import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const STAGE2_FILE = path.join(
  DATA_DIR,
  'usyd-degree-component-relationships.stage2.json',
);

const TABLE_S_FILE = path.join(
  DATA_DIR,
  'usyd-table-s-degree-component-choices.json',
);

const QUALIFIED_ORIGINAL_FILE = path.join(
  DATA_DIR,
  'usyd-qualified-table-a-degree-component-choices.json',
);

const RECONCILED_QUALIFIED_FILE = path.join(
  DATA_DIR,
  'usyd-qualified-table-a-degree-component-choices.reconciled.json',
);

const UNQUALIFIED_FILE = path.join(
  DATA_DIR,
  'usyd-unqualified-table-a-degree-component-choices.json',
);

type UnknownRecord = Record<string, unknown>;

export interface UsydDegreeComponentFinalMerge {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    explicitNamedRelationships: number;
    tableSChoicePools: number;
    qualifiedTableAChoicePools: number;
    unqualifiedTableAChoicePools: number;
    totalChoicePools: number;

    tableSSemanticReviewSignals: number;
    qualifiedTableASemanticReviewSignals: number;
    semanticReviewSignals: number;

    duplicateQualifiedPoolKeys: number;
    duplicateUnqualifiedPoolKeys: number;
    duplicateCrossLayerPoolKeys: number;
  };

  relationshipLayers: {
    explicitNamedRelationships: unknown[];

    choicePools: {
      tableS: unknown[];
      qualifiedTableA: unknown[];
      unqualifiedTableA: unknown[];
    };

    semanticReview: {
      tableS: unknown[];
      qualifiedTableA: unknown[];
      all: unknown[];
    };
  };

  coverage: {
    explicitNamedRelationships: 'COMPLETE';
    tableSChoicePools: 'COMPLETE';
    qualifiedTableAChoicePools: 'COMPLETE_RECONCILED_2026';
    unqualifiedTableAChoicePools: 'COMPLETE';
    tableAAndTableSComponentRelationships: 'COMPLETE';

    degreeRequirementSemantics: 'NOT_YET_COMPLETE';
    recommendedStudyPlans: 'NOT_YET_COMPLETE';
  };

  sourceArtifacts: {
    stage2: string;
    tableS: string;
    qualifiedOriginal: string;
    reconciledQualifiedTableA: string;
    unqualifiedTableA: string;
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
  const raw =
    await fs.readFile(
      filePath,
      'utf8',
    );

  return JSON.parse(raw) as unknown;
}

function getArray(
  record: UnknownRecord,
  keys: string[],
): unknown[] | null {
  for (const key of keys) {
    if (
      Array.isArray(
        record[key],
      )
    ) {
      return record[key] as
        unknown[];
    }
  }

  return null;
}

function arrayFromContainer(
  value: unknown,
  preferredKeys: string[],
): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  return (
    getArray(
      value,
      preferredKeys,
    ) ??
    []
  );
}

function getExplicitNamed(
  stage2: UnknownRecord,
): unknown[] {
  const direct =
    getArray(
      stage2,
      [
        'explicitNamedRelationships',
        'explicitRelationships',
        'namedRelationships',
      ],
    );

  if (direct) {
    return direct;
  }

  if (
    isRecord(
      stage2.relationshipLayers,
    )
  ) {
    const nested =
      getArray(
        stage2.relationshipLayers,
        [
          'explicitNamedRelationships',
          'explicitRelationships',
          'namedRelationships',
        ],
      );

    if (nested) {
      return nested;
    }
  }

  throw new Error(
    'Could not locate Stage2 explicit named relationships.',
  );
}

function getChoicePoolsObject(
  stage2: UnknownRecord,
): UnknownRecord {
  if (
    isRecord(
      stage2.choicePools,
    )
  ) {
    return stage2.choicePools;
  }

  if (
    isRecord(
      stage2.relationshipLayers,
    ) &&
    isRecord(
      stage2.relationshipLayers
        .choicePools,
    )
  ) {
    return stage2.relationshipLayers
      .choicePools;
  }

  throw new Error(
    'Could not locate Stage2 choicePools object.',
  );
}

function getTableS(
  stage2: UnknownRecord,
): unknown[] {
  const choicePools =
    getChoicePoolsObject(
      stage2,
    );

  const result =
    getArray(
      choicePools,
      [
        'tableS',
        'tableSChoicePools',
        'sharedTableS',
      ],
    );

  if (result) {
    return result;
  }

  throw new Error(
    'Could not locate Stage2 Table S choice pools.',
  );
}

/**
 * Recursively collect arrays whose property name clearly denotes a review
 * bucket. This is used only on the two original source artifacts:
 *   - Table S choices
 *   - qualified Table A choices
 *
 * We intentionally do NOT infer reviews from arbitrary text fields.
 */
function collectReviewArrays(
  value: unknown,
): unknown[] {
  const collected:
    unknown[] = [];

  const visit =
    (
      current: unknown,
    ) => {
      if (
        Array.isArray(
          current,
        )
      ) {
        for (
          const item
          of current
        ) {
          visit(
            item,
          );
        }

        return;
      }

      if (
        !isRecord(
          current,
        )
      ) {
        return;
      }

      for (
        const [
          key,
          child,
        ]
        of Object.entries(
          current,
        )
      ) {
        const normalizedKey =
          key
            .replace(/[^a-z0-9]/gi, '')
            .toLowerCase();

        const isReviewKey =
          normalizedKey.includes(
            'semanticreview',
          ) ||
          normalizedKey ===
            'reviewsignals' ||
          normalizedKey ===
            'review' ||
          normalizedKey ===
            'reviewitems';

        if (
          isReviewKey &&
          Array.isArray(
            child,
          )
        ) {
          collected.push(
            ...child,
          );

          continue;
        }

        visit(
          child,
        );
      }
    };

  visit(
    value,
  );

  const seen =
    new Set<string>();

  const unique:
    unknown[] = [];

  for (
    const item
    of collected
  ) {
    const key =
      JSON.stringify(
        item,
      );

    if (
      !seen.has(
        key,
      )
    ) {
      seen.add(
        key,
      );

      unique.push(
        item,
      );
    }
  }

  return unique;
}

function canonical(
  value: string,
): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase(
      'en-AU',
    );
}

function poolKey(
  value: unknown,
): string {
  if (!isRecord(value)) {
    return JSON.stringify(value);
  }

  const degreeCode =
    String(
      value.degreeCode ??
      value.degree ??
      value.awardCode ??
      '',
    );

  const role =
    String(
      value.role ??
      value.requestedComponentType ??
      value.componentType ??
      '',
    );

  const tableName =
    String(
      value.tableName ??
      value.table ??
      '',
    );

  const scopes =
    Array.isArray(
      value.scopes,
    )
      ? value.scopes
          .map(String)
          .join('+')
      : '';

  const raw =
    String(
      value.sourceRaw ??
      value.raw ??
      '',
    );

  return [
    canonical(
      degreeCode,
    ),
    canonical(
      role,
    ),
    canonical(
      tableName ||
      scopes,
    ),
    canonical(
      raw,
    ),
  ].join('|');
}

function duplicateCount(
  values: unknown[],
): number {
  const keys =
    values.map(
      poolKey,
    );

  return keys.length -
    new Set(keys).size;
}

function crossLayerDuplicateCount(
  left: unknown[],
  right: unknown[],
): number {
  const leftKeys =
    new Set(
      left.map(
        poolKey,
      ),
    );

  return right.filter(
    (item) =>
      leftKeys.has(
        poolKey(item),
      ),
  ).length;
}

export async function buildUsydDegreeComponentFinalMerge():
Promise<UsydDegreeComponentFinalMerge> {
  const [
    stage2Raw,
    tableSRaw,
    qualifiedOriginalRaw,
    qualifiedReconciledRaw,
    unqualifiedRaw,
  ] =
    await Promise.all([
      readJson(
        STAGE2_FILE,
      ),

      readJson(
        TABLE_S_FILE,
      ),

      readJson(
        QUALIFIED_ORIGINAL_FILE,
      ),

      readJson(
        RECONCILED_QUALIFIED_FILE,
      ),

      readJson(
        UNQUALIFIED_FILE,
      ),
    ]);

  if (
    !isRecord(
      stage2Raw,
    )
  ) {
    throw new Error(
      'Stage2 relationship file must contain an object.',
    );
  }

  const explicitNamed =
    getExplicitNamed(
      stage2Raw,
    );

  const tableS =
    getTableS(
      stage2Raw,
    );

  const qualified =
    arrayFromContainer(
      qualifiedReconciledRaw,
      [
        'choices',
        'pools',
      ],
    );

  const unqualified =
    arrayFromContainer(
      unqualifiedRaw,
      [
        'pools',
        'choices',
      ],
    );

  /**
   * IMPORTANT V3 FIX:
   * read review signals from the ORIGINAL source artifacts directly.
   * Stage2 never guaranteed that review arrays were embedded in the merge.
   */
  const tableSReview =
    collectReviewArrays(
      tableSRaw,
    );

  const qualifiedReview =
    collectReviewArrays(
      qualifiedOriginalRaw,
    );

  const semanticReview =
    [
      ...tableSReview,
      ...qualifiedReview,
    ];

  if (
    explicitNamed.length !==
    18
  ) {
    throw new Error(
      `Expected 18 explicit named relationships, got ${explicitNamed.length}.`,
    );
  }

  if (
    tableS.length !==
    33
  ) {
    throw new Error(
      `Expected 33 Table S choice pools, got ${tableS.length}.`,
    );
  }

  if (
    qualified.length !==
    18
  ) {
    throw new Error(
      `Expected 18 reconciled qualified Table A pools, got ${qualified.length}.`,
    );
  }

  if (
    unqualified.length !==
    46
  ) {
    throw new Error(
      `Expected 46 unqualified Table A pools, got ${unqualified.length}.`,
    );
  }

  const duplicateQualifiedPoolKeys =
    duplicateCount(
      qualified,
    );

  const duplicateUnqualifiedPoolKeys =
    duplicateCount(
      unqualified,
    );

  const duplicateCrossLayerPoolKeys =
    crossLayerDuplicateCount(
      qualified,
      unqualified,
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      explicitNamedRelationships:
        explicitNamed.length,

      tableSChoicePools:
        tableS.length,

      qualifiedTableAChoicePools:
        qualified.length,

      unqualifiedTableAChoicePools:
        unqualified.length,

      totalChoicePools:
        tableS.length +
        qualified.length +
        unqualified.length,

      tableSSemanticReviewSignals:
        tableSReview.length,

      qualifiedTableASemanticReviewSignals:
        qualifiedReview.length,

      semanticReviewSignals:
        semanticReview.length,

      duplicateQualifiedPoolKeys,

      duplicateUnqualifiedPoolKeys,

      duplicateCrossLayerPoolKeys,
    },

    relationshipLayers: {
      explicitNamedRelationships:
        explicitNamed,

      choicePools: {
        tableS,

        qualifiedTableA:
          qualified,

        unqualifiedTableA:
          unqualified,
      },

      semanticReview: {
        tableS:
          tableSReview,

        qualifiedTableA:
          qualifiedReview,

        all:
          semanticReview,
      },
    },

    coverage: {
      explicitNamedRelationships:
        'COMPLETE',

      tableSChoicePools:
        'COMPLETE',

      qualifiedTableAChoicePools:
        'COMPLETE_RECONCILED_2026',

      unqualifiedTableAChoicePools:
        'COMPLETE',

      tableAAndTableSComponentRelationships:
        'COMPLETE',

      degreeRequirementSemantics:
        'NOT_YET_COMPLETE',

      recommendedStudyPlans:
        'NOT_YET_COMPLETE',
    },

    sourceArtifacts: {
      stage2:
        STAGE2_FILE,

      tableS:
        TABLE_S_FILE,

      qualifiedOriginal:
        QUALIFIED_ORIGINAL_FILE,

      reconciledQualifiedTableA:
        RECONCILED_QUALIFIED_FILE,

      unqualifiedTableA:
        UNQUALIFIED_FILE,
    },
  };
}

export async function writeUsydDegreeComponentFinalMerge():
Promise<void> {
  const result =
    await buildUsydDegreeComponentFinalMerge();

  if (
    result.counts
      .duplicateQualifiedPoolKeys !==
      0 ||
    result.counts
      .duplicateUnqualifiedPoolKeys !==
      0 ||
    result.counts
      .duplicateCrossLayerPoolKeys !==
      0 ||
    result.counts
      .tableSSemanticReviewSignals !==
      2 ||
    result.counts
      .qualifiedTableASemanticReviewSignals !==
      5 ||
    result.counts
      .semanticReviewSignals !==
      7
  ) {
    throw new Error(
      [
        'Refusing to write final degree-component relationship layer.',
        `tableSReview=${result.counts.tableSSemanticReviewSignals} (expected 2)`,
        `qualifiedReview=${result.counts.qualifiedTableASemanticReviewSignals} (expected 5)`,
        `totalReview=${result.counts.semanticReviewSignals} (expected 7)`,
        `qualifiedDuplicates=${result.counts.duplicateQualifiedPoolKeys}`,
        `unqualifiedDuplicates=${result.counts.duplicateUnqualifiedPoolKeys}`,
        `crossLayerDuplicates=${result.counts.duplicateCrossLayerPoolKeys}`,
      ].join(' '),
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-degree-component-relationships.final.json',
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
    '[USYD final degree-component relationship merge V3] PASS',
  );

  console.log(
    `Explicit named relationships: ${result.counts.explicitNamedRelationships}`,
  );

  console.log(
    `Table S pools: ${result.counts.tableSChoicePools}`,
  );

  console.log(
    `Qualified Table A pools: ${result.counts.qualifiedTableAChoicePools}`,
  );

  console.log(
    `Unqualified Table A pools: ${result.counts.unqualifiedTableAChoicePools}`,
  );

  console.log(
    `Total choice pools: ${result.counts.totalChoicePools}`,
  );

  console.log(
    `Table S semantic review: ${result.counts.tableSSemanticReviewSignals}`,
  );

  console.log(
    `Qualified Table A semantic review: ${result.counts.qualifiedTableASemanticReviewSignals}`,
  );

  console.log(
    `Total semantic review: ${result.counts.semanticReviewSignals}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
