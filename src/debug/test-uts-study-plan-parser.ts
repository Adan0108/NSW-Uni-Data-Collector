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

  const course =
    courses.find(
      (item) =>
        item.code ===
        'C10026',
    );

  if (!course) {
    throw new Error(
      'C10026 not found.',
    );
  }

  const plans =
    parseUtsStudyPlans(
      course.studyPlans,
    );

  console.log(
    '\n=============================',
  );

  console.log(
    'UTS STUDY PLAN TEST',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Course: ${course.code} - ${course.name}`,
  );

  console.log(
    `Study plans: ${plans.length}`,
  );

  for (const plan of plans) {
    console.log(
      `\nPLAN: ${plan.title}`,
    );

    console.log(
      `Course: ${plan.courseCode ?? '-'}`,
    );

    console.log(
      `Years: ${plan.years.length}`,
    );

    for (const year of plan.years) {
      console.log(
        `  ${year.name}`,
      );

      for (
        const period
        of year.periods
      ) {
        console.log(
          `    ${period.name}`,
        );

        for (
          const item
          of period.items
        ) {
          console.log(
            `      [${item.type}] ${
              item.code ?? '-'
            } - ${item.title} (${item.creditPoints ?? '-'}cp)`,
          );
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});