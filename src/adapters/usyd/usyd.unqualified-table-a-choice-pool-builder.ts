import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const SCOPE_AUDIT_FILE = path.join(
  DATA_DIR,
  'usyd-unqualified-table-a-scope-dedup-audit.json',
);

const AUTHORITATIVE_ROLE_FILE = path.join(
  DATA_DIR,
  'usyd-unqualified-table-a-authoritative-role-catalog.json',
);

const SUPPLEMENT_FILE = path.join(
  DATA_DIR,
  'usyd-authoritative-table-a-role-supplements.json',
);

const COMPONENT_FILE = path.join(
  DATA_DIR,
  'usyd-components-complete.json',
);

const RECONCILED_QUALIFIED_FILE = path.join(
  DATA_DIR,
  'usyd-qualified-table-a-degree-component-choices.reconciled.json',
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

interface ScopeAuditRecord {
  degreeCode: string;
  degreeTitle: string;
  componentType: ComponentRole;
  semanticClass:
    | 'DIRECT_TABLE_A_COMPONENT_CHOICE'
    | 'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE'
    | 'CROSS_FACULTY_TABLE_A_COMPONENT_CHOICE';
  raw: string;
  resolution:
    | 'EXACT_SCOPE'
    | 'MULTI_SCOPE_EXPLICIT'
    | 'ALREADY_COVERED_BY_QUALIFIED_POOL'
    | 'AMBIGUOUS_SCOPE'
    | 'NO_SCOPE_EVIDENCE';
  resolvedScopes: TableAScope[];
  dedupAgainstQualified: boolean;
}

interface AuthoritativeRolePool {
  scope: TableAScope;
  role: ComponentRole;
  names: string[];
  sourceUrls: string[];
}

interface ComponentRecord {
  name: string;
  type: string;
  handbook: string;
  sourceUrl: string | null;
}

interface SupplementRecord {
  name: string;
  type: ComponentRole;
  handbook: string;
  tableAScope: TableAScope;
  sourceUrl: string;
  sourceFamily: {
    found: boolean;
    sourceType: string | null;
    sourceUrl: string | null;
  };
  requirementsSourceResolved: boolean;
}

interface QualifiedChoice {
  degreeCode: string;
  tableName: string;
  requestedComponentType: string;
  candidates: Array<{
    componentName: string;
  }>;
}

export interface UsydUnqualifiedTableAChoiceCandidate {
  name: string;
  type: ComponentRole;
  scope: TableAScope;
  handbook: string;

  sourceUrl: string | null;

  identitySource:
    | 'EXISTING_COMPONENT'
    | 'AUTHORITATIVE_ROLE_SUPPLEMENT';

  requirementsSourceResolved:
    boolean;
}

export interface UsydUnqualifiedTableAChoicePool {
  degreeCode: string;
  degreeTitle: string;

  role: ComponentRole;

  semanticClass:
    ScopeAuditRecord['semanticClass'];

  sourceRaw: string;

  scopes:
    TableAScope[];

  candidates:
    UsydUnqualifiedTableAChoiceCandidate[];

  candidateCount: number;

  tableSAlsoAllowed:
    boolean;

  crossFaculty:
    boolean;
}

export interface UsydUnqualifiedTableAChoicePoolDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    eligibleSignals: number;
    choicePools: number;
    degrees: number;
    totalCandidateOccurrences: number;

    exactScopePools: number;
    multiScopePools: number;

    tableSAlsoAllowedPools: number;
    crossFacultyPools: number;

    duplicatePoolKeys: number;
    emptyPools: number;

    candidateIdentitiesExisting: number;
    candidateIdentitiesSupplemented: number;
    candidatesWithoutRequirementSource: number;

    qualifiedDuplicatesExcluded: number;
  };

  pools:
    UsydUnqualifiedTableAChoicePool[];
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

function handbookForScope(
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

async function loadScopeAudit():
Promise<ScopeAuditRecord[]> {
  const value =
    await readJson(
      SCOPE_AUDIT_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(
      value.records,
    )
  ) {
    throw new Error(
      'USYD unqualified Table A scope audit is missing records[].',
    );
  }

  return value.records as
    ScopeAuditRecord[];
}

async function loadAuthoritativeRoles():
Promise<AuthoritativeRolePool[]> {
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
      'USYD authoritative Table A role catalog is missing pools[].',
    );
  }

  return value.pools as
    AuthoritativeRolePool[];
}

async function loadSupplements():
Promise<SupplementRecord[]> {
  const value =
    await readJson(
      SUPPLEMENT_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(
      value.supplements,
    )
  ) {
    throw new Error(
      'USYD authoritative Table A supplement file is missing supplements[].',
    );
  }

  return value.supplements as
    SupplementRecord[];
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
      'USYD complete component catalog is missing components[].',
    );
  }

  return value.components
    .filter(isRecord)
    .map(
      (item) => ({
        name:
          String(
            item.name ??
            item.title ??
            item.componentName ??
            '',
          ),

        type:
          String(
            item.type ??
            item.componentType ??
            '',
          ).toUpperCase(),

        handbook:
          String(
            item.handbook ??
            item.handbookCategory ??
            item.category ??
            '',
          ).toUpperCase(),

        sourceUrl:
          typeof item.sourceUrl ===
          'string'
            ? item.sourceUrl
            : typeof item.overviewUrl ===
              'string'
              ? item.overviewUrl
              : typeof item.url ===
                'string'
                ? item.url
                : null,
      }),
    )
    .filter(
      (item) =>
        item.name &&
        item.type &&
        item.handbook,
    );
}

async function loadQualifiedChoices():
Promise<QualifiedChoice[]> {
  const value =
    await readJson(
      RECONCILED_QUALIFIED_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(
      value.choices,
    )
  ) {
    throw new Error(
      'Reconciled qualified Table A choice file is missing choices[]. Run the reconciliation writer first.',
    );
  }

  return value.choices as
    QualifiedChoice[];
}

function authoritativePoolFor(
  scope: TableAScope,
  role: ComponentRole,
  pools: AuthoritativeRolePool[],
): AuthoritativeRolePool {
  const pool =
    pools.find(
      (item) =>
        item.scope ===
          scope &&
        item.role ===
          role,
    );

  if (!pool) {
    throw new Error(
      `Missing authoritative role pool for ${scope}/${role}.`,
    );
  }

  return pool;
}

function buildCandidate(
  name: string,
  scope: TableAScope,
  role: ComponentRole,
  components: ComponentRecord[],
  supplements: SupplementRecord[],
): UsydUnqualifiedTableAChoiceCandidate {
  const handbook =
    handbookForScope(
      scope,
    );

  const exact =
    components.find(
      (component) =>
        component.handbook ===
          handbook &&
        component.type ===
          role &&
        canonical(
          component.name,
        ) ===
          canonical(
            name,
          ),
    );

  if (exact) {
    return {
      name,

      type:
        role,

      scope,

      handbook,

      sourceUrl:
        exact.sourceUrl,

      identitySource:
        'EXISTING_COMPONENT',

      requirementsSourceResolved:
        Boolean(
          exact.sourceUrl,
        ),
    };
  }

  const supplement =
    supplements.find(
      (item) =>
        item.tableAScope ===
          scope &&
        item.type ===
          role &&
        canonical(
          item.name,
        ) ===
          canonical(
            name,
          ),
    );

  if (!supplement) {
    throw new Error(
      `Authoritative role identity ${scope}/${role}/${name} has neither an exact component nor a supplement.`,
    );
  }

  return {
    name,

    type:
      role,

    scope,

    handbook,

    sourceUrl:
      supplement.sourceFamily.sourceUrl ??
      supplement.sourceUrl,

    identitySource:
      'AUTHORITATIVE_ROLE_SUPPLEMENT',

    requirementsSourceResolved:
      supplement.requirementsSourceResolved,
  };
}

