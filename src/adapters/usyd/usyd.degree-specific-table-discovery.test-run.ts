import {
  discoverUsydDegreeSpecificTables,
  type UsydDegreeSpecificTableCategory,
} from './usyd.degree-specific-table-discovery';

import {
  fetchUsydGlobalUnitTable,
} from './usyd.global-unit-table-parser';

/**
 * ------------------------------------------------
 * USYD UNDERGRADUATE DEGREE-SPECIFIC TABLE AUDIT
 * ------------------------------------------------
 */

const CATEGORIES:
  UsydDegreeSpecificTableCategory[] = [
    'ARCHITECTURE',
    'MEDICINE_HEALTH',
    'LAW',
  ];

function divider(): void {
  console.log(
    '================================',
  );
}

function isPurePostgraduateUrl(
  url: string,
): boolean {
  try {
    const pathname =
      new URL(
        url,
      ).pathname.toLowerCase();

    return (
      pathname.startsWith(
        '/handbooks/medicine-health-pg/',
      ) ||
      pathname ===
        '/handbooks/medicine-health-pg.html' ||
      pathname.includes(
        '/law/postgraduate/',
      )
    );
  } catch {
    return true;
  }
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD UNDERGRADUATE DEGREE-SPECIFIC TABLE AUDIT',
  );

  divider();

  const tables =
    await discoverUsydDegreeSpecificTables();

  /**
   * ------------------------------------------------
   * TABLE COUNTS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'TABLES BY HANDBOOK',
  );

  divider();

  for (
    const category
    of CATEGORIES
  ) {
    const items =
      tables.filter(
        (item) =>
          item.handbookCategory ===
          category,
      );

    console.log(
      `${category}: ${items.length}`,
    );
  }

  /**
   * ------------------------------------------------
   * PURE PG LEAKS
   * ------------------------------------------------
   */

  const postgraduateLeaks =
    tables.filter(
      (item) =>
        isPurePostgraduateUrl(
          item.tableUrl,
        ) ||
        isPurePostgraduateUrl(
          item.sourcePageUrl,
        ),
    );

  divider();

  console.log(
    'PURE POSTGRADUATE TABLE LEAKS',
  );

  divider();

  if (
    postgraduateLeaks.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const leak
      of postgraduateLeaks
    ) {
      console.log(
        `${leak.handbookCategory} / ${leak.courseName}`,
      );

      console.log(
        `  table: ${leak.tableUrl}`,
      );

      console.log(
        `  source: ${leak.sourcePageUrl}`,
      );

      console.log('');
    }
  }

  /**
   * ------------------------------------------------
   * KNOWN PG TITLES
   * ------------------------------------------------
   */

  const knownPostgraduateOnlyNames =
    [
      /^Juris Doctor$/i,
      /^Master of Laws$/i,
      /^Master of Taxation$/i,
      /^Master of Business Law$/i,
      /^Master of Administrative Law and Policy$/i,
      /^Master of Environmental Law$/i,
      /^Master of Health Law$/i,
      /^Master of International Law$/i,
      /^Master of Labour Law and Relations$/i,
      /^Master of Criminology$/i,
      /^Advanced Surgery/i,
      /^Bioethics$/i,
      /^Biostatistics$/i,
      /^Brain and Mind Sciences$/i,
      /^Clinical Epidemiology$/i,
      /^Clinical Neurophysiology$/i,
      /^Critical Care Medicine$/i,
      /^Genomics and Precision Medicine$/i,
      /^Global Health$/i,
      /^Internal Medicine$/i,
      /^Pain Management$/i,
      /^Sleep Medicine$/i,
      /^Trauma-Informed Psychotherapy$/i,
    ];

  const suspiciousPgNames =
    tables.filter(
      (item) =>
        knownPostgraduateOnlyNames.some(
          (pattern) =>
            pattern.test(
              item.courseName,
            ),
        ),
    );

  divider();

  console.log(
    'KNOWN POSTGRADUATE-ONLY COURSE NAMES',
  );

  divider();

  if (
    suspiciousPgNames.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const item
      of suspiciousPgNames
    ) {
      console.log(
        `${item.handbookCategory} / ${item.courseName}`,
      );

      console.log(
        `  ${item.tableUrl}`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * DUPLICATES
   * ------------------------------------------------
   */

  const tableUrlMap =
    new Map<
      string,
      number
    >();

  for (
    const table
    of tables
  ) {
    const key =
      [
        table.handbookCategory,
        table.tableUrl,
      ].join(
        '::',
      );

    tableUrlMap.set(
      key,

      (
        tableUrlMap.get(
          key,
        ) ??
        0
      ) +
      1,
    );
  }

  const duplicateUrls =
    [
      ...tableUrlMap.entries(),
    ].filter(
      (
        [
          ,
          count,
        ],
      ) =>
        count >
        1,
    );

  divider();

  console.log(
    'DUPLICATE TABLE URLS',
  );

  divider();

  if (
    duplicateUrls.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const [
        key,
        count,
      ]
      of duplicateUrls
    ) {
      console.log(
        `${count} x ${key}`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * SAMPLE TABLES
   * ------------------------------------------------
   */

  divider();

  console.log(
    'SAMPLE TABLES',
  );

  divider();

  for (
    const category
    of CATEGORIES
  ) {
    console.log(
      category,
    );

    const sample =
      tables
        .filter(
          (item) =>
            item.handbookCategory ===
            category,
        )
        .slice(
          0,
          10,
        );

    for (
      const item
      of sample
    ) {
      console.log(
        `  ${item.courseName}`,
      );

      console.log(
        `    ${item.tableUrl}`,
      );

      console.log(
        `    source: ${item.sourcePageUrl}`,
      );
    }

    console.log('');
  }

  /**
   * ------------------------------------------------
   * PARSE ALL TABLES
   * ------------------------------------------------
   */

  const failures:
    Array<{
      category:
        UsydDegreeSpecificTableCategory;

      courseName:
        string;

      url:
        string;

      error:
        string;
    }> =
    [];

  const zeroUnitTables:
    Array<{
      category:
        UsydDegreeSpecificTableCategory;

      courseName:
        string;

      url:
        string;
    }> =
    [];

  const globalUnitCodes =
    new Set<string>();

  let totalOccurrences =
    0;

  const parsedByCategory =
    new Map<
      UsydDegreeSpecificTableCategory,
      {
        tables: number;

        successful: number;

        zeroUnit: number;

        uniqueCodes:
          Set<string>;
      }
    >();

  for (
    const category
    of CATEGORIES
  ) {
    parsedByCategory.set(
      category,
      {
        tables:
          0,

        successful:
          0,

        zeroUnit:
          0,

        uniqueCodes:
          new Set<string>(),
      },
    );
  }

  for (
    let index = 0;
    index <
    tables.length;
    index += 1
  ) {
    const table =
      tables[
        index
      ];

    console.log(
      `[USYD degree table parser] ${index + 1}/${tables.length} ` +
      `${table.handbookCategory} / ${table.courseName}`,
    );

    const stats =
      parsedByCategory.get(
        table.handbookCategory,
      );

    if (
      stats
    ) {
      stats.tables +=
        1;
    }

    try {
      const parsed =
        await fetchUsydGlobalUnitTable(
          table.tableUrl,
        );

      if (
        stats
      ) {
        stats.successful +=
          1;
      }

      if (
        parsed.uniqueUnitCount ===
        0
      ) {
        zeroUnitTables.push({
          category:
            table.handbookCategory,

          courseName:
            table.courseName,

          url:
            table.tableUrl,
        });

        if (
          stats
        ) {
          stats.zeroUnit +=
            1;
        }
      }

      totalOccurrences +=
        parsed.unitOccurrenceCount;

      for (
        const code
        of parsed.uniqueUnitCodes
      ) {
        globalUnitCodes.add(
          code,
        );

        stats
          ?.uniqueCodes
          .add(
            code,
          );
      }
    } catch (
      error
    ) {
      failures.push({
        category:
          table.handbookCategory,

        courseName:
          table.courseName,

        url:
          table.tableUrl,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });
    }
  }

  /**
   * ------------------------------------------------
   * BY CATEGORY
   * ------------------------------------------------
   */

  divider();

  console.log(
    'PARSE RESULT BY HANDBOOK',
  );

  divider();

  for (
    const category
    of CATEGORIES
  ) {
    const stats =
      parsedByCategory.get(
        category,
      );

    if (
      !stats
    ) {
      continue;
    }

    console.log(
      category,
    );

    console.log(
      `  Tables: ${stats.tables}`,
    );

    console.log(
      `  Parsed: ${stats.successful}`,
    );

    console.log(
      `  Zero-unit tables: ${stats.zeroUnit}`,
    );

    console.log(
      `  Unique unit codes: ${stats.uniqueCodes.size}`,
    );

    console.log('');
  }

  /**
   * ------------------------------------------------
   * FAILURES
   * ------------------------------------------------
   */

  divider();

  console.log(
    'FAILED TABLE PARSES',
  );

  divider();

  if (
    failures.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const failure
      of failures
    ) {
      console.log(
        `${failure.category} / ${failure.courseName}`,
      );

      console.log(
        `  ${failure.url}`,
      );

      console.log(
        `  ${failure.error}`,
      );

      console.log('');
    }
  }

  /**
   * ------------------------------------------------
   * ZERO UNITS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'TABLES WITH ZERO UNITS',
  );

  divider();

  if (
    zeroUnitTables.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const table
      of zeroUnitTables
    ) {
      console.log(
        `${table.category} / ${table.courseName}`,
      );

      console.log(
        `  ${table.url}`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * EMPTY CATEGORIES
   * ------------------------------------------------
   */

  const emptyCategories =
    CATEGORIES.filter(
      (category) =>
        tables.filter(
          (table) =>
            table.handbookCategory ===
            category,
        ).length ===
        0,
    );

  divider();

  console.log(
    'CATEGORIES WITH ZERO TABLES',
  );

  divider();

  if (
    emptyCategories.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const category
      of emptyCategories
    ) {
      console.log(
        category,
      );
    }
  }

  /**
   * ------------------------------------------------
   * FINAL
   * ------------------------------------------------
   */

  divider();

  console.log(
    'FINAL UNDERGRADUATE DEGREE-SPECIFIC TABLE AUDIT',
  );

  divider();

  console.log(
    `Discovered table URLs: ${tables.length}`,
  );

  console.log(
    `Parsed successfully: ${tables.length - failures.length}`,
  );

  console.log(
    `Parser failures: ${failures.length}`,
  );

  console.log(
    `Zero-unit tables: ${zeroUnitTables.length}`,
  );

  console.log(
    `Unit occurrences: ${totalOccurrences}`,
  );

  console.log(
    `Unique undergraduate degree-specific unit codes: ${globalUnitCodes.size}`,
  );

  console.log(
    `Categories with zero tables: ${emptyCategories.length}`,
  );

  console.log(
    `Pure postgraduate leaks: ${postgraduateLeaks.length}`,
  );

  console.log(
    `Known postgraduate-only names: ${suspiciousPgNames.length}`,
  );

  const hardFailure =
    tables.length ===
      0 ||
    emptyCategories.length >
      0 ||
    failures.length >
      0 ||
    postgraduateLeaks.length >
      0 ||
    suspiciousPgNames.length >
      0;

  console.log('');

  console.log(
    `RESULT: ${
      hardFailure
        ? 'FAIL'
        : 'PASS'
    }`,
  );

  if (
    !hardFailure &&
    zeroUnitTables.length >
      0
  ) {
    console.log(
      'UNDERGRADUATE DEGREE TABLE STATUS: REVIEW',
    );
  } else if (
    !hardFailure
  ) {
    console.log(
      'UNDERGRADUATE DEGREE TABLE STATUS: CLEAN',
    );
  }

  if (
    hardFailure
  ) {
    process.exitCode =
      1;
  }
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);