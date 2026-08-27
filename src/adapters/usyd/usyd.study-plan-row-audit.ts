import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const RELEVANCE_FILE = path.join(
  DATA_DIR,
  'usyd-study-plan-relevance-audit.v2.json',
);

interface Candidate {
  degreeCode: string;
  degreeTitle: string;
  candidateUrl: string;
  candidateText: string | null;
  relevanceStatus:
    | 'AUTHORITATIVE_RECOMMENDATION_SOURCE'
    | 'REVIEW_DEGREE_SCOPE_MISMATCH'
    | 'NO_PLAN_FOUND'
    | 'FETCH_FAILED';
  heading: string | null;
  tableCount: number;
  tableRows: string[][];
}

interface RelevanceDataset {
  candidates: Candidate[];
}

export type StudyPlanRowKind =
  | 'HEADER'
  | 'PLAN_ROW'
  | 'CREDIT_ROW'
  | 'TOTAL_ROW'
  | 'AMENDMENT_HEADER'
  | 'AMENDMENT_ROW'
  | 'NOTE'
  | 'UNKNOWN';

export interface AuditedStudyPlanRow {
  degreeCode: string;
  degreeTitle: string;
  sourceUrl: string;

  rowIndex: number;
  cells: string[];

  kind: StudyPlanRowKind;

  year:
    number | null;

  yearLabel:
    string | null;

  semester:
    number | null;

  unitCodes:
    string[];

  choiceTexts:
    string[];

  creditPoints:
    number[];

  semesterTotalCreditPoints:
    number | null;

  degreeTotalCreditPoints:
    number | null;

  reason:
    string;
}

export interface UsydStudyPlanRowAuditV2 {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    authoritativeSources: number;
    rows: number;

    headerRows: number;
    planRows: number;
    creditRows: number;
    totalRows: number;
    amendmentHeaderRows: number;
    amendmentRows: number;
    noteRows: number;
    unknownRows: number;

    planRowsWithUnitCodes: number;
    planRowsWithChoices: number;

    planRowsWithYear: number;
    planRowsWithSemester: number;

    orphanCreditRows: number;
    duplicateSourceUrls: number;
  };

  sources: Array<{
    degreeCode: string;
    degreeTitle: string;
    sourceUrl: string;
    heading: string | null;
    tableCount: number;
    rowCount: number;
  }>;

  rows:
    AuditedStudyPlanRow[];

  coverage: {
    authoritativeSourceSelection: 'COMPLETE';
    rowShapeAudit: 'COMPLETE';
    creditRowPairing: 'COMPLETE';
    amendmentRowsExcludedFromPlan: 'COMPLETE';
    finalStudyPlanNormalization: 'READY';
  };
}

async function readRelevance():
Promise<RelevanceDataset> {
  const raw =
    await fs.readFile(
      RELEVANCE_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as RelevanceDataset;

  if (
    !Array.isArray(
      parsed.candidates,
    )
  ) {
    throw new Error(
      'Study-plan relevance audit V2 is missing candidates[]. Run the V2 writer first.',
    );
  }

  return parsed;
}

function normalize(
  value: string,
): string {
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractUnitCodes(
  text: string,
): string[] {
  const matches =
    text.match(
      /\b[A-Z]{4}\d{4}\b/g,
    ) ??
    [];

  return [
    ...new Set(
      matches,
    ),
  ];
}

function extractChoiceTexts(
  cells: string[],
): string[] {
  const choicePatterns =
    [
      /\belective\b/i,
      /\bmajor\b/i,
      /\bminor\b/i,
      /\bprogram\b/i,
      /\bselective\b/i,
      /\bcore unit\b/i,
      /\bfoundation unit\b/i,
      /\bunit from\b/i,
      /\btable [asdo]\b/i,
      /\bopen learning environment\b/i,
      /\bdalyell\b/i,
      /\bchoice\b/i,
      /\bscience unit\b/i,
      /\barts unit\b/i,
      /\bcultural capstone\b/i,
      /\bliberal studies\b/i,
    ];

  return cells
    .map(
      normalize,
    )
    .filter(
      (cell) =>
        cell.length >
          0 &&
        extractUnitCodes(
          cell,
        ).length ===
          0 &&
        choicePatterns.some(
          (pattern) =>
            pattern.test(
              cell,
            ),
        ),
    );
}

function isHeaderRow(
  cells: string[],
): boolean {
  const text =
    normalize(
      cells.join(
        ' | ',
      ),
    );

  return (
    /\bsemester\b/i.test(
      text,
    ) &&
    /\bunit of study\b/i.test(
      text,
    ) &&
    /\btotal\b/i.test(
      text,
    )
  );
}

function isCreditRow(
  cells: string[],
): boolean {
  if (
    cells.length <
    2
  ) {
    return false;
  }

  return cells.every(
    (cell) =>
      /^\d{1,3}$/.test(
        normalize(
          cell,
        ),
      ),
  );
}

function isTotalRow(
  cells: string[],
): boolean {
  const first =
    normalize(
      cells[0] ??
      '',
    );

  return /^total credit points:?$/i.test(
    first,
  );
}

function isAmendmentHeader(
  cells: string[],
): boolean {
  const text =
    normalize(
      cells.join(
        ' | ',
      ),
    );

  return (
    /\bdate\b/i.test(
      text,
    ) &&
    /\boriginal publication\b/i.test(
      text,
    ) &&
    /\bpost-publication amendment\b/i.test(
      text,
    )
  );
}

function isAmendmentRow(
  cells: string[],
): boolean {
  const first =
    normalize(
      cells[0] ??
      '',
    );

  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(
    first,
  );
}

function looksLikeNote(
  cells: string[],
): boolean {
  const text =
    normalize(
      cells.join(
        ' ',
      ),
    );

  return (
    /^note\b/i.test(
      text,
    ) ||
    /^students?\b/i.test(
      text,
    ) ||
    /^depending on\b/i.test(
      text,
    ) ||
    /^please\b/i.test(
      text,
    ) ||
    /^this sample\b/i.test(
      text,
    )
  );
}

function parsePlanRowContext(
  cells: string[],
  previousYear:
    number | null,
  previousYearLabel:
    string | null,
): {
  year: number | null;
  yearLabel: string | null;
  semester: number | null;
} {
  const first =
    normalize(
      cells[0] ??
      '',
    );

  const second =
    normalize(
      cells[1] ??
      '',
    );

  const normalYear =
    first.match(
      /^Year\s+([1-9])$/i,
    );

  if (
    normalYear
  ) {
    return {
      year:
        Number(
          normalYear[1],
        ),

      yearLabel:
        `Year ${normalYear[1]}`,

      semester:
        /^[12]$/.test(
          second,
        )
          ? Number(
              second,
            )
          : null,
    };
  }

  if (
    /^Foundation Year$/i.test(
      first,
    )
  ) {
    return {
      year:
        0,

      yearLabel:
        'Foundation Year',

      semester:
        /^[12]$/.test(
          second,
        )
          ? Number(
              second,
            )
          : null,
    };
  }

  if (
    /^[12]$/.test(
      first,
    )
  ) {
    return {
      year:
        previousYear,

      yearLabel:
        previousYearLabel,

      semester:
        Number(
          first,
        ),
    };
  }

  return {
    year:
      previousYear,

    yearLabel:
      previousYearLabel,

    semester:
      null,
  };
}

function parseCreditNumbers(
  cells: string[],
): number[] {
  return cells.map(
    (cell) =>
      Number(
        normalize(
          cell,
        ),
      ),
  );
}

function parseDegreeTotal(
  cells: string[],
): number | null {
  if (
    !isTotalRow(
      cells,
    )
  ) {
    return null;
  }

  for (
    let index =
      cells.length -
      1;
    index >=
      0;
    index -=
      1
  ) {
    const value =
      normalize(
        cells[index],
      );

    if (
      /^\d{1,3}$/.test(
        value,
      )
    ) {
      return Number(
        value,
      );
    }
  }

  return null;
}

export async function buildUsydStudyPlanRowAuditV2():
Promise<UsydStudyPlanRowAuditV2> {
  const relevance =
    await readRelevance();

  const authoritative =
    relevance.candidates.filter(
      (candidate) =>
        candidate.relevanceStatus ===
        'AUTHORITATIVE_RECOMMENDATION_SOURCE',
    );

  const rows:
    AuditedStudyPlanRow[] =
    [];

  let orphanCreditRows =
    0;

  for (
    const candidate
    of authoritative
  ) {
    let currentYear:
      number | null =
      null;

    let currentYearLabel:
      string | null =
      null;

    let lastPlanRow:
      AuditedStudyPlanRow | null =
      null;

    candidate.tableRows.forEach(
      (
        rawCells,
        rowIndex,
      ) => {
        const cells =
          rawCells.map(
            normalize,
          );

        if (
          isHeaderRow(
            cells,
          )
        ) {
          rows.push({
            degreeCode:
              candidate.degreeCode,

            degreeTitle:
              candidate.degreeTitle,

            sourceUrl:
              candidate.candidateUrl,

            rowIndex,
            cells,

            kind:
              'HEADER',

            year:
              null,

            yearLabel:
              null,

            semester:
              null,

            unitCodes:
              [],

            choiceTexts:
              [],

            creditPoints:
              [],

            semesterTotalCreditPoints:
              null,

            degreeTotalCreditPoints:
              null,

            reason:
              'PLAN_TABLE_HEADER',
          });

          lastPlanRow =
            null;

          return;
        }

        if (
          isAmendmentHeader(
            cells,
          )
        ) {
          rows.push({
            degreeCode:
              candidate.degreeCode,

            degreeTitle:
              candidate.degreeTitle,

            sourceUrl:
              candidate.candidateUrl,

            rowIndex,
            cells,

            kind:
              'AMENDMENT_HEADER',

            year:
              null,

            yearLabel:
              null,

            semester:
              null,

            unitCodes:
              [],

            choiceTexts:
              [],

            creditPoints:
              [],

            semesterTotalCreditPoints:
              null,

            degreeTotalCreditPoints:
              null,

            reason:
              'AMENDMENT_TABLE_HEADER',
          });

          lastPlanRow =
            null;

          return;
        }

        if (
          isAmendmentRow(
            cells,
          )
        ) {
          rows.push({
            degreeCode:
              candidate.degreeCode,

            degreeTitle:
              candidate.degreeTitle,

            sourceUrl:
              candidate.candidateUrl,

            rowIndex,
            cells,

            kind:
              'AMENDMENT_ROW',

            year:
              null,

            yearLabel:
              null,

            semester:
              null,

            unitCodes:
              extractUnitCodes(
                cells.join(
                  ' ',
                ),
              ),

            choiceTexts:
              [],

            creditPoints:
              [],

            semesterTotalCreditPoints:
              null,

            degreeTotalCreditPoints:
              null,

            reason:
              'POST_PUBLICATION_AMENDMENT_ROW',
          });

          lastPlanRow =
            null;

          return;
        }

        if (
          isTotalRow(
            cells,
          )
        ) {
          rows.push({
            degreeCode:
              candidate.degreeCode,

            degreeTitle:
              candidate.degreeTitle,

            sourceUrl:
              candidate.candidateUrl,

            rowIndex,
            cells,

            kind:
              'TOTAL_ROW',

            year:
              null,

            yearLabel:
              null,

            semester:
              null,

            unitCodes:
              [],

            choiceTexts:
              [],

            creditPoints:
              [],

            semesterTotalCreditPoints:
              null,

            degreeTotalCreditPoints:
              parseDegreeTotal(
                cells,
              ),

            reason:
              'DEGREE_TOTAL_CREDIT_POINTS',
          });

          lastPlanRow =
            null;

          return;
        }

        if (
          isCreditRow(
            cells,
          )
        ) {
          const creditPoints =
            parseCreditNumbers(
              cells,
            );

          const semesterTotalCreditPoints =
            creditPoints[
              creditPoints.length -
              1
            ] ??
            null;

          rows.push({
            degreeCode:
              candidate.degreeCode,

            degreeTitle:
              candidate.degreeTitle,

            sourceUrl:
              candidate.candidateUrl,

            rowIndex,
            cells,

            kind:
              'CREDIT_ROW',

            year:
              lastPlanRow?.year ??
              null,

            yearLabel:
              lastPlanRow?.yearLabel ??
              null,

            semester:
              lastPlanRow?.semester ??
              null,

            unitCodes:
              [],

            choiceTexts:
              [],

            creditPoints,

            semesterTotalCreditPoints,

            degreeTotalCreditPoints:
              null,

            reason:
              lastPlanRow
                ? 'PAIRED_WITH_PREVIOUS_PLAN_ROW'
                : 'ORPHAN_CREDIT_ROW',
          });

          if (
            !lastPlanRow
          ) {
            orphanCreditRows +=
              1;
          } else {
            lastPlanRow.creditPoints =
              creditPoints.slice(
                0,
                -1,
              );

            lastPlanRow.semesterTotalCreditPoints =
              semesterTotalCreditPoints;
          }

          return;
        }

        if (
          looksLikeNote(
            cells,
          )
        ) {
          rows.push({
            degreeCode:
              candidate.degreeCode,

            degreeTitle:
              candidate.degreeTitle,

            sourceUrl:
              candidate.candidateUrl,

            rowIndex,
            cells,

            kind:
              'NOTE',

            year:
              null,

            yearLabel:
              null,

            semester:
              null,

            unitCodes:
              [],

            choiceTexts:
              [],

            creditPoints:
              [],

            semesterTotalCreditPoints:
              null,

            degreeTotalCreditPoints:
              null,

            reason:
              'NOTE_TEXT',
          });

          lastPlanRow =
            null;

          return;
        }

        const context =
          parsePlanRowContext(
            cells,
            currentYear,
            currentYearLabel,
          );

        if (
          context.year !==
          null
        ) {
          currentYear =
            context.year;

          currentYearLabel =
            context.yearLabel;
        }

        const allText =
          normalize(
            cells.join(
              ' ',
            ),
          );

        const unitCodes =
          extractUnitCodes(
            allText,
          );

        const choiceTexts =
          extractChoiceTexts(
            cells,
          );

        const looksLikePlanRow =
          context.semester !==
            null ||
          unitCodes.length >
            0 ||
          choiceTexts.length >
            0;

        if (
          looksLikePlanRow
        ) {
          const planRow:
            AuditedStudyPlanRow = {
              degreeCode:
                candidate.degreeCode,

              degreeTitle:
                candidate.degreeTitle,

              sourceUrl:
                candidate.candidateUrl,

              rowIndex,
              cells,

              kind:
                'PLAN_ROW',

              year:
                context.year,

              yearLabel:
                context.yearLabel,

              semester:
                context.semester,

              unitCodes,

              choiceTexts,

              creditPoints:
                [],

              semesterTotalCreditPoints:
                null,

              degreeTotalCreditPoints:
                null,

              reason:
                'PLAN_CONTENT_ROW',
            };

          rows.push(
            planRow,
          );

          lastPlanRow =
            planRow;

          return;
        }

        rows.push({
          degreeCode:
            candidate.degreeCode,

          degreeTitle:
            candidate.degreeTitle,

          sourceUrl:
            candidate.candidateUrl,

          rowIndex,
          cells,

          kind:
            'UNKNOWN',

          year:
            currentYear,

          yearLabel:
            currentYearLabel,

          semester:
            null,

          unitCodes:
            [],

          choiceTexts:
            [],

          creditPoints:
            [],

          semesterTotalCreditPoints:
            null,

          degreeTotalCreditPoints:
            null,

          reason:
            'UNCLASSIFIED_ROW_SHAPE',
        });

        lastPlanRow =
          null;
      },
    );
  }

  const sourceKeys =
    authoritative.map(
      (candidate) =>
        `${candidate.degreeCode}|${candidate.candidateUrl}`,
    );

  const duplicateSourceUrls =
    sourceKeys.length -
    new Set(
      sourceKeys,
    ).size;

  const planRows =
    rows.filter(
      (row) =>
        row.kind ===
        'PLAN_ROW',
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      authoritativeSources:
        authoritative.length,

      rows:
        rows.length,

      headerRows:
        rows.filter(
          (row) =>
            row.kind ===
            'HEADER',
        ).length,

      planRows:
        planRows.length,

      creditRows:
        rows.filter(
          (row) =>
            row.kind ===
            'CREDIT_ROW',
        ).length,

      totalRows:
        rows.filter(
          (row) =>
            row.kind ===
            'TOTAL_ROW',
        ).length,

      amendmentHeaderRows:
        rows.filter(
          (row) =>
            row.kind ===
            'AMENDMENT_HEADER',
        ).length,

      amendmentRows:
        rows.filter(
          (row) =>
            row.kind ===
            'AMENDMENT_ROW',
        ).length,

      noteRows:
        rows.filter(
          (row) =>
            row.kind ===
            'NOTE',
        ).length,

      unknownRows:
        rows.filter(
          (row) =>
            row.kind ===
            'UNKNOWN',
        ).length,

      planRowsWithUnitCodes:
        planRows.filter(
          (row) =>
            row.unitCodes.length >
            0,
        ).length,

      planRowsWithChoices:
        planRows.filter(
          (row) =>
            row.choiceTexts.length >
            0,
        ).length,

      planRowsWithYear:
        planRows.filter(
          (row) =>
            row.year !==
            null,
        ).length,

      planRowsWithSemester:
        planRows.filter(
          (row) =>
            row.semester !==
            null,
        ).length,

      orphanCreditRows,

      duplicateSourceUrls,
    },

    sources:
      authoritative.map(
        (candidate) => ({
          degreeCode:
            candidate.degreeCode,

          degreeTitle:
            candidate.degreeTitle,

          sourceUrl:
            candidate.candidateUrl,

          heading:
            candidate.heading,

          tableCount:
            candidate.tableCount,

          rowCount:
            candidate.tableRows.length,
        }),
      ),

    rows,

    coverage: {
      authoritativeSourceSelection:
        'COMPLETE',

      rowShapeAudit:
        'COMPLETE',

      creditRowPairing:
        'COMPLETE',

      amendmentRowsExcludedFromPlan:
        'COMPLETE',

      finalStudyPlanNormalization:
        'READY',
    },
  };
}

export async function writeUsydStudyPlanRowAuditV2():
Promise<void> {
  const result =
    await buildUsydStudyPlanRowAuditV2();

  if (
    result.counts
      .duplicateSourceUrls !==
      0 ||
    result.counts
      .orphanCreditRows !==
      0 ||
    result.counts
      .unknownRows !==
      0
  ) {
    throw new Error(
      [
        'Refusing to write study-plan row audit V2.',
        `duplicates=${result.counts.duplicateSourceUrls}`,
        `orphanCreditRows=${result.counts.orphanCreditRows}`,
        `unknownRows=${result.counts.unknownRows}`,
      ].join(' '),
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-study-plan-row-audit.v2.json',
    );

  const temporary =
    `${outputFile}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      result,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    outputFile,
  );

  console.log(
    '[USYD study plan row audit V2] PASS',
  );

  console.log(
    `Plan rows: ${result.counts.planRows}`,
  );

  console.log(
    `Credit rows: ${result.counts.creditRows}`,
  );

  console.log(
    `Amendment rows: ${result.counts.amendmentRows}`,
  );

  console.log(
    `Unknown rows: ${result.counts.unknownRows}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
