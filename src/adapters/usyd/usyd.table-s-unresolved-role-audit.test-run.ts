import {
  auditUsydTableSUnresolvedRoles,
} from './usyd.table-s-unresolved-role-audit';

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
    'USYD TABLE S UNRESOLVED ROLE AUDIT',
  );

  divider();

  const result =
    await auditUsydTableSUnresolvedRoles();

  console.log(
    `Unresolved families input: ${result.counts.unresolvedFamiliesInput}`,
  );

  console.log(
    `Resolved from unit tables: ${result.counts.resolved}`,
  );

  console.log(
    `Still unresolved: ${result.counts.stillUnresolved}`,
  );

  console.log(
    `Fetch failed: ${result.counts.fetchFailed}`,
  );

  divider();

  console.log(
    'FAMILY RESULTS',
  );

  divider();

  for (
    const record
    of result.records
  ) {
    console.log(
      `${record.familyName}`,
    );

    console.log(
      `  Status: ${record.status}`,
    );

    console.log(
      `  Roles: ${record.explicitRoles.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Unit tables: ${record.unitTableUrls.length}`,
    );

    for (
      const url
      of record.unitTableUrls
    ) {
      console.log(
        `    ${url}`,
      );
    }

    for (
      const evidence
      of record.evidenceText
    ) {
      console.log(
        `  Evidence: ${evidence}`,
      );
    }

    for (
      const error
      of record.fetchErrors
    ) {
      console.log(
        `  Error: ${error}`,
      );
    }

    console.log('');
  }

  const failures:
    string[] =
    [];

  if (
    result.counts.unresolvedFamiliesInput !==
    6
  ) {
    failures.push(
      `Expected 6 unresolved families, got ${result.counts.unresolvedFamiliesInput}.`,
    );
  }

  if (
    result.counts.fetchFailed >
    0
  ) {
    failures.push(
      `${result.counts.fetchFailed} family/families had complete fetch failure.`,
    );
  }

  divider();

  if (
    failures.length >
    0
  ) {
    console.log(
      'RESULT: REVIEW',
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
    'STATUS: UNIT-TABLE ROLE EVIDENCE COLLECTED',
  );

  console.log(
    'NEXT: merge resolved roles into the authoritative Table S role catalogue; keep any still-unresolved family explicitly unresolved.',
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
