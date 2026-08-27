import {
  buildUsydStudyPlanNormalizedV1,
} from './usyd.study-plan-normalizer';

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
    'USYD STUDY PLAN NORMALIZER V1',
  );

  divider();

  const result =
    await buildUsydStudyPlanNormalizedV1();

  console.log(
    `Source pages: ${result.counts.sourcePages}`,
  );

  console.log(
    `Study plans: ${result.counts.studyPlans}`,
  );

  console.log(
    `Study-plan years: ${result.counts.studyPlanYears}`,
  );

  console.log(
    `Study-plan periods: ${result.counts.studyPlanPeriods}`,
  );

  console.log(
    `Study-plan items: ${result.counts.studyPlanItems}`,
  );

  console.log(
    `Subject items: ${result.counts.subjectItems}`,
  );

  console.log(
    `Choice items: ${result.counts.choiceItems}`,
  );

  console.log(
    `Plans with total CP: ${result.counts.plansWithTotalCreditPoints}`,
  );

  console.log(
    `Periods without items: ${result.counts.periodsWithoutItems}`,
  );

  console.log(
    `Periods without CP total: ${result.counts.periodsWithoutCreditTotal}`,
  );

  console.log(
    `Duplicate plan keys: ${result.counts.duplicatePlanKeys}`,
  );

  console.log(
    `Duplicate period keys: ${result.counts.duplicatePeriodKeys}`,
  );

  console.log(
    `Duplicate item keys: ${result.counts.duplicateItemKeys}`,
  );

  divider();

  console.log(
    'NORMALIZED PLAN SUMMARY',
  );

  divider();

  for (
    const plan
    of result.studyPlans
  ) {
    const periods =
      plan.years.reduce(
        (
          total,
          year,
        ) =>
          total +
          year.periods.length,
        0,
      );

    const items =
      plan.years.reduce(
        (
          total,
          year,
        ) =>
          total +
          year.periods.reduce(
            (
              inner,
              period,
            ) =>
              inner +
              period.items.length,
            0,
          ),
        0,
      );

    console.log(
      `${plan.degreeCode} — ${plan.title}`,
    );

    console.log(
      `  Total CP: ${plan.totalCreditPoints ?? '(none)'}`,
    );

    console.log(
      `  Years: ${plan.years.length}`,
    );

    console.log(
      `  Periods: ${periods}`,
    );

    console.log(
      `  Items: ${items}`,
    );

    console.log(
      `  Source: ${plan.sourceUrl}`,
    );

    console.log('');
  }

  const failures:
    string[] = [];

  if (
    result.counts.sourcePages !==
    4
  ) {
    failures.push(
      `Expected 4 authoritative source pages, got ${result.counts.sourcePages}.`,
    );
  }

  if (
    result.counts.studyPlans !==
    6
  ) {
    failures.push(
      `Expected 6 normalized sample-enrolment plans, got ${result.counts.studyPlans}.`,
    );
  }

  if (
    result.counts.studyPlanYears !==
    20
  ) {
    failures.push(
      `Expected 20 study-plan years, got ${result.counts.studyPlanYears}.`,
    );
  }

  if (
    result.counts.studyPlanPeriods !==
    40
  ) {
    failures.push(
      `Expected 40 semester periods, got ${result.counts.studyPlanPeriods}.`,
    );
  }

  if (
    result.counts.studyPlanItems !==
    152
  ) {
    failures.push(
      `Expected 152 study-plan items, got ${result.counts.studyPlanItems}.`,
    );
  }

  if (
    result.counts.plansWithTotalCreditPoints !==
    6
  ) {
    failures.push(
      `Expected all 6 plans to have degree total CP, got ${result.counts.plansWithTotalCreditPoints}.`,
    );
  }

  if (
    result.counts.periodsWithoutItems !==
      0 ||
    result.counts.periodsWithoutCreditTotal !==
      0
  ) {
    failures.push(
      'Every semester period must contain items and a semester CP total.',
    );
  }

  if (
    result.counts.duplicatePlanKeys !==
      0 ||
    result.counts.duplicatePeriodKeys !==
      0 ||
    result.counts.duplicateItemKeys !==
      0
  ) {
    failures.push(
      'Normalized study-plan keys must be unique.',
    );
  }

  const formalRequirementLeak =
    result.studyPlans.some(
      (plan) =>
        plan.isFormalRequirement !==
        false,
    );

  if (
    formalRequirementLeak
  ) {
    failures.push(
      'Recommended study plans must never be marked as formal requirements.',
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
    'USYD RECOMMENDED STUDY PLAN NORMALIZATION: CLEAN',
  );

  console.log(
    '6 OFFICIAL SAMPLE-ENROLMENT PLANS NORMALIZED FROM 4 PROVEN 2026 SOURCES',
  );

  console.log(
    'NEXT: write normalized plans, then rebuild the USYD master and run final integrity / requisite-semantic checks before Prisma mapping.',
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
