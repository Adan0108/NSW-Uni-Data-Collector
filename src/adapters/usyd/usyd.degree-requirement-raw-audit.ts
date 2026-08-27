import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const ENRICHED_FILE = path.join(
  DATA_DIR,
  'usyd-degree-requirement-enriched.v2.json',
);

interface EnrichedClause {
  degreeCode: string;
  degreeTitle: string;
  sourcePath: string;
  sourceIndex: number;
  raw: string;
  status:
    | 'AUTHORITATIVE'
    | 'RAW_FALLBACK'
    | 'NON_REQUIREMENT';
  source:
    | 'AST_V2'
    | 'ENRICHMENT_V2';
  node: unknown;
  reasons: string[];
}

interface EnrichedDataset {
  clauses: EnrichedClause[];
}

export interface UsydRawFallbackReasonGroup {
  reason: string;
  count: number;
  degreeCount: number;

  samples: Array<{
    degreeCode: string;
    raw: string;
  }>;
}

export interface UsydDegreeRequirementRawAudit {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    clauses: number;
    authoritative: number;
    rawFallback: number;
    nonRequirement: number;

    rawWithExplicitReasons: number;
    rawUnsupportedSafePatternOnly: number;
    rawLargeResolutionBlocks: number;
    rawNestedNumbering: number;
    rawMixedAndOr: number;
    rawConditional: number;

    degreesWithRawFallback: number;
    degreesFullyStructuredAtClauseLevel: number;

    emptyReasonRawFallbacks: number;
  };

  reasons:
    UsydRawFallbackReasonGroup[];

  degreeSummary: Array<{
    degreeCode: string;
    rawFallbackCount: number;
    authoritativeCount: number;
  }>;

  coverage: {
    rawFallbackAudit: 'COMPLETE';
    rawPreservation: 'COMPLETE';
    semanticFreezeDecision: 'READY_FOR_REVIEW';
  };
}

async function readEnriched():
Promise<EnrichedDataset> {
  const raw =
    await fs.readFile(
      ENRICHED_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as EnrichedDataset;

  if (
    !Array.isArray(
      parsed.clauses,
    )
  ) {
    throw new Error(
      'Enriched V2 dataset is missing clauses[]. Run the V2 enrichment writer first.',
    );
  }

  return parsed;
}

export async function buildUsydDegreeRequirementRawAuditV1():
Promise<UsydDegreeRequirementRawAudit> {
  const enriched =
    await readEnriched();

  const rawFallback =
    enriched.clauses.filter(
      (clause) =>
        clause.status ===
        'RAW_FALLBACK',
    );

  const authoritative =
    enriched.clauses.filter(
      (clause) =>
        clause.status ===
        'AUTHORITATIVE',
    );

  const nonRequirement =
    enriched.clauses.filter(
      (clause) =>
        clause.status ===
        'NON_REQUIREMENT',
    );

  const reasonMap =
    new Map<
      string,
      EnrichedClause[]
    >();

  for (
    const clause
    of rawFallback
  ) {
    const reasons =
      clause.reasons.length >
      0
        ? clause.reasons
        : ['NO_REASON'];

    for (
      const reason
      of reasons
    ) {
      const current =
        reasonMap.get(
          reason,
        ) ??
        [];

      current.push(
        clause,
      );

      reasonMap.set(
        reason,
        current,
      );
    }
  }

  const reasons:
    UsydRawFallbackReasonGroup[] =
    [
      ...reasonMap.entries(),
    ]
      .map(
        (
          [
            reason,
            clauses,
          ],
        ) => ({
          reason,

          count:
            clauses.length,

          degreeCount:
            new Set(
              clauses.map(
                (clause) =>
                  clause.degreeCode,
              ),
            ).size,

          samples:
            clauses
              .slice(
                0,
                8,
              )
              .map(
                (clause) => ({
                  degreeCode:
                    clause.degreeCode,

                  raw:
                    clause.raw,
                }),
              ),
        }),
      )
      .sort(
        (
          left,
          right,
        ) =>
          right.count -
            left.count ||
          left.reason.localeCompare(
            right.reason,
          ),
      );

  const degreeCodes =
    [
      ...new Set(
        enriched.clauses.map(
          (clause) =>
            clause.degreeCode,
        ),
      ),
    ].sort();

  const degreeSummary =
    degreeCodes.map(
      (degreeCode) => ({
        degreeCode,

        rawFallbackCount:
          rawFallback.filter(
            (clause) =>
              clause.degreeCode ===
              degreeCode,
          ).length,

        authoritativeCount:
          authoritative.filter(
            (clause) =>
              clause.degreeCode ===
              degreeCode,
          ).length,
      }),
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      clauses:
        enriched.clauses.length,

      authoritative:
        authoritative.length,

      rawFallback:
        rawFallback.length,

      nonRequirement:
        nonRequirement.length,

      rawWithExplicitReasons:
        rawFallback.filter(
          (clause) =>
            clause.reasons.length >
            0,
        ).length,

      rawUnsupportedSafePatternOnly:
        rawFallback.filter(
          (clause) =>
            clause.reasons.length ===
              1 &&
            clause.reasons[0] ===
              'UNSUPPORTED_SAFE_PATTERN',
        ).length,

      rawLargeResolutionBlocks:
        rawFallback.filter(
          (clause) =>
            clause.raw.length >
            900,
        ).length,

      rawNestedNumbering:
        rawFallback.filter(
          (clause) =>
            clause.reasons.includes(
              'NESTED_NUMBERING',
            ),
        ).length,

      rawMixedAndOr:
        rawFallback.filter(
          (clause) =>
            clause.reasons.includes(
              'MIXED_AND_OR_PRECEDENCE',
            ),
        ).length,

      rawConditional:
        rawFallback.filter(
          (clause) =>
            clause.reasons.includes(
              'CONDITIONAL_LANGUAGE',
            ),
        ).length,

      degreesWithRawFallback:
        degreeSummary.filter(
          (degree) =>
            degree.rawFallbackCount >
            0,
        ).length,

      degreesFullyStructuredAtClauseLevel:
        degreeSummary.filter(
          (degree) =>
            degree.rawFallbackCount ===
            0,
        ).length,

      emptyReasonRawFallbacks:
        rawFallback.filter(
          (clause) =>
            clause.reasons.length ===
            0,
        ).length,
    },

    reasons,

    degreeSummary,

    coverage: {
      rawFallbackAudit:
        'COMPLETE',

      rawPreservation:
        'COMPLETE',

      semanticFreezeDecision:
        'READY_FOR_REVIEW',
    },
  };
}

export async function writeUsydDegreeRequirementRawAuditV1():
Promise<void> {
  const result =
    await buildUsydDegreeRequirementRawAuditV1();

  if (
    result.counts
      .emptyReasonRawFallbacks !==
      0
  ) {
    throw new Error(
      `Refusing to write RAW audit: ${result.counts.emptyReasonRawFallbacks} RAW fallbacks have no reason.`,
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-degree-requirement-raw-audit.v1.json',
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
    '[USYD degree requirement RAW audit V1] PASS',
  );

  console.log(
    `RAW fallbacks: ${result.counts.rawFallback}`,
  );

  console.log(
    `Degrees with RAW fallback: ${result.counts.degreesWithRawFallback}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
