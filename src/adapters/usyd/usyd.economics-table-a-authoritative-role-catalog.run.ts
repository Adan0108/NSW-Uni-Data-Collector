import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydEconomicsTableAAuthoritativeRoles,
} from './usyd.economics-table-a-authoritative-role-catalog';

const OUTPUT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    '2026',
    'usyd-economics-table-a-authoritative-roles.json',
  );

async function main():
Promise<void> {
  const result =
    await collectUsydEconomicsTableAAuthoritativeRoles();

  if (
    result.counts.roles !==
      6 ||
    result.counts.majors !==
      3 ||
    result.counts.minors !==
      3 ||
    result.counts.unresolvedFamilies !==
      0
  ) {
    throw new Error(
      'Refusing to write Economics Table A authoritative roles because expected role coverage is not satisfied.',
    );
  }

  const temporary =
    `${OUTPUT_FILE}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      result,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    OUTPUT_FILE,
  );

  console.log(
    '[USYD Economics Table A authoritative roles] PASS',
  );

  console.log(
    `Roles: ${result.counts.roles}`,
  );

  console.log(
    `Majors: ${result.counts.majors}`,
  );

  console.log(
    `Minors: ${result.counts.minors}`,
  );

  console.log(
    `Supplemental: ${result.counts.supplementalRoles}`,
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
