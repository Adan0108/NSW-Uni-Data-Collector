import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydTableSRoleEligibility,
} from './usyd.table-s-role-eligibility-audit';

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
    'usyd-table-s-role-eligibility-audit.json',
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
    await auditUsydTableSRoleEligibility();

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD Table S role eligibility audit] PASS',
  );

  console.log(
    `Role-gap groups: ${result.counts.tableSRoleGapGroups}`,
  );

  console.log(
    `Families: ${result.counts.tableSComponentFamilies}`,
  );

  console.log(
    `Requested missing types: ${result.requestedMissingTypes.join(', ') || 'NONE'}`,
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
