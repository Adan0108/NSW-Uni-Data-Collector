import {
  collectUsydTableSAuthoritativeRoleCatalog,
} from './usyd.table-s-authoritative-role-catalog';

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
    'USYD TABLE S FINAL AUTHORITATIVE ROLE CATALOG AUDIT',
  );

  divider();

  const result =
    await collectUsydTableSAuthoritativeRoleCatalog();

  console.log(
    `Source families: ${result.counts.sourceFamilies}`,
  );

  console.log(
    `Authoritative roles: ${result.counts.authoritativeRoles}`,
  );

  console.log(
    `Authoritative MAJOR roles: ${result.counts.authoritativeMajors}`,
  );

  console.log(
    `Authoritative MINOR roles: ${result.counts.authoritativeMinors}`,
  );

  console.log(
    `Authoritative PROGRAM roles: ${result.counts.authoritativePrograms}`,
  );

  console.log(
    `Supplemental role records needed: ${result.counts.supplementalRoles}`,
  );

  console.log(
    `Source-type contradictions: ${result.counts.contradictions}`,
  );

  console.log(
    `Unresolved families: ${result.counts.unresolvedFamilies}`,
  );

  divider();

  console.log(
    'SOURCE-TYPE CONTRADICTIONS',
  );

  divider();

  for (
    const contradiction
    of result.contradictions
  ) {
    console.log(
      contradiction.name,
    );

    console.log(
      `  Source catalogue: ${contradiction.sourceCatalogTypes.join(', ')}`,
    );

    console.log(
      `  Source-proven roles: ${contradiction.sourceProvenRoles.join(', ')}`,
    );

    console.log(
      `  Evidence: ${contradiction.evidenceUrl}`,
    );
  }

  divider();

  console.log(
    'UNRESOLVED FAMILIES',
  );

  divider();

  if (
    result.unresolvedFamilies.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const family
      of result.unresolvedFamilies
    ) {
      const name =
        'familyName' in family
          ? family.familyName
          : 'UNKNOWN';

      console.log(
        name,
      );
    }
  }

  const failures:
    string[] =
    [];

  if (
    result.counts.sourceFamilies !==
    108
  ) {
    failures.push(
      `Expected 108 Table S source families, got ${result.counts.sourceFamilies}.`,
    );
  }

  if (
    result.counts.authoritativeMajors !==
    101
  ) {
    failures.push(
      `Expected 101 source-proven Table S majors after unit-table resolution, got ${result.counts.authoritativeMajors}.`,
    );
  }

  if (
    result.counts.authoritativeMinors !==
    101
  ) {
    failures.push(
      `Expected 101 source-proven Table S minors after unit-table resolution, got ${result.counts.authoritativeMinors}.`,
    );
  }

  if (
    result.counts.authoritativePrograms !==
    0
  ) {
    failures.push(
      `Expected 0 source-proven Table S programs, got ${result.counts.authoritativePrograms}.`,
    );
  }

  if (
    result.counts.authoritativeRoles !==
    202
  ) {
    failures.push(
      `Expected 202 authoritative Table S roles, got ${result.counts.authoritativeRoles}.`,
    );
  }

  if (
    result.counts.supplementalRoles !==
    101
  ) {
    failures.push(
      `Expected 101 supplemental role records, got ${result.counts.supplementalRoles}.`,
    );
  }

  if (
    result.counts.contradictions !==
    7
  ) {
    failures.push(
      `Expected 7 source-type contradictions, got ${result.counts.contradictions}.`,
    );
  }

  if (
    result.counts.unresolvedFamilies !==
    0
  ) {
    failures.push(
      `Expected 0 unresolved Table S families, got ${result.counts.unresolvedFamilies}.`,
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
    'TABLE S AUTHORITATIVE ROLE CATALOG: COMPLETE',
  );

  console.log(
    'NEXT: write the final Table S role catalogue and use it to resolve generic Table S degree-component choices.',
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
