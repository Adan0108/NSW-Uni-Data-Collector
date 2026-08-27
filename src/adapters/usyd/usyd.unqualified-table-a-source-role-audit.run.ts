import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydUnqualifiedTableASourceRoles,
} from './usyd.unqualified-table-a-source-role-audit';

const OUTPUT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    '2026',
    'usyd-unqualified-table-a-source-role-audit.json',
  );

async function main():
Promise<void> {
  const result =
    await auditUsydUnqualifiedTableASourceRoles();

  if (
    result.counts.requestedPairs !==
    11
  ) {
    throw new Error(
      'Refusing to write source-role V2 because expected role-pair coverage changed.',
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
    '[USYD unqualified Table A source-role audit V2] PASS',
  );

  console.log(
    `Pairs: ${result.counts.requestedPairs}`,
  );

  console.log(
    `Pairs with evidence: ${result.counts.pairsWithAnyExplicitRoleEvidence}`,
  );

  console.log(
    `Zero-evidence pairs: ${result.counts.pairsWithZeroExplicitRoleEvidence}`,
  );

  console.log(
    `Authoritative names: ${result.counts.totalAuthoritativeNames}`,
  );

  console.log(
    `Fetch failures: ${result.counts.fetchFailures}`,
  );

  console.log(
    `Output: ${OUTPUT_FILE}`,
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
