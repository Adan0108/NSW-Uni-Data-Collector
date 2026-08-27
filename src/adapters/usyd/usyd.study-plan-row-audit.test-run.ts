import {
  buildUsydStudyPlanRowAuditV2,
} from './usyd.study-plan-row-audit';

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
    'USYD STUDY PLAN ROW AUDIT V2',
  );

  divider();

  const result =
    await buildUsydStudyPlanRowAuditV2();

  console.log(
    `Authoritative sources: ${result.counts.authoritativeSources}`,
  );

  console.log(
    `Rows: ${result.counts.rows}`,
  );

  console.log(
    `Header rows: ${result.counts.headerRows}`,
  );

  console.log(
    `Plan rows: ${result.counts.planRows}`,
  );

  console.log(
    `Credit rows: ${result.counts.creditRows}`,
  );

  console.log(
    `Total rows: ${result.counts.totalRows}`,
  );

  console.log(
    `Amendment header rows: ${result.counts.amendmentHeaderRows}`,
  );

  console.log(
    `Amendment rows: ${result.counts.amendmentRows}`,
  );

  console.log(
    `Note rows: ${result.counts.noteRows}`,
  );

  console.log(
    `Unknown rows: ${result.counts.unknownRows}`,
  );

  console.log(
    `Plan rows with unit codes: ${result.counts.planRowsWithUnitCodes}`,
  );

  console.log(
    `Plan rows with choices: ${result.counts.planRowsWithChoices}`,
  );

  console.log(
    `Plan rows with year: ${result.counts.planRowsWithYear}`,
  );

  console.log(
    `Plan rows with semester: ${result.counts.planRowsWithSemester}`,
  );

  console.log(
    `Orphan credit rows: ${result.counts.orphanCreditRows}`,
  );

  console.log(
    `Duplicate source assignments: ${result.counts.duplicateSourceUrls}`,
  );

  divider();

  console.log(
    'PLAN ROW SAMPLES',
  );

  divider();

  for (
    const row
    of result.rows
      .filter(
        (item) =>
          item.kind ===
          'PLAN_ROW',
      )
      .slice(
        0,
        30,
      )
  ) {
    console.log(
      `${row.degreeCode} | ${row.yearLabel ?? '(no year)'} | Semester ${row.semester ?? '?'}`,
    );

    console.log(
      `  Cells: ${row.cells.join(' | ')}`,
    );

    console.log(
      `  Units: ${row.unitCodes.join(', ') || '(none)'}`,
    );

    console.log(
      `  Choices: ${row.choiceTexts.join(' || ') || '(none)'}`,
    );

    console.log(
      `  Item CP: ${row.creditPoints.join(', ') || '(none)'}`,
    );

    console.log(
      `  Semester total: ${row.semesterTotalCreditPoints ?? '(none)'}`,
    );

    console.log('');
  }

  divider();

  console.log(
    'UNKNOWN ROWS',
  );

  divider();

  for (
    const row
    of result.rows.filter(
      (item) =>
        item.kind ===
        'UNKNOWN',
    )
  ) {
    console.log(
      `${row.degreeCode} | row ${row.rowIndex}: ${row.cells.join(' | ')}`,
    );
  }

  const failures:
    string[] = [];

  if (
    result.counts.authoritativeSources !==
    4
  ) {
    failures.push(
      `Expected 4 authoritative sources, got ${result.counts.authoritativeSources}.`,
    );
  }

  if (
    result.counts.rows !==
    106
  ) {
    failures.push(
      `Expected 106 source rows, got ${result.counts.rows}.`,
    );
  }

  if (
    result.counts.duplicateSourceUrls !==
    0
  ) {
    failures.push(
      `Expected 0 duplicate source assignments, got ${result.counts.duplicateSourceUrls}.`,
    );
  }

  if (
    result.counts.orphanCreditRows !==
    0
  ) {
    failures.push(
      `Expected 0 orphan credit rows, got ${result.counts.orphanCreditRows}.`,
    );
  }

  if (
    result.counts.unknownRows !==
    0
  ) {
    failures.push(
      `Expected 0 unknown rows after V2 classification, got ${result.counts.unknownRows}.`,
    );
  }

  if (
    result.counts.planRowsWithSemester !==
    result.counts.planRows
  ) {
    failures.push(
      `Every plan row should have a semester. ${result.counts.planRowsWithSemester}/${result.counts.planRows} do.`,
    );
  }

  if (
    result.counts.planRowsWithYear !==
    result.counts.planRows
  ) {
    failures.push(
      `Every plan row should inherit a year. ${result.counts.planRowsWithYear}/${result.counts.planRows} do.`,
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
    'STUDY PLAN ROW SHAPES V2: CLEAN',
  );

  console.log(
    'CREDIT-ONLY ROWS PAIRED WITH PREVIOUS PLAN ROWS',
  );

  console.log(
    'POST-PUBLICATION AMENDMENT TABLES EXCLUDED FROM PLAN ITEMS',
  );

  console.log(
    'NEXT: write V2 and build final StudyPlan -> Year -> Period -> Item normalization.',
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
