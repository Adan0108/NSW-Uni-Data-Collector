import {
  collectUtsCourses,
} from '../adapters/uts/uts.course.collector.js';

async function main() {
  const courses =
    await collectUtsCourses(
      '2026',
    );

  console.log(
    `\nCollected courses: ${courses.length}`,
  );

  const withoutStructure =
    courses.filter(
      (course) =>
        !course.structure,
    );

  console.log(
    `Without structure: ${withoutStructure.length}`,
  );

  for (
    const course
    of withoutStructure
  ) {
    console.log(
      `${course.code} - ${course.name}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});