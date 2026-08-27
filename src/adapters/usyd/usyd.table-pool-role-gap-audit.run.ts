import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydTablePoolRoleGaps,
} from './usyd.table-pool-role-gap-audit';

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
    'usyd-table-pool-role-gap-audit.json',
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
    await auditUsydTablePoolRoleGaps();

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD table-pool role gap audit] PASS',
  );

  console.log(
    `Inspected: ${result.counts.inspectedGroups}`,
  );

  console.log(
    `Role variant missing: ${result.counts.roleVariantMissing}`,
  );

  console.log(
    `No pool: ${result.counts.noComponentPool}`,
  );

  console.log(
    `False stream: ${result.counts.likelyFalseStreamSignal}`,
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
