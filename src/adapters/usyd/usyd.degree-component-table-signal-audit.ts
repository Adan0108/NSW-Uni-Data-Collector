import fs from 'node:fs/promises';
import path from 'node:path';

const HANDBOOK_YEAR =
  2026;

const DATA_DIR =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
  );

const STAGE1_FILE =
  path.join(
    DATA_DIR,
    'usyd-degree-component-relationships.stage1.json',
  );

const COMPONENT_FILE =
  path.join(
    DATA_DIR,
    'usyd-components-complete.json',
  );

type UnknownRecord =
  Record<string, unknown>;

export interface UsydGenericRelationshipSignal {
  degreeCode: string;
  degreeTitle: string;
  degreeHandbook: string | null;
  componentType:
    | 'MAJOR'
    | 'MINOR'
    | 'PROGRAM'
    | 'STREAM'
    | null;
  tableName: string | null;
  rawText: string;
  authoritative: false;
}

export interface UsydComponentPoolCandidate {
  componentIndex: number;
  name: string;
  type: string;
  handbook: string;
  sourceUrl: string | null;
  overviewUrl: string | null;
  tableUrl: string | null;
}

export interface UsydTableSignalGroup {
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

  candidateComponents: UsydComponentPoolCandidate[];
}

export interface UsydDegreeComponentTableSignalAudit {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    genericSignals: number;
    linkedComponentTableSignals: number;
    componentOnlySignals: number;
    tableOnlySignals: number;
    groupedTableSignals: number;
    tableS: number;
    tableD: number;
    tableO: number;
    qualifiedTableA: number;
    unqualifiedTableA: number;
    otherTable: number;
    noTable: number;
  };

  groups: UsydTableSignalGroup[];
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

function stringValue(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
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

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(
  value: string,
): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyTable(
  tableName: string | null,
): {
  classification:
    UsydTableSignalGroup['classification'];
  strategy:
    UsydTableSignalGroup['candidateStrategy'];
} {
  if (!tableName) {
    return {
      classification: 'NO_TABLE',
      strategy: 'NONE',
    };
  }

  const value =
    normalizeKey(tableName);

  if (
    value === 'table s' ||
    value.startsWith('table s ')
  ) {
    return {
      classification: 'TABLE_S',
      strategy: 'INTERDISCIPLINARY_POOL',
    };
  }

  if (
    value === 'table d' ||
    value.startsWith('table d ')
  ) {
    return {
      classification: 'TABLE_D',
      strategy: 'DALYELL_POOL',
    };
  }

  if (
    value === 'table o' ||
    value.startsWith('table o ')
  ) {
    return {
      classification: 'TABLE_O',
      strategy: 'OPEN_LEARNING_ENVIRONMENT',
    };
  }

  if (
    value.startsWith('table a for ')
  ) {
    return {
      classification: 'QUALIFIED_TABLE_A',
      strategy: 'QUALIFIED_TABLE_A_CONTEXT',
    };
  }

  if (value === 'table a') {
    return {
      classification: 'UNQUALIFIED_TABLE_A',
      strategy: 'SAME_HANDBOOK_CONTEXT',
    };
  }

  return {
    classification: 'OTHER_TABLE',
    strategy: 'NONE',
  };
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

async function loadSignals():
Promise<UsydGenericRelationshipSignal[]> {
  const value =
    await readJson(
      STAGE1_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(value.genericSignals)
  ) {
    throw new Error(
      'Stage 1 relationship file does not contain genericSignals[].',
    );
  }

  return value.genericSignals as
    UsydGenericRelationshipSignal[];
}

async function loadComponents():
Promise<UsydComponentPoolCandidate[]> {
  const value =
    await readJson(
      COMPONENT_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(value.components)
  ) {
    throw new Error(
      'Complete component file does not contain components[].',
    );
  }

  const output:
    UsydComponentPoolCandidate[] =
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
        stringValue(
          item,
          [
            'name',
            'title',
            'componentName',
          ],
        );

      const type =
        stringValue(
          item,
          [
            'type',
            'componentType',
          ],
        );

      const handbook =
        stringValue(
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
        componentIndex:
          index,
        name,
        type:
          type.toUpperCase(),
        handbook:
          handbook.toUpperCase(),
        sourceUrl:
          stringValue(
            item,
            [
              'sourceUrl',
              'url',
            ],
          ),
        overviewUrl:
          stringValue(
            item,
            [
              'overviewUrl',
            ],
          ),
        tableUrl:
          stringValue(
            item,
            [
              'tableUrl',
              'unitTableUrl',
              'unitOfStudyTableUrl',
            ],
          ),
      });
    },
  );

  return output;
}

