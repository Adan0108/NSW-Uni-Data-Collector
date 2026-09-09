import fs from 'node:fs';
import path from 'node:path';

type JsonObject = Record<string, unknown>;

interface CuspSubject {
  code?: string | null;
  name?: string | null;
  sourceUrl?: string | null;
}

interface CuspItem {
  position?: number | null;
  requirementLabel?: string | null;
  requirementSourceId?: string | null;
  creditPoints?: number | null;
  subjects?: CuspSubject[];
  rawText?: string | null;
}

interface CuspPeriod {
  yearNumber?: number | null;
  periodName?: string | null;
  title?: string | null;
  notes?: unknown[];
  items?: CuspItem[];
}

interface CuspMetadata {
  dvid?: string | null;
  degreeId?: string | null;
  originalDegreeName?: string | null;
  normalizedDegreeName?: string | null;
  canonicalDegreeTitle?: string | null;
  family?: string | null;
  discipline?: string | null;
  major?: string | null;
  combinedPartner?: string | null;
  isMidYear?: boolean | null;
  sourceUrl?: string | null;
}

interface CuspPlan {
  source?: string | null;
  sourceUrl?: string | null;
  title?: string | null;
  variantTitle?: string | null;
  underReview?: boolean | null;
  commencementYear?: number | null;

  cuspDegreeVersionId?: string | null;
  cuspDegreeId?: string | null;
  cuspDegreeName?: string | null;
  cuspStreamId?: string | null;

  periods?: CuspPeriod[];
  cusp?: CuspMetadata;

  [key: string]: unknown;
}

interface Degree {
  code: string;
  title: string;
  studyPlans?: CuspPlan[];
  [key: string]: unknown;
}

interface Subject {
  code: string;
  name?: string;
  [key: string]: unknown;
}

interface DatabasePlanItem {
  itemType: 'SUBJECT' | 'CHOICE';

  subjectCode: string | null;
  choiceText: string | null;
  rawText: string | null;

  creditPoints: number | null;
  sourceUrl: string | null;

  sortOrder: number;

  rawData: JsonObject;
}

interface DatabasePeriod {
  name: string;

  periodType: string | null;
  periodNumber: number | null;

  totalCreditPoints: number | null;

  items: DatabasePlanItem[];
}

interface DatabaseYear {
  label: string;

  yearNumber: number | null;

  periods: DatabasePeriod[];
}

interface DatabaseStudyPlan {
  degreeCode: string;

  sourcePlanId: string;

  title: string;

  sourceUrl: string | null;

  pathway: string | null;

  variantNumber: number | null;

  handbookYear: number;

  totalCreditPoints: number | null;

  sourceType: string;

  isFormalRequirement: boolean;

  years: DatabaseYear[];

  rawData: JsonObject;
}

interface Master {
  university: {
    code: string;
    name: string;
  };

  handbookYear: number;

  metadata: JsonObject & {
    counts?: Record<string, number>;
  };

  degrees: Degree[];

  subjects: Subject[];

  studyPlans: DatabaseStudyPlan[];

  [key: string]: unknown;
}

const ROOT = process.cwd();

const INPUT_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-master-final.with-cusp.subjects-resolved.json',
);

const OUTPUT_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-master-final.database-ready.json',
);

const REPORT_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-database-master-report.json',
);

function readJson<T>(filePath: string): T {
  return JSON.parse(
    fs.readFileSync(filePath, 'utf8'),
  ) as T;
}

function writeJson(
  filePath: string,
  value: unknown,
): void {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });

  fs.writeFileSync(
    filePath,
    JSON.stringify(value, null, 2),
    'utf8',
  );
}

function normalizeCode(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase();
}

function cleanText(
  value:
    | string
    | null
    | undefined,
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null;
  }

  const cleaned = value
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || null;
}

function periodTypeFromName(
  name: string,
): string | null {
  const normalized =
    name.toLowerCase();

  if (
    normalized.includes(
      'semester',
    )
  ) {
    return 'SEMESTER';
  }

  if (
    normalized.includes(
      'term',
    )
  ) {
    return 'TERM';
  }

  if (
    normalized.includes(
      'session',
    )
  ) {
    return 'SESSION';
  }

  return null;
}

