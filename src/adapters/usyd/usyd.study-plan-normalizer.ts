import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const ROW_AUDIT_FILE = path.join(
  DATA_DIR,
  'usyd-study-plan-row-audit.v2.json',
);

type StudyPlanRowKind =
  | 'HEADER'
  | 'PLAN_ROW'
  | 'CREDIT_ROW'
  | 'TOTAL_ROW'
  | 'AMENDMENT_HEADER'
  | 'AMENDMENT_ROW'
  | 'NOTE'
  | 'UNKNOWN';

interface AuditedStudyPlanRow {
  degreeCode: string;
  degreeTitle: string;
  sourceUrl: string;

  rowIndex: number;
  cells: string[];

  kind: StudyPlanRowKind;

  year: number | null;
  yearLabel: string | null;
  semester: number | null;

  unitCodes: string[];
  choiceTexts: string[];

  creditPoints: number[];
  semesterTotalCreditPoints: number | null;
  degreeTotalCreditPoints: number | null;

  reason: string;
}

interface RowAuditDataset {
  counts: {
    authoritativeSources: number;
    rows: number;
    unknownRows: number;
    orphanCreditRows: number;
  };

  rows: AuditedStudyPlanRow[];
}

export type UsydStudyPlanItemType =
  | 'SUBJECT'
  | 'CHOICE';

export interface UsydNormalizedStudyPlanItem {
  itemType:
    UsydStudyPlanItemType;

  subjectCode:
    string | null;

  choiceText:
    string | null;

  creditPoints:
    number | null;

  sortOrder:
    number;

  rawText:
    string;
}

export interface UsydNormalizedStudyPlanPeriod {
  periodType: 'SEMESTER';

  periodNumber:
    1 | 2;

  name:
    string;

  totalCreditPoints:
    number | null;

  items:
    UsydNormalizedStudyPlanItem[];
}

export interface UsydNormalizedStudyPlanYear {
  yearNumber:
    number;

  label:
    string;

  periods:
    UsydNormalizedStudyPlanPeriod[];
}

export interface UsydNormalizedStudyPlan {
  degreeCode:
    string;

  degreeTitle:
    string;

  title:
    string;

  pathway:
    'ARTS' | 'SCIENCE' | 'OTHER';

  variantNumber:
    number;

  handbookYear:
    2026;

  sourceUrl:
    string;

  sourceType:
    'OFFICIAL_SAMPLE_ENROLMENT';

  isFormalRequirement:
    false;

  totalCreditPoints:
    number | null;

  years:
    UsydNormalizedStudyPlanYear[];
}

export interface UsydStudyPlanNormalizedDataset {
  university:
    'USYD';

  handbookYear:
    2026;

  generatedAt:
    string;

  counts: {
    sourcePages:
      number;

    studyPlans:
      number;

    studyPlanYears:
      number;

    studyPlanPeriods:
      number;

    studyPlanItems:
      number;

    subjectItems:
      number;

    choiceItems:
      number;

    plansWithTotalCreditPoints:
      number;

    periodsWithoutItems:
      number;

    periodsWithoutCreditTotal:
      number;

    duplicatePlanKeys:
      number;

    duplicatePeriodKeys:
      number;

    duplicateItemKeys:
      number;
  };

  studyPlans:
    UsydNormalizedStudyPlan[];

  coverage: {
    authoritativeRecommendationSources:
      'NORMALIZED';

    amendmentRows:
      'EXCLUDED';

    formalRequirementSeparation:
      'PRESERVED';

    recommendedStudyPlans:
      'COMPLETE_FOR_PROVEN_2026_SOURCES';
  };
}

async function readRowAudit():
Promise<RowAuditDataset> {
  const raw =
    await fs.readFile(
      ROW_AUDIT_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as RowAuditDataset;

  if (
    !Array.isArray(
      parsed.rows,
    )
  ) {
    throw new Error(
      'Study-plan row audit V2 is missing rows[]. Run the V2 writer first.',
    );
  }

  if (
    parsed.counts
      .unknownRows !==
      0 ||
    parsed.counts
      .orphanCreditRows !==
      0
  ) {
    throw new Error(
      'Study-plan row audit V2 is not clean enough to normalize.',
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
  value: string,
): string[] {
  return [
    ...new Set(
      value.match(
        /\b[A-Z]{4}\d{4}\b/g,
      ) ??
      [],
    ),
  ];
}

function pathwayFromUrl(
  sourceUrl: string,
):
  | 'ARTS'
  | 'SCIENCE'
  | 'OTHER' {
  const pathname =
    new URL(
      sourceUrl,
    ).pathname.toLowerCase();

  if (
    pathname.includes(
      'arts-enrolment-guide',
    )
  ) {
    return 'ARTS';
  }

  if (
    pathname.includes(
      'science-enrolment-guide',
    )
  ) {
    return 'SCIENCE';
  }

  return 'OTHER';
}

function itemCellsForRow(
  row: AuditedStudyPlanRow,
): string[] {
  if (
    row.kind !==
    'PLAN_ROW'
  ) {
    return [];
  }

  const cells =
    row.cells.map(
      normalize,
    );

  const first =
    cells[0] ??
    '';

  if (
    /^Year\s+\d+$/i.test(
      first,
    ) ||
    /^Foundation Year$/i.test(
      first,
    )
  ) {
    return cells.slice(
      2,
    );
  }

  if (
    /^[12]$/.test(
      first,
    )
  ) {
    return cells.slice(
      1,
    );
  }

  throw new Error(
    `Unsupported PLAN_ROW leading cells: ${row.degreeCode} ${row.sourceUrl} row ${row.rowIndex}: ${cells.join(' | ')}`,
  );
}

function buildItem(
  rawText: string,
  creditPoints: number | null,
  sortOrder: number,
): UsydNormalizedStudyPlanItem {
  const normalized =
    normalize(
      rawText,
    );

  const unitCodes =
    extractUnitCodes(
      normalized,
    );

  if (
    unitCodes.length ===
    1
  ) {
    return {
      itemType:
        'SUBJECT',

      subjectCode:
        unitCodes[0],

      choiceText:
        null,

      creditPoints,

      sortOrder,

      rawText:
        normalized,
    };
  }

  /**
   * Zero codes => textual choice/pattern.
   * Multiple explicit codes => alternative/compound choice.
   *
   * Never collapse a multi-code cell into one SUBJECT.
   */
  return {
    itemType:
      'CHOICE',

    subjectCode:
      null,

    choiceText:
      normalized,

    creditPoints,

    sortOrder,

    rawText:
      normalized,
  };
}

interface SourceSegment {
  degreeCode: string;
  degreeTitle: string;
  sourceUrl: string;
  rows: AuditedStudyPlanRow[];
  totalCreditPoints: number | null;
}

function segmentPlans(
  rows: AuditedStudyPlanRow[],
): SourceSegment[] {
  const bySource =
    new Map<
      string,
      AuditedStudyPlanRow[]
    >();

  for (
    const row
    of rows
  ) {
    const key =
      [
        row.degreeCode,
        row.sourceUrl,
      ].join('|');

    const existing =
      bySource.get(
        key,
      ) ??
      [];

    existing.push(
      row,
    );

    bySource.set(
      key,
      existing,
    );
  }

  const segments:
    SourceSegment[] =
    [];

  for (
    const sourceRows
    of bySource.values()
  ) {
    const ordered =
      [...sourceRows].sort(
        (
          left,
          right,
        ) =>
          left.rowIndex -
          right.rowIndex,
      );

    let current:
      AuditedStudyPlanRow[] =
      [];

    for (
      const row
      of ordered
    ) {
      if (
        row.kind ===
        'AMENDMENT_HEADER' ||
        row.kind ===
        'AMENDMENT_ROW'
      ) {
        continue;
      }

      if (
        row.kind ===
        'HEADER'
      ) {
        if (
          current.length >
          0
        ) {
          throw new Error(
            `Unexpected new HEADER before TOTAL_ROW: ${row.degreeCode} ${row.sourceUrl}`,
          );
        }

        current = [
          row,
        ];

        continue;
      }

      if (
        current.length ===
        0
      ) {
        /**
         * Ignore metadata outside plan table segments.
         */
        continue;
      }

      current.push(
        row,
      );

      if (
        row.kind ===
        'TOTAL_ROW'
      ) {
        segments.push({
          degreeCode:
            row.degreeCode,

          degreeTitle:
            row.degreeTitle,

          sourceUrl:
            row.sourceUrl,

          rows:
            current,

          totalCreditPoints:
            row.degreeTotalCreditPoints,
        });

        current =
          [];
      }
    }

    if (
      current.length >
      0
    ) {
      throw new Error(
        `Unclosed study-plan segment for ${current[0].degreeCode} ${current[0].sourceUrl}.`,
      );
    }
  }

  return segments;
}

function buildPlan(
  segment: SourceSegment,
  variantNumber: number,
): UsydNormalizedStudyPlan {
  const pathway =
    pathwayFromUrl(
      segment.sourceUrl,
    );

  const periodMap =
    new Map<
      string,
      UsydNormalizedStudyPlanPeriod
    >();

  const yearMap =
    new Map<
      number,
      UsydNormalizedStudyPlanYear
    >();

  for (
    const row
    of segment.rows
  ) {
    if (
      row.kind !==
      'PLAN_ROW'
    ) {
      continue;
    }

    if (
      row.year ===
      null ||
    row.yearLabel ===
      null ||
    row.semester ===
      null
    ) {
      throw new Error(
        `PLAN_ROW missing year/semester: ${row.degreeCode} ${row.sourceUrl} row ${row.rowIndex}.`,
      );
    }

    if (
      row.semester !==
      1 &&
    row.semester !==
      2
    ) {
      throw new Error(
        `Unexpected semester ${row.semester}.`,
      );
    }

    let year =
      yearMap.get(
        row.year,
      );

    if (!year) {
      year = {
        yearNumber:
          row.year,

        label:
          row.yearLabel,

        periods:
          [],
      };

      yearMap.set(
        row.year,
        year,
      );
    }

    const periodKey =
      `${row.year}|${row.semester}`;

    if (
      periodMap.has(
        periodKey,
      )
    ) {
      throw new Error(
        `Duplicate period in one plan segment: ${row.degreeCode} ${segment.sourceUrl} ${periodKey}.`,
      );
    }

    const itemCells =
      itemCellsForRow(
        row,
      );

    if (
      row.creditPoints.length !==
      itemCells.length
    ) {
      throw new Error(
        [
          `Credit/item cell mismatch: ${row.degreeCode}`,
          `source=${row.sourceUrl}`,
          `row=${row.rowIndex}`,
          `itemCells=${itemCells.length}`,
          `creditPoints=${row.creditPoints.length}`,
          `cells=${row.cells.join(' | ')}`,
        ].join(' '),
      );
    }

    const items =
      itemCells.map(
        (
          cell,
          index,
        ) =>
          buildItem(
            cell,
            row.creditPoints[
              index
            ] ??
              null,
            index,
          ),
      );

    const period:
      UsydNormalizedStudyPlanPeriod = {
        periodType:
          'SEMESTER',

        periodNumber:
          row.semester,

        name:
          `Semester ${row.semester}`,

        totalCreditPoints:
          row.semesterTotalCreditPoints,

        items,
      };

    periodMap.set(
      periodKey,
      period,
    );

    year.periods.push(
      period,
    );
  }

  const years =
    [
      ...yearMap.values(),
    ]
      .sort(
        (
          left,
          right,
        ) =>
          left.yearNumber -
          right.yearNumber,
      )
      .map(
        (year) => ({
          ...year,

          periods:
            [...year.periods].sort(
              (
                left,
                right,
              ) =>
                left.periodNumber -
                right.periodNumber,
            ),
        }),
      );

  const pathwayLabel =
    pathway ===
      'ARTS'
      ? 'Arts pathway'
      : pathway ===
          'SCIENCE'
        ? 'Science pathway'
        : 'Sample enrolment';

  return {
    degreeCode:
      segment.degreeCode,

    degreeTitle:
      segment.degreeTitle,

    title:
      `${pathwayLabel} - sample enrolment ${variantNumber}`,

    pathway,

    variantNumber,

    handbookYear:
      2026,

    sourceUrl:
      segment.sourceUrl,

    sourceType:
      'OFFICIAL_SAMPLE_ENROLMENT',

    isFormalRequirement:
      false,

    totalCreditPoints:
      segment.totalCreditPoints,

    years,
  };
}

export async function buildUsydStudyPlanNormalizedV1():
Promise<UsydStudyPlanNormalizedDataset> {
  const audit =
    await readRowAudit();

  const segments =
    segmentPlans(
      audit.rows,
    );

  const variantCounters =
    new Map<
      string,
      number
    >();

  const studyPlans =
    segments.map(
      (segment) => {
        const key =
          [
            segment.degreeCode,
            segment.sourceUrl,
          ].join('|');

        const nextVariant =
          (
            variantCounters.get(
              key,
            ) ??
            0
          ) +
          1;

        variantCounters.set(
          key,
          nextVariant,
        );

        return buildPlan(
          segment,
          nextVariant,
        );
      },
    );

  const planKeys =
    studyPlans.map(
      (plan) =>
        [
          plan.degreeCode,
          plan.sourceUrl,
          plan.variantNumber,
        ].join('|'),
    );

  const duplicatePlanKeys =
    planKeys.length -
    new Set(
      planKeys,
    ).size;

  const periodKeys:
    string[] =
    [];

  const itemKeys:
    string[] =
    [];

  let studyPlanYears =
    0;

  let studyPlanPeriods =
    0;

  let studyPlanItems =
    0;

  let subjectItems =
    0;

  let choiceItems =
    0;

  let periodsWithoutItems =
    0;

  let periodsWithoutCreditTotal =
    0;

  for (
    const plan
    of studyPlans
  ) {
    studyPlanYears +=
      plan.years.length;

    for (
      const year
      of plan.years
    ) {
      studyPlanPeriods +=
        year.periods.length;

      for (
        const period
        of year.periods
      ) {
        const periodKey =
          [
            plan.degreeCode,
            plan.sourceUrl,
            plan.variantNumber,
            year.yearNumber,
            period.periodNumber,
          ].join('|');

        periodKeys.push(
          periodKey,
        );

        if (
          period.items.length ===
          0
        ) {
          periodsWithoutItems +=
            1;
        }

        if (
          period.totalCreditPoints ===
          null
        ) {
          periodsWithoutCreditTotal +=
            1;
        }

        studyPlanItems +=
          period.items.length;

        for (
          const item
          of period.items
        ) {
          if (
            item.itemType ===
            'SUBJECT'
          ) {
            subjectItems +=
              1;
          } else {
            choiceItems +=
              1;
          }

          itemKeys.push(
            [
              periodKey,
              item.sortOrder,
            ].join('|'),
          );
        }
      }
    }
  }

  const duplicatePeriodKeys =
    periodKeys.length -
    new Set(
      periodKeys,
    ).size;

  const duplicateItemKeys =
    itemKeys.length -
    new Set(
      itemKeys,
    ).size;

  const sourcePages =
    new Set(
      studyPlans.map(
        (plan) =>
          [
            plan.degreeCode,
            plan.sourceUrl,
          ].join('|'),
      ),
    ).size;

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      sourcePages,

      studyPlans:
        studyPlans.length,

      studyPlanYears,

      studyPlanPeriods,

      studyPlanItems,

      subjectItems,

      choiceItems,

      plansWithTotalCreditPoints:
        studyPlans.filter(
          (plan) =>
            plan.totalCreditPoints !==
            null,
        ).length,

      periodsWithoutItems,

      periodsWithoutCreditTotal,

      duplicatePlanKeys,

      duplicatePeriodKeys,

      duplicateItemKeys,
    },

    studyPlans,

    coverage: {
      authoritativeRecommendationSources:
        'NORMALIZED',

      amendmentRows:
        'EXCLUDED',

      formalRequirementSeparation:
        'PRESERVED',

      recommendedStudyPlans:
        'COMPLETE_FOR_PROVEN_2026_SOURCES',
    },
  };
}

export async function writeUsydStudyPlanNormalizedV1():
Promise<void> {
  const result =
    await buildUsydStudyPlanNormalizedV1();

  if (
    result.counts
      .duplicatePlanKeys !==
      0 ||
    result.counts
      .duplicatePeriodKeys !==
      0 ||
    result.counts
      .duplicateItemKeys !==
      0 ||
    result.counts
      .periodsWithoutItems !==
      0 ||
    result.counts
      .periodsWithoutCreditTotal !==
      0
  ) {
    throw new Error(
      [
        'Refusing to write normalized study plans.',
        `duplicatePlans=${result.counts.duplicatePlanKeys}`,
        `duplicatePeriods=${result.counts.duplicatePeriodKeys}`,
        `duplicateItems=${result.counts.duplicateItemKeys}`,
        `emptyPeriods=${result.counts.periodsWithoutItems}`,
        `periodsWithoutCP=${result.counts.periodsWithoutCreditTotal}`,
      ].join(' '),
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-study-plans.normalized.v1.json',
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
    '[USYD study plan normalizer V1] PASS',
  );

  console.log(
    `Study plans: ${result.counts.studyPlans}`,
  );

  console.log(
    `Years: ${result.counts.studyPlanYears}`,
  );

  console.log(
    `Periods: ${result.counts.studyPlanPeriods}`,
  );

  console.log(
    `Items: ${result.counts.studyPlanItems}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
