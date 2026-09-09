import fs from 'node:fs';
import path from 'node:path';

interface Subject {
  code?: string;
  name?: string;
}

interface Degree {
  code?: string;
  title?: string;
}

interface StudyPlanItem {
  itemType?: string;

  subjectCode?: string | null;

  choiceText?: string | null;

  rawText?: string | null;
}

interface StudyPlanPeriod {
  name?: string;

  items?: StudyPlanItem[];
}

interface StudyPlanYear {
  label?: string;

  yearNumber?: number | null;

  periods?: StudyPlanPeriod[];
}

interface StudyPlan {
  degreeCode?: string;

  sourcePlanId?: string | null;

  title?: string;

  sourceType?: string | null;

  pathway?: string | null;

  years?: StudyPlanYear[];
}

interface Master {
  university?: {
    code?: string;
  };

  handbookYear?: number;

  metadata?: {
    counts?: Record<string, number>;
  };

  degrees?: Degree[];

  subjects?: Subject[];

  studyPlans?: StudyPlan[];
}

interface ValidationIssue {
  severity: 'ERROR' | 'WARNING';

  type: string;

  message: string;

  planIndex?: number;

  degreeCode?: string;

  sourcePlanId?: string;

  subjectCode?: string;
}

const ROOT = process.cwd();

const INPUT_PATH = path.join(
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
  'usyd-database-master-validation-report.json',
);

