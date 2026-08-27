import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydDegreeTableOwnership,
} from './usyd.degree-table-mapper';

const HANDBOOK_YEAR =
  2026;

const OUTPUT_DIR =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
  );

const OUTPUT_FILE =
  path.join(
    OUTPUT_DIR,
    'usyd-degree-table-ownership.json',
  );

async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  const temporaryPath =
    `${filePath}.tmp`;

  await fs.writeFile(
    temporaryPath,
    JSON.stringify(
      value,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporaryPath,
    filePath,
  );
}

async function main():
Promise<void> {
  console.log(
    '[USYD degree table ownership] collecting...',
  );

  const result =
    await collectUsydDegreeTableOwnership();

  if (
    result.discoveredTableCount !==
      37 ||
    result.mappedTableCount !==
      37 ||
    result.unresolvedCount !==
      0
  ) {
    throw new Error(
      [
        'Degree table ownership is not clean.',
        `discovered=${result.discoveredTableCount}`,
        `mapped=${result.mappedTableCount}`,
        `unresolved=${result.unresolvedCount}`,
        'Run usyd.degree-table-mapper.test-run.ts first.',
      ].join(
        ' ',
      ),
    );
  }

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive:
        true,
    },
  );

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD degree table ownership] PASS',
  );

  console.log(
    `Tables: ${result.discoveredTableCount}`,
  );

  console.log(
    `DIRECT: ${result.directCount}`,
  );

  console.log(
    `SHARED: ${result.sharedCount}`,
  );

  console.log(
    `UNRESOLVED: ${result.unresolvedCount}`,
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
