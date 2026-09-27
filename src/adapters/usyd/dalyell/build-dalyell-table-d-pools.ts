import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';

import {
  applyDalyellTableDPools,
  type DalyellMaster,
} from './dalyell-table-d.js';

const INPUT_FILE =
  resolve(
    process.cwd(),
    'data/normalized/usyd/2026/usyd-master-final.engineering-repaired.subjects-resolved.json',
  );

const REPORT_FILE =
  resolve(
    process.cwd(),
    'data/normalized/usyd/2026/usyd-dalyell-table-d-report.json',
  );

async function main():
Promise<void> {
  const master =
    JSON.parse(
      await readFile(
        INPUT_FILE,
        'utf8',
      ),
    ) as DalyellMaster;

  const result =
    applyDalyellTableDPools(
      master,
    );

  const report = {
    generatedAt:
      new Date()
        .toISOString(),
    ...result,
  };

  await writeFile(
    INPUT_FILE,
    JSON.stringify(
      master,
      null,
      2,
    ) + '\n',
    'utf8',
  );

  await writeFile(
    REPORT_FILE,
    JSON.stringify(
      report,
      null,
      2,
    ) + '\n',
    'utf8',
  );

  console.log(
    '================================',
  );
  console.log(
    'USYD DALYELL TABLE D POOLS',
  );
  console.log(
    '================================',
  );
  console.log(
    `Authoritative source: ${result.sourceUrl}`,
  );
  console.log(
    `Table D subjects: ${result.subjectCodes.length}`,
  );
  console.log(
    `Canonical subjects: ${result.canonicalSubjectCount}`,
  );
  console.log(
    `Unresolved subjects: ${result.unresolvedSubjectCodes.length}`,
  );
  console.log(
    `Dalyell requirements linked: ${result.authoritativeRequirementCount}`,
  );
  console.log(
    `Credit-point distribution: ${JSON.stringify(result.creditPointCounts)}`,
  );
  console.log(
    `Table D candidate memberships: ${result.candidateMembershipCount}`,
  );
  console.log(
    `Saved: ${INPUT_FILE}`,
  );
  console.log(
    `Report: ${REPORT_FILE}`,
  );
}

main().catch(
  (
    error:
      unknown,
  ) => {
    console.error(
      error,
    );
    process.exitCode =
      1;
  },
);
