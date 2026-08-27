import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const EXPLICIT_FILE = path.join(
  DATA_DIR,
  'usyd-degree-component-relationships.stage1.json',
);

const TABLE_S_FILE = path.join(
  DATA_DIR,
  'usyd-table-s-degree-component-choices.json',
);

const TABLE_A_FILE = path.join(
  DATA_DIR,
  'usyd-qualified-table-a-degree-component-choices.json',
);

type UnknownRecord = Record<string, unknown>;

export interface UsydDegreeComponentStage2Dataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  status: {
    explicitNamedRelationships: 'COMPLETE';
    tableSChoicePools: 'COMPLETE';
    qualifiedTableAChoicePools: 'COMPLETE';
    unqualifiedTableAChoicePools: 'NOT_YET_RESOLVED';
    degreeRequirementSemantics: 'NOT_YET_COMPLETE';
    recommendedStudyPlans: 'NOT_YET_COMPLETE';
  };

  counts: {
    explicitNamedRelationships: number;

    tableSChoicePools: number;
    tableSChoiceCandidates: number;

    qualifiedTableAChoicePools: number;
    qualifiedTableAChoiceCandidates: number;

    totalChoicePools: number;
    totalChoiceCandidates: number;

    tableSSemanticReviewSignals: number;
    qualifiedTableAReviewSignals: number;
    totalSemanticReviewSignals: number;
  };

  /**
   * These are direct, source-grounded named degree-component
   * relationships only.
   *
   * They are deliberately kept separate from generic table choice pools.
   */
  explicitNamedRelationships: unknown[];

  /**
   * A candidate inside a choice pool is NOT a compulsory relationship.
   *
   * Example:
   * "choose a major from Table S" means the degree is related to the
   * CHOICE POOL, not that all 101 Table S majors are compulsory.
   */
  choicePools: {
    tableS: unknown[];
    qualifiedTableA: unknown[];
  };

  semanticReview: {
    tableS: unknown[];
    qualifiedTableA: unknown[];
  };
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

function getArray(
  source: UnknownRecord,
  keys: string[],
): unknown[] | null {
  for (const key of keys) {
    const value = source[key];

    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
}

function candidateCount(
  pools: unknown[],
): number {
  let total = 0;

  for (const pool of pools) {
    if (
      isRecord(pool) &&
      Array.isArray(pool.candidates)
    ) {
      total += pool.candidates.length;
    }
  }

  return total;
}

async function loadExplicitRelationships():
Promise<unknown[]> {
  const value = await readJson(
    EXPLICIT_FILE,
  );

  if (!isRecord(value)) {
    throw new Error(
      'Stage1 explicit relationship file must contain a JSON object.',
    );
  }

  const relationships = getArray(
    value,
    [
      'relationships',
      'explicitRelationships',
      'explicitNamedRelationships',
    ],
  );

  if (!relationships) {
    throw new Error(
      'Could not find explicit named relationships in usyd-degree-component-relationships.stage1.json.',
    );
  }

  return relationships;
}

async function loadChoiceFile(
  filePath: string,
  label: string,
): Promise<{
  choices: unknown[];
  reviewSignals: unknown[];
}> {
  const value = await readJson(
    filePath,
  );

  if (!isRecord(value)) {
    throw new Error(
      `${label} file must contain a JSON object.`,
    );
  }

  const choices = getArray(
    value,
    [
      'choices',
      'choicePools',
    ],
  );

  if (!choices) {
    throw new Error(
      `${label} file is missing choices[].`,
    );
  }

  const reviewSignals =
    getArray(
      value,
      [
        'semanticReviewSignals',
        'reviewSignals',
      ],
    ) ?? [];

  return {
    choices,
    reviewSignals,
  };
}

export async function collectUsydDegreeComponentStage2():
Promise<UsydDegreeComponentStage2Dataset> {
  const [
    explicitNamedRelationships,
    tableS,
    tableA,
  ] = await Promise.all([
    loadExplicitRelationships(),

    loadChoiceFile(
      TABLE_S_FILE,
      'Table S choice',
    ),

    loadChoiceFile(
      TABLE_A_FILE,
      'qualified Table A choice',
    ),
  ]);

  const tableSChoiceCandidates =
    candidateCount(
      tableS.choices,
    );

  const qualifiedTableAChoiceCandidates =
    candidateCount(
      tableA.choices,
    );

  return {
    university: 'USYD',
    handbookYear: 2026,
    generatedAt:
      new Date().toISOString(),

    status: {
      explicitNamedRelationships:
        'COMPLETE',

      tableSChoicePools:
        'COMPLETE',

      qualifiedTableAChoicePools:
        'COMPLETE',

      unqualifiedTableAChoicePools:
        'NOT_YET_RESOLVED',

      degreeRequirementSemantics:
        'NOT_YET_COMPLETE',

      recommendedStudyPlans:
        'NOT_YET_COMPLETE',
    },

    counts: {
      explicitNamedRelationships:
        explicitNamedRelationships.length,

      tableSChoicePools:
        tableS.choices.length,

      tableSChoiceCandidates,

      qualifiedTableAChoicePools:
        tableA.choices.length,

      qualifiedTableAChoiceCandidates,

      totalChoicePools:
        tableS.choices.length +
        tableA.choices.length,

      totalChoiceCandidates:
        tableSChoiceCandidates +
        qualifiedTableAChoiceCandidates,

      tableSSemanticReviewSignals:
        tableS.reviewSignals.length,

      qualifiedTableAReviewSignals:
        tableA.reviewSignals.length,

      totalSemanticReviewSignals:
        tableS.reviewSignals.length +
        tableA.reviewSignals.length,
    },

    explicitNamedRelationships,

    choicePools: {
      tableS:
        tableS.choices,

      qualifiedTableA:
        tableA.choices,
    },

    semanticReview: {
      tableS:
        tableS.reviewSignals,

      qualifiedTableA:
        tableA.reviewSignals,
    },
  };
}
