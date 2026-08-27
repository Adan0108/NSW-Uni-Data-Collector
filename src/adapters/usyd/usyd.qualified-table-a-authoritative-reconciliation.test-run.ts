import {
  reconcileUsydQualifiedTableAChoices,
} from './usyd.qualified-table-a-authoritative-reconciliation';

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
    'USYD QUALIFIED TABLE A AUTHORITATIVE RECONCILIATION',
  );

  divider();

  const result =
    await reconcileUsydQualifiedTableAChoices();

  console.log(
    `Pools: ${result.counts.originalPools}`,
  );

  console.log(
    `Matched: ${result.counts.matchedPools}`,
  );

  console.log(
    `Corrected: ${result.counts.correctedPools}`,
  );

  console.log(
    `No authoritative catalog: ${result.counts.noCatalogPools}`,
  );

  console.log(
    `Removed candidate occurrences: ${result.counts.removedCandidateOccurrences}`,
  );

  console.log(
    `Missing authoritative candidate occurrences: ${result.counts.missingCandidateOccurrences}`,
  );

  divider();

  console.log(
    'POOL DIFFS',
  );

  divider();

  for (
    const item
    of result.reconciliation
  ) {
    console.log(
      `${item.degreeCode} — ${item.tableName} / ${item.role}`,
    );

    console.log(
      `  Scope: ${item.scope}`,
    );

    console.log(
      `  Original: ${item.originalCount}`,
    );

    console.log(
      `  Authoritative: ${item.authoritativeCount ?? 'N/A'}`,
    );

    console.log(
      `  Kept: ${item.keptCount}`,
    );

    console.log(
      `  Removed: ${item.removedCount}`,
    );

    console.log(
      `  Missing: ${item.missingCount}`,
    );

    console.log(
      `  Status: ${item.status}`,
    );

    if (
      item.removedNames.length >
      0
    ) {
      console.log(
        `  Removed names: ${item.removedNames.join(' | ')}`,
      );
    }

    if (
      item.missingNames.length >
      0
    ) {
      console.log(
        `  Missing names: ${item.missingNames.join(' | ')}`,
      );
    }

    console.log('');
  }

  const failures:
    string[] = [];

  if (
    result.counts.originalPools !==
    18
  ) {
    failures.push(
      `Expected 18 qualified Table A choice pools, got ${result.counts.originalPools}.`,
    );
  }

  const commercePools =
    result.reconciliation.filter(
      (item) =>
        item.scope ===
          'BUSINESS' &&
        item.role ===
          'MAJOR',
    );

  if (
    commercePools.length ===
    0
  ) {
    failures.push(
      'Expected at least one qualified BUSINESS/MAJOR pool.',
    );
  }

  for (
    const pool
    of commercePools
  ) {
    if (
      pool.authoritativeCount !==
      11
    ) {
      failures.push(
        `${pool.degreeCode} BUSINESS/MAJOR authoritative count must be 11.`,
      );
    }

    if (
      pool.removedNames.some(
        (name) =>
          name ===
          'Accounting (Professional)',
      ) ===
      false
    ) {
      failures.push(
        `${pool.degreeCode} BUSINESS/MAJOR did not remove Accounting (Professional).`,
      );
    }
  }

  const artsPools =
    result.reconciliation.filter(
      (item) =>
        item.scope ===
          'ARTS' &&
        item.role ===
          'MAJOR',
    );

  for (
    const pool
    of artsPools
  ) {
    if (
      pool.authoritativeCount !==
      47
    ) {
      failures.push(
        `${pool.degreeCode} ARTS/MAJOR authoritative count must be 47.`,
      );
    }
  }

  const sciencePools =
    result.reconciliation.filter(
      (item) =>
        item.scope ===
          'SCIENCE' &&
        item.role ===
          'MAJOR',
    );

  for (
    const pool
    of sciencePools
  ) {
    if (
      pool.authoritativeCount !==
      38
    ) {
      failures.push(
        `${pool.degreeCode} SCIENCE/MAJOR authoritative count must be 38.`,
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
    'QUALIFIED TABLE A AUTHORITATIVE RECONCILIATION: CLEAN',
  );

  console.log(
    'NEXT: write the reconciliation. If missing authoritative names are zero, the corrected qualified pools are ready for Stage2 replacement; otherwise supplement missing role records first.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode =
      1;
  },
);
