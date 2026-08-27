import {
  buildUsydDegreeRootSemanticsV2,
} from './usyd.degree-root-semantics';

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
    'USYD DEGREE ROOT SEMANTICS V2',
  );

  divider();

  const result =
    await buildUsydDegreeRootSemanticsV2();

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Original single-root degrees: ${result.counts.originalSingleRootDegrees}`,
  );

  console.log(
    `Resolved multi-root degrees: ${result.counts.resolvedMultiRootDegrees}`,
  );

  console.log(
    `Unresolved multi-root degrees: ${result.counts.unresolvedMultiRootDegrees}`,
  );

  console.log(
    `Excluded label fragments: ${result.counts.excludedLabelFragments}`,
  );

  console.log(
    `Excluded connector fragments: ${result.counts.excludedConnectorFragments}`,
  );

  console.log(
    `Excluded stray subclauses: ${result.counts.excludedStraySubclauses}`,
  );

  console.log(
    `Missing canonical roots: ${result.counts.missingCanonicalRoots}`,
  );

  console.log(
    `Duplicate degree codes: ${result.counts.duplicateDegreeCodes}`,
  );

  divider();

  console.log(
    'RESOLVED MULTI-ROOT DEGREES',
  );

  divider();

  for (
    const degree
    of result.degrees.filter(
      (item) =>
        item.semanticStatus ===
        'AUTHORITATIVE_RESOLVED_MULTI_ROOT',
    )
  ) {
    console.log(
      `${degree.degreeCode} — ${degree.resolutionReason}`,
    );

    console.log(
      `  Canonical root: ${degree.canonicalRootId}`,
    );

    console.log(
      `  Excluded roots: ${degree.excludedRootIds.join(', ')}`,
    );
  }

  const failures:
    string[] = [];

  if (
    result.counts.degrees !==
    109
  ) {
    failures.push(
      `Expected 109 degrees, got ${result.counts.degrees}.`,
    );
  }

  if (
    result.counts.originalSingleRootDegrees !==
    100
  ) {
    failures.push(
      `Expected 100 original single-root degrees, got ${result.counts.originalSingleRootDegrees}.`,
    );
  }

  if (
    result.counts.resolvedMultiRootDegrees !==
    9
  ) {
    failures.push(
      `Expected all 9 reviewed multi-root degrees to resolve, got ${result.counts.resolvedMultiRootDegrees}.`,
    );
  }

  if (
    result.counts.unresolvedMultiRootDegrees !==
      0 ||
    result.counts.missingCanonicalRoots !==
      0 ||
    result.counts.duplicateDegreeCodes !==
      0
  ) {
    failures.push(
      'Root resolution integrity failed.',
    );
  }

  if (
    result.counts.excludedLabelFragments !==
    1
  ) {
    failures.push(
      `Expected exactly 1 label fragment (BHECONOH-02 Economics), got ${result.counts.excludedLabelFragments}.`,
    );
  }

  if (
    result.counts.excludedConnectorFragments !==
    5
  ) {
    failures.push(
      `Expected exactly 5 connector fragments ("above; and"), got ${result.counts.excludedConnectorFragments}.`,
    );
  }

  if (
    result.counts.excludedStraySubclauses !==
    3
  ) {
    failures.push(
      `Expected exactly 3 stray Table S roots, got ${result.counts.excludedStraySubclauses}.`,
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
    'DEGREE ROOT SELECTION: COMPLETE FOR ALL 109 DEGREES',
  );

  console.log(
    '9 FALSE MULTI-ROOT CASES RESOLVED WITHOUT INVENTING ALL/ANY LOGIC',
  );

  console.log(
    'NEXT: write V2. Then enrich the complex RAW clauses into structured formal semantics while preserving RAW fallback for anything still unsafe.',
  );
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
