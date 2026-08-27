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
  | 'ECONOMICS'
  | 'SCIENCE'
  | 'CONSERVATORIUM'
  | 'ENGINEERING'
  | 'ARCHITECTURE'
  | 'MEDICINE_HEALTH';

interface ScopeAuditRecord {
  degreeCode: string;
  degreeTitle: string;
  componentType: ComponentRole;
  resolution:
    | 'EXACT_SCOPE'
    | 'MULTI_SCOPE_EXPLICIT'
    | 'ALREADY_COVERED_BY_QUALIFIED_POOL'
    | 'AMBIGUOUS_SCOPE'
    | 'NO_SCOPE_EVIDENCE';
  resolvedScopes: TableAScope[];
  dedupAgainstQualified: boolean;
  raw: string;
}

interface ComponentRecord {
  index: number;
  name: string;
  type: string;
  handbook: string;
  sourceUrl: string | null;
}

export interface UsydUnqualifiedTableARoleCoverageRecord {
  scope: TableAScope;
  role: ComponentRole;

  sourceHandbook:
    string;

  signalCount:
    number;

  degrees:
    string[];

  candidateCount:
    number;

  candidateNames:
    string[];

  status:
    | 'HAS_CANDIDATES_NEEDS_SOURCE_ROLE_AUDIT'
    | 'NO_EXACT_ROLE_CANDIDATES';

  evidenceExamples:
    string[];
}

export interface UsydUnqualifiedTableARoleCoverageDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    eligibleSignals: number;
    requestedScopeRolePairs: number;
    pairsWithCandidates: number;
    pairsWithoutCandidates: number;
  };

  records:
    UsydUnqualifiedTableARoleCoverageRecord[];
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
    const value = asString(
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
  const raw = await fs.readFile(
    filePath,
    'utf8',
  );

  return JSON.parse(raw) as unknown;
}

function scopeToHandbook(
  scope: TableAScope,
): string {
  switch (scope) {
    case 'ARTS':
      return 'ARTS';

    case 'BUSINESS':
      return 'BUSINESS';

    case 'COMPUTING':
    case 'ENGINEERING':
      return 'ENGINEERING';

    case 'ECONOMICS':
      return 'ARTS';

    case 'SCIENCE':
      return 'SCIENCE';

    case 'CONSERVATORIUM':
      return 'CONSERVATORIUM';

    case 'ARCHITECTURE':
      return 'ARCHITECTURE';

    case 'MEDICINE_HEALTH':
      return 'MEDICINE_HEALTH';
  }
}

async function loadScopeRecords():
Promise<ScopeAuditRecord[]> {
  const value = await readJson(
    SCOPE_AUDIT_FILE,
  );

  if (
    !isRecord(value) ||
    !Array.isArray(value.records)
  ) {
    throw new Error(
      'USYD scope/dedup audit is missing records[]. Run the V3 writer first.',
    );
  }

  return value.records as
    ScopeAuditRecord[];
}

async function loadComponents():
Promise<ComponentRecord[]> {
  const value = await readJson(
    COMPONENT_FILE,
  );

  if (
    !isRecord(value) ||
    !Array.isArray(value.components)
  ) {
    throw new Error(
      'USYD complete component catalogue is missing components[].',
    );
  }

  const output:
    ComponentRecord[] = [];

  value.components.forEach(
    (item, index) => {
      if (!isRecord(item)) {
        return;
      }

      const name = firstString(
        item,
        [
          'name',
          'title',
          'componentName',
        ],
      );

      const type = firstString(
        item,
        [
          'type',
          'componentType',
        ],
      );

      const handbook = firstString(
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
            ],
          ),
      });
    },
  );

  return output;
}

export async function auditUsydUnqualifiedTableARoleCoverage():
Promise<UsydUnqualifiedTableARoleCoverageDataset> {
  const [
    scopeRecords,
    components,
  ] = await Promise.all([
    loadScopeRecords(),
    loadComponents(),
  ]);

  /**
   * Eligible here means:
   * - exact scope, or explicit multi-scope;
   * - not already covered by the qualified Table A layer.
   *
   * We deliberately do NOT create any pool yet. This audit only asks:
   * "for every requested Table A scope + role, do we even have a
   * trustworthy role catalogue?"
   */
  const eligible =
    scopeRecords.filter(
      (record) =>
        !record.dedupAgainstQualified &&
        (
          record.resolution ===
            'EXACT_SCOPE' ||
          record.resolution ===
            'MULTI_SCOPE_EXPLICIT'
        ),
    );

  const grouped =
    new Map<
      string,
      {
        scope: TableAScope;
        role: ComponentRole;
        degreeCodes: Set<string>;
        raws: string[];
      }
    >();

  for (const record of eligible) {
    for (const scope of record.resolvedScopes) {
      const key =
        `${scope}|${record.componentType}`;

      let group =
        grouped.get(key);

      if (!group) {
        group = {
          scope,
          role:
            record.componentType,
          degreeCodes:
            new Set<string>(),
          raws: [],
        };

        grouped.set(
          key,
          group,
        );
      }

      group.degreeCodes.add(
        record.degreeCode,
      );

      if (
        !group.raws.includes(
          record.raw,
        )
      ) {
        group.raws.push(
          record.raw,
        );
      }
    }
  }

  const records:
    UsydUnqualifiedTableARoleCoverageRecord[] =
    [];

  for (const group of grouped.values()) {
    const sourceHandbook =
      scopeToHandbook(
        group.scope,
      );

    const candidates =
      components.filter(
        (component) =>
          component.handbook ===
            sourceHandbook &&
          component.type ===
            group.role,
      );

    const candidateNames =
      [
        ...new Set(
          candidates.map(
            (candidate) =>
              candidate.name,
          ),
        ),
      ].sort();

    records.push({
      scope:
        group.scope,

      role:
        group.role,

      sourceHandbook,

      signalCount:
        group.raws.length,

      degrees:
        [
          ...group.degreeCodes,
        ].sort(),

      candidateCount:
        candidateNames.length,

      candidateNames,

      status:
        candidateNames.length >
        0
          ? 'HAS_CANDIDATES_NEEDS_SOURCE_ROLE_AUDIT'
          : 'NO_EXACT_ROLE_CANDIDATES',

      evidenceExamples:
        group.raws.slice(
          0,
          5,
        ),
    });
  }

  records.sort(
    (left, right) =>
      left.scope.localeCompare(
        right.scope,
      ) ||
      left.role.localeCompare(
        right.role,
      ),
  );

  const pairsWithCandidates =
    records.filter(
      (record) =>
        record.candidateCount >
        0,
    ).length;

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

      requestedScopeRolePairs:
        records.length,

      pairsWithCandidates,

      pairsWithoutCandidates:
        records.length -
        pairsWithCandidates,
    },

    records,
  };
}
