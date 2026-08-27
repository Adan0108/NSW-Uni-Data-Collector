import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const AUTHORITATIVE_ROLE_FILE = path.join(
  DATA_DIR,
  'usyd-unqualified-table-a-authoritative-role-catalog.json',
);

const COMPONENT_FILE = path.join(
  DATA_DIR,
  'usyd-components-complete.json',
);

type UnknownRecord = Record<string, unknown>;

type ComponentRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM';

type TableAScope =
  | 'ARTS'
  | 'BUSINESS'
  | 'COMPUTING'
  | 'CONSERVATORIUM'
  | 'ENGINEERING'
  | 'SCIENCE';

interface AuthoritativeRolePool {
  scope: TableAScope;
  role: ComponentRole;
  names: string[];
  sourceUrls: string[];
  notes: string[];
}

interface AuthoritativeRoleCatalog {
  pools: AuthoritativeRolePool[];
}

interface ComponentRecord {
  index: number;
  name: string;
  type: string;
  handbook: string;
  sourceUrl: string | null;
}

export interface UsydRoleSupplement {
  name: string;
  type: ComponentRole;
  handbook: string;

  tableAScope:
    TableAScope;

  sourceUrl: string;

  sourceEvidence:
    'AUTHORITATIVE_CENTRAL_ROLE_CATALOG';

  sourceFamily:
    {
      found: boolean;
      sourceType: string | null;
      sourceUrl: string | null;
    };

  requirementsSourceResolved:
    boolean;

  reason:
    'MISSING_EXACT_ROLE';
}

export interface UsydAuthoritativeRoleSupplementResult {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    authoritativeRoleIdentities: number;
    exactExisting: number;
    supplementsNeeded: number;
    supplementsWithFamilySource: number;
    supplementsCentralSourceOnly: number;
    duplicateSupplementKeys: number;
  };

  existing: Array<{
    scope: TableAScope;
    role: ComponentRole;
    name: string;
    handbook: string;
  }>;

  supplements:
    UsydRoleSupplement[];
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asString(
  value: unknown,
): string | null {
  return (
    typeof value === 'string' &&
    value.trim()
  )
    ? value.trim()
    : null;
}

function firstString(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value =
      asString(
        record[key],
      );

    if (value) {
      return value;
    }
  }

  return null;
}

async function readJson(
  filePath: string,
): Promise<unknown> {
  const raw =
    await fs.readFile(
      filePath,
      'utf8',
    );

  return JSON.parse(raw) as unknown;
}

function canonical(
  value: string,
): string {
  return value
    .normalize('NFKC')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase(
      'en-AU',
    );
}

function sourceHandbookForScope(
  scope: TableAScope,
): string {
  switch (scope) {
    case 'ARTS':
      return 'ARTS';

    case 'BUSINESS':
      return 'BUSINESS';

    case 'COMPUTING':
      return 'ENGINEERING';

    case 'CONSERVATORIUM':
      return 'CONSERVATORIUM';

    case 'ENGINEERING':
      return 'ENGINEERING';

    case 'SCIENCE':
      return 'SCIENCE';
  }
}

async function loadAuthoritativeRoles():
Promise<AuthoritativeRoleCatalog> {
  const value =
    await readJson(
      AUTHORITATIVE_ROLE_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(
      value.pools,
    )
  ) {
    throw new Error(
      'Authoritative Table A role catalog is missing pools[]. Run the V4 writer first.',
    );
  }

  return {
    pools:
      value.pools as
        AuthoritativeRolePool[],
  };
}

async function loadComponents():
Promise<ComponentRecord[]> {
  const value =
    await readJson(
      COMPONENT_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(
      value.components,
    )
  ) {
    throw new Error(
      'USYD complete component catalogue is missing components[].',
    );
  }

  const output:
    ComponentRecord[] =
    [];

  value.components.forEach(
    (
      item,
      index,
    ) => {
      if (!isRecord(item)) {
        return;
      }

      const name =
        firstString(
          item,
          [
            'name',
            'title',
            'componentName',
          ],
        );

      const type =
        firstString(
          item,
          [
            'type',
            'componentType',
          ],
        );

      const handbook =
        firstString(
          item,
          [
            'handbook',
            'handbookCategory',
            'category',
          ],
        );

      if (
        !name ||
        !type ||
        !handbook
      ) {
        return;
      }

      output.push({
        index,

        name,

        type:
          type.toUpperCase(),

        handbook:
          handbook.toUpperCase(),

        sourceUrl:
          firstString(
            item,
            [
              'sourceUrl',
              'overviewUrl',
              'url',
              'tableUrl',
            ],
          ),
      });
    },
  );

  return output;
}