function isAlreadyCoveredByQualified(
  record: ScopeAuditRecord,
  qualified: QualifiedChoice[],
): boolean {
  if (
    record.dedupAgainstQualified ||
    record.resolution ===
      'ALREADY_COVERED_BY_QUALIFIED_POOL'
  ) {
    return true;
  }

  if (
    record.resolvedScopes.length !==
    1
  ) {
    return false;
  }

  const scope =
    record.resolvedScopes[0];

  const expectedTableFragment:
    Record<TableAScope, string> =
    {
      ARTS:
        'bachelor of arts',

      BUSINESS:
        'bachelor of commerce',

      COMPUTING:
        'bachelor of computing',

      CONSERVATORIUM:
        'bachelor of music',

      ENGINEERING:
        'project management',

      SCIENCE:
        'bachelor of science',
    };

  return qualified.some(
    (choice) =>
      choice.degreeCode ===
        record.degreeCode &&
      choice.requestedComponentType ===
        record.componentType &&
      choice.tableName
        .toLowerCase()
        .includes(
          expectedTableFragment[
            scope
          ],
        ),
  );
}

export async function buildUsydUnqualifiedTableAChoicePools():
Promise<UsydUnqualifiedTableAChoicePoolDataset> {
  const [
    scopeAudit,
    rolePools,
    supplements,
    components,
    qualified,
  ] =
    await Promise.all([
      loadScopeAudit(),
      loadAuthoritativeRoles(),
      loadSupplements(),
      loadComponents(),
      loadQualifiedChoices(),
    ]);

  const eligible =
    scopeAudit.filter(
      (record) =>
        (
          record.resolution ===
            'EXACT_SCOPE' ||
          record.resolution ===
            'MULTI_SCOPE_EXPLICIT'
        ),
    );

  /**
   * Count signals that the V3 scope audit already proved are covered by
   * the qualified Table A layer. These records are intentionally absent
   * from `eligible` because eligible contains only EXACT_SCOPE and
   * MULTI_SCOPE_EXPLICIT records.
   *
   * BPCOMPUT-01 MAJOR is the known current example.
   */
  let qualifiedDuplicatesExcluded =
    scopeAudit.filter(
      (record) =>
        record.dedupAgainstQualified ||
        record.resolution ===
          'ALREADY_COVERED_BY_QUALIFIED_POOL',
    ).length;

  const pools:
    UsydUnqualifiedTableAChoicePool[] =
    [];

  for (
    const record
    of eligible
  ) {
    if (
      isAlreadyCoveredByQualified(
        record,
        qualified,
      )
    ) {
      /**
       * Exact/multi records can still be discovered as duplicates from the
       * reconciled qualified file. Count those here. The ALREADY_COVERED
       * records were counted above and are not present in `eligible`.
       */
      qualifiedDuplicatesExcluded +=
        1;

      continue;
    }

    const candidateMap =
      new Map<
        string,
        UsydUnqualifiedTableAChoiceCandidate
      >();

    for (
      const scope
      of record.resolvedScopes
    ) {
      const rolePool =
        authoritativePoolFor(
          scope,
          record.componentType,
          rolePools,
        );

      for (
        const name
        of rolePool.names
      ) {
        const candidate =
          buildCandidate(
            name,
            scope,
            record.componentType,
            components,
            supplements,
          );

        /**
         * Same name can appear in both Arts and Science.
         * Preserve scope in the identity key so cross-faculty pools do not
         * collapse distinct source-role identities.
         */
        const key =
          [
            candidate.scope,
            candidate.type,
            canonical(
              candidate.name,
            ),
          ].join('|');

        candidateMap.set(
          key,
          candidate,
        );
      }
    }

    const candidates =
      [
        ...candidateMap.values(),
      ].sort(
        (
          left,
          right,
        ) =>
          left.scope.localeCompare(
            right.scope,
          ) ||
          left.name.localeCompare(
            right.name,
          ),
      );

    pools.push({
      degreeCode:
        record.degreeCode,

      degreeTitle:
        record.degreeTitle,

      role:
        record.componentType,

      semanticClass:
        record.semanticClass,

      sourceRaw:
        record.raw,

      scopes:
        [...record.resolvedScopes],

      candidates,

      candidateCount:
        candidates.length,

      tableSAlsoAllowed:
        record.semanticClass ===
        'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE',

      crossFaculty:
        record.semanticClass ===
          'CROSS_FACULTY_TABLE_A_COMPONENT_CHOICE' ||
        record.resolvedScopes.length >
          1,
    });
  }

  const poolKeys =
    pools.map(
      (pool) =>
        [
          pool.degreeCode,
          pool.role,
          pool.scopes.join('+'),
          canonical(
            pool.sourceRaw,
          ),
        ].join('|'),
    );

  const duplicatePoolKeys =
    poolKeys.length -
    new Set(
      poolKeys,
    ).size;

  const allCandidates =
    pools.flatMap(
      (pool) =>
        pool.candidates,
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      eligibleSignals:
        eligible.length,

      choicePools:
        pools.length,

      degrees:
        new Set(
          pools.map(
            (pool) =>
              pool.degreeCode,
          ),
        ).size,

      totalCandidateOccurrences:
        allCandidates.length,

      exactScopePools:
        pools.filter(
          (pool) =>
            pool.scopes.length ===
            1,
        ).length,

      multiScopePools:
        pools.filter(
          (pool) =>
            pool.scopes.length >
            1,
        ).length,

      tableSAlsoAllowedPools:
        pools.filter(
          (pool) =>
            pool.tableSAlsoAllowed,
        ).length,

      crossFacultyPools:
        pools.filter(
          (pool) =>
            pool.crossFaculty,
        ).length,

      duplicatePoolKeys,

      emptyPools:
        pools.filter(
          (pool) =>
            pool.candidateCount ===
            0,
        ).length,

      candidateIdentitiesExisting:
        allCandidates.filter(
          (candidate) =>
            candidate.identitySource ===
            'EXISTING_COMPONENT',
        ).length,

      candidateIdentitiesSupplemented:
        allCandidates.filter(
          (candidate) =>
            candidate.identitySource ===
            'AUTHORITATIVE_ROLE_SUPPLEMENT',
        ).length,

      candidatesWithoutRequirementSource:
        allCandidates.filter(
          (candidate) =>
            !candidate.requirementsSourceResolved,
        ).length,

      qualifiedDuplicatesExcluded,
    },

    pools:
      pools.sort(
        (
          left,
          right,
        ) =>
          left.degreeCode.localeCompare(
            right.degreeCode,
          ) ||
          left.role.localeCompare(
            right.role,
          ) ||
          left.scopes
            .join('+')
            .localeCompare(
              right.scopes.join('+'),
            ),
      ),
  };
}

