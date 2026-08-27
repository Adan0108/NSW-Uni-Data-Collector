import {
  buildUsydUnqualifiedTableAChoicePools,
} from './usyd.unqualified-table-a-choice-pool-builder';

function divider():
void {
  console.log(
    '================================',
  );
}

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD UNQUALIFIED TABLE A CHOICE POOL BUILDER',
  );

  divider();

  const result =
    await buildUsydUnqualifiedTableAChoicePools();

  console.log(
    `Eligible signals: ${result.counts.eligibleSignals}`,
  );

  console.log(
    `Qualified duplicates excluded: ${result.counts.qualifiedDuplicatesExcluded}`,
  );

  console.log(
    `Choice pools: ${result.counts.choicePools}`,
  );

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Candidate occurrences: ${result.counts.totalCandidateOccurrences}`,
  );

  console.log(
    `Exact-scope pools: ${result.counts.exactScopePools}`,
  );

  console.log(
    `Multi-scope pools: ${result.counts.multiScopePools}`,
  );

  console.log(
    `Table A-or-S pools: ${result.counts.tableSAlsoAllowedPools}`,
  );

  console.log(
    `Cross-faculty pools: ${result.counts.crossFacultyPools}`,
  );

  console.log(
    `Duplicate pool keys: ${result.counts.duplicatePoolKeys}`,
  );

  console.log(
    `Empty pools: ${result.counts.emptyPools}`,
  );

  console.log(
    `Existing candidate occurrences: ${result.counts.candidateIdentitiesExisting}`,
  );

  console.log(
    `Supplemented candidate occurrences: ${result.counts.candidateIdentitiesSupplemented}`,
  );

  console.log(
    `Candidates without requirement source: ${result.counts.candidatesWithoutRequirementSource}`,
  );

  divider();

  console.log(
    'POOL SUMMARY',
  );

  divider();

  for (
    const pool
    of result.pools
  ) {
    console.log(
      `${pool.degreeCode} — ${pool.role} — ${pool.scopes.join(' + ')}`,
    );

    console.log(
      `  Candidates: ${pool.candidateCount}`,
    );

    console.log(
      `  Table S also allowed: ${pool.tableSAlsoAllowed ? 'YES' : 'NO'}`,
    );

    console.log(
      `  Cross-faculty: ${pool.crossFaculty ? 'YES' : 'NO'}`,
    );

    console.log(
      `  Raw: ${pool.sourceRaw}`,
    );

    console.log('');
  }

  const failures:
    string[] = [];

  if (
    result.counts.eligibleSignals !==
    46
  ) {
    failures.push(
      `Expected 46 eligible exact/multi-scope signals from V3, got ${result.counts.eligibleSignals}.`,
    );
  }

  if (
    result.counts.qualifiedDuplicatesExcluded !==
    1
  ) {
    failures.push(
      `Expected exactly 1 already-qualified signal (BPCOMPUT-01 MAJOR), got ${result.counts.qualifiedDuplicatesExcluded}.`,
    );
  }

  if (
    result.counts.choicePools !==
    46
  ) {
    failures.push(
      `Expected 46 unqualified Table A pools from the 46 exact/multi-scope signals, got ${result.counts.choicePools}.`,
    );
  }

  if (
    result.counts.duplicatePoolKeys !==
    0
  ) {
    failures.push(
      `Expected 0 duplicate pool keys, got ${result.counts.duplicatePoolKeys}.`,
    );
  }

  if (
    result.counts.emptyPools !==
    0
  ) {
    failures.push(
      `Expected 0 empty pools, got ${result.counts.emptyPools}.`,
    );
  }

  const liberalArtsScience =
    result.pools.filter(
      (pool) =>
        (
          pool.degreeCode ===
            'BHLIARSH-01' ||
          pool.degreeCode ===
            'BPLIARSC-02'
        ) &&
        pool.crossFaculty,
    );

  if (
    liberalArtsScience.length <
    2
  ) {
    failures.push(
      'Expected both Liberal Arts and Science degrees to retain explicit cross-faculty Table A pools.',
    );
  }

  const projectManagement =
    result.pools.filter(
      (pool) =>
        (
          pool.degreeCode ===
            'BHPRJMGT-01' ||
          pool.degreeCode ===
            'BPPRJMGT-02'
        ) &&
        pool.role ===
          'MAJOR'
    );

  for (
    const pool
    of projectManagement
  ) {
    if (
      pool.candidateCount !==
      2
    ) {
      failures.push(
        `${pool.degreeCode} Project Management MAJOR pool expected 2 candidates, got ${pool.candidateCount}.`,
      );
    }
  }

  divider();

  if (
    failures.length >
    0
  ) {
    console.log(
      'RESULT: FAIL',
    );

    for (
      const failure
      of failures
    ) {
      console.log(
        `- ${failure}`,
      );
    }

    process.exitCode =
      1;

    return;
  }

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'UNQUALIFIED TABLE A CHOICE POOLS: STRUCTURALLY CLEAN',
  );

  console.log(
    'NEXT: write pools, then merge explicit named relationships + Table S + reconciled qualified Table A + unqualified Table A into the final degree-component relationship layer.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode =
      1;
  },
);