export async function buildUsydAuthoritativeTableARoleSupplements():
Promise<UsydAuthoritativeRoleSupplementResult> {
  const [
    authoritative,
    components,
  ] =
    await Promise.all([
      loadAuthoritativeRoles(),
      loadComponents(),
    ]);

  const existing:
    UsydAuthoritativeRoleSupplementResult['existing'] =
    [];

  const supplements:
    UsydRoleSupplement[] =
    [];

  let authoritativeRoleIdentities =
    0;

  for (
    const pool
    of authoritative.pools
  ) {
    const handbook =
      sourceHandbookForScope(
        pool.scope,
      );

    const centralSourceUrl =
      pool.sourceUrls[0];

    if (!centralSourceUrl) {
      throw new Error(
        `${pool.scope}/${pool.role} has no authoritative source URL.`,
      );
    }

    for (
      const roleName
      of pool.names
    ) {
      authoritativeRoleIdentities +=
        1;

      const exact =
        components.find(
          (component) =>
            component.handbook ===
              handbook &&
            component.type ===
              pool.role &&
            canonical(
              component.name,
            ) ===
              canonical(
                roleName,
              ),
        );

      if (exact) {
        existing.push({
          scope:
            pool.scope,

          role:
            pool.role,

          name:
            roleName,

          handbook,
        });

        continue;
      }

      /**
       * Find a same-handbook family record with another role.
       * This is useful as a detailed requirement/source-page pointer,
       * but it does NOT supply role authority. Role authority comes only
       * from the central 2026 role catalog.
       */
      const family =
        components.find(
          (component) =>
            component.handbook ===
              handbook &&
            canonical(
              component.name,
            ) ===
              canonical(
                roleName,
              ),
        );

      supplements.push({
        name:
          roleName,

        type:
          pool.role,

        handbook,

        tableAScope:
          pool.scope,

        sourceUrl:
          centralSourceUrl,

        sourceEvidence:
          'AUTHORITATIVE_CENTRAL_ROLE_CATALOG',

        sourceFamily: {
          found:
            family !==
            undefined,

          sourceType:
            family?.type ??
            null,

          sourceUrl:
            family?.sourceUrl ??
            null,
        },

        requirementsSourceResolved:
          Boolean(
            family?.sourceUrl,
          ),

        reason:
          'MISSING_EXACT_ROLE',
      });
    }
  }

  const supplementKeys =
    supplements.map(
      (supplement) =>
        [
          supplement.handbook,
          supplement.type,
          canonical(
            supplement.name,
          ),
        ].join('|'),
    );

  const duplicateSupplementKeys =
    supplementKeys.length -
    new Set(
      supplementKeys,
    ).size;

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      authoritativeRoleIdentities,

      exactExisting:
        existing.length,

      supplementsNeeded:
        supplements.length,

      supplementsWithFamilySource:
        supplements.filter(
          (supplement) =>
            supplement.requirementsSourceResolved,
        ).length,

      supplementsCentralSourceOnly:
        supplements.filter(
          (supplement) =>
            !supplement.requirementsSourceResolved,
        ).length,

      duplicateSupplementKeys,
    },

    existing:
      existing.sort(
        (
          left,
          right,
        ) =>
          left.scope.localeCompare(
            right.scope,
          ) ||
          left.role.localeCompare(
            right.role,
          ) ||
          left.name.localeCompare(
            right.name,
          ),
      ),

    supplements:
      supplements.sort(
        (
          left,
          right,
        ) =>
          left.tableAScope.localeCompare(
            right.tableAScope,
          ) ||
          left.type.localeCompare(
            right.type,
          ) ||
          left.name.localeCompare(
            right.name,
          ),
      ),
  };
}

export async function writeUsydAuthoritativeTableARoleSupplements():
Promise<void> {
  const result =
    await buildUsydAuthoritativeTableARoleSupplements();

  if (
    result.counts.duplicateSupplementKeys !==
    0
  ) {
    throw new Error(
      `Refusing to write supplements: ${result.counts.duplicateSupplementKeys} duplicate supplement keys.`,
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-authoritative-table-a-role-supplements.json',
    );

  const temporary =
    `${outputFile}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      result,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    outputFile,
  );

  console.log(
    '[USYD authoritative Table A role supplements] PASS',
  );

  console.log(
    `Authoritative role identities: ${result.counts.authoritativeRoleIdentities}`,
  );

  console.log(
    `Exact existing: ${result.counts.exactExisting}`,
  );

  console.log(
    `Supplements needed: ${result.counts.supplementsNeeded}`,
  );

  console.log(
    `Supplements with family source: ${result.counts.supplementsWithFamilySource}`,
  );

  console.log(
    `Central-source-only supplements: ${result.counts.supplementsCentralSourceOnly}`,
  );

  console.log(
    `Duplicate supplement keys: ${result.counts.duplicateSupplementKeys}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
