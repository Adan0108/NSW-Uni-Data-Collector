import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydTableSAuthoritativeRoleCatalog,
} from './usyd.table-s-authoritative-role-catalog';

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
    'usyd-table-s-authoritative-roles.json',
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
    await collectUsydTableSAuthoritativeRoleCatalog();

  if (
    result.counts.authoritativeMajors !==
      101 ||
    result.counts.authoritativeMinors !==
      101 ||
    result.counts.authoritativePrograms !==
      0 ||
    result.counts.authoritativeRoles !==
      202 ||
    result.counts.unresolvedFamilies !==
      0
  ) {
    throw new Error(
      'Refusing to write final Table S authoritative role catalogue because expected final role counts are not satisfied.',
    );
  }

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD Table S authoritative roles] PASS',
  );

  console.log(
    `Roles: ${result.counts.authoritativeRoles}`,
  );

  console.log(
    `Majors: ${result.counts.authoritativeMajors}`,
  );

  console.log(
    `Minors: ${result.counts.authoritativeMinors}`,
  );

  console.log(
    `Programs: ${result.counts.authoritativePrograms}`,
  );

  console.log(
    `Supplemental: ${result.counts.supplementalRoles}`,
  );

  console.log(
    `Contradictions: ${result.counts.contradictions}`,
  );

  console.log(
    `Unresolved: ${result.counts.unresolvedFamilies}`,
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
