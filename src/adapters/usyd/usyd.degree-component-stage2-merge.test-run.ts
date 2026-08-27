import {
  collectUsydDegreeComponentStage2,
} from './usyd.degree-component-stage2-merge';

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
    'USYD DEGREE-COMPONENT STAGE2 MERGE AUDIT',
  );

  divider();

  const result =
    await collectUsydDegreeComponentStage2();

  console.log(
    `Explicit named relationships: ${result.counts.explicitNamedRelationships}`,
  );

  console.log(
    `Table S choice pools: ${result.counts.tableSChoicePools}`,
  );

  console.log(
    `Table S candidates: ${result.counts.tableSChoiceCandidates}`,
  );

  console.log(
    `Qualified Table A choice pools: ${result.counts.qualifiedTableAChoicePools}`,
  );

  console.log(
    `Qualified Table A candidates: ${result.counts.qualifiedTableAChoiceCandidates}`,
  );

  console.log(
    `Total choice pools: ${result.counts.totalChoicePools}`,
  );

  console.log(
    `Total choice candidates: ${result.counts.totalChoiceCandidates}`,
  );

  console.log(
    `Table S semantic review: ${result.counts.tableSSemanticReviewSignals}`,
  );

  console.log(
    `Qualified Table A review: ${result.counts.qualifiedTableAReviewSignals}`,
  );

  console.log(
    `Total semantic review: ${result.counts.totalSemanticReviewSignals}`,
  );

  divider();

  console.log(
    'COVERAGE STATUS',
  );

  divider();

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      result.status,
    )
  ) {
    console.log(
      `${key}: ${value}`,
    );
  }

  const failures: string[] = [];

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
    result.counts.tableSChoiceCandidates !==
    3333
  ) {
    failures.push(
      `Expected 3333 Table S candidates, got ${result.counts.tableSChoiceCandidates}.`,
    );
  }

  if (
    result.counts.qualifiedTableAChoicePools !==
    18
  ) {
    failures.push(
      `Expected 18 qualified Table A choice pools, got ${result.counts.qualifiedTableAChoicePools}.`,
    );
  }

  if (
    result.counts.qualifiedTableAChoiceCandidates !==
    462
  ) {
    failures.push(
      `Expected 462 qualified Table A candidates, got ${result.counts.qualifiedTableAChoiceCandidates}.`,
    );
  }

  if (
    result.counts.totalChoicePools !==
    51
  ) {
    failures.push(
      `Expected 51 total choice pools, got ${result.counts.totalChoicePools}.`,
    );
  }

  if (
    result.counts.totalChoiceCandidates !==
    3795
  ) {
    failures.push(
      `Expected 3795 total choice candidates, got ${result.counts.totalChoiceCandidates}.`,
    );
  }

  if (
    result.counts.tableSSemanticReviewSignals !==
    2
  ) {
    failures.push(
      `Expected 2 Table S semantic-review signals, got ${result.counts.tableSSemanticReviewSignals}.`,
    );
  }

  if (
    result.counts.qualifiedTableAReviewSignals !==
    5
  ) {
    failures.push(
      `Expected 5 qualified Table A review signals, got ${result.counts.qualifiedTableAReviewSignals}.`,
    );
  }

  divider();

  if (failures.length > 0) {
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

    process.exitCode = 1;
    return;
  }

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'STAGE2 DEGREE-COMPONENT MERGE: CLEAN',
  );

  console.log(
    'IMPORTANT: this is not the final USYD relationship layer because unqualified Table A references and degree requirement semantics are still unresolved.',
  );

  console.log(
    'NEXT: write Stage2, then resolve unqualified Table A references.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
