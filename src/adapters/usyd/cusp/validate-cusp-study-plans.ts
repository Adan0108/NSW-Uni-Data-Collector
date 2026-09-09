import fs from 'node:fs';
import path from 'node:path';

interface CuspSubjectRef {
  code?: string | null;
  name?: string | null;
  sourceUrl?: string | null;
}

interface CuspPlanItem {
  position?: number | null;
  requirementLabel?: string | null;
  requirementSourceId?: string | null;
  creditPoints?: number | null;
  subjects?: CuspSubjectRef[];
  rawText?: string | null;
}

interface CuspPlanPeriod {
  yearNumber?: number | null;
  periodName?: string | null;
  title?: string | null;
  notes?: string[];
  items?: CuspPlanItem[];
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

interface StudyPlan {
  source?: string | null;
  sourceUrl?: string | null;

  cuspDegreeVersionId?: string | null;
  cuspDegreeId?: string | null;
  cuspDegreeName?: string | null;
  cuspStreamId?: string | null;

  commencementYear?: number | null;

  title?: string | null;
  variantTitle?: string | null;

  underReview?: boolean | null;

  periods?: CuspPlanPeriod[];

  cusp?: CuspMetadata;
}

interface Degree {
  code: string;
  title: string;
  studyPlans?: StudyPlan[];
  [key: string]: unknown;
}

interface Subject {
  code: string;
  [key: string]: unknown;
}

interface UsydMaster {
  degrees: Degree[];
  subjects?: Subject[];
  [key: string]: unknown;
}

interface ValidationIssue {
  severity: 'ERROR' | 'WARNING';

  type:
    | 'NO_PERIODS'
    | 'NO_ACADEMIC_YEAR'
    | 'NO_YEAR_1'
    | 'NO_FINAL_YEAR'
    | 'EMPTY_ACADEMIC_PERIOD'
    | 'FIXED_ITEM_WITHOUT_SUBJECT'
    | 'SUBJECT_NOT_IN_MASTER'
    | 'DUPLICATE_SUBJECT_IN_PERIOD'
    | 'INVALID_YEAR'
    | 'INVALID_SUBJECT_CODE'
    | 'DUPLICATE_PLAN_IDENTITY'
    | 'MISSING_CUSP_METADATA'
    | 'MISSING_DISCIPLINE'
    | 'MISSING_VARIANT_TITLE';

  degreeCode: string;
  degreeTitle: string;

  planTitle: string | null;
  variantTitle: string | null;

  cuspDegreeName: string | null;
  discipline: string | null;

  periodTitle?: string | null;
  subjectCode?: string | null;

  message: string;
}

interface PlanSummary {
  degreeCode: string;
  degreeTitle: string;

  planTitle: string | null;
  variantTitle: string | null;

  cuspDegreeName: string | null;
  discipline: string | null;
  major: string | null;
  combinedPartner: string | null;

  isMidYear: boolean;
  underReview: boolean;

  periodCount: number;
  academicPeriodCount: number;
  academicYears: number[];

  subjectReferenceCount: number;
  electiveOrChoiceSlotCount: number;
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

const REPORT_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-cusp-study-plan-validation-report.json',
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
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    filePath,
    JSON.stringify(value, null, 2),
    'utf8',
  );
}

function normalizeCode(
  value: string,
): string {
  return value.trim().toUpperCase();
}

function normalizeText(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isCuspPlan(
  plan: StudyPlan,
): boolean {
  return plan.source === 'CUSP';
}

function isAcademicPeriod(
  period: CuspPlanPeriod,
): boolean {
  return (
    typeof period.yearNumber === 'number' &&
    period.yearNumber >= 1
  );
}

function getStructuredSubjectCodes(
  plan: StudyPlan,
): string[] {
  const codes: string[] = [];

  for (const period of plan.periods ?? []) {
    for (const item of period.items ?? []) {
      for (const subject of item.subjects ?? []) {
        if (
          typeof subject.code === 'string' &&
          subject.code.trim()
        ) {
          codes.push(
            normalizeCode(subject.code),
          );
        }
      }
    }
  }

  return codes;
}

function looksLikeChoiceSlot(
  item: CuspPlanItem,
): boolean {
  const text = normalizeText(
    [
      item.requirementLabel,
      item.rawText,
    ]
      .filter(Boolean)
      .join(' '),
  );

  return (
    text.includes('elective') ||
    text.includes('select from') ||
    text.includes('options') ||
    text.includes('choice') ||
    text.includes('arts units') ||
    text.includes('science units') ||
    text.includes('commerce units') ||
    text.includes('free electives')
  );
}

function looksLikeFixedSubjectItem(
  item: CuspPlanItem,
): boolean {
  if (
    (item.subjects?.length ?? 0) > 0
  ) {
    return false;
  }

  if (looksLikeChoiceSlot(item)) {
    return false;
  }

  const raw =
    item.rawText?.trim() ?? '';

  /*
   * If rawText directly begins with a unit code but subjects[]
   * is empty, parsing probably failed.
   */
  return /^[A-Z]{4}\d{4}\b/.test(
    raw,
  );
}

function createPlanIdentity(
  degree: Degree,
  plan: StudyPlan,
): string {
  return [
    degree.code,
    plan.cuspDegreeVersionId ?? '',
    plan.cuspStreamId ?? '',
    plan.sourceUrl ?? '',
    plan.variantTitle ?? '',
  ]
    .map(normalizeText)
    .join('|');
}

function main(): void {
  const master =
    readJson<UsydMaster>(
      INPUT_PATH,
    );

  if (
    !Array.isArray(master.degrees)
  ) {
    throw new Error(
      'Input master does not contain degrees[]',
    );
  }

  const subjectCodes =
    new Set(
      (master.subjects ?? [])
        .filter(
          (subject) =>
            typeof subject.code ===
            'string',
        )
        .map((subject) =>
          normalizeCode(subject.code),
        ),
    );

  const issues:
    ValidationIssue[] = [];

  const summaries:
    PlanSummary[] = [];

  const planIdentityCounts =
    new Map<string, number>();

  let totalCuspPlans = 0;
  let engineeringPlans = 0;
  let advancedComputingPlans = 0;
  let projectManagementPlans = 0;

  let midYearPlans = 0;
  let underReviewPlans = 0;

  for (const degree of master.degrees) {
    for (
      const plan of
      degree.studyPlans ?? []
    ) {
      if (!isCuspPlan(plan)) {
        continue;
      }

      totalCuspPlans += 1;

      const family =
        plan.cusp?.family ?? null;

      if (
        family === 'ENGINEERING'
      ) {
        engineeringPlans += 1;
      }

      if (
        family ===
        'ADVANCED_COMPUTING'
      ) {
        advancedComputingPlans += 1;
      }

      if (
        family ===
        'PROJECT_MANAGEMENT'
      ) {
        projectManagementPlans += 1;
      }

      if (plan.cusp?.isMidYear) {
        midYearPlans += 1;
      }

      if (plan.underReview) {
        underReviewPlans += 1;
      }

      const periods =
        plan.periods ?? [];

      const academicPeriods =
        periods.filter(
          isAcademicPeriod,
        );

      const academicYears =
        [
          ...new Set(
            academicPeriods
              .map(
                (period) =>
                  period.yearNumber,
              )
              .filter(
                (
                  year,
                ): year is number =>
                  typeof year ===
                  'number',
              ),
          ),
        ].sort((a, b) => a - b);

      const subjectReferences =
        getStructuredSubjectCodes(
          plan,
        );

      let electiveOrChoiceSlotCount =
        0;

      for (const period of periods) {
        for (
          const item of
          period.items ?? []
        ) {
          if (
            looksLikeChoiceSlot(
              item,
            )
          ) {
            electiveOrChoiceSlotCount +=
              1;
          }
        }
      }

      summaries.push({
        degreeCode:
          degree.code,

        degreeTitle:
          degree.title,

        planTitle:
          plan.title ?? null,

        variantTitle:
          plan.variantTitle ??
          null,

        cuspDegreeName:
          plan.cusp
            ?.originalDegreeName ??
          plan.cuspDegreeName ??
          null,

        discipline:
          plan.cusp?.discipline ??
          null,

        major:
          plan.cusp?.major ??
          null,

        combinedPartner:
          plan.cusp
            ?.combinedPartner ??
          null,

        isMidYear:
          Boolean(
            plan.cusp?.isMidYear,
          ),

        underReview:
          Boolean(
            plan.underReview,
          ),

        periodCount:
          periods.length,

        academicPeriodCount:
          academicPeriods.length,

        academicYears,

        subjectReferenceCount:
          subjectReferences.length,

        electiveOrChoiceSlotCount,
      });

      if (!plan.cusp) {
        issues.push({
          severity: 'ERROR',
          type:
            'MISSING_CUSP_METADATA',

          degreeCode:
            degree.code,

          degreeTitle:
            degree.title,

          planTitle:
            plan.title ?? null,

          variantTitle:
            plan.variantTitle ??
            null,

          cuspDegreeName:
            plan.cuspDegreeName ??
            null,

          discipline: null,

          message:
            'CUSP plan does not contain canonical cusp metadata.',
        });
      }

      if (
        family === 'ENGINEERING' &&
        !plan.cusp?.discipline
      ) {
        issues.push({
          severity: 'WARNING',
          type:
            'MISSING_DISCIPLINE',

          degreeCode:
            degree.code,

          degreeTitle:
            degree.title,

          planTitle:
            plan.title ?? null,

          variantTitle:
            plan.variantTitle ??
            null,

          cuspDegreeName:
            plan.cusp
              ?.originalDegreeName ??
            plan.cuspDegreeName ??
            null,

          discipline:
            plan.cusp?.discipline ??
            null,

          message:
            'Engineering plan has no discipline metadata.',
        });
      }

      if (!plan.variantTitle) {
        issues.push({
          severity: 'WARNING',
          type:
            'MISSING_VARIANT_TITLE',

          degreeCode:
            degree.code,

          degreeTitle:
            degree.title,

          planTitle:
            plan.title ?? null,

          variantTitle: null,

          cuspDegreeName:
            plan.cusp
              ?.originalDegreeName ??
            plan.cuspDegreeName ??
            null,

          discipline:
            plan.cusp?.discipline ??
            null,

          message:
            'CUSP plan has no variantTitle.',
        });
      }

      if (periods.length === 0) {
        issues.push({
          severity: 'ERROR',
          type: 'NO_PERIODS',

          degreeCode:
            degree.code,

          degreeTitle:
            degree.title,

          planTitle:
            plan.title ?? null,

          variantTitle:
            plan.variantTitle ??
            null,

          cuspDegreeName:
            plan.cusp
              ?.originalDegreeName ??
            plan.cuspDegreeName ??
            null,

          discipline:
            plan.cusp?.discipline ??
            null,

          message:
            'Study plan contains no periods.',
        });
      }

      if (
        academicPeriods.length === 0
      ) {
        issues.push({
          severity: 'ERROR',
          type:
            'NO_ACADEMIC_YEAR',

          degreeCode:
            degree.code,

          degreeTitle:
            degree.title,

          planTitle:
            plan.title ?? null,

          variantTitle:
            plan.variantTitle ??
            null,

          cuspDegreeName:
            plan.cusp
              ?.originalDegreeName ??
            plan.cuspDegreeName ??
            null,

          discipline:
            plan.cusp?.discipline ??
            null,

          message:
            'Study plan contains no Year 1+ academic periods.',
        });
      }

      if (
        academicYears.length > 0 &&
        !academicYears.includes(1)
      ) {
        issues.push({
          severity: 'WARNING',
          type: 'NO_YEAR_1',

          degreeCode:
            degree.code,

          degreeTitle:
            degree.title,

          planTitle:
            plan.title ?? null,

          variantTitle:
            plan.variantTitle ??
            null,

          cuspDegreeName:
            plan.cusp
              ?.originalDegreeName ??
            plan.cuspDegreeName ??
            null,

          discipline:
            plan.cusp?.discipline ??
            null,

          message:
            `Plan starts at Year ${academicYears[0]} instead of Year 1.`,
        });
      }

      /*
       * Don't hardcode Engineering as exactly four years because
       * combined degrees can legitimately run longer.
       *
       * But a normal engineering plan finishing before Year 4 is
       * suspicious.
       */
      if (
        family === 'ENGINEERING' &&
        !plan.cusp
          ?.combinedPartner &&
        academicYears.length > 0 &&
        Math.max(
          ...academicYears,
        ) < 4
      ) {
        issues.push({
          severity: 'WARNING',
          type: 'NO_FINAL_YEAR',

          degreeCode:
            degree.code,

          degreeTitle:
            degree.title,

          planTitle:
            plan.title ?? null,

          variantTitle:
            plan.variantTitle ??
            null,

          cuspDegreeName:
            plan.cusp
              ?.originalDegreeName ??
            plan.cuspDegreeName ??
            null,

          discipline:
            plan.cusp?.discipline ??
            null,

          message:
            `Base Engineering plan ends at Year ${Math.max(
              ...academicYears,
            )}.`,
        });
      }

      for (const period of periods) {
        if (
          typeof period.yearNumber ===
            'number' &&
          period.yearNumber < 0
        ) {
          issues.push({
            severity: 'ERROR',
            type: 'INVALID_YEAR',

            degreeCode:
              degree.code,

            degreeTitle:
              degree.title,

            planTitle:
              plan.title ?? null,

            variantTitle:
              plan.variantTitle ??
              null,

            cuspDegreeName:
              plan.cusp
                ?.originalDegreeName ??
              plan.cuspDegreeName ??
              null,

            discipline:
              plan.cusp
                ?.discipline ??
              null,

            periodTitle:
              period.title ??
              period.periodName ??
              null,

            message:
              `Invalid yearNumber ${period.yearNumber}.`,
          });
        }

        if (
          isAcademicPeriod(
            period,
          ) &&
          (
            period.items?.length ??
            0
          ) === 0
        ) {
          issues.push({
            severity: 'WARNING',
            type:
              'EMPTY_ACADEMIC_PERIOD',

            degreeCode:
              degree.code,

            degreeTitle:
              degree.title,

            planTitle:
              plan.title ?? null,

            variantTitle:
              plan.variantTitle ??
              null,

            cuspDegreeName:
              plan.cusp
                ?.originalDegreeName ??
              plan.cuspDegreeName ??
              null,

            discipline:
              plan.cusp
                ?.discipline ??
              null,

            periodTitle:
              period.title ??
              period.periodName ??
              null,

            message:
              'Academic period contains no study-plan items.',
          });
        }

        const codesInPeriod =
          new Set<string>();

        for (
          const item of
          period.items ?? []
        ) {
          if (
            looksLikeFixedSubjectItem(
              item,
            )
          ) {
            issues.push({
              severity: 'ERROR',
              type:
                'FIXED_ITEM_WITHOUT_SUBJECT',

              degreeCode:
                degree.code,

              degreeTitle:
                degree.title,

              planTitle:
                plan.title ?? null,

              variantTitle:
                plan.variantTitle ??
                null,

              cuspDegreeName:
                plan.cusp
                  ?.originalDegreeName ??
                plan.cuspDegreeName ??
                null,

              discipline:
                plan.cusp
                  ?.discipline ??
                null,

              periodTitle:
                period.title ??
                period.periodName ??
                null,

              message:
                `Item looks like a fixed subject but subjects[] is empty: ${item.rawText ?? ''}`,
            });
          }

          for (
            const subject of
            item.subjects ?? []
          ) {
            if (
              typeof subject.code !==
                'string' ||
              !subject.code.trim()
            ) {
              issues.push({
                severity: 'ERROR',
                type:
                  'INVALID_SUBJECT_CODE',

                degreeCode:
                  degree.code,

                degreeTitle:
                  degree.title,

                planTitle:
                  plan.title ??
                  null,

                variantTitle:
                  plan.variantTitle ??
                  null,

                cuspDegreeName:
                  plan.cusp
                    ?.originalDegreeName ??
                  plan.cuspDegreeName ??
                  null,

                discipline:
                  plan.cusp
                    ?.discipline ??
                  null,

                periodTitle:
                  period.title ??
                  period.periodName ??
                  null,

                subjectCode:
                  subject.code ??
                  null,

                message:
                  'Structured subject reference has no valid code.',
              });

              continue;
            }

            const code =
              normalizeCode(
                subject.code,
              );

            if (
              !/^[A-Z]{4}\d{4}$/.test(
                code,
              )
            ) {
              issues.push({
                severity: 'ERROR',
                type:
                  'INVALID_SUBJECT_CODE',

                degreeCode:
                  degree.code,

                degreeTitle:
                  degree.title,

                planTitle:
                  plan.title ??
                  null,

                variantTitle:
                  plan.variantTitle ??
                  null,

                cuspDegreeName:
                  plan.cusp
                    ?.originalDegreeName ??
                  plan.cuspDegreeName ??
                  null,

                discipline:
                  plan.cusp
                    ?.discipline ??
                  null,

                periodTitle:
                  period.title ??
                  period.periodName ??
                  null,

                subjectCode:
                  code,

                message:
                  `Invalid subject code format: ${code}`,
              });
            }

            if (
              !subjectCodes.has(
                code,
              )
            ) {
              issues.push({
                severity: 'ERROR',
                type:
                  'SUBJECT_NOT_IN_MASTER',

                degreeCode:
                  degree.code,

                degreeTitle:
                  degree.title,

                planTitle:
                  plan.title ??
                  null,

                variantTitle:
                  plan.variantTitle ??
                  null,

                cuspDegreeName:
                  plan.cusp
                    ?.originalDegreeName ??
                  plan.cuspDegreeName ??
                  null,

                discipline:
                  plan.cusp
                    ?.discipline ??
                  null,

                periodTitle:
                  period.title ??
                  period.periodName ??
                  null,

                subjectCode:
                  code,

                message:
                  `${code} is referenced by the study plan but is not present in master.subjects.`,
              });
            }

            if (
              codesInPeriod.has(code)
            ) {
              issues.push({
                severity: 'WARNING',
                type:
                  'DUPLICATE_SUBJECT_IN_PERIOD',

                degreeCode:
                  degree.code,

                degreeTitle:
                  degree.title,

                planTitle:
                  plan.title ??
                  null,

                variantTitle:
                  plan.variantTitle ??
                  null,

                cuspDegreeName:
                  plan.cusp
                    ?.originalDegreeName ??
                  plan.cuspDegreeName ??
                  null,

                discipline:
                  plan.cusp
                    ?.discipline ??
                  null,

                periodTitle:
                  period.title ??
                  period.periodName ??
                  null,

                subjectCode:
                  code,

                message:
                  `${code} appears multiple times in the same academic period.`,
              });
            }

            codesInPeriod.add(
              code,
            );
          }
        }
      }

      const identity =
        createPlanIdentity(
          degree,
          plan,
        );

      planIdentityCounts.set(
        identity,
        (
          planIdentityCounts.get(
            identity,
          ) ?? 0
        ) + 1,
      );
    }
  }

  /*
   * Duplicate identity validation runs after all plans have been
   * inspected.
   */
  for (
    const [
      identity,
      count,
    ] of planIdentityCounts
  ) {
    if (count <= 1) {
      continue;
    }

    const matchingSummary =
      summaries.find(
        (summary) => {
          const degree = {
            code:
              summary.degreeCode,
          };

          return identity.startsWith(
            normalizeText(
              degree.code,
            ),
          );
        },
      );

    issues.push({
      severity: 'WARNING',
      type:
        'DUPLICATE_PLAN_IDENTITY',

      degreeCode:
        matchingSummary
          ?.degreeCode ?? 'UNKNOWN',

      degreeTitle:
        matchingSummary
          ?.degreeTitle ?? 'UNKNOWN',

      planTitle:
        matchingSummary
          ?.planTitle ?? null,

      variantTitle:
        matchingSummary
          ?.variantTitle ?? null,

      cuspDegreeName:
        matchingSummary
          ?.cuspDegreeName ?? null,

      discipline:
        matchingSummary
          ?.discipline ?? null,

      message:
        `Plan identity occurs ${count} times: ${identity}`,
    });
  }

  const errors =
    issues.filter(
      (issue) =>
        issue.severity ===
        'ERROR',
    );

  const warnings =
    issues.filter(
      (issue) =>
        issue.severity ===
        'WARNING',
    );

  const issueCountsByType =
    issues.reduce<
      Record<string, number>
    >(
      (result, issue) => {
        result[issue.type] =
          (
            result[
              issue.type
            ] ?? 0
          ) + 1;

        return result;
      },
      {},
    );

  const report = {
    generatedAt:
      new Date().toISOString(),

    sourceFile:
      INPUT_PATH,

    totals: {
      cuspPlans:
        totalCuspPlans,

      engineeringPlans,

      advancedComputingPlans,

      projectManagementPlans,

      midYearPlans,

      underReviewPlans,

      errors:
        errors.length,

      warnings:
        warnings.length,
    },

    issueCountsByType,

    errors,

    warnings,

    plans:
      summaries,
  };

  writeJson(
    REPORT_PATH,
    report,
  );

  console.log(
    `Total CUSP plans: ${totalCuspPlans}`,
  );

  console.log(
    `Engineering plans: ${engineeringPlans}`,
  );

  console.log(
    `Advanced Computing plans: ${advancedComputingPlans}`,
  );

  console.log(
    `Project Management plans: ${projectManagementPlans}`,
  );

  console.log(
    `Mid-year plans: ${midYearPlans}`,
  );

  console.log(
    `Under-review plans: ${underReviewPlans}`,
  );

  console.log(
    `Validation errors: ${errors.length}`,
  );

  console.log(
    `Validation warnings: ${warnings.length}`,
  );

  console.log(
    'Issue counts:',
    issueCountsByType,
  );

  console.log(
    `Saved validation report to ${REPORT_PATH}`,
  );
}

main();