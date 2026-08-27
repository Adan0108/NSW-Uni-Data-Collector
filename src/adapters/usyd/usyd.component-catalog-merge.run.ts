import fs from 'node:fs/promises';
import path from 'node:path';

import {
  mergeUsydComponentCatalog,
} from './usyd.component-catalog-merge';

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
    'usyd-components-complete.json',
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
    await mergeUsydComponentCatalog();

  if (
    result.baseComponentCount !==
      358 ||
    result.supplementalComponentCount !==
      9 ||
    result.totalComponentCount !==
      367 ||
    result.duplicateKeys.length !==
      0
  ) {
    throw new Error(
      `Refusing to write merged component catalogue: base=${result.baseComponentCount}, supplemental=${result.supplementalComponentCount}, total=${result.totalComponentCount}, duplicates=${result.duplicateKeys.length}.`,
    );
  }

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD component catalog merge] PASS',
  );

  console.log(
    `Base: ${result.baseComponentCount}`,
  );

  console.log(
    `Supplemental: ${result.supplementalComponentCount}`,
  );

  console.log(
    `Total: ${result.totalComponentCount}`,
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
