/**
 * USYD degree-specific table ownership mapper.
 *
 * Purpose:
 * - Reuse the existing `usyd.degree-specific-table-discovery.ts`.
 * - Convert the 37 undergraduate Architecture / Medicine & Health / Law
 *   table discoveries into stable ownership records.
 * - Never guess a degree code.
 * - Preserve DIRECT vs SHARED ownership explicitly.
 *
 * Important:
 * This stage maps TABLE -> canonical course/owner page.
 * Degree-code linking can happen in the master collector using the global
 * degree dataset and the owner page/source URLs.
 */

export type UsydDegreeTableOwnershipStatus =
  | 'DIRECT'
  | 'SHARED'
  | 'UNRESOLVED';

export type UsydDegreeTableHandbook =
  | 'ARCHITECTURE'
  | 'MEDICINE_HEALTH'
  | 'LAW';

export interface UsydDegreeSpecificTableRecord {
  handbook: UsydDegreeTableHandbook;
  degreeTitle: string;
  tableUrl: string;
  sourceUrl: string;
}

export interface UsydDegreeTableOwnership {
  handbook: UsydDegreeTableHandbook;

  degreeTitle: string;

  tableUrl: string;

  sourceUrl: string;

  /**
   * Stable course/owner grouping key.
   *
   * Examples:
   * ARCHITECTURE:b-architecture-environments
   * MEDICINE_HEALTH:exercise-physiology
   * LAW:undergraduate-coursework
   */
  ownerKey: string | null;

  /**
   * Canonical owner page used for later linking to the global degree dataset.
   *
   * This is intentionally a handbook URL, not an inferred degree code.
   */
  ownerPageUrl: string | null;

  status: UsydDegreeTableOwnershipStatus;

  /**
   * Human-readable reason for DIRECT / SHARED / UNRESOLVED.
   */
  reason: string;
}

export interface UsydDegreeTableOwnershipResult {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  discoveredTableCount: number;
  mappedTableCount: number;
  directCount: number;
  sharedCount: number;
  unresolvedCount: number;