function readJson<T>(
  filePath: string,
): T {
  return JSON.parse(
    fs.readFileSync(
      filePath,
      'utf8',
    ),
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
    JSON.stringify(
      value,
      null,
      2,
    ),
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

function main(): void {
  const master =
    readJson<Master>(
      INPUT_PATH,
    );

  const issues:
    ValidationIssue[] = [];

  if (
    master.university?.code !==
    'USYD'
  ) {
    throw new Error(
      'Expected USYD master',
    );
  }

  if (
    master.handbookYear !==
    2026
  ) {
    throw new Error(
      'Expected handbook year 2026',
    );
  }

  const degrees =
    master.degrees ?? [];

  const subjects =
    master.subjects ?? [];

  const studyPlans =
    master.studyPlans ?? [];

  /*
   * -------------------------------------------------------
   * Degree validation
   * -------------------------------------------------------
   */

  const degreeCodes =
    new Set<string>();

  for (
    const degree of degrees
  ) {
    if (
      typeof degree.code !==
      'string' ||
      !degree.code.trim()
    ) {
      issues.push({
        severity: 'ERROR',

        type:
          'INVALID_DEGREE_CODE',

        message:
          'Degree has no code.',
      });

      continue;
    }

    const code =
      degree.code.trim();

    if (
      degreeCodes.has(code)
    ) {
      issues.push({
        severity: 'ERROR',

        type:
          'DUPLICATE_DEGREE_CODE',

        degreeCode: code,

        message:
          `Duplicate degree code: ${code}`,
      });
    }

    degreeCodes.add(code);
  }

  /*
   * -------------------------------------------------------
   * Subject validation
   * -------------------------------------------------------
   */

  const subjectCodes =
    new Set<string>();

  for (
    const subject of subjects
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

        message:
          'Subject has no code.',
      });

      continue;
    }

    const code =
      normalizeCode(
        subject.code,
      );

    if (
      typeof subject.name !==
      'string' ||
      !subject.name.trim()
    ) {
      issues.push({
        severity: 'ERROR',

        type:
          'SUBJECT_WITHOUT_NAME',

        subjectCode: code,

        message:
          `${code} has no subject.name.`,
      });
    }

    if (
      subjectCodes.has(code)
    ) {
      issues.push({
        severity: 'ERROR',

        type:
          'DUPLICATE_SUBJECT_CODE',

        subjectCode: code,

        message:
          `Duplicate subject code: ${code}`,
      });
    }

    subjectCodes.add(code);
  }

  /*
   * -------------------------------------------------------
   * Study-plan validation
   * -------------------------------------------------------
   */

  const cuspSourcePlanIds =
    new Set<string>();

  let cuspPlans = 0;

  let handbookPlans = 0;

  let years = 0;

  let periods = 0;

  let items = 0;

  let subjectItems = 0;

  let choiceItems = 0;

  for (
    const [
      planIndex,
      plan,
    ] of studyPlans.entries()
  ) {
    const degreeCode =
      plan.degreeCode ?? '';

    if (
      !degreeCodes.has(
        degreeCode,
      )
    ) {
      issues.push({
        severity: 'ERROR',

        type:
          'PLAN_DEGREE_NOT_FOUND',

        planIndex,

        degreeCode,

        sourcePlanId:
          plan.sourcePlanId ??
          undefined,

        message:
          `Study plan references unknown degree: ${degreeCode}`,
      });
    }

    if (
      typeof plan.title !==
      'string' ||
      !plan.title.trim()
    ) {
      issues.push({
        severity: 'ERROR',

        type:
          'PLAN_WITHOUT_TITLE',

        planIndex,

        degreeCode,

        message:
          'Study plan has no title.',
      });
    }

    const isCusp =
      plan.sourceType ===
      'CUSP';

    if (isCusp) {
      cuspPlans += 1;

      if (
        typeof plan.sourcePlanId !==
        'string' ||
        !plan.sourcePlanId.trim()
      ) {
        issues.push({
          severity: 'ERROR',

          type:
            'CUSP_PLAN_WITHOUT_SOURCE_ID',

          planIndex,

          degreeCode,

          message:
            'CUSP plan has no sourcePlanId.',
        });
      } else {
        if (
          cuspSourcePlanIds.has(
            plan.sourcePlanId,
          )
        ) {
          issues.push({
            severity: 'ERROR',

            type:
              'DUPLICATE_CUSP_SOURCE_ID',

            planIndex,

            degreeCode,

            sourcePlanId:
              plan.sourcePlanId,

            message:
              `Duplicate CUSP sourcePlanId: ${plan.sourcePlanId}`,
          });
        }

        cuspSourcePlanIds.add(
          plan.sourcePlanId,
        );
      }
    } else {
      handbookPlans += 1;
    }

    const planYears =
      plan.years ?? [];

    if (
      planYears.length === 0
    ) {
      issues.push({
        severity: 'ERROR',

        type:
          'PLAN_WITHOUT_YEARS',

        planIndex,

        degreeCode,

        sourcePlanId:
          plan.sourcePlanId ??
          undefined,

        message:
          'Study plan contains no years.',
      });
    }

    years +=
      planYears.length;

    for (
      const year of planYears
    ) {
      /*
       * Negative academic years are always invalid.
       */
      if (
        typeof year.yearNumber === 'number' &&
        year.yearNumber < 0
      ) {
        issues.push({
          severity: 'ERROR',

          type:
            'INVALID_ACADEMIC_YEAR',

          planIndex,

          degreeCode,

          sourcePlanId:
            plan.sourcePlanId ??
            undefined,

          message:
            `Database study plan contains invalid Year ${year.yearNumber}.`,
        });
      }

      /*
       * CUSP yearNumber = 0 represents planning/guidance content.
       *
       * prepare-usyd-database-master.ts should remove those
       * before database normalization.
       *
       * Therefore, Year 0 in a CUSP DB plan indicates a
       * normalization bug.
       *
       * Non-CUSP plans may legitimately use Year 0 for a
       * Foundation Year, such as BPLASXTD-01 official
       * sample enrolment plans.
       */
      if (
        plan.sourceType === 'CUSP' &&
        year.yearNumber === 0
      ) {
        issues.push({
          severity: 'ERROR',

          type:
            'CUSP_GUIDANCE_YEAR_IN_DATABASE',

          planIndex,

          degreeCode,

          sourcePlanId:
            plan.sourcePlanId ??
            undefined,

          message:
            'CUSP study plan contains Year 0 guidance content after database normalization.',
        });
      }

      const yearPeriods =
        year.periods ?? [];

      periods +=
        yearPeriods.length;

      if (
        yearPeriods.length === 0
      ) {
        issues.push({
          severity: 'ERROR',

          type:
            'YEAR_WITHOUT_PERIODS',

          planIndex,

          degreeCode,

          sourcePlanId:
            plan.sourcePlanId ??
            undefined,

          message:
            `Study-plan year ${String(
              year.yearNumber,
            )} has no periods.`,
        });
      }

      for (
        const period of
        yearPeriods
      ) {
        if (
          typeof period.name !==
          'string' ||
          !period.name.trim()
        ) {
          issues.push({
            severity: 'ERROR',

            type:
              'PERIOD_WITHOUT_NAME',

            planIndex,

            degreeCode,

            message:
              'Study-plan period has no name.',
          });
        }

        const periodItems =
          period.items ?? [];

        items +=
          periodItems.length;

        for (
          const item of
          periodItems
        ) {
          if (
            item.itemType ===
            'SUBJECT'
          ) {
            subjectItems += 1;

            if (
              typeof item.subjectCode !==
              'string' ||
              !item.subjectCode.trim()
            ) {
              issues.push({
                severity: 'ERROR',

                type:
                  'SUBJECT_ITEM_WITHOUT_CODE',

                planIndex,

                degreeCode,

                message:
                  'SUBJECT StudyPlanItem has no subjectCode.',
              });

              continue;
            }

            const code =
              normalizeCode(
                item.subjectCode,
              );

            if (
              !subjectCodes.has(
                code,
              )
            ) {
              issues.push({
                severity: 'ERROR',

                type:
                  'STUDY_PLAN_SUBJECT_NOT_FOUND',

                planIndex,

                degreeCode,

                subjectCode:
                  code,

                message:
                  `${code} is referenced by a study plan but not present in subjects[].`,
              });
            }

            continue;
          }

          if (
            item.itemType ===
            'CHOICE'
          ) {
            choiceItems += 1;

            if (
              !item.choiceText &&
              !item.rawText
            ) {
              issues.push({
                severity:
                  'WARNING',

                type:
                  'EMPTY_CHOICE_ITEM',

                planIndex,

                degreeCode,

                message:
                  'CHOICE item has no choiceText/rawText.',
              });
            }

            continue;
          }

          issues.push({
            severity: 'ERROR',

            type:
              'INVALID_ITEM_TYPE',

            planIndex,

            degreeCode,

            message:
              `Unknown StudyPlanItem type: ${String(
                item.itemType,
              )}`,
          });
        }
      }
    }
  }

  /*
   * -------------------------------------------------------
   * Metadata count validation
   * -------------------------------------------------------
   */

  const metadataCounts =
    master.metadata
      ?.counts ?? {};

  if (
    metadataCounts.degrees !==
    degrees.length
  ) {
    issues.push({
      severity: 'ERROR',

      type:
        'DEGREE_COUNT_MISMATCH',

      message:
        `metadata=${String(
          metadataCounts.degrees,
        )}, actual=${degrees.length}`,
    });
  }

  if (
    metadataCounts.subjects !==
    subjects.length
  ) {
    issues.push({
      severity: 'ERROR',

      type:
        'SUBJECT_COUNT_MISMATCH',

      message:
        `metadata=${String(
          metadataCounts.subjects,
        )}, actual=${subjects.length}`,
    });
  }

  if (
    metadataCounts.studyPlans !==
    studyPlans.length
  ) {
    issues.push({
      severity: 'ERROR',

      type:
        'STUDY_PLAN_COUNT_MISMATCH',

      message:
        `metadata=${String(
          metadataCounts.studyPlans,
        )}, actual=${studyPlans.length}`,
    });
  }

  /*
   * -------------------------------------------------------
   * Current frozen dataset invariants
   * -------------------------------------------------------
   */

  if (
    degrees.length !== 109
  ) {
    issues.push({
      severity: 'ERROR',

      type:
        'UNEXPECTED_DEGREE_TOTAL',

      message:
        `Expected 109 degrees, got ${degrees.length}.`,
    });
  }

  if (
    subjects.length !== 3081
  ) {
    issues.push({
      severity: 'ERROR',

      type:
        'UNEXPECTED_SUBJECT_TOTAL',

      message:
        `Expected 3081 subjects, got ${subjects.length}.`,
    });
  }

  if (
    studyPlans.length !== 531
  ) {
    issues.push({
      severity: 'ERROR',

      type:
        'UNEXPECTED_PLAN_TOTAL',

      message:
        `Expected 531 study plans, got ${studyPlans.length}.`,
    });
  }

  if (
    cuspPlans !== 525
  ) {
    issues.push({
      severity: 'ERROR',

      type:
        'UNEXPECTED_CUSP_PLAN_TOTAL',

      message:
        `Expected 525 CUSP plans, got ${cuspPlans}.`,
    });
  }

  if (
    handbookPlans !== 6
  ) {
    issues.push({
      severity: 'ERROR',

      type:
        'UNEXPECTED_HANDBOOK_PLAN_TOTAL',

      message:
        `Expected 6 handbook plans, got ${handbookPlans}.`,
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

  const issueCounts =
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
      new Date()
        .toISOString(),

    totals: {
      degrees:
        degrees.length,

      subjects:
        subjects.length,

      studyPlans:
        studyPlans.length,

      cuspPlans,

      handbookPlans,

      years,

      periods,

      items,

      subjectItems,

      choiceItems,

      errors:
        errors.length,

      warnings:
        warnings.length,
    },

    issueCounts,

    errors,

    warnings,
  };

  writeJson(
    REPORT_PATH,
    report,
  );

  console.log(
    '================================',
  );

  console.log(
    'USYD DATABASE MASTER VALIDATION',
  );

  console.log(
    '================================',
  );

  console.log(
    report.totals,
  );

  console.log(
    'Issue counts:',
    issueCounts,
  );

  console.log(
    `Saved report to ${REPORT_PATH}`,
  );

  if (
    errors.length > 0
  ) {
    process.exitCode = 1;
  }
}

main();