import {
  auditUsydUnqualifiedTableA,
} from './usyd.unqualified-table-a-audit';

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
    'USYD UNQUALIFIED TABLE A AUDIT',
  );

  divider();

  const result =
    await auditUsydUnqualifiedTableA();

  console.log(
    `Groups: ${result.counts.groups}`,
  );

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Typed component references: ${result.counts.typedComponentReferences}`,
  );

  console.log(
    `Table-only/elective references: ${result.counts.tableOnlyOrElective}`,
  );

  console.log(
    `Multi-type review: ${result.counts.multiTypeReview}`,
  );

  divider();

  console.log(
    'BY DEGREE HANDBOOK',
  );

  divider();

  for (
    const [
      handbook,
      count,
    ]
    of Object.entries(
      result.byDegreeHandbook,
    ).sort(
      (left, right) =>
        left[0].localeCompare(
          right[0],
        ),
    )
  ) {
    console.log(
      `${handbook}: ${count}`,
    );
  }

  divider();

  console.log(
    'BY COMPONENT TYPE',
  );

  divider();

  for (
    const [
      type,
      count,
    ]
    of Object.entries(
      result.byComponentType,
    ).sort(
      (left, right) =>
        left[0].localeCompare(
          right[0],
        ),
    )
  ) {
    console.log(
      `${type}: ${count}`,
    );
  }

  divider();

  console.log(
    'RECORDS',
  );

  divider();

  for (const record of result.records) {
    console.log(
      `${record.degreeCode} — ${record.degreeTitle}`,
    );

    console.log(
      `  Degree handbook: ${record.degreeHandbook ?? 'UNKNOWN'}`,
    );

    console.log(
      `  Types: ${record.componentTypes.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Class: ${record.preliminaryClassification}`,
    );

    console.log(
      `  Candidates: ${record.candidateCount}`,
    );

    console.log(
      `  Candidate handbook/type: ${JSON.stringify(record.candidatesByHandbookAndType)}`,
    );

    for (
      const raw
      of record.rawExamples
    ) {
      console.log(
        `  Raw: ${raw}`,
      );
    }

    console.log('');
  }

  const failures: string[] = [];

  if (
    result.counts.groups !==
    32
  ) {
    failures.push(
      `Expected 32 unqualified Table A groups from the earlier table-signal audit, got ${result.counts.groups}.`,
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
    'STATUS: DIAGNOSTIC ONLY',
  );

  console.log(
    'NEXT: classify each typed unqualified Table A reference by actual degree/table context before creating any choice pool.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
