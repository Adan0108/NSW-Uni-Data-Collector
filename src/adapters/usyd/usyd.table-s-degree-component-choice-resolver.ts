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

const STAGE1_RELATIONSHIP_FILE =
  path.join(
    DATA_DIR,
    'usyd-degree-component-relationships.stage1.json',
  );

const TABLE_S_ROLE_FILE =
  path.join(
    DATA_DIR,
    'usyd-table-s-authoritative-roles.json',
  );

type UnknownRecord =
  Record<string, unknown>;

type ComponentRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM';

interface GenericSignal {
  degreeCode: string;
  degreeTitle: string;
  degreeHandbook: string | null;
  componentType:
    ComponentRole | null;
  tableName: string | null;
  rawText: string;
  authoritative: false;
}

interface TableSRole {
  name: string;
  type:
    | 'MAJOR'
    | 'MINOR'
    | 'PROGRAM';
  handbook:
    'INTERDISCIPLINARY';
  authoritative:
    true;
  evidenceSource:
    | 'TABLE_S_OVERVIEW'
    | 'TABLE_S_UNIT_TABLE';
  evidenceUrl: string;
  supplementalRole: boolean;
}

export interface UsydTableSDegreeComponentChoiceCandidate {
  componentName: string;

  componentType:
    | 'MAJOR'
    | 'MINOR';

  componentHandbook:
    'INTERDISCIPLINARY';

  evidenceUrl: string;

  sourceProven:
    true;
}

export interface UsydTableSDegreeComponentChoice {
  degreeCode: string;
  degreeTitle: string;
  degreeHandbook: string | null;

  tableName:
    'Table S';

  requestedComponentType:
    | 'MAJOR'
    | 'MINOR';

  relationshipSemantics:
    'CHOICE_POOL';

  compulsoryCandidateRelationships:
    false;

  authoritative:
    true;

  candidates:
    UsydTableSDegreeComponentChoiceCandidate[];

  evidence:
    Array<{
      rawText: string;
    }>;
}

export interface UsydTableSSemanticReviewSignal {
  degreeCode: string;
  degreeTitle: string;
  componentType:
    'PROGRAM' | 'STREAM';
  rawText: string;

  reason:
    | 'TABLE_S_HAS_NO_PROGRAM_ROLE'
    | 'STREAM_CONTEXT_IS_NOT_TABLE_S_COMPONENT_CHOICE';
}

export interface UsydTableSDegreeComponentChoiceDataset {
  university:
    'USYD';

  handbookYear:
    2026;

  generatedAt:
    string;

  counts: {
    rawTableSSignals: number;
    tableOnlySignalsIgnored: number;
    typedChoiceSignals: number;
    choicePools: number;
    totalChoiceCandidates: number;
    degreesWithTableSChoices: number;
    semanticReviewSignals: number;
  };

  choices:
    UsydTableSDegreeComponentChoice[];

