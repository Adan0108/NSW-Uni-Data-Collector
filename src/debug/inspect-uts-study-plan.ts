import {
  collectUtsCourses,
} from '../adapters/uts/uts.course.collector.js';

async function main() {
  const courses =
    await collectUtsCourses(
      '2026',
    );

  /*
   * Bachelor of Business is useful because
   * it has a normal multi-year study plan.
   */
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

  console.log(
    '\n=============================',
  );

  console.log(
    `${course.code} - ${course.name}`,
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Study plans: ${
      course.studyPlans?.length ??
      0
    }`,
  );

  console.dir(
    course.studyPlans,
    {
      depth: null,
      maxArrayLength: null,
    },
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});