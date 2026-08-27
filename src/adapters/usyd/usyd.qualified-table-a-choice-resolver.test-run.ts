import {
  collectUsydQualifiedTableAChoices,
} from './usyd.qualified-table-a-choice-resolver';

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
    'USYD QUALIFIED TABLE A FINAL AUDIT',
  );

  divider();

  const result =
    await collectUsydQualifiedTableAChoices();

  console.log(
    `Qualified Table A groups: ${result.counts.qualifiedTableAGroups}`,
  );

  console.log(
    `Authoritative choice pools: ${result.counts.authoritativeChoicePools}`,
  );

  console.log(
    `Degrees with qualified Table A choices: ${result.counts.degreesWithQualifiedTableAChoices}`,
  );

  console.log(
    `Total choice candidates: ${result.counts.totalChoiceCandidates}`,
  );

  console.log(
    `Review signals: ${result.counts.reviewSignals}`,
  );

  console.log(
    `Contextual Honours signals: ${result.counts.contextualHonoursSignals}`,
  );

  console.log(
    `STREAM review signals: ${result.counts.streamReviewSignals}`,
  );

  console.log(
    `Unresolved role signals: ${result.counts.unresolvedRoleSignals}`,
  );

  divider();

  console.log(
    'AUTHORITATIVE POOLS',
  );

  divider();

  for (const choice of result.choices) {
    console.log(
      `${choice.degreeCode} — ${choice.degreeTitle}`,
    );

    console.log(
      `  Table: ${choice.tableName}`,
    );

    console.log(
      `  Type: ${choice.requestedComponentType}`,
    );

    console.log(
      `  Candidates: ${choice.candidates.length}`,
    );
  }

  divider();

  console.log(
    'REVIEW SIGNALS',
  );

  divider();

  for (
    const signal
    of result.reviewSignals
  ) {
    console.log(
      `${signal.degreeCode} — ${signal.degreeTitle}`,
    );

    console.log(
      `  Table: ${signal.tableName}`,
    );

    console.log(
      `  Types: ${signal.requestedComponentTypes.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Reason: ${signal.reason}`,
    );
  }

  const failures: string[] = [];

  const expectedCounts =
    new Map<string, number>([
      [
        'Table A for the Bachelor of Commerce|MAJOR',
        12,
      ],
      [
        'Table A for the Bachelor of Computing|MAJOR',
        4,
      ],
      [
        'Table A for the Bachelor of Arts|MAJOR',
        52,
      ],
      [
        'Table A for the Bachelor of Economics|MAJOR',
        3,
      ],
      [
        'Table A for the Bachelor of Economics|MINOR',
        3,
      ],
      [
        'Table A for the Bachelor of Science|MAJOR',
        46,
      ],
    ]);

  for (
    const choice
    of result.choices
  ) {
    const key =
      `${choice.tableName}|${choice.requestedComponentType}`;

    const expected =
      expectedCounts.get(key);

    if (
      expected !== undefined &&
      choice.candidates.length !==
        expected
    ) {
      failures.push(
        `${key} expected ${expected} candidates, got ${choice.candidates.length}.`,
      );
    }
  }

  if (
    result.counts.contextualHonoursSignals !==
    4
  ) {
    failures.push(
      `Expected 4 contextual Honours signals, got ${result.counts.contextualHonoursSignals}.`,
    );
  }

  if (
    result.counts.streamReviewSignals !==
    1
  ) {
    failures.push(
      `Expected 1 STREAM review signal, got ${result.counts.streamReviewSignals}.`,
    );
  }

  if (
    result.counts.unresolvedRoleSignals !==
    0
  ) {
    failures.push(
      `Expected 0 unresolved role signals, got ${result.counts.unresolvedRoleSignals}.`,
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
    'QUALIFIED TABLE A CHOICE POOLS: COMPLETE',
  );

  console.log(
    'The remaining 5 review signals are contextual semantics, not missing component-role coverage.',
  );

  console.log(
    'NEXT: write Table A choices and merge explicit named + Table S + Table A degree-component relationships.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
