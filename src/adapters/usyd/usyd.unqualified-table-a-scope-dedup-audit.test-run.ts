import {
  auditUsydUnqualifiedTableAScopeDedup,
} from './usyd.unqualified-table-a-scope-dedup-audit';

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
    'USYD UNQUALIFIED TABLE A SCOPE + DEDUP AUDIT V3',
  );

  divider();

  const result =
    await auditUsydUnqualifiedTableAScopeDedup();

  console.log(
    `Semantic-safe signals: ${result.counts.semanticSafeSignals}`,
  );

  console.log(
    `Typed eligible signals: ${result.counts.typedEligibleSignals}`,
  );

  console.log(
    `Safe but untyped signals: ${result.counts.safeButUntypedSignals}`,
  );

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Exact scope: ${result.counts.exactScope}`,
  );

  console.log(
    `Multi-scope explicit: ${result.counts.multiScopeExplicit}`,
  );

  console.log(
    `Already covered by qualified pool: ${result.counts.alreadyCoveredByQualifiedPool}`,
  );

  console.log(
    `Ambiguous scope: ${result.counts.ambiguousScope}`,
  );

  console.log(
    `No scope evidence: ${result.counts.noScopeEvidence}`,
  );

  divider();

  console.log(
    'SAFE BUT UNTYPED — PRESERVED, NOT RESOLVED',
  );

  divider();

  for (
    const record
    of result.excludedSafeButUntyped
  ) {
    console.log(
      `${record.degreeCode ?? 'UNKNOWN'} — ${record.degreeTitle ?? 'UNKNOWN'}`,
    );

    console.log(
      `  Semantic: ${record.semanticClass}`,
    );

    console.log(
      `  Raw: ${record.raw}`,
    );
  }

  divider();

  console.log(
    'TYPED ELIGIBLE RECORDS',
  );

  divider();

  for (
    const record
    of result.records
  ) {
    console.log(
      `${record.degreeCode} — ${record.degreeTitle}`,
    );

    console.log(
      `  Type: ${record.componentType}`,
    );

    console.log(
      `  Semantic: ${record.semanticClass}`,
    );

    console.log(
      `  Resolution: ${record.resolution}`,
    );

    console.log(
      `  Explicit scopes: ${record.explicitScopes.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Existing qualified scopes: ${record.existingQualifiedScopes.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Title hints: ${record.inferredScopeCandidates.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Resolved scopes: ${record.resolvedScopes.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Dedup qualified: ${record.dedupAgainstQualified ? 'YES' : 'NO'}`,
    );

    console.log(
      `  Raw: ${record.raw}`,
    );

    console.log('');
  }

  const failures:
    string[] =
    [];

  if (
    result.counts.semanticSafeSignals !==
    49
  ) {
    failures.push(
      `Expected 49 semantic-safe signals from V2 (24 direct + 21 A-or-S + 4 cross-faculty), got ${result.counts.semanticSafeSignals}.`,
    );
  }

  if (
    result.counts.typedEligibleSignals !==
    47
  ) {
    failures.push(
      `Expected 47 typed eligible signals after excluding 2 safe-but-untyped cross-faculty/raw duplicates, got ${result.counts.typedEligibleSignals}.`,
    );
  }

  if (
    result.counts.safeButUntypedSignals !==
    2
  ) {
    failures.push(
      `Expected 2 semantic-safe but untyped signals to remain preserved, got ${result.counts.safeButUntypedSignals}.`,
    );
  }

  if (
    result.counts.typedEligibleSignals +
      result.counts.safeButUntypedSignals !==
    result.counts.semanticSafeSignals
  ) {
    failures.push(
      'Semantic-safe accounting does not balance: typed eligible + safe-but-untyped must equal semantic-safe total.',
    );
  }

  if (
    result.counts.exactScope !==
    44
  ) {
    failures.push(
      `Expected 44 exact-scope typed signals after source-grounded Engineering combined-degree overrides, got ${result.counts.exactScope}.`,
    );
  }

  if (
    result.counts.multiScopeExplicit !==
    2
  ) {
    failures.push(
      `Expected 2 explicit multi-scope Liberal Arts and Science signals, got ${result.counts.multiScopeExplicit}.`,
    );
  }

  if (
    result.counts.alreadyCoveredByQualifiedPool !==
    1
  ) {
    failures.push(
      `Expected 1 signal already covered by the qualified Table A layer, got ${result.counts.alreadyCoveredByQualifiedPool}.`,
    );
  }

  if (
    result.counts.ambiguousScope !==
    0 ||
    result.counts.noScopeEvidence !==
    0
  ) {
    failures.push(
      `Expected 0 ambiguous/no-scope typed signals, got ${result.counts.ambiguousScope} ambiguous and ${result.counts.noScopeEvidence} no-scope.`,
    );
  }

  const engineeringArts =
    result.records.find(
      (record) =>
        record.degreeCode ===
        'BHENGART-05',
    );

  if (
    !engineeringArts ||
    engineeringArts.resolution !==
      'EXACT_SCOPE' ||
    engineeringArts.resolvedScopes.length !==
      1 ||
    engineeringArts.resolvedScopes[0] !==
      'ARTS'
  ) {
    failures.push(
      'BHENGART-05 must resolve to the non-Engineering ARTS Table A.',
    );
  }

  const engineeringCommerce =
    result.records.find(
      (record) =>
        record.degreeCode ===
        'BHENGCOM-05',
    );

  if (
    !engineeringCommerce ||
    engineeringCommerce.resolution !==
      'EXACT_SCOPE' ||
    engineeringCommerce.resolvedScopes.length !==
      1 ||
    engineeringCommerce.resolvedScopes[0] !==
      'BUSINESS'
  ) {
    failures.push(
      'BHENGCOM-05 must resolve to the non-Engineering BUSINESS Table A.',
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
    'SCOPE/DEDUP V3: CLEAN',
  );

  console.log(
    'NEXT: write V3, then build the authoritative unqualified Table A choice pools from the 44 exact-scope signals plus the 2 explicit cross-faculty signals, excluding the 1 already-qualified duplicate.',
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
