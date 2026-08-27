import {
  auditUsydEconomicsTableARoles,
} from './usyd.economics-table-a-role-audit';

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
    'USYD ECONOMICS TABLE A ROLE AUDIT',
  );

  divider();

  const records =
    await auditUsydEconomicsTableARoles();

  for (
    const record
    of records
  ) {
    console.log(
      record.name,
    );

    console.log(
      `  Roles: ${record.roles.join(', ') || 'NONE'}`,
    );

    console.log(
      `  URL: ${record.url}`,
    );

    if (
      record.fetchError
    ) {
      console.log(
        `  ERROR: ${record.fetchError}`,
      );
    }

    for (
      const evidence
      of record.evidence.slice(
        0,
        12,
      )
    ) {
      console.log(
        `  Evidence: ${evidence}`,
      );
    }

    console.log('');
  }

  const failed =
    records.filter(
      (
        record,
      ) =>
        record.fetchError !==
        null,
    );

  divider();

  if (
    failed.length >
    0
  ) {
    console.log(
      'RESULT: REVIEW',
    );

    console.log(
      `${failed.length} page(s) failed to fetch.`,
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'NEXT: use only explicitly proven MINOR roles to close the final qualified Table A role gap.',
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
