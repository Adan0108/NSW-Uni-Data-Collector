import {
  collectUtsCourses,
} from '../adapters/uts/uts.course.collector.js';

import {
  parseUtsStudyPlans,
} from '../adapters/uts/uts.study-plan.parser.js';

async function main() {
  const courses =
    await collectUtsCourses(
      '2026',
    );

  let coursesWithPlans = 0;
  let coursesWithoutPlans = 0;

  let totalPlans = 0;
  let totalYears = 0;
  let totalPeriods = 0;
  let totalItems = 0;

  let subjectItems = 0;
  let choiceItems = 0;

  const emptyPlans: string[] = [];
  const malformedItems: string[] = [];

  for (const course of courses) {
    const plans =
      parseUtsStudyPlans(
        course.studyPlans,
      );

    if (plans.length === 0) {
      coursesWithoutPlans++;

      continue;
    }

    coursesWithPlans++;

    totalPlans +=
      plans.length;

    for (const plan of plans) {
      if (
        plan.years.length === 0
      ) {
        emptyPlans.push(
          `${course.code} -> ${plan.title}`,
        );
      }

      totalYears +=
        plan.years.length;

      for (const year of plan.years) {
        totalPeriods +=
          year.periods.length;

        for (
          const period
          of year.periods
        ) {
          totalItems +=
            period.items.length;

          for (
            const item
            of period.items
          ) {
            if (
              item.type ===
              'SUBJECT'
            ) {
              subjectItems++;

              if (
                !item.code ||
                !item.title
              ) {
                malformedItems.push(
                  `${course.code} -> ${plan.title} -> ${year.name} -> ${period.name}`,
                );
              }
            }

            if (
              item.type ===
              'CHOICE'
            ) {
              choiceItems++;

              if (
                !item.title
              ) {
                malformedItems.push(
                  `${course.code} -> ${plan.title} -> ${year.name} -> ${period.name}`,
                );
              }
            }
          }
        }
      }
    }
  }

  console.log(
    '\n=============================',
  );

  console.log(
    'UTS STUDY PLAN VALIDATION',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Courses: ${courses.length}`,
  );

  console.log(
    `Courses with plans: ${coursesWithPlans}`,
  );

  console.log(
    `Courses without plans: ${coursesWithoutPlans}`,
  );

  console.log(
    `Total study plans: ${totalPlans}`,
  );

  console.log(
    `Total years: ${totalYears}`,
  );

  console.log(
    `Total periods: ${totalPeriods}`,
  );

  console.log(
    `Total items: ${totalItems}`,
  );

  console.log(
    `Subject items: ${subjectItems}`,
  );

  console.log(
    `Choice items: ${choiceItems}`,
  );

  console.log(
    `Empty plans: ${emptyPlans.length}`,
  );

  console.log(
    `Malformed items: ${malformedItems.length}`,
  );

  if (
    emptyPlans.length > 0
  ) {
    console.log(
      '\nEmpty plans:',
    );

    for (
      const item
      of emptyPlans
    ) {
      console.log(
        item,
      );
    }
  }

  if (
    malformedItems.length > 0
  ) {
    console.log(
      '\nMalformed items:',
    );

    for (
      const item
      of malformedItems
    ) {
      console.log(
        item,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});