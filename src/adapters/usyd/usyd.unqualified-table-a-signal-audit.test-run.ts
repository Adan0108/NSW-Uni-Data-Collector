import {
  auditUsydUnqualifiedTableASignals,
} from './usyd.unqualified-table-a-signal-audit';

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
    'USYD UNQUALIFIED TABLE A SIGNAL-LEVEL AUDIT V2',
  );

  divider();

  const result =
    await auditUsydUnqualifiedTableASignals();

  console.log(
    `Signals: ${result.counts.signals}`,
  );

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Direct Table A component choices: ${result.counts.directTableAComponentChoice}`,
  );

  console.log(
    `Table A or Table S component choices: ${result.counts.tableAOrTableSComponentChoice}`,
  );

  console.log(
    `Cross-faculty Table A component choices: ${result.counts.crossFacultyTableAComponentChoice}`,
  );

  console.log(
    `STREAM context: ${result.counts.streamContext}`,
  );

  console.log(
    `Non-component unit references: ${result.counts.nonComponentUnitReference}`,
  );

  console.log(
    `Suspicious PROGRAM scope: ${result.counts.suspiciousProgramScope}`,
  );

  console.log(
    `Untyped component clauses: ${result.counts.untypedComponentClause}`,
  );

  console.log(
    `Review: ${result.counts.review}`,
  );

  divider();

  console.log(
    'SAFE TYPED COMPONENT SIGNALS',
  );

  divider();

  for (
    const record
    of result.records.filter(
      (record) =>
        record.semanticClass ===
          'DIRECT_TABLE_A_COMPONENT_CHOICE' ||
        record.semanticClass ===
          'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE' ||
        record.semanticClass ===
          'CROSS_FACULTY_TABLE_A_COMPONENT_CHOICE',
    )
  ) {
    console.log(
      `${record.degreeCode ?? 'UNKNOWN'} — ${record.degreeTitle ?? 'UNKNOWN'}`,
    );

    console.log(
      `  Type: ${record.componentType ?? 'NONE'}`,
    );

    console.log(
      `  Class: ${record.semanticClass}`,
    );

    console.log(
      `  Raw: ${record.raw}`,
    );
  }

  divider();

  console.log(
    'PRESERVED / EXCLUDED SIGNALS',
  );

  divider();

  for (
    const record
    of result.records.filter(
      (record) =>
        record.semanticClass !==
          'DIRECT_TABLE_A_COMPONENT_CHOICE' &&
        record.semanticClass !==
          'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE' &&
        record.semanticClass !==
          'CROSS_FACULTY_TABLE_A_COMPONENT_CHOICE',
    )
  ) {
    console.log(
      `${record.degreeCode ?? 'UNKNOWN'} — ${record.degreeTitle ?? 'UNKNOWN'}`,
    );

    console.log(
      `  Type: ${record.componentType ?? 'NONE'}`,
    );

    console.log(
      `  Class: ${record.semanticClass}`,
    );

    console.log(
      `  Raw: ${record.raw}`,
    );
  }

  const failures: string[] = [];

  if (
    result.counts.signals ===
    0
  ) {
    failures.push(
      'No unqualified Table A signals were recovered.',
    );
  }

  const psychologyMinor =
    result.records.find(
      (record) =>
        record.degreeCode ===
          'BPPSYCHO-04' &&
        record.componentType ===
          'MINOR' &&
        /minor as listed in the bachelor of science table a,\s*or table s/i.test(
          record.raw,
        ),
    );

  if (
    !psychologyMinor ||
    psychologyMinor.semanticClass !==
      'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE'
  ) {
    failures.push(
      'BPPSYCHO-04 MINOR must classify as TABLE_A_OR_TABLE_S_COMPONENT_CHOICE.',
    );
  }

  const performanceUnitReview =
    result.records.filter(
      (record) =>
        record.degreeCode ===
          'BPMUPERF-01' &&
        record.componentType ===
          null &&
        record.semanticClass ===
          'REVIEW',
    );

  if (
    performanceUnitReview.length >
    0
  ) {
    failures.push(
      `BPMUPERF-01 still has ${performanceUnitReview.length} untyped Table A unit clause(s) incorrectly left as REVIEW.`,
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
    'UNQUALIFIED TABLE A SIGNAL SEMANTICS V2: CLEAN',
  );

  console.log(
    'NEXT: build pools only from safe typed component signals. Untyped duplicates stay preserved for formal degree-requirement parsing.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