  semanticReviewSignals:
    UsydTableSSemanticReviewSignal[];
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function normalize(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

async function readJson(
  filePath: string,
): Promise<unknown> {
  const raw =
    await fs.readFile(
      filePath,
      'utf8',
    );

  return JSON.parse(
    raw,
  ) as unknown;
}

async function loadGenericSignals():
Promise<GenericSignal[]> {
  const value =
    await readJson(
      STAGE1_RELATIONSHIP_FILE,
    );

  if (
    !isRecord(
      value,
    ) ||
    !Array.isArray(
      value.genericSignals,
    )
  ) {
    throw new Error(
      'Stage 1 degree-component relationship dataset is missing genericSignals[].',
    );
  }

  return value.genericSignals as
    GenericSignal[];
}

async function loadTableSRoles():
Promise<TableSRole[]> {
  const value =
    await readJson(
      TABLE_S_ROLE_FILE,
    );

  if (
    !isRecord(
      value,
    ) ||
    !Array.isArray(
      value.roles,
    )
  ) {
    throw new Error(
      'Final Table S authoritative role catalogue is missing roles[]. Run usyd.table-s-authoritative-role-catalog.run.ts first.',
    );
  }

  return value.roles as
    TableSRole[];
}

function isTableS(
  tableName: string | null,
): boolean {
  return (
    typeof tableName ===
      'string' &&
    normalize(
      tableName,
    ) ===
      'table s'
  );
}

function isChoiceRole(
  value:
    ComponentRole | null,
): value is
  | 'MAJOR'
  | 'MINOR' {
  return (
    value ===
      'MAJOR' ||
    value ===
      'MINOR'
  );
}

function dedupeEvidence(
  values:
    Array<{
      rawText: string;
    }>,
): Array<{
  rawText: string;
}> {
  return [
    ...new Map(
      values.map(
        (
          item,
        ) => [
          item.rawText,
          item,
        ],
      ),
    ).values(),
  ];
}

export async function collectUsydTableSDegreeComponentChoices():
Promise<UsydTableSDegreeComponentChoiceDataset> {
  const [
    genericSignals,
    tableSRoles,
  ] =
    await Promise.all(
      [
        loadGenericSignals(),
        loadTableSRoles(),
      ],
    );

  const tableSSignals =
    genericSignals.filter(
      (
        signal,
      ) =>
        isTableS(
          signal.tableName,
        ),
    );

  /**
   * componentType === null means this is only a generic table mention
   * such as:
   *   - electives from Table S
   *   - units from Table S
   *   - the definition of Table S
   *
   * Those are not degree-component relationships and must not appear
   * as unresolved component-choice failures.
   */
  const tableOnlySignals =
    tableSSignals.filter(
      (
        signal,
      ) =>
        signal.componentType ===
        null,
    );

  const typedSignals =
    tableSSignals.filter(
      (
        signal,
      ) =>
        signal.componentType !==
        null,
    );

  const rolesByType =
    new Map<
      'MAJOR' | 'MINOR',
      TableSRole[]
    >();

  for (
    const type
    of [
      'MAJOR',
      'MINOR',
    ] as const
  ) {
    rolesByType.set(
      type,
      tableSRoles
        .filter(
          (
            role,
          ) =>
            role.type ===
            type,
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.name.localeCompare(
              right.name,
            ),
        ),
    );
  }

  const semanticReviewSignals:
    UsydTableSSemanticReviewSignal[] =
    [];

  const choiceMap =
    new Map<
      string,
      UsydTableSDegreeComponentChoice
    >();

  let typedChoiceSignals =
    0;

  for (
    const signal
    of typedSignals
  ) {
    if (
      signal.componentType ===
      'PROGRAM'
    ) {
      semanticReviewSignals.push({
        degreeCode:
          signal.degreeCode,

        degreeTitle:
          signal.degreeTitle,

        componentType:
          'PROGRAM',

        rawText:
          signal.rawText,

        reason:
          'TABLE_S_HAS_NO_PROGRAM_ROLE',
      });

      continue;
    }

    if (
      signal.componentType ===
      'STREAM'
    ) {
      semanticReviewSignals.push({
        degreeCode:
          signal.degreeCode,

        degreeTitle:
          signal.degreeTitle,

        componentType:
          'STREAM',

        rawText:
          signal.rawText,

        reason:
          'STREAM_CONTEXT_IS_NOT_TABLE_S_COMPONENT_CHOICE',
      });

      continue;
    }

    if (
      !isChoiceRole(
        signal.componentType,
      )
    ) {
      continue;
    }

    /**
     * Capture the narrowed value in a local constant.
     * TypeScript does not preserve the signal.componentType narrowing
     * inside later callback closures such as candidates.map(...).
     */
    const requestedComponentType =
      signal.componentType;

    const candidates =
      rolesByType.get(
        requestedComponentType,
      ) ??
      [];

    if (
      candidates.length !==
      101
    ) {
      throw new Error(
        `Expected exactly 101 authoritative Table S ${requestedComponentType} candidates, got ${candidates.length}.`,
      );
    }

    typedChoiceSignals +=
      1;

    const key =
      [
        signal.degreeCode,
        requestedComponentType,
        'TABLE_S',
      ].join(
        '|',
      );

    const existing =
      choiceMap.get(
        key,
      );

    if (
      existing
    ) {
      existing.evidence =
        dedupeEvidence(
          [
            ...existing.evidence,
            {
              rawText:
                signal.rawText,
            },
          ],
        );

      continue;
    }

    choiceMap.set(
      key,
      {
        degreeCode:
          signal.degreeCode,

        degreeTitle:
          signal.degreeTitle,

        degreeHandbook:
          signal.degreeHandbook,

        tableName:
          'Table S',

        requestedComponentType,

        relationshipSemantics:
          'CHOICE_POOL',

        compulsoryCandidateRelationships:
          false,

        authoritative:
          true,

        candidates:
          candidates.map(
            (
              role,
            ) => ({
              componentName:
                role.name,

              componentType:
                requestedComponentType,

              componentHandbook:
                'INTERDISCIPLINARY',

              evidenceUrl:
                role.evidenceUrl,

              sourceProven:
                true,
            }),
          ),

        evidence: [
          {
            rawText:
              signal.rawText,
          },
        ],
      },
    );
  }

  const choices =
    [
      ...choiceMap.values(),
    ].sort(
      (
        left,
        right,
      ) =>
        left.degreeCode.localeCompare(
          right.degreeCode,
        ) ||
        left.requestedComponentType.localeCompare(
          right.requestedComponentType,
        ),
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date()
        .toISOString(),

    counts: {
      rawTableSSignals:
        tableSSignals.length,

      tableOnlySignalsIgnored:
        tableOnlySignals.length,

      typedChoiceSignals,

      choicePools:
        choices.length,

      totalChoiceCandidates:
        choices.reduce(
          (
            total,
            choice,
          ) =>
            total +
            choice.candidates.length,
          0,
        ),

      degreesWithTableSChoices:
        new Set(
          choices.map(
            (
              choice,
            ) =>
              choice.degreeCode,
          ),
        ).size,

      semanticReviewSignals:
        semanticReviewSignals.length,
    },

    choices,

    semanticReviewSignals,
  };
}