export async function writeUsydUnqualifiedTableAChoicePools():
Promise<void> {
  const result =
    await buildUsydUnqualifiedTableAChoicePools();

  if (
    result.counts.duplicatePoolKeys !==
      0 ||
    result.counts.emptyPools !==
      0
  ) {
    throw new Error(
      `Refusing to write unqualified Table A pools: duplicates=${result.counts.duplicatePoolKeys}, empty=${result.counts.emptyPools}.`,
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-unqualified-table-a-degree-component-choices.json',
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
    '[USYD unqualified Table A choice pools] PASS',
  );

  console.log(
    `Eligible signals: ${result.counts.eligibleSignals}`,
  );

  console.log(
    `Qualified duplicates excluded: ${result.counts.qualifiedDuplicatesExcluded}`,
  );

  console.log(
    `Choice pools: ${result.counts.choicePools}`,
  );

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Candidate occurrences: ${result.counts.totalCandidateOccurrences}`,
  );

  console.log(
    `Exact-scope pools: ${result.counts.exactScopePools}`,
  );

  console.log(
    `Multi-scope pools: ${result.counts.multiScopePools}`,
  );

  console.log(
    `Table A-or-S pools: ${result.counts.tableSAlsoAllowedPools}`,
  );

  console.log(
    `Supplemented candidate occurrences: ${result.counts.candidateIdentitiesSupplemented}`,
  );

  console.log(
    `Candidates without requirement source: ${result.counts.candidatesWithoutRequirementSource}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