function periodNumberFromName(
  name: string,
): number | null {
  const match =
    name.match(
      /(?:semester|term|session)\s*(\d+)/i,
    );

  if (!match) {
    return null;
  }

  const value =
    Number(match[1]);

  return Number.isInteger(
    value,
  )
    ? value
    : null;
}

function looksLikeChoice(
  item: CuspItem,
): boolean {
  return (
    (item.subjects?.length ?? 0) ===
    0
  );
}

function convertSubjectItem(
  item: CuspItem,
  subject: CuspSubject,
  itemIndex: number,
): DatabasePlanItem {
  const code =
    typeof subject.code ===
    'string'
      ? normalizeCode(
          subject.code,
        )
      : null;

  return {
    itemType: 'SUBJECT',

    subjectCode: code,

    choiceText: null,

    rawText:
      cleanText(
        item.rawText,
      ),

    /*
     * Study-plan allocation CP only.
     *
     * This must NOT be copied to
     * Subject.creditPoints.
     */
    creditPoints:
      typeof item.creditPoints ===
      'number'
        ? item.creditPoints
        : null,

    sourceUrl:
      cleanText(
        subject.sourceUrl,
      ),

    sortOrder:
      typeof item.position ===
      'number'
        ? item.position
        : itemIndex,

    rawData: {
      ...item,

      cuspSubject: {
        ...subject,
      },
    },
  };
}

function convertChoiceItem(
  item: CuspItem,
  itemIndex: number,
): DatabasePlanItem {
  const label =
    cleanText(
      item.requirementLabel,
    );

  const rawText =
    cleanText(
      item.rawText,
    );

  return {
    itemType: 'CHOICE',

    subjectCode: null,

    choiceText:
      label ??
      rawText ??
      'Choice',

    rawText,

    creditPoints:
      typeof item.creditPoints ===
      'number'
        ? item.creditPoints
        : null,

    sourceUrl: null,

    sortOrder:
      typeof item.position ===
      'number'
        ? item.position
        : itemIndex,

    rawData: {
      ...item,
    },
  };
}

function convertItems(
  items: CuspItem[],
): DatabasePlanItem[] {
  const result:
    DatabasePlanItem[] = [];

  for (
    const [itemIndex, item]
    of items.entries()
  ) {
    const subjects =
      item.subjects ?? [];

    if (
      looksLikeChoice(item)
    ) {
      result.push(
        convertChoiceItem(
          item,
          itemIndex,
        ),
      );

      continue;
    }

    /*
     * CUSP can theoretically attach
     * more than one subject to a single
     * requirement row.
     *
     * DB schema stores one StudyPlanItem
     * -> one Subject, so expand it.
     */
    for (
      const subject of subjects
    ) {
      result.push(
        convertSubjectItem(
          item,
          subject,
          itemIndex,
        ),
      );
    }
  }

  return result;
}

function convertPeriodsToYears(
  periods: CuspPeriod[],
): DatabaseYear[] {
  const byYear =
    new Map<
      number,
      CuspPeriod[]
    >();

  /*
   * CUSP yearNumber = 0 contains
   * planning/guidance content.
   *
   * It is preserved inside rawData,
   * but is not an academic DB year.
   */
  for (
    const period of periods
  ) {
    if (
      typeof period.yearNumber !==
        'number' ||
      period.yearNumber < 1
    ) {
      continue;
    }

    const group =
      byYear.get(
        period.yearNumber,
      ) ?? [];

    group.push(period);

    byYear.set(
      period.yearNumber,
      group,
    );
  }

  return [
    ...byYear.entries(),
  ]
    .sort(
      ([a], [b]) =>
        a - b,
    )
    .map(
      (
        [
          yearNumber,
          yearPeriods,
        ],
      ) => ({
        label:
          `Year ${yearNumber}`,

        yearNumber,

        periods:
          yearPeriods.map(
            (
              period,
            ) => {
              const name =
                cleanText(
                  period.periodName,
                ) ??
                cleanText(
                  period.title,
                ) ??
                'Study Period';

              const items =
                convertItems(
                  period.items ??
                    [],
                );

              const totalCreditPoints =
                items.reduce(
                  (
                    total,
                    item,
                  ) =>
                    total +
                    (
                      typeof item.creditPoints ===
                      'number'
                        ? item.creditPoints
                        : 0
                    ),
                  0,
                );

              return {
                name,

                periodType:
                  periodTypeFromName(
                    name,
                  ),

                periodNumber:
                  periodNumberFromName(
                    name,
                  ),

                totalCreditPoints,

                items,
              };
            },
          ),
      }),
    );
}

function getPathway(
  plan: CuspPlan,
): string | null {
  return (
    cleanText(
      plan.cusp
        ?.discipline,
    ) ??
    cleanText(
      plan.cusp?.major,
    ) ??
    cleanText(
      plan.cusp
        ?.originalDegreeName,
    ) ??
    cleanText(
      plan.cuspDegreeName,
    )
  );
}

function getPlanTitle(
  plan: CuspPlan,
): string {
  return (
    cleanText(
      plan.variantTitle,
    ) ??
    cleanText(
      plan.cusp
        ?.originalDegreeName,
    ) ??
    cleanText(
      plan.title,
    ) ??
    'CUSP Study Plan'
  );
}

function createCuspSourcePlanId(
  degreeCode: string,
  plan: CuspPlan,
): string {
  const stableParts = [
    degreeCode,

    cleanText(
      plan.cusp?.dvid,
    ) ??
      cleanText(
        plan.cuspDegreeVersionId,
      ) ??
      cleanText(
        plan.cuspDegreeId,
      ) ??
      'NO_DVID',

    cleanText(
      plan.cuspStreamId,
    ) ??
      'BASE',

    cleanText(
      plan.variantTitle,
    ) ??
      cleanText(
        plan.cusp
          ?.originalDegreeName,
      ) ??
      'PLAN',
  ];

  return stableParts
    .join(':')
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function convertCuspPlan(
  degree: Degree,
  plan: CuspPlan,
): DatabaseStudyPlan {
  const sourcePlanId =
    createCuspSourcePlanId(
      degree.code,
      plan,
    );

  const years =
    convertPeriodsToYears(
      plan.periods ?? [],
    );

  return {
    degreeCode:
      degree.code,

    /*
     * Stable identity preserved for
     * database import.
     */
    sourcePlanId,

    title:
      getPlanTitle(plan),

    sourceUrl:
      cleanText(
        plan.sourceUrl,
      ) ??
      cleanText(
        plan.cusp
          ?.sourceUrl,
      ),

    pathway:
      getPathway(plan),

    /*
     * Old handbook plans use numeric
     * variants.
     *
     * CUSP variants use their own stable
     * identity instead.
     */
    variantNumber: null,

    handbookYear: 2026,

    totalCreditPoints: null,

    sourceType: 'CUSP',

    /*
     * CUSP is a recommended study plan,
     * not the formal requirement tree.
     */
    isFormalRequirement:
      false,

    years,

    rawData: {
      sourcePlanId,

      provider:
        'CUSP',

      underReview:
        Boolean(
          plan.underReview,
        ),

      cusp:
        plan.cusp ?? null,

      originalPlan: {
        ...plan,
      },
    },
  };
}

function validateSubjects(
  subjects: Subject[],
): void {
  const seen =
    new Set<string>();

  for (
    const subject of subjects
  ) {
    const code =
      normalizeCode(
        subject.code,
      );

    if (
      !subject.name ||
      !subject.name.trim()
    ) {
      throw new Error(
        `Subject ${code} has no name`,
      );
    }

    if (
      seen.has(code)
    ) {
      throw new Error(
        `Duplicate subject code: ${code}`,
      );
    }

    seen.add(code);
  }
}

function main(): void {
  const master =
    readJson<Master>(
      INPUT_PATH,
    );

  if (
    master.university?.code !==
      'USYD' ||
    master.handbookYear !==
      2026
  ) {
    throw new Error(
      'Expected USYD 2026 master',
    );
  }

  validateSubjects(
    master.subjects,
  );

  const existingPlans =
    Array.isArray(
      master.studyPlans,
    )
      ? master.studyPlans
      : [];

  const cuspPlans:
    DatabaseStudyPlan[] = [];

  let degreesWithCuspPlans =
    0;

  for (
    const degree of
    master.degrees
  ) {
    const plans =
      (
        degree.studyPlans ??
        []
      ).filter(
        (plan) =>
          plan.source ===
          'CUSP',
      );

    if (
      plans.length > 0
    ) {
      degreesWithCuspPlans +=
        1;
    }

    for (
      const plan of plans
    ) {
      cuspPlans.push(
        convertCuspPlan(
          degree,
          plan,
        ),
      );
    }
  }

  if (
    cuspPlans.length !==
    525
  ) {
    throw new Error(
      `Expected 525 CUSP plans, found ${cuspPlans.length}`,
    );
  }

  /*
   * Keep the 6 existing handbook plans
   * and append the 525 CUSP plans.
   */
  const databasePlans = [
    ...existingPlans,
    ...cuspPlans,
  ];

  const output =
    JSON.parse(
      JSON.stringify(master),
    ) as Master;

  output.studyPlans =
    databasePlans;

  /*
   * degree.studyPlans is only an
   * intermediate CUSP merge structure.
   *
   * The canonical DB importer expects
   * plans at master.studyPlans.
   */
  output.degrees =
    output.degrees.map(
      (degree) => {
        const {
          studyPlans:
            _studyPlans,
          ...rest
        } = degree;

        return rest as Degree;
      },
    );

  const metadataCounts =
    output.metadata.counts ??
    {};

  /*
   * IMPORTANT:
   *
   * Importer validates metadata counts
   * against the actual arrays.
   *
   * We added:
   * - 63 subjects
   * - 525 CUSP plans
   */
  output.metadata.counts = {
    ...metadataCounts,

    subjects:
      output.subjects.length,

    studyPlans:
      databasePlans.length,
  };

  const report = {
    generatedAt:
      new Date()
        .toISOString(),

    existingHandbookPlans:
      existingPlans.length,

    cuspPlans:
      cuspPlans.length,

    finalStudyPlans:
      databasePlans.length,

    degreesWithCuspPlans,

    subjects:
      output.subjects.length,

    cuspPlansWithSourcePlanId:
      cuspPlans.filter(
        (plan) =>
          Boolean(
            plan.sourcePlanId,
          ),
      ).length,

    cuspPlansByFamily:
      cuspPlans.reduce<
        Record<string, number>
      >(
        (
          result,
          plan,
        ) => {
          const originalPlan =
            plan.rawData
              .originalPlan;

          let family =
            'UNKNOWN';

          if (
            typeof originalPlan ===
              'object' &&
            originalPlan !==
              null
          ) {
            const original =
              originalPlan as
                JsonObject;

            const cusp =
              original.cusp;

            if (
              typeof cusp ===
                'object' &&
              cusp !== null
            ) {
              const value =
                (
                  cusp as
                    JsonObject
                ).family;

              if (
                typeof value ===
                  'string'
              ) {
                family =
                  value;
              }
            }
          }

          result[family] =
            (
              result[
                family
              ] ?? 0
            ) + 1;

          return result;
        },
        {},
      ),
  };

  writeJson(
    OUTPUT_PATH,
    output,
  );

  writeJson(
    REPORT_PATH,
    report,
  );

  console.log(
    '================================',
  );

  console.log(
    'USYD DATABASE MASTER PREP',
  );

  console.log(
    '================================',
  );

  console.log(
    `Existing handbook plans: ${existingPlans.length}`,
  );

  console.log(
    `CUSP plans added: ${cuspPlans.length}`,
  );

  console.log(
    `Final study plans: ${databasePlans.length}`,
  );

  console.log(
    `Degrees with CUSP plans: ${degreesWithCuspPlans}`,
  );

  console.log(
    `Subjects: ${output.subjects.length}`,
  );

  console.log(
    `CUSP plans with sourcePlanId: ${report.cuspPlansWithSourcePlanId}`,
  );

  console.log(
    `Saved DB master to ${OUTPUT_PATH}`,
  );

  console.log(
    `Saved report to ${REPORT_PATH}`,
  );
}

main();