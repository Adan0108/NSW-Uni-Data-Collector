import fs from 'node:fs/promises';
import path from 'node:path';

const HANDBOOK_YEAR = 2026;

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  String(HANDBOOK_YEAR),
);

const TABLE_SIGNAL_AUDIT_FILE = path.join(
  DATA_DIR,
  'usyd-degree-component-table-signal-audit.json',
);

const COMPONENT_FILE = path.join(
  DATA_DIR,
  'usyd-components-complete.json',
);

const ECONOMICS_ROLE_FILE = path.join(
  DATA_DIR,
  'usyd-economics-table-a-authoritative-roles.json',
);

type UnknownRecord = Record<string, unknown>;

type ComponentRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM';

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
  candidateComponents: CandidateComponent[];
}

interface EconomicsAuthoritativeRole {
  name: string;
  type: 'MAJOR' | 'MINOR';
  handbook: 'ARTS';
  tableName: 'Table A for the Bachelor of Economics';
  authoritative: true;
  evidenceUrl: string;
  supplementalRole: boolean;
}

interface EconomicsRoleCatalog {
  roles: EconomicsAuthoritativeRole[];
}

type QualifiedTableAKey =
  | 'COMMERCE'
  | 'COMPUTING'
  | 'ARTS'
  | 'ECONOMICS'
  | 'SCIENCE';

interface TableRule {
  key: QualifiedTableAKey;
  canonicalTableName: string;
}

const TABLE_RULES: Array<{
  pattern: RegExp;
  rule: TableRule;
}> = [
  {
    pattern: /\btable a for the bachelor of commerce\b/i,
    rule: {
      key: 'COMMERCE',
      canonicalTableName:
        'Table A for the Bachelor of Commerce',
    },
  },
  {
    pattern:
      /\btable a for the bachelor of (?:advanced )?computing\b/i,
    rule: {
      key: 'COMPUTING',
      canonicalTableName:
        'Table A for the Bachelor of Computing',
    },
  },
  {
    pattern:
      /\btable a for the bachelor of arts(?: and bachelor of advanced studies)?\b/i,
    rule: {
      key: 'ARTS',
      canonicalTableName:
        'Table A for the Bachelor of Arts',
    },
  },
  {
    pattern: /\btable a for the bachelor of economics\b/i,
    rule: {
      key: 'ECONOMICS',
      canonicalTableName:
        'Table A for the Bachelor of Economics',
    },
  },
  {
    pattern: /\btable a for the bachelor of science\b/i,
    rule: {
      key: 'SCIENCE',
      canonicalTableName:
        'Table A for the Bachelor of Science',
    },
  },
];

export interface UsydQualifiedTableAChoiceCandidate {
  componentIndex: number | null;
  componentName: string;
  componentType: 'MAJOR' | 'MINOR' | 'PROGRAM';
  componentHandbook: string;
  sourceUrl: string | null;
  authoritativeRoleSource:
    | 'COMPONENT_CATALOG'
    | 'ECONOMICS_ROLE_CATALOG';
}

export interface UsydQualifiedTableAChoice {
  degreeCode: string;
  degreeTitle: string;
  degreeHandbook: string | null;
  tableName: string;
  requestedComponentType:
    | 'MAJOR'
    | 'MINOR'
    | 'PROGRAM';
  relationshipSemantics: 'CHOICE_POOL';
  authoritative: true;
  compulsoryCandidateRelationships: false;
  candidates:
    UsydQualifiedTableAChoiceCandidate[];
  evidence: string[];
}

export interface UsydQualifiedTableAReviewSignal {
  degreeCode: string;
  degreeTitle: string;
  tableName: string;
  requestedComponentTypes: string[];
  rawExamples: string[];
  reason:
    | 'UNKNOWN_TABLE_A'
    | 'NO_REQUESTED_COMPONENT_TYPE'
    | 'MULTIPLE_REQUESTED_TYPES'
    | 'CONTEXTUAL_HONOURS_TABLE_REFERENCE'
    | 'STREAM_NOT_DIRECT_COMPONENT_POOL'
    | 'NO_AUTHORITATIVE_CANDIDATES';
}

export interface UsydQualifiedTableAChoiceDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;
  counts: {
    qualifiedTableAGroups: number;
    authoritativeChoicePools: number;
    degreesWithQualifiedTableAChoices: number;
    totalChoiceCandidates: number;
    reviewSignals: number;
    contextualHonoursSignals: number;
    streamReviewSignals: number;
    unresolvedRoleSignals: number;
  };
  choices: UsydQualifiedTableAChoice[];
  reviewSignals: UsydQualifiedTableAReviewSignal[];
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
    const value = record[key];

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
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

async function loadQualifiedGroups():
Promise<TableSignalGroup[]> {
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

  return (
    value.groups as TableSignalGroup[]
  ).filter(
    (group) =>
      group.classification ===
      'QUALIFIED_TABLE_A',
  );
}

async function loadAllComponents():
Promise<CandidateComponent[]> {
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

  const output: CandidateComponent[] = [];

  value.components.forEach(
    (item, index) => {
      if (!isRecord(item)) {
        return;
      }

      const name = stringValue(
        item,
        ['name', 'title', 'componentName'],
      );

      const type = stringValue(
        item,
        ['type', 'componentType'],
      );

      const handbook = stringValue(
        item,
        ['handbook', 'handbookCategory', 'category'],
      );

      if (!name || !type || !handbook) {
        return;
      }

      output.push({
        componentIndex: index,
        name,
        type: type.toUpperCase(),
        handbook: handbook.toUpperCase(),
        sourceUrl: stringValue(
          item,
          ['sourceUrl', 'url'],
        ),
        overviewUrl: stringValue(
          item,
          ['overviewUrl'],
        ),
        tableUrl: stringValue(
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

async function loadEconomicsRoles():
Promise<EconomicsAuthoritativeRole[]> {
  const value = await readJson(
    ECONOMICS_ROLE_FILE,
  );

  if (
    !isRecord(value) ||
    !Array.isArray(value.roles)
  ) {
    throw new Error(
      'USYD Economics authoritative role catalogue is missing roles[]. Run usyd.economics-table-a-authoritative-role-catalog.run.ts first.',
    );
  }

  return (
    value as unknown as EconomicsRoleCatalog
  ).roles;
}

function isComponentRole(
  value: string,
): value is ComponentRole {
  return (
    value === 'MAJOR' ||
    value === 'MINOR' ||
    value === 'PROGRAM' ||
    value === 'STREAM'
  );
}

function resolveTableRule(
  tableName: string,
): TableRule | null {
  for (const entry of TABLE_RULES) {
    if (entry.pattern.test(tableName)) {
      return entry.rule;
    }
  }

  return null;
}

function isContextualHonoursTable(
  tableName: string,
): boolean {
  return /table a for the bachelor relevant to that honours subject area/i.test(
    tableName,
  );
}

function fromComponent(
  candidate: CandidateComponent,
): UsydQualifiedTableAChoiceCandidate {
  return {
    componentIndex:
      candidate.componentIndex,
    componentName:
      candidate.name,
    componentType:
      candidate.type as
        | 'MAJOR'
        | 'MINOR'
        | 'PROGRAM',
    componentHandbook:
      candidate.handbook,
    sourceUrl:
      candidate.sourceUrl,
    authoritativeRoleSource:
      'COMPONENT_CATALOG',
  };
}

function resolveCandidates(
  rule: TableRule,
  requestedComponentType:
    | 'MAJOR'
    | 'MINOR'
    | 'PROGRAM',
  group: TableSignalGroup,
  allComponents: CandidateComponent[],
  economicsRoles: EconomicsAuthoritativeRole[],
): UsydQualifiedTableAChoiceCandidate[] {
  if (rule.key === 'ECONOMICS') {
    return economicsRoles
      .filter(
        (role) =>
          role.type ===
          requestedComponentType,
      )
      .map(
        (role) => ({
          componentIndex: null,
          componentName: role.name,
          componentType: role.type,
          componentHandbook: role.handbook,
          sourceUrl: role.evidenceUrl,
          authoritativeRoleSource:
            'ECONOMICS_ROLE_CATALOG',
        }),
      );
  }

  let candidates:
    CandidateComponent[] = [];

  switch (rule.key) {
    case 'COMMERCE':
      candidates =
        group.candidateComponents.filter(
          (candidate) =>
            candidate.handbook ===
              'BUSINESS' &&
            candidate.type ===
              requestedComponentType,
        );
      break;

    case 'COMPUTING':
      candidates =
        group.candidateComponents.filter(
          (candidate) =>
            candidate.handbook ===
              'ENGINEERING' &&
            candidate.type ===
              requestedComponentType,
        );
      break;

    case 'ARTS':
      candidates =
        allComponents.filter(
          (candidate) =>
            candidate.handbook ===
              'ARTS' &&
            candidate.type ===
              requestedComponentType,
        );
      break;

    case 'SCIENCE':
      candidates =
        allComponents.filter(
          (candidate) =>
            candidate.handbook ===
              'SCIENCE' &&
            candidate.type ===
              requestedComponentType,
        );
      break;
  }

  return candidates.map(
    fromComponent,
  );
}

export async function collectUsydQualifiedTableAChoices():
Promise<UsydQualifiedTableAChoiceDataset> {
  const [
    groups,
    allComponents,
    economicsRoles,
  ] = await Promise.all([
    loadQualifiedGroups(),
    loadAllComponents(),
    loadEconomicsRoles(),
  ]);

  const choices:
    UsydQualifiedTableAChoice[] = [];

  const reviewSignals:
    UsydQualifiedTableAReviewSignal[] =
    [];

  for (const group of groups) {
    const rawTableName =
      group.originalTableNames[0] ??
      group.normalizedTableName;

    const requestedTypes =
      group.componentTypes.filter(
        isComponentRole,
      );

    if (
      isContextualHonoursTable(
        rawTableName,
      )
    ) {
      reviewSignals.push({
        degreeCode: group.degreeCode,
        degreeTitle: group.degreeTitle,
        tableName: rawTableName,
        requestedComponentTypes:
          requestedTypes,
        rawExamples: group.rawExamples,
        reason:
          'CONTEXTUAL_HONOURS_TABLE_REFERENCE',
      });
      continue;
    }

    if (requestedTypes.length === 0) {
      reviewSignals.push({
        degreeCode: group.degreeCode,
        degreeTitle: group.degreeTitle,
        tableName: rawTableName,
        requestedComponentTypes: [],
        rawExamples: group.rawExamples,
        reason:
          'NO_REQUESTED_COMPONENT_TYPE',
      });
      continue;
    }

    if (requestedTypes.length > 1) {
      reviewSignals.push({
        degreeCode: group.degreeCode,
        degreeTitle: group.degreeTitle,
        tableName: rawTableName,
        requestedComponentTypes:
          requestedTypes,
        rawExamples: group.rawExamples,
        reason:
          'MULTIPLE_REQUESTED_TYPES',
      });
      continue;
    }

    const requestedComponentType =
      requestedTypes[0];

    if (
      requestedComponentType ===
      'STREAM'
    ) {
      reviewSignals.push({
        degreeCode: group.degreeCode,
        degreeTitle: group.degreeTitle,
        tableName: rawTableName,
        requestedComponentTypes: [
          requestedComponentType,
        ],
        rawExamples: group.rawExamples,
        reason:
          'STREAM_NOT_DIRECT_COMPONENT_POOL',
      });
      continue;
    }

    const tableRule =
      resolveTableRule(
        rawTableName,
      );

    if (!tableRule) {
      reviewSignals.push({
        degreeCode: group.degreeCode,
        degreeTitle: group.degreeTitle,
        tableName: rawTableName,
        requestedComponentTypes: [
          requestedComponentType,
        ],
        rawExamples: group.rawExamples,
        reason:
          'UNKNOWN_TABLE_A',
      });
      continue;
    }

    const candidates =
      resolveCandidates(
        tableRule,
        requestedComponentType,
        group,
        allComponents,
        economicsRoles,
      );

    if (candidates.length === 0) {
      reviewSignals.push({
        degreeCode: group.degreeCode,
        degreeTitle: group.degreeTitle,
        tableName:
          tableRule.canonicalTableName,
        requestedComponentTypes: [
          requestedComponentType,
        ],
        rawExamples: group.rawExamples,
        reason:
          'NO_AUTHORITATIVE_CANDIDATES',
      });
      continue;
    }

    choices.push({
      degreeCode: group.degreeCode,
      degreeTitle: group.degreeTitle,
      degreeHandbook:
        group.degreeHandbook,
      tableName:
        tableRule.canonicalTableName,
      requestedComponentType,
      relationshipSemantics:
        'CHOICE_POOL',
      authoritative: true,
      compulsoryCandidateRelationships:
        false,
      candidates,
      evidence: group.rawExamples,
    });
  }

  choices.sort(
    (left, right) =>
      left.degreeCode.localeCompare(
        right.degreeCode,
      ) ||
      left.tableName.localeCompare(
        right.tableName,
      ) ||
      left.requestedComponentType.localeCompare(
        right.requestedComponentType,
      ),
  );

  reviewSignals.sort(
    (left, right) =>
      left.degreeCode.localeCompare(
        right.degreeCode,
      ) ||
      left.tableName.localeCompare(
        right.tableName,
      ),
  );

  const countReview = (
    reason:
      UsydQualifiedTableAReviewSignal['reason'],
  ) =>
    reviewSignals.filter(
      (signal) =>
        signal.reason === reason,
    ).length;

  return {
    university: 'USYD',
    handbookYear: 2026,
    generatedAt:
      new Date().toISOString(),

    counts: {
      qualifiedTableAGroups:
        groups.length,

      authoritativeChoicePools:
        choices.length,

      degreesWithQualifiedTableAChoices:
        new Set(
          choices.map(
            (choice) =>
              choice.degreeCode,
          ),
        ).size,

      totalChoiceCandidates:
        choices.reduce(
          (total, choice) =>
            total +
            choice.candidates.length,
          0,
        ),

      reviewSignals:
        reviewSignals.length,

      contextualHonoursSignals:
        countReview(
          'CONTEXTUAL_HONOURS_TABLE_REFERENCE',
        ),

      streamReviewSignals:
        countReview(
          'STREAM_NOT_DIRECT_COMPONENT_POOL',
        ),

      unresolvedRoleSignals:
        countReview(
          'NO_AUTHORITATIVE_CANDIDATES',
        ),
    },

    choices,
    reviewSignals,
  };
}
