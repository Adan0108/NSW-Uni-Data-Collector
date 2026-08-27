import {
  auditUsydTableSRoleSourceEvidence,
} from './usyd.table-s-role-source-audit';

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
    'USYD TABLE S ROLE SOURCE AUDIT',
  );

  divider();

  const result =
    await auditUsydTableSRoleSourceEvidence();

  console.log(
    `Families inspected: ${result.counts.familiesInspected}`,
  );

  console.log(
    `Fetch succeeded: ${result.counts.fetchSucceeded}`,
  );

  console.log(
    `Fetch failed: ${result.counts.fetchFailed}`,
  );

  console.log(
    `MAJOR supported: ${result.counts.majorSupported}`,
  );

  console.log(
    `MINOR supported: ${result.counts.minorSupported}`,
  );

  console.log(
    `PROGRAM supported: ${result.counts.programSupported}`,
  );

  console.log(
    `No explicit role evidence: ${result.counts.noExplicitRoleEvidence}`,
  );

  divider();

  console.log(
    'MINOR-SUPPORTED FAMILIES',
  );

  divider();

  for (
    const record
    of result.records.filter(
      (
        item,
      ) =>
        item
          .explicitRoles
          .includes(
            'MINOR',
          ),
    )
  ) {
    console.log(
      record.familyName,
    );

    console.log(
      `  Roles: ${record.explicitRoles.join(', ')}`,
    );

    console.log(
      `  URL: ${record.overviewUrl}`,
    );

    if (
      record.requirementsText
    ) {
      console.log(
        `  Requirements: ${record.requirementsText}`,
      );
    }
  }

  divider();

  console.log(
    'PROGRAM-SUPPORTED FAMILIES',
  );

  divider();

  for (
    const record
    of result.records.filter(
      (
        item,
      ) =>
        item
          .explicitRoles
          .includes(
            'PROGRAM',
          ),
    )
  ) {
    console.log(
      record.familyName,
    );

    console.log(
      `  Roles: ${record.explicitRoles.join(', ')}`,
    );

    console.log(
      `  URL: ${record.overviewUrl}`,
    );

    if (
      record.requirementsText
    ) {
      console.log(
        `  Requirements: ${record.requirementsText}`,
      );
    }
  }

  divider();

  console.log(
    'NO EXPLICIT ROLE EVIDENCE',
  );

  divider();

  for (
    const record
    of result.records.filter(
      (
        item,
      ) =>
        item.status ===
        'NO_EXPLICIT_ROLE_EVIDENCE',
    )
  ) {
    console.log(
      `${record.familyName} — ${record.overviewUrl}`,
    );
  }

  divider();

  console.log(
    'FETCH FAILURES',
  );

  divider();

  for (
    const record
    of result.records.filter(
      (
        item,
      ) =>
        item.status ===
        'FETCH_FAILED',
    )
  ) {
    console.log(
      `${record.familyName} — ${record.overviewUrl}`,
    );

    console.log(
      `  ${record.error ?? 'Unknown error'}`,
    );
  }

  const failures:
    string[] =
    [];

  if (
    result.counts.fetchFailed >
    0
  ) {
    failures.push(
      `${result.counts.fetchFailed} Table S overview page(s) failed to fetch.`,
    );
  }

  if (
    result.counts.familiesInspected ===
    0
  ) {
    failures.push(
      'No Table S subject-area overview pages were inspected.',
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
    'SOURCE ROLE EVIDENCE: COLLECTED',
  );

  console.log(
    'NEXT: create only MINOR/PROGRAM role records explicitly supported by these overview pages, then rerun Table A/S role coverage.',
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
