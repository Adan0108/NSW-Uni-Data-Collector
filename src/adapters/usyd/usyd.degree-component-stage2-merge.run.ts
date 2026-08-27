import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydDegreeComponentStage2,
} from './usyd.degree-component-stage2-merge';

const OUTPUT_FILE = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-degree-component-relationships.stage2.json',
);

async function main():
Promise<void> {
  const result =
    await collectUsydDegreeComponentStage2();

  if (
    result.counts.explicitNamedRelationships !==
      18 ||
    result.counts.tableSChoicePools !==
      33 ||
    result.counts.tableSChoiceCandidates !==
      3333 ||
    result.counts.qualifiedTableAChoicePools !==
      18 ||
    result.counts.qualifiedTableAChoiceCandidates !==
      462 ||
    result.counts.tableSSemanticReviewSignals !==
      2 ||
    result.counts.qualifiedTableAReviewSignals !==
      5
  ) {
    throw new Error(
      'Refusing to write Stage2 because expected relationship coverage changed.',
    );
  }

  const temporary =
    `${OUTPUT_FILE}.tmp`;

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
    OUTPUT_FILE,
  );

  console.log(
    '[USYD degree-component Stage2 merge] PASS',
  );

  console.log(
    `Explicit: ${result.counts.explicitNamedRelationships}`,
  );

  console.log(
    `Choice pools: ${result.counts.totalChoicePools}`,
  );

  console.log(
    `Choice candidates: ${result.counts.totalChoiceCandidates}`,
  );

  console.log(
    `Semantic review: ${result.counts.totalSemanticReviewSignals}`,
  );

  console.log(
    `Output: ${OUTPUT_FILE}`,
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
