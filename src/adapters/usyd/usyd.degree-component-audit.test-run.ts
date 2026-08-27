import {
  auditUsydDegreeComponentEvidence,
} from './usyd.degree-component-audit';

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
    'USYD DEGREE-COMPONENT EVIDENCE AUDIT',
  );

  divider();

  const result =
    await auditUsydDegreeComponentEvidence();

  console.log(
    `Degrees: ${result.degreeCount}`,
  );

  console.log(
    `Components: ${result.componentCount}`,
  );

  console.log(
    `Evidence records: ${result.evidenceCount}`,
  );

  console.log(
    `Resolved named refs: ${result.resolvedNamedCount}`,
  );

  console.log(
    `Ambiguous named refs: ${result.ambiguousNamedCount}`,
  );

  console.log(
    `Unresolved named refs: ${result.unresolvedNamedCount}`,
  );

  console.log(
    `Generic table/component refs: ${result.genericCount}`,
  );

  divider();

  console.log(
    'UNRESOLVED NAMED REFERENCES',
  );

  divider();

  const unresolved =
    result.evidence.filter(
      (item) =>
        item.kind ===
          'NAMED_COMPONENT' &&
        item.status ===
          'UNRESOLVED',
    );

  if (
    unresolved.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const item
      of unresolved
    ) {
      console.log(
        `${item.degreeCode} — ${item.degreeTitle}`,
      );

      console.log(
        `  ${item.componentType}: ${item.componentName}`,
      );

      console.log(
        `  Raw: ${item.rawText}`,
      );
    }
  }

  divider();

  console.log(
    'AMBIGUOUS NAMED REFERENCES',
  );

  divider();

  const ambiguous =
    result.evidence.filter(
      (item) =>
        item.kind ===
          'NAMED_COMPONENT' &&
        item.status ===
          'AMBIGUOUS',
    );

  if (
    ambiguous.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const item
      of ambiguous
    ) {
      console.log(
        `${item.degreeCode} — ${item.degreeTitle}`,
      );

      console.log(
        `  ${item.componentType}: ${item.componentName}`,
      );

      console.log(
        `  Candidate component indexes: ${item.matchedComponentIndexes.join(', ')}`,
      );
    }
  }

  divider();

  console.log(
    'GENERIC RELATIONSHIP SIGNALS',
  );

  divider();

  const genericSamples =
    result.evidence
      .filter(
        (item) =>
          item.status ===
          'GENERIC',
      )
      .slice(
        0,
        40,
      );

  for (
    const item
    of genericSamples
  ) {
    console.log(
      `${item.degreeCode} — ${item.degreeTitle}`,
    );

    console.log(
      `  ${item.kind}: ${item.tableName ?? item.componentType ?? 'UNKNOWN'}`,
    );

    console.log(
      `  Raw: ${item.rawText}`,
    );
  }

  divider();

  if (
    result.degreeCount !==
    109
  ) {
    console.log(
      'RESULT: FAIL',
    );

    console.log(
      `Expected 109 degrees, got ${result.degreeCount}.`,
    );

    process.exitCode =
      1;

    return;
  }

  if (
    result.componentCount ===
    0
  ) {
    console.log(
      'RESULT: FAIL',
    );

    console.log(
      'No components found in master.',
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    'RESULT: PASS',
  );

  if (
    result.unresolvedNamedCount > 0 ||
    result.ambiguousNamedCount > 0
  ) {
    console.log(
      'SEMANTIC STATUS: REVIEW REQUIRED',
    );

    console.log(
      'NEXT: review only the unresolved/ambiguous named references before creating authoritative degree-component relationships.',
    );

    return;
  }

  console.log(
    'SEMANTIC STATUS: CLEAN',
  );

  console.log(
    'STATUS: RELATIONSHIP EVIDENCE INVENTORY READY',
  );

  console.log(
    'NEXT: build authoritative degree-component relationships. Generic Table A/S/O/D references must still be resolved through explicit table ownership; never infer them from wording alone.',
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
