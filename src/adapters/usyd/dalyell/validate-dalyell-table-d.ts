import {
  readFile,
} from 'node:fs/promises';
import {
  resolve,
} from 'node:path';

import {
  type DalyellMaster,
  validateDalyellTableD,
} from './dalyell-table-d.js';

const INPUT_FILE =
  resolve(
    process.cwd(),
    'data/normalized/usyd/2026/usyd-master-final.database-ready.json',
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
    validateDalyellTableD(
      master,
    );

  console.log(
    '================================',
  );
  console.log(
    'USYD DALYELL TABLE D VALIDATION',
  );
  console.log(
    '================================',
  );
  console.log({
    sourceUrl:
      result.sourceUrl,
    tableDSubjects:
      result.subjectCodes.length,
    canonicalSubjects:
      result.canonicalSubjectCount,
    unresolvedSubjects:
      result.unresolvedSubjectCodes.length,
    authoritativeRequirements:
      result.authoritativeRequirementCount,
    creditPointCounts:
      result.creditPointCounts,
    candidateSources:
      result.candidateSourceCount,
    candidateMemberships:
      result.candidateMembershipCount,
    engineeringUndergraduateSubjects:
      result.engineeringUndergraduateSubjectCount,
    tableSSubjects:
      result.tableSSubjectCount,
  });
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
