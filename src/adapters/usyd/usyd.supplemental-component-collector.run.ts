import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydSupplementalComponents,
} from './usyd.supplemental-component-collector';

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
    'usyd-supplemental-components.json',
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
    await collectUsydSupplementalComponents();

  if (
    result.uniqueSupplementalComponents !==
    9
  ) {
    throw new Error(
      `Expected 9 supplemental components, got ${result.uniqueSupplementalComponents}.`,
    );
  }

  const missingCp =
    result.components.filter(
      (
        component,
      ) =>
        component.requiredCreditPoints ===
        null,
    );

  if (
    missingCp.length >
    0
  ) {
    throw new Error(
      `Refusing to write: ${missingCp.length} supplemental component(s) have no explicit CP value.`,
    );
  }

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD supplemental components] PASS',
  );

  console.log(
    `Components: ${result.uniqueSupplementalComponents}`,
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
