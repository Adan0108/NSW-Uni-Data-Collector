import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydUnqualifiedTableARoleCoverage,
} from './usyd.unqualified-table-a-role-coverage-audit';

const OUTPUT_FILE = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-unqualified-table-a-role-coverage-audit.json',
);

async function main():
Promise<void> {
  const result =
    await auditUsydUnqualifiedTableARoleCoverage();

  if (
    result.counts.eligibleSignals !==
      46 ||
    result.counts.requestedScopeRolePairs !==
      11
  ) {
    throw new Error(
      'Refusing to write unqualified Table A role audit because expected V3 coverage changed.',
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
    '[USYD unqualified Table A role coverage] PASS',
  );

  console.log(
    `Eligible records: ${result.counts.eligibleSignals}`,
  );

  console.log(
    `Scope/role pairs: ${result.counts.requestedScopeRolePairs}`,
  );

  console.log(
    `With candidates: ${result.counts.pairsWithCandidates}`,
  );

  console.log(
    `Zero candidates: ${result.counts.pairsWithoutCandidates}`,
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
