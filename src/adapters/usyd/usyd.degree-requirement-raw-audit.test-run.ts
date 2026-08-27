import {
  buildUsydDegreeRequirementRawAuditV1,
} from './usyd.degree-requirement-raw-audit';

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
    'USYD DEGREE REQUIREMENT RAW FALLBACK AUDIT V1',
  );

  divider();

  const result =
    await buildUsydDegreeRequirementRawAuditV1();

  console.log(
    `Clauses: ${result.counts.clauses}`,
  );

  console.log(
    `Authoritative: ${result.counts.authoritative}`,
  );

  console.log(
    `RAW fallback: ${result.counts.rawFallback}`,
  );

  console.log(
    `Non-requirement: ${result.counts.nonRequirement}`,
  );

  console.log(
    `RAW with explicit reasons: ${result.counts.rawWithExplicitReasons}`,
  );

  console.log(
    `Unsupported-safe-pattern only: ${result.counts.rawUnsupportedSafePatternOnly}`,
  );

  console.log(
    `Large resolution blocks: ${result.counts.rawLargeResolutionBlocks}`,
  );

  console.log(
    `Nested numbering: ${result.counts.rawNestedNumbering}`,
  );

  console.log(
    `Mixed AND/OR: ${result.counts.rawMixedAndOr}`,
  );

  console.log(
    `Conditional language: ${result.counts.rawConditional}`,
  );

  console.log(
    `Degrees with RAW fallback: ${result.counts.degreesWithRawFallback}`,
  );

  console.log(
    `Degrees fully structured at clause level: ${result.counts.degreesFullyStructuredAtClauseLevel}`,
  );

  console.log(
    `RAW fallbacks with empty reasons: ${result.counts.emptyReasonRawFallbacks}`,
  );

  divider();

  console.log(
    'RAW FALLBACK REASONS',
  );

  divider();

  for (
    const reason
    of result.reasons
  ) {
    console.log(
      `${reason.reason}: ${reason.count} clauses / ${reason.degreeCount} degrees`,
    );

    for (
      const sample
      of reason.samples.slice(
        0,
        3,
      )
    ) {
      console.log(
        `  ${sample.degreeCode}: ${sample.raw}`,
      );
    }

    console.log('');
  }

  const failures:
    string[] = [];

  if (
    result.counts.clauses !==
    1085
  ) {
    failures.push(
      `Expected 1085 clauses, got ${result.counts.clauses}.`,
    );
  }

  if (
    result.counts.authoritative !==
    400
  ) {
    failures.push(
      `Expected 400 authoritative clauses after V2 enrichment (258 + 142), got ${result.counts.authoritative}.`,
    );
  }

  if (
    result.counts.rawFallback !==
    576
  ) {
    failures.push(
      `Expected 576 RAW fallbacks after V2 enrichment, got ${result.counts.rawFallback}.`,
    );
  }

  if (
    result.counts.nonRequirement !==
    109
  ) {
    failures.push(
      `Expected 109 non-requirement clauses, got ${result.counts.nonRequirement}.`,
    );
  }

  if (
    result.counts.emptyReasonRawFallbacks !==
    0
  ) {
    failures.push(
      `Expected 0 RAW fallbacks with empty reasons, got ${result.counts.emptyReasonRawFallbacks}.`,
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
    'RAW FALLBACK INVENTORY: CLEAN',
  );

  console.log(
    'NEXT: review the reason distribution. If most remaining RAW clauses are nested/conditional/qualified buckets, freeze degree semantics and move to study-plan collection.',
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
