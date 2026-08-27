import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const TABLE_SIGNAL_AUDIT_FILE = path.join(
  DATA_DIR,
  'usyd-degree-component-table-signal-audit.json',
);

type UnknownRecord = Record<string, unknown>;

interface CandidateComponent {
  componentIndex: number;
  name: string;
  type: string;
  handbook: string;
  sourceUrl: string | null;
  overviewUrl: string | null;
  tableUrl: string | null;
}

interface TableSignalGroup {
  degreeCode: string;
  degreeTitle: string;
  degreeHandbook: string | null;
  normalizedTableName: string;
  originalTableNames: string[];
  signalCount: number;
  componentTypes: string[];
  rawExamples: string[];

  classification:
    | 'TABLE_S'
    | 'TABLE_D'
    | 'TABLE_O'
    | 'QUALIFIED_TABLE_A'
    | 'UNQUALIFIED_TABLE_A'
    | 'OTHER_TABLE'
    | 'NO_TABLE';

  candidateStrategy:
    | 'INTERDISCIPLINARY_POOL'
    | 'DALYELL_POOL'
    | 'OPEN_LEARNING_ENVIRONMENT'
    | 'QUALIFIED_TABLE_A_CONTEXT'
    | 'SAME_HANDBOOK_CONTEXT'
    | 'NONE';

  candidateComponents: CandidateComponent[];
}

export interface UsydUnqualifiedTableAAuditRecord {
  degreeCode: string;
  degreeTitle: string;
  degreeHandbook: string | null;

  tableNames: string[];
  componentTypes: string[];
  signalCount: number;

  rawExamples: string[];

  candidateCount: number;

  candidatesByHandbook:
    Record<string, number>;

  candidatesByType:
    Record<string, number>;

  candidatesByHandbookAndType:
    Record<string, number>;

  sampleCandidates:
    Array<{
      componentIndex: number;
      name: string;
      type: string;
      handbook: string;
      sourceUrl: string | null;
    }>;

  preliminaryClassification:
    | 'TYPED_COMPONENT_REFERENCE'
    | 'TABLE_ONLY_OR_ELECTIVE'
    | 'MULTI_TYPE_REVIEW';
}

export interface UsydUnqualifiedTableAAuditDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    groups: number;
    typedComponentReferences: number;
    tableOnlyOrElective: number;
    multiTypeReview: number;
    degrees: number;
  };

  byDegreeHandbook:
    Record<string, number>;

  byComponentType:
    Record<string, number>;

  records:
    UsydUnqualifiedTableAAuditRecord[];
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
  const raw = await fs.readFile(
    filePath,
    'utf8',
  );

  return JSON.parse(raw) as unknown;
}

function increment(
  target: Record<string, number>,
  key: string,
): void {
  target[key] = (target[key] ?? 0) + 1;
}

function countCandidates(
  candidates: CandidateComponent[],
  selector: (candidate: CandidateComponent) => string,
): Record<string, number> {
  const output: Record<string, number> = {};

  for (const candidate of candidates) {
    increment(
      output,
      selector(candidate),
    );
  }

  return output;
}

function preliminaryClassification(
  componentTypes: string[],
): UsydUnqualifiedTableAAuditRecord['preliminaryClassification'] {
  const typed = componentTypes.filter(
    (type) =>
      type === 'MAJOR' ||
      type === 'MINOR' ||
      type === 'PROGRAM' ||
      type === 'STREAM',
  );

  if (typed.length === 0) {
    return 'TABLE_ONLY_OR_ELECTIVE';
  }

  if (typed.length > 1) {
    return 'MULTI_TYPE_REVIEW';
  }

  return 'TYPED_COMPONENT_REFERENCE';
}

export async function auditUsydUnqualifiedTableA():
Promise<UsydUnqualifiedTableAAuditDataset> {
  const value = await readJson(
    TABLE_SIGNAL_AUDIT_FILE,
  );

  if (
    !isRecord(value) ||
    !Array.isArray(value.groups)
  ) {
    throw new Error(
      'USYD degree-component table-signal audit is missing groups[].',
    );
  }

  const groups = (
    value.groups as TableSignalGroup[]
  ).filter(
    (group) =>
      group.classification ===
      'UNQUALIFIED_TABLE_A',
  );

  const records:
    UsydUnqualifiedTableAAuditRecord[] = [];

  const byDegreeHandbook:
    Record<string, number> = {};

  const byComponentType:
    Record<string, number> = {};

  for (const group of groups) {
    increment(
      byDegreeHandbook,
      group.degreeHandbook ?? 'UNKNOWN',
    );

    if (group.componentTypes.length === 0) {
      increment(
        byComponentType,
        'NONE',
      );
    } else {
      for (const type of group.componentTypes) {
        increment(
          byComponentType,
          type,
        );
      }
    }

    records.push({
      degreeCode:
        group.degreeCode,

      degreeTitle:
        group.degreeTitle,

      degreeHandbook:
        group.degreeHandbook,

      tableNames:
        group.originalTableNames,

      componentTypes:
        group.componentTypes,

      signalCount:
        group.signalCount,

      rawExamples:
        group.rawExamples,

      candidateCount:
        group.candidateComponents.length,

      candidatesByHandbook:
        countCandidates(
          group.candidateComponents,
          (candidate) =>
            candidate.handbook,
        ),

      candidatesByType:
        countCandidates(
          group.candidateComponents,
          (candidate) =>
            candidate.type,
        ),

      candidatesByHandbookAndType:
        countCandidates(
          group.candidateComponents,
          (candidate) =>
            `${candidate.handbook}/${candidate.type}`,
        ),

      sampleCandidates:
        group.candidateComponents
          .slice(0, 20)
          .map(
            (candidate) => ({
              componentIndex:
                candidate.componentIndex,

              name:
                candidate.name,

              type:
                candidate.type,

              handbook:
                candidate.handbook,

              sourceUrl:
                candidate.sourceUrl,
            }),
          ),

      preliminaryClassification:
        preliminaryClassification(
          group.componentTypes,
        ),
    });
  }

  records.sort(
    (left, right) =>
      (left.degreeHandbook ?? '')
        .localeCompare(
          right.degreeHandbook ?? '',
        ) ||
      left.degreeCode.localeCompare(
        right.degreeCode,
      ),
  );

  const countClass = (
    classification:
      UsydUnqualifiedTableAAuditRecord['preliminaryClassification'],
  ) =>
    records.filter(
      (record) =>
        record.preliminaryClassification ===
        classification,
    ).length;

  return {
    university: 'USYD',
    handbookYear: 2026,
    generatedAt:
      new Date().toISOString(),

    counts: {
      groups:
        records.length,

      typedComponentReferences:
        countClass(
          'TYPED_COMPONENT_REFERENCE',
        ),

      tableOnlyOrElective:
        countClass(
          'TABLE_ONLY_OR_ELECTIVE',
        ),

      multiTypeReview:
        countClass(
          'MULTI_TYPE_REVIEW',
        ),

      degrees:
        new Set(
          records.map(
            (record) =>
              record.degreeCode,
          ),
        ).size,
    },

    byDegreeHandbook,
    byComponentType,
    records,
  };
}
