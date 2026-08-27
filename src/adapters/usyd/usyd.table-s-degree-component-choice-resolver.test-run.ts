import {
  collectUsydTableSDegreeComponentChoices,
} from './usyd.table-s-degree-component-choice-resolver';

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
    'USYD TABLE S DEGREE-COMPONENT CHOICE AUDIT',
  );

  divider();

  const result =
    await collectUsydTableSDegreeComponentChoices();

  console.log(
    `Raw Table S signals: ${result.counts.rawTableSSignals}`,
  );

  console.log(
    `Table-only signals ignored: ${result.counts.tableOnlySignalsIgnored}`,
  );

  console.log(
    `Typed MAJOR/MINOR choice signals: ${result.counts.typedChoiceSignals}`,
  );

  console.log(
    `Choice pools: ${result.counts.choicePools}`,
  );

  console.log(
    `Degrees with Table S choices: ${result.counts.degreesWithTableSChoices}`,
  );

  console.log(
    `Total choice candidates: ${result.counts.totalChoiceCandidates}`,
  );

  console.log(
    `Semantic review signals: ${result.counts.semanticReviewSignals}`,
  );

  divider();

  console.log(
    'CHOICE POOLS',
  );

  divider();

  for (
    const choice
    of result.choices
  ) {
    console.log(
      `${choice.degreeCode} — ${choice.degreeTitle}`,
    );

    console.log(
      `  ${choice.requestedComponentType} from Table S`,
    );

    console.log(
      `  Candidates: ${choice.candidates.length}`,
    );

    console.log(
      `  Evidence records: ${choice.evidence.length}`,
    );
  }

  divider();

  console.log(
    'SEMANTIC REVIEW SIGNALS',
  );

  divider();

  if (
    result.semanticReviewSignals.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const signal
      of result.semanticReviewSignals
    ) {
      console.log(
        `${signal.degreeCode} — ${signal.degreeTitle}`,
      );

      console.log(
        `  Type: ${signal.componentType}`,
      );

      console.log(
        `  Reason: ${signal.reason}`,
      );

      console.log(
        `  Raw: ${signal.rawText}`,
      );
    }
  }

  const failures:
    string[] =
    [];

  const wrongPool =
    result.choices.filter(
      (
        choice,
      ) =>
        choice.candidates.length !==
        101,
    );

  if (
    wrongPool.length >
    0
  ) {
    failures.push(
      `${wrongPool.length} Table S choice pool(s) do not contain exactly 101 authoritative candidates.`,
    );
  }

  if (
    result.counts.choicePools ===
    0
  ) {
    failures.push(
      'No Table S MAJOR/MINOR choice pools were produced.',
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
    'TABLE S DEGREE-COMPONENT CHOICES: CLEAN',
  );

  console.log(
    'Table-only/elective references are intentionally ignored because they are not component relationships.',
  );

  console.log(
    'Any PROGRAM/STREAM signal is preserved separately for semantic review and is not converted into a Table S choice.',
  );

  console.log(
    'NEXT: write Table S choices, then resolve qualified Table A choice pools.',
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