function filterByRequestedTypes(
  components: UsydComponentPoolCandidate[],
  componentTypes: string[],
): UsydComponentPoolCandidate[] {
  if (componentTypes.length === 0) {
    return components;
  }

  const wanted =
    new Set(
      componentTypes.map(
        (
          item,
        ) =>
          item.toUpperCase(),
      ),
    );

  return components.filter(
    (
      component,
    ) =>
      wanted.has(
        component.type,
      ),
  );
}

function qualifiedTableATokens(
  tableName: string,
): string[] {
  const withoutPrefix =
    tableName.replace(
      /^\s*Table\s+A\s+for\s+/i,
      '',
    );

  return normalizeKey(
    withoutPrefix,
  )
    .split(' ')
    .filter(
      (
        token,
      ) =>
        token.length >= 4 &&
        ![
          'bachelor',
          'honours',
          'degree',
          'degrees',
          'advanced',
          'studies',
        ].includes(token),
    );
}

function scoreQualifiedTableA(
  component: UsydComponentPoolCandidate,
  tokens: string[],
): number {
  if (tokens.length === 0) {
    return 0;
  }

  const haystack =
    normalizeKey(
      [
        component.sourceUrl ?? '',
        component.overviewUrl ?? '',
        component.tableUrl ?? '',
      ].join(' '),
    );

  let score =
    0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function getCandidates(
  classification:
    UsydTableSignalGroup['classification'],
  tableName: string | null,
  degreeHandbook: string | null,
  componentTypes: string[],
  components: UsydComponentPoolCandidate[],
): UsydComponentPoolCandidate[] {
  const typed =
    filterByRequestedTypes(
      components,
      componentTypes,
    );

  if (classification === 'TABLE_S') {
    return typed.filter(
      (
        component,
      ) =>
        component.handbook ===
        'INTERDISCIPLINARY',
    );
  }

  if (classification === 'UNQUALIFIED_TABLE_A') {
    if (!degreeHandbook) {
      return [];
    }

    return typed.filter(
      (
        component,
      ) =>
        component.handbook ===
        degreeHandbook.toUpperCase(),
    );
  }

  if (
    classification ===
      'QUALIFIED_TABLE_A' &&
    tableName
  ) {
    const tokens =
      qualifiedTableATokens(
        tableName,
      );

    const scored =
      typed
        .map(
          (
            component,
          ) => ({
            component,
            score:
              scoreQualifiedTableA(
                component,
                tokens,
              ),
          }),
        )
        .filter(
          (
            item,
          ) =>
            item.score >
            0,
        )
        .sort(
          (
            left,
            right,
          ) =>
            right.score -
            left.score,
        );

    if (scored.length === 0) {
      return [];
    }

    const best =
      scored[0].score;

    return scored
      .filter(
        (
          item,
        ) =>
          item.score ===
          best,
      )
      .map(
        (
          item,
        ) =>
          item.component,
      );
  }

  /**
   * Table D and Table O are not component-family pools in the same
   * sense as Table A/Table S. They are intentionally left without
   * candidates until a dedicated Dalyell/OLE semantic stage.
   */
  return [];
}

export async function auditUsydDegreeComponentTableSignals():
Promise<UsydDegreeComponentTableSignalAudit> {
  const [
    signals,
    components,
  ] =
    await Promise.all(
      [
        loadSignals(),
        loadComponents(),
      ],
    );

  const linkedSignals =
    signals.filter(
      (
        signal,
      ) =>
        signal.componentType !==
          null &&
        signal.tableName !==
          null,
    );

  const componentOnlySignals =
    signals.filter(
      (
        signal,
      ) =>
        signal.componentType !==
          null &&
        signal.tableName ===
          null,
    );

  const tableOnlySignals =
    signals.filter(
      (
        signal,
      ) =>
        signal.componentType ===
          null &&
        signal.tableName !==
          null,
    );

  const grouped =
    new Map<
      string,
      {
        degreeCode: string;
        degreeTitle: string;
        degreeHandbook: string | null;
        tableName: string | null;
        originalTableNames: Set<string>;
        componentTypes: Set<string>;
        rawExamples: Set<string>;
        signalCount: number;
      }
    >();

  for (const signal of linkedSignals) {
    const tableName =
      signal.tableName
        ? normalizeText(
            signal.tableName,
          )
        : null;

    const tableKey =
      tableName
        ? normalizeKey(
            tableName,
          )
        : '__NO_TABLE__';

    const key =
      [
        signal.degreeCode,
        tableKey,
      ].join('|');

    const existing =
      grouped.get(key);

    if (existing) {
      existing.signalCount +=
        1;

      if (tableName) {
        existing.originalTableNames.add(
          tableName,
        );
      }

      if (signal.componentType) {
        existing.componentTypes.add(
          signal.componentType,
        );
      }

      if (
        existing.rawExamples.size <
        5
      ) {
        existing.rawExamples.add(
          signal.rawText,
        );
      }

      continue;
    }

    grouped.set(
      key,
      {
        degreeCode:
          signal.degreeCode,
        degreeTitle:
          signal.degreeTitle,
        degreeHandbook:
          signal.degreeHandbook,
        tableName,
        originalTableNames:
          new Set(
            tableName
              ? [
                  tableName,
                ]
              : [],
          ),
        componentTypes:
          new Set(
            signal.componentType
              ? [
                  signal.componentType,
                ]
              : [],
          ),
        rawExamples:
          new Set(
            [
              signal.rawText,
            ],
          ),
        signalCount:
          1,
      },
    );
  }

  const groups:
    UsydTableSignalGroup[] =
    [];

  for (
    const group
    of grouped.values()
  ) {
    const classification =
      classifyTable(
        group.tableName,
      );

    const componentTypes =
      [
        ...group.componentTypes,
      ].sort();

    groups.push({
      degreeCode:
        group.degreeCode,
      degreeTitle:
        group.degreeTitle,
      degreeHandbook:
        group.degreeHandbook,
      normalizedTableName:
        group.tableName
          ? normalizeKey(
              group.tableName,
            )
          : '__NO_TABLE__',
      originalTableNames:
        [
          ...group.originalTableNames,
        ].sort(),
      signalCount:
        group.signalCount,
      componentTypes,
      rawExamples:
        [
          ...group.rawExamples,
        ],
      classification:
        classification.classification,
      candidateStrategy:
        classification.strategy,
      candidateComponents:
        getCandidates(
          classification.classification,
          group.tableName,
          group.degreeHandbook,
          componentTypes,
          components,
        ),
    });
  }

  groups.sort(
    (
      left,
      right,
    ) =>
      left.degreeCode.localeCompare(
        right.degreeCode,
      ) ||
      left.normalizedTableName.localeCompare(
        right.normalizedTableName,
      ),
  );

  const count =
    (
      classification:
        UsydTableSignalGroup['classification'],
    ) =>
      groups.filter(
        (
          group,
        ) =>
          group.classification ===
          classification,
      ).length;

  return {
    university:
      'USYD',
    handbookYear:
      2026,
    generatedAt:
      new Date()
        .toISOString(),

    counts: {
      genericSignals:
        signals.length,
      linkedComponentTableSignals:
        linkedSignals.length,
      componentOnlySignals:
        componentOnlySignals.length,
      tableOnlySignals:
        tableOnlySignals.length,
      groupedTableSignals:
        groups.length,
      tableS:
        count('TABLE_S'),
      tableD:
        count('TABLE_D'),
      tableO:
        count('TABLE_O'),
      qualifiedTableA:
        count(
          'QUALIFIED_TABLE_A',
        ),
      unqualifiedTableA:
        count(
          'UNQUALIFIED_TABLE_A',
        ),
      otherTable:
        count('OTHER_TABLE'),
      noTable:
        count('NO_TABLE'),
    },

    groups,
  };
}
