import {
  buildUsydDegreeComponentFinalMerge,
} from './usyd.degree-component-final-merge';

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
    'USYD FINAL DEGREE-COMPONENT RELATIONSHIP MERGE V3',
  );

  divider();

  const result =
    await buildUsydDegreeComponentFinalMerge();

  console.log(
    `Explicit named relationships: ${result.counts.explicitNamedRelationships}`,
  );

  console.log(
    `Table S choice pools: ${result.counts.tableSChoicePools}`,
  );

  console.log(
    `Qualified Table A pools: ${result.counts.qualifiedTableAChoicePools}`,
  );

  console.log(
    `Unqualified Table A pools: ${result.counts.unqualifiedTableAChoicePools}`,
  );

  console.log(
    `Total choice pools: ${result.counts.totalChoicePools}`,
  );

  console.log(
    `Table S semantic review signals: ${result.counts.tableSSemanticReviewSignals}`,
  );

  console.log(
    `Qualified Table A semantic review signals: ${result.counts.qualifiedTableASemanticReviewSignals}`,
  );

  console.log(
    `Total semantic review signals: ${result.counts.semanticReviewSignals}`,
  );

  console.log(
    `Qualified duplicate keys: ${result.counts.duplicateQualifiedPoolKeys}`,
  );

  console.log(
    `Unqualified duplicate keys: ${result.counts.duplicateUnqualifiedPoolKeys}`,
  );

  console.log(
    `Cross-layer duplicate keys: ${result.counts.duplicateCrossLayerPoolKeys}`,
  );

  divider();

  console.log(
    'COVERAGE',
  );

  divider();

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      result.coverage,
    )
  ) {
    console.log(
      `${key}: ${value}`,
    );
  }

  const failures:
    string[] = [];

  if (
    result.counts.explicitNamedRelationships !==
    18
  ) {
    failures.push(
      `Expected 18 explicit named relationships, got ${result.counts.explicitNamedRelationships}.`,
    );
  }

  if (
    result.counts.tableSChoicePools !==
    33
  ) {
    failures.push(
      `Expected 33 Table S choice pools, got ${result.counts.tableSChoicePools}.`,
    );
  }

  if (
    result.counts.qualifiedTableAChoicePools !==
    18
  ) {
    failures.push(
      `Expected 18 reconciled qualified Table A pools, got ${result.counts.qualifiedTableAChoicePools}.`,
    );
  }

  if (
    result.counts.unqualifiedTableAChoicePools !==
    46
  ) {
    failures.push(
      `Expected 46 unqualified Table A pools, got ${result.counts.unqualifiedTableAChoicePools}.`,
    );
  }

  if (
    result.counts.totalChoicePools !==
    97
  ) {
    failures.push(
      `Expected 97 total choice pools, got ${result.counts.totalChoicePools}.`,
    );
  }

  if (
    result.counts.tableSSemanticReviewSignals !==
    2
  ) {
    failures.push(
      `Expected 2 Table S semantic review signals, got ${result.counts.tableSSemanticReviewSignals}.`,
    );
  }

  if (
    result.counts.qualifiedTableASemanticReviewSignals !==
    5
  ) {
    failures.push(
      `Expected 5 qualified Table A semantic review signals, got ${result.counts.qualifiedTableASemanticReviewSignals}.`,
    );
  }

  if (
    result.counts.semanticReviewSignals !==
    7
  ) {
    failures.push(
      `Expected 7 total semantic review signals, got ${result.counts.semanticReviewSignals}.`,
    );
  }

  if (
    result.counts.duplicateQualifiedPoolKeys !==
      0 ||
    result.counts.duplicateUnqualifiedPoolKeys !==
      0 ||
    result.counts.duplicateCrossLayerPoolKeys !==
      0
  ) {
    failures.push(
      'Expected zero duplicate pool keys within or across qualified/unqualified Table A layers.',
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
    'TABLE A + TABLE S DEGREE-COMPONENT RELATIONSHIP LAYER: COMPLETE',
  );

  console.log(
    'SEMANTIC REVIEW SIGNALS PRESERVED: 2 TABLE S + 5 QUALIFIED TABLE A = 7',
  );

  console.log(
    'NEXT: write final relationship layer, then move to formal degree-requirement semantics.',
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
