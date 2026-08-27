import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydTableSUnresolvedRoles,
} from './usyd.table-s-unresolved-role-audit';

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
    'usyd-table-s-unresolved-role-audit.json',
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
    await auditUsydTableSUnresolvedRoles();

  if (
    result.counts.fetchFailed >
    0
  ) {
    throw new Error(
      `Refusing to write: ${result.counts.fetchFailed} family/families had complete fetch failure.`,
    );
  }

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD Table S unresolved role audit] PASS',
  );

  console.log(
    `Input: ${result.counts.unresolvedFamiliesInput}`,
  );

  console.log(
    `Resolved: ${result.counts.resolved}`,
  );

  console.log(
    `Still unresolved: ${result.counts.stillUnresolved}`,
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
