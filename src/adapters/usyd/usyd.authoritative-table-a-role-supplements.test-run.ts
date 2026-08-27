import {
  buildUsydAuthoritativeTableARoleSupplements,
} from './usyd.authoritative-table-a-role-supplements';

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
    'USYD AUTHORITATIVE TABLE A ROLE SUPPLEMENTS',
  );

  divider();

  const result =
    await buildUsydAuthoritativeTableARoleSupplements();

  console.log(
    `Authoritative role identities: ${result.counts.authoritativeRoleIdentities}`,
  );

  console.log(
    `Exact existing: ${result.counts.exactExisting}`,
  );

  console.log(
    `Supplements needed: ${result.counts.supplementsNeeded}`,
  );

  console.log(
    `Supplements with family source: ${result.counts.supplementsWithFamilySource}`,
  );

  console.log(
    `Central-source-only supplements: ${result.counts.supplementsCentralSourceOnly}`,
  );

  console.log(
    `Duplicate supplement keys: ${result.counts.duplicateSupplementKeys}`,
  );

  divider();

  console.log(
    'SUPPLEMENTS BY SCOPE / ROLE',
  );

  divider();

  const grouped =
    new Map<
      string,
      typeof result.supplements
    >();

  for (
    const supplement
    of result.supplements
  ) {
    const key =
      `${supplement.tableAScope}/${supplement.type}`;

    const current =
      grouped.get(key) ??
      [];

    current.push(
      supplement,
    );

    grouped.set(
      key,
      current,
    );
  }

  for (
    const [
      key,
      supplements,
    ]
    of grouped
  ) {
    console.log(
      `${key}: ${supplements.length}`,
    );

    console.log(
      `  ${supplements.map((item) => item.name).join(' | ')}`,
    );

    const unresolved =
      supplements.filter(
        (item) =>
          !item.requirementsSourceResolved,
      );

    if (
      unresolved.length >
      0
    ) {
      console.log(
        `  Requirements source unresolved: ${unresolved.length}`,
      );

      console.log(
        `  ${unresolved.map((item) => item.name).join(' | ')}`,
      );
    }

    console.log('');
  }

  const failures:
    string[] = [];

  if (
    result.counts.authoritativeRoleIdentities !==
    214
  ) {
    failures.push(
      `Expected 214 authoritative role identities, got ${result.counts.authoritativeRoleIdentities}.`,
    );
  }

  if (
    result.counts.duplicateSupplementKeys !==
    0
  ) {
    failures.push(
      `Expected 0 duplicate supplement keys, got ${result.counts.duplicateSupplementKeys}.`,
    );
  }

  const businessProfessional =
    result.existing.some(
      (item) =>
        item.scope ===
          'BUSINESS' &&
        item.role ===
          'MAJOR' &&
        item.name ===
          'Accounting (Professional)',
    ) ||
    result.supplements.some(
      (item) =>
        item.tableAScope ===
          'BUSINESS' &&
        item.type ===
          'MAJOR' &&
        item.name ===
          'Accounting (Professional)',
    );

  if (
    businessProfessional
  ) {
    failures.push(
      'Accounting (Professional) must not exist in authoritative BUSINESS/MAJOR role identities.',
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
    'AUTHORITATIVE ROLE SUPPLEMENT IDENTITIES: CLEAN',
  );

  console.log(
    'NEXT: write supplements. Central-source-only role identities are valid for choice-pool membership but remain flagged for later component-requirement enrichment.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode =
      1;
  },
);
