import {
  auditUsydUnqualifiedTableARoleCoverage,
} from './usyd.unqualified-table-a-role-coverage-audit';

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
    'USYD UNQUALIFIED TABLE A ROLE-COVERAGE AUDIT',
  );

  divider();

  const result =
    await auditUsydUnqualifiedTableARoleCoverage();

  console.log(
    `Eligible scope records: ${result.counts.eligibleSignals}`,
  );

  console.log(
    `Requested scope/role pairs: ${result.counts.requestedScopeRolePairs}`,
  );

  console.log(
    `Pairs with current candidates: ${result.counts.pairsWithCandidates}`,
  );

  console.log(
    `Pairs with zero exact-role candidates: ${result.counts.pairsWithoutCandidates}`,
  );

  divider();

  console.log(
    'SCOPE / ROLE COVERAGE',
  );

  divider();

  for (const record of result.records) {
    console.log(
      `${record.scope} / ${record.role}`,
    );

    console.log(
      `  Source handbook: ${record.sourceHandbook}`,
    );

    console.log(
      `  Degrees: ${record.degrees.length}`,
    );

    console.log(
      `  Candidate names: ${record.candidateCount}`,
    );

    console.log(
      `  Status: ${record.status}`,
    );

    if (
      record.candidateNames.length >
      0
    ) {
      console.log(
        `  Sample: ${record.candidateNames.slice(0, 12).join(' | ')}`,
      );
    }

    console.log('');
  }

  const failures:
    string[] = [];

  if (
    result.counts.eligibleSignals !==
    46
  ) {
    failures.push(
      `Expected 46 eligible typed signals (44 exact + 2 explicit multi-scope, excluding the 1 qualified duplicate), got ${result.counts.eligibleSignals}.`,
    );
  }

  if (
    result.counts.requestedScopeRolePairs !==
    11
  ) {
    failures.push(
      `Expected 11 unique Table A scope/role pairs from the V3 output, got ${result.counts.requestedScopeRolePairs}.`,
    );
  }

  divider();

  if (failures.length > 0) {
    console.log(
      'RESULT: FAIL',
    );

    for (const failure of failures) {
      console.log(
        `- ${failure}`,
      );
    }

    process.exitCode = 1;
    return;
  }

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'STATUS: ROLE-COVERAGE DIAGNOSTIC COMPLETE',
  );

  console.log(
    'IMPORTANT: non-zero candidate counts do not prove role completeness. MINOR/PROGRAM pools must be source-audited before relationship creation.',
  );

  console.log(
    'NEXT: source-audit the incomplete Table A roles identified here, then build authoritative unqualified Table A pools.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
