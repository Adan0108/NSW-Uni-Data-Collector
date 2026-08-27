import {
  auditUsydUnqualifiedTableASourceRoles,
} from './usyd.unqualified-table-a-source-role-audit';

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
    'USYD UNQUALIFIED TABLE A SOURCE-ROLE AUDIT V2',
  );

  divider();

  const result =
    await auditUsydUnqualifiedTableASourceRoles();

  console.log(
    `Requested pairs: ${result.counts.requestedPairs}`,
  );

  console.log(
    `Pairs with explicit role evidence: ${result.counts.pairsWithAnyExplicitRoleEvidence}`,
  );

  console.log(
    `Pairs with zero explicit role evidence: ${result.counts.pairsWithZeroExplicitRoleEvidence}`,
  );

  console.log(
    `Total authoritative names: ${result.counts.totalAuthoritativeNames}`,
  );

  console.log(
    `Fetch failures: ${result.counts.fetchFailures}`,
  );

  divider();

  for (
    const record
    of result.records
  ) {
    console.log(
      `${record.scope} / ${record.role}`,
    );

    console.log(
      `  Seed strategy: ${record.seedStrategy}`,
    );

    console.log(
      `  Seed families: ${record.seedFamilies}`,
    );

    console.log(
      `  Explicit role families: ${record.explicitRoleFamilies}`,
    );

    console.log(
      `  No explicit evidence: ${record.noExplicitRoleEvidence}`,
    );

    console.log(
      `  Fetch failures: ${record.fetchFailures}`,
    );

    console.log(
      `  No URL: ${record.noUrl}`,
    );

    if (
      record.authoritativeNames.length >
      0
    ) {
      console.log(
        `  Authoritative names: ${record.authoritativeNames.join(' | ')}`,
      );
    }

    console.log('');
  }

  const failures:
    string[] = [];

  if (
    result.counts.requestedPairs !==
    11
  ) {
    failures.push(
      `Expected 11 requested scope/role pairs, got ${result.counts.requestedPairs}.`,
    );
  }

  const computingMinor =
    result.records.find(
      (record) =>
        record.scope ===
          'COMPUTING' &&
        record.role ===
          'MINOR',
    );

  if (
    !computingMinor ||
    computingMinor.seedFamilies !==
      4
  ) {
    failures.push(
      `COMPUTING/MINOR must audit exactly the 4 authoritative Computing MAJOR source families; got ${computingMinor?.seedFamilies ?? 0}.`,
    );
  }

  const artsMinor =
    result.records.find(
      (record) =>
        record.scope ===
          'ARTS' &&
        record.role ===
          'MINOR',
    );

  if (
    !artsMinor ||
    artsMinor.seedFamilies <
      40
  ) {
    failures.push(
      `ARTS/MINOR must audit the full Arts family universe, not only the existing Sociology MINOR record; got ${artsMinor?.seedFamilies ?? 0} seeds.`,
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
    'SOURCE-ROLE V2 FAMILY SEEDING: CLEAN',
  );

  console.log(
    'NEXT: inspect the role counts. We can then build authoritative role supplements only for explicitly proven families.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
