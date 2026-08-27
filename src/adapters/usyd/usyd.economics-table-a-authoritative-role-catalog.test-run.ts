import {
  collectUsydEconomicsTableAAuthoritativeRoles,
} from './usyd.economics-table-a-authoritative-role-catalog';

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
    'USYD ECONOMICS TABLE A AUTHORITATIVE ROLE AUDIT',
  );

  divider();

  const result =
    await collectUsydEconomicsTableAAuthoritativeRoles();

  console.log(
    `Families: ${result.counts.families}`,
  );

  console.log(
    `Authoritative roles: ${result.counts.roles}`,
  );

  console.log(
    `MAJOR roles: ${result.counts.majors}`,
  );

  console.log(
    `MINOR roles: ${result.counts.minors}`,
  );

  console.log(
    `Supplemental roles needed: ${result.counts.supplementalRoles}`,
  );

  console.log(
    `Unresolved families: ${result.counts.unresolvedFamilies}`,
  );

  divider();

  for (
    const role
    of result.roles
  ) {
    console.log(
      `${role.type} — ${role.name}`,
    );

    console.log(
      `  Existing exact source records: ${role.existingSourceComponentIndexes.length}`,
    );

    console.log(
      `  Supplemental: ${role.supplementalRole ? 'YES' : 'NO'}`,
    );

    console.log(
      `  Evidence: ${role.evidenceUrl}`,
    );
  }

  const failures:
    string[] =
    [];

  if (
    result.counts.families !==
    3
  ) {
    failures.push(
      `Expected 3 Economics Table A families, got ${result.counts.families}.`,
    );
  }

  if (
    result.counts.roles !==
    6
  ) {
    failures.push(
      `Expected 6 authoritative Economics Table A roles, got ${result.counts.roles}.`,
    );
  }

  if (
    result.counts.majors !==
      3 ||
    result.counts.minors !==
      3
  ) {
    failures.push(
      `Expected 3 MAJOR + 3 MINOR roles, got ${result.counts.majors} MAJOR + ${result.counts.minors} MINOR.`,
    );
  }

  if (
    result.counts.supplementalRoles !==
    3
  ) {
    failures.push(
      `Expected 3 supplemental MINOR role records, got ${result.counts.supplementalRoles}.`,
    );
  }

  if (
    result.counts.unresolvedFamilies !==
    0
  ) {
    failures.push(
      `Expected 0 unresolved families, got ${result.counts.unresolvedFamilies}.`,
    );
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
    'ECONOMICS TABLE A ROLES: SOURCE-GROUNDED',
  );

  console.log(
    'NEXT: write the Economics authoritative role catalogue, then rerun the qualified Table A final resolver.',
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
