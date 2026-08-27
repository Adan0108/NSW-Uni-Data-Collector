import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydComponentRoleCoverage,
} from './usyd.component-role-coverage-audit';

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
    'usyd-component-role-coverage.json',
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
    await auditUsydComponentRoleCoverage();

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD component role coverage] PASS',
  );

  console.log(
    `Named evidence: ${result.namedEvidenceCount}`,
  );

  console.log(
    `Resolved same-handbook: ${result.resolvedSameHandbookCount}`,
  );

  console.log(
    `Missing role: ${result.missingRoleCount}`,
  );

  console.log(
    `Missing family: ${result.missingFamilyCount}`,
  );

  console.log(
    `Only other handbook: ${result.onlyOtherHandbookCount}`,
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
