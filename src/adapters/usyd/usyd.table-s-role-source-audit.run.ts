import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydTableSRoleSourceEvidence,
} from './usyd.table-s-role-source-audit';

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
    'usyd-table-s-role-source-audit.json',
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
    await auditUsydTableSRoleSourceEvidence();

  if (
    result.counts.fetchFailed >
    0
  ) {
    throw new Error(
      `Refusing to write: ${result.counts.fetchFailed} Table S overview page(s) failed to fetch.`,
    );
  }

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD Table S role source audit] PASS',
  );

  console.log(
    `Families: ${result.counts.familiesInspected}`,
  );

  console.log(
    `MINOR supported: ${result.counts.minorSupported}`,
  );

  console.log(
    `PROGRAM supported: ${result.counts.programSupported}`,
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