  ownership: UsydDegreeTableOwnership[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringValue(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (
    const key
    of keys
  ) {
    const value =
      record[key];

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function normaliseHandbook(
  value: string | null,
): UsydDegreeTableHandbook | null {
  if (
    !value
  ) {
    return null;
  }

  const normalized =
    value
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        '_',
      );

  if (
    normalized ===
    'ARCHITECTURE'
  ) {
    return 'ARCHITECTURE';
  }

  if (
    normalized ===
      'MEDICINE_HEALTH' ||
    normalized ===
      'MEDICINE_AND_HEALTH' ||
    normalized ===
      'MEDICINEHEALTH'
  ) {
    return 'MEDICINE_HEALTH';
  }

  if (
    normalized ===
    'LAW'
  ) {
    return 'LAW';
  }

  return null;
}

function uniqueByTableUrl(
  rows: UsydDegreeSpecificTableRecord[],
): UsydDegreeSpecificTableRecord[] {
  const seen =
    new Set<string>();

  const unique:
    UsydDegreeSpecificTableRecord[] =
    [];

  for (
    const row
    of rows
  ) {
    if (
      seen.has(
        row.tableUrl,
      )
    ) {
      continue;
    }

    seen.add(
      row.tableUrl,
    );

    unique.push(
      row,
    );
  }

  return unique;
}

function collectCandidateObjects(
  value: unknown,
  output:
    UnknownRecord[],
): void {
  if (
    Array.isArray(
      value,
    )
  ) {
    for (
      const item
      of value
    ) {
      collectCandidateObjects(
        item,
        output,
      );
    }

    return;
  }

  if (
    !isRecord(
      value,
    )
  ) {
    return;
  }

  /**
   * A discovery record always needs at least a URL-looking field.
   * We still recurse because some discovery functions return:
   *
   * {
   *   tables: [...]
   * }
   *
   * or:
   *
   * {
   *   architecture: [...],
   *   medicineHealth: [...],
   *   law: [...]
   * }
   */
  const possibleTableUrl =
    stringValue(
      value,
      [
        'tableUrl',
        'url',
        'unitTableUrl',
        'unitOfStudyTableUrl',
      ],
    );

  if (
    possibleTableUrl?.includes(
      'sydney.edu.au/handbooks/',
    )
  ) {
    output.push(
      value,
    );
  }

  for (
    const nested
    of Object.values(
      value,
    )
  ) {
    if (
      typeof nested ===
        'object' &&
      nested !==
        null
    ) {
      collectCandidateObjects(
        nested,
        output,
      );
    }
  }
}

function inferHandbookFromUrl(
  url: string,
): UsydDegreeTableHandbook | null {
  if (
    url.includes(
      '/handbooks/architecture/',
    )
  ) {
    return 'ARCHITECTURE';
  }

  if (
    url.includes(
      '/handbooks/medicine-health/',
    )
  ) {
    return 'MEDICINE_HEALTH';
  }

  if (
    url.includes(
      '/handbooks/law/',
    )
  ) {
    return 'LAW';
  }

  return null;
}

function normalizeDiscoveryOutput(
  value: unknown,
): UsydDegreeSpecificTableRecord[] {
  const objects:
    UnknownRecord[] =
    [];

  collectCandidateObjects(
    value,
    objects,
  );

  const rows:
    UsydDegreeSpecificTableRecord[] =
    [];

  for (
    const record
    of objects
  ) {
    const tableUrl =
      stringValue(
        record,
        [
          'tableUrl',
          'url',
          'unitTableUrl',
          'unitOfStudyTableUrl',
        ],
      );

    if (
      !tableUrl ||
      !/unit-of-study-table\.html(?:[?#].*)?$/i.test(
        tableUrl,
      )
    ) {
      continue;
    }

    const sourceUrl =
      stringValue(
        record,
        [
          'sourceUrl',
          'source',
          'discoveredFrom',
          'parentUrl',
          'pageUrl',
        ],
      ) ??
      tableUrl;

    const degreeTitle =
      stringValue(
        record,
        [
          'degreeTitle',
          'degreeName',
          'title',
          'name',
          'courseTitle',
        ],
      ) ??
      'Unknown';

    const handbook =
      normaliseHandbook(
        stringValue(
          record,
          [
            'handbook',
            'category',
            'handbookCategory',
          ],
        ),
      ) ??
      inferHandbookFromUrl(
        tableUrl,
      ) ??
      inferHandbookFromUrl(
        sourceUrl,
      );

    if (
      !handbook
    ) {
      continue;
    }

    rows.push({
      handbook,
      degreeTitle,
      tableUrl,
      sourceUrl,
    });
  }

  return uniqueByTableUrl(
    rows,
  );
}

/**
 * The earlier project versions used slightly different export names while
 * discovery was being refined. Keeping this tiny compatibility loader means
 * the mapper does not require changing the already-working discovery file.
 */
async function loadDegreeSpecificTableDiscovery():
Promise<UsydDegreeSpecificTableRecord[]> {
  const discoveryModulePath =
    './usyd.degree-specific-table-discovery';

  const module =
    await import(
      discoveryModulePath
    ) as UnknownRecord;

  const candidateNames =
    [
      'discoverUsydDegreeSpecificTables',
      'discoverUsydUndergraduateDegreeSpecificTables',
      'discoverDegreeSpecificTables',
      'collectUsydDegreeSpecificTables',
      'default',
    ];

  let raw:
    unknown = null;

  for (
    const candidateName
    of candidateNames
  ) {
    const candidate =
      module[
        candidateName
      ];

    if (
      typeof candidate !==
      'function'
    ) {
      continue;
    }

    raw =
      await (
        candidate as
        () => Promise<unknown>
      )();

    break;
  }

  if (
    raw ===
    null
  ) {
    throw new Error(
      [
        'Could not find the degree-specific table discovery export.',
        `Tried: ${candidateNames.join(', ')}`,
        'Open usyd.degree-specific-table-discovery.ts and export the working discovery function under one of those names.',
      ].join(
        ' ',
      ),
    );
  }

  const normalized =
    normalizeDiscoveryOutput(
      raw,
    );

  if (
    normalized.length ===
    0
  ) {
    throw new Error(
      'Degree-specific table discovery returned no normalisable undergraduate table records.',
    );
  }

  return normalized;
}

function getPathSegments(
  url: string,
): string[] {
  try {
    return new URL(
      url,
    ).pathname
      .split(
        '/',
      )
      .filter(
        Boolean,
      );
  } catch {
    return [];
  }
}

function makeSydneyUrl(
  pathname: string,
): string {
  return (
    'https://www.sydney.edu.au' +
    (
      pathname.startsWith(
        '/',
      )
        ? pathname
        : `/${pathname}`
    )
  );
}

function mapArchitecture(
  table:
    UsydDegreeSpecificTableRecord,
): UsydDegreeTableOwnership {
  const segments =
    getPathSegments(
      table.tableUrl,
    );

  const undergraduateIndex =
    segments.indexOf(
      'undergraduate',
    );

  const slug =
    undergraduateIndex >=
        0
      ? segments[
          undergraduateIndex +
          1
        ] ??
        null
      : null;

  if (
    !slug
  ) {
    return {
      ...table,
      ownerKey:
        null,
      ownerPageUrl:
        null,
      status:
        'UNRESOLVED',
      reason:
        'Could not derive Architecture undergraduate course slug from table URL.',
    };
  }

  return {
    ...table,

    ownerKey:
      `ARCHITECTURE:${slug}`,

    ownerPageUrl:
      makeSydneyUrl(
        `/handbooks/architecture/undergraduate/${slug}/overview.html`,
      ),

    status:
      'DIRECT',

    reason:
      'Architecture degree-specific table is contained inside one undergraduate course route.',
  };
}

function findMedicineCourseRoute(
  table:
    UsydDegreeSpecificTableRecord,
): {
  section:
    'coursework'
    | 'honours';
  slug:
    string;
} | null {
  for (
    const url
    of [
      table.tableUrl,
      table.sourceUrl,
    ]
  ) {
    const segments =
      getPathSegments(
        url,
      );

    for (
      const section
      of [
        'coursework',
        'honours',
      ] as const
    ) {
      const index =
        segments.indexOf(
          section,
        );

      const slug =
        index >=
          0
          ? segments[
              index +
              1
            ]
          : undefined;

      if (
        slug
      ) {
        return {
          section,
          slug,
        };
      }
    }
  }

  return null;
}

function mapMedicineHealth(
  table:
    UsydDegreeSpecificTableRecord,
): UsydDegreeTableOwnership {
  const route =
    findMedicineCourseRoute(
      table,
    );

  if (
    !route
  ) {
    return {
      ...table,
      ownerKey:
        null,
      ownerPageUrl:
        null,
      status:
        'UNRESOLVED',
      reason:
        'Could not derive Medicine & Health coursework/honours course route.',
    };
  }

  return {
    ...table,

    ownerKey:
      `MEDICINE_HEALTH:${route.section}:${route.slug}`,

    ownerPageUrl:
      makeSydneyUrl(
        `/handbooks/medicine-health/${route.section}/${route.slug}/overview.html`,
      ),

    status:
      'DIRECT',

    reason:
      'Medicine & Health table is contained inside one coursework/honours course route.',
  };
}

function mapLaw(
  table:
    UsydDegreeSpecificTableRecord,
): UsydDegreeTableOwnership {
  const isUndergraduate =
    table.tableUrl.includes(
      '/handbooks/law/undergraduate/',
    );

  if (
    !isUndergraduate
  ) {
    return {
      ...table,
      ownerKey:
        null,
      ownerPageUrl:
        null,
      status:
        'UNRESOLVED',
      reason:
        'Law table was not inside the undergraduate handbook route.',
    };
  }

  return {
    ...table,

    ownerKey:
      'LAW:undergraduate-coursework',

    ownerPageUrl:
      'https://www.sydney.edu.au/handbooks/law/undergraduate.html',

    status:
      'SHARED',

    reason:
      'The Law compulsory/elective tables are shared undergraduate coursework tables rather than a one-degree-only table.',
  };
}

export function mapUsydDegreeSpecificTableOwnership(
  tables:
    UsydDegreeSpecificTableRecord[],
): UsydDegreeTableOwnershipResult {
  const ownership =
    tables.map(
      (
        table,
      ): UsydDegreeTableOwnership => {
        switch (
          table.handbook
        ) {
          case 'ARCHITECTURE':
            return mapArchitecture(
              table,
            );

          case 'MEDICINE_HEALTH':
            return mapMedicineHealth(
              table,
            );

          case 'LAW':
            return mapLaw(
              table,
            );
        }
      },
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date()
        .toISOString(),

    discoveredTableCount:
      tables.length,

    mappedTableCount:
      ownership.filter(
        (
          item,
        ) =>
          item.status !==
          'UNRESOLVED',
      ).length,

    directCount:
      ownership.filter(
        (
          item,
        ) =>
          item.status ===
          'DIRECT',
      ).length,

    sharedCount:
      ownership.filter(
        (
          item,
        ) =>
          item.status ===
          'SHARED',
      ).length,

    unresolvedCount:
      ownership.filter(
        (
          item,
        ) =>
          item.status ===
          'UNRESOLVED',
      ).length,

    ownership,
  };
}

export async function collectUsydDegreeTableOwnership():
Promise<UsydDegreeTableOwnershipResult> {
  const tables =
    await loadDegreeSpecificTableDiscovery();

  return mapUsydDegreeSpecificTableOwnership(
    tables,
  );
}
