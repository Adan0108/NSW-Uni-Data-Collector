import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydTableSDegreeComponentChoices,
} from './usyd.table-s-degree-component-choice-resolver';

const HANDBOOK_YEAR =
  2026;

const OUTPUT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
    'usyd-table-s-degree-component-choices.json',
  );

async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  const temporary =
    `${filePath}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      value,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    filePath,
  );
}

async function main():
Promise<void> {
  const result =
    await collectUsydTableSDegreeComponentChoices();

  const badChoice =
    result.choices.some(
      (
        choice,
      ) =>
        choice.candidates.length !==
        101,
    );

  if (
    badChoice
  ) {
    throw new Error(
      'Refusing to write Table S choices because one or more pools do not contain exactly 101 authoritative candidates.',
    );
  }

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD Table S degree-component choices] PASS',
  );

  console.log(
    `Choice pools: ${result.counts.choicePools}`,
  );

  console.log(
    `Degrees: ${result.counts.degreesWithTableSChoices}`,
  );

  console.log(
    `Table-only ignored: ${result.counts.tableOnlySignalsIgnored}`,
  );

  console.log(
    `Semantic review: ${result.counts.semanticReviewSignals}`,
  );

  console.log(
    `Output: ${OUTPUT_FILE}`,
  );
}

main().catch(
  (
    error,
  ) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
