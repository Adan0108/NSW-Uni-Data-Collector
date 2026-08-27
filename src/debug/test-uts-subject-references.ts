import {
  collectUtsMaster,
} from '../adapters/uts/uts.master.collector.js';

import {
  collectSubjectReferences,
  getUniqueSubjectReferences,
} from '../adapters/uts/uts.subject-reference.collector.js';

async function main() {
  const master =
    await collectUtsMaster(
      '2026',
    );

  const references =
    collectSubjectReferences(
      master.courses,
      master.aos,
    );

  const uniqueSubjects =
    getUniqueSubjectReferences(
      references,
    );

  console.log(
    '\n=============================',
  );

  console.log(
    'UTS SUBJECT REFERENCES',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Total subject relationships: ${references.length}`,
  );

  console.log(
    `Unique subject codes: ${uniqueSubjects.length}`,
  );

  const missingUrl =
    uniqueSubjects.filter(
      (subject) =>
        !subject.url,
    );

  console.log(
    `Subjects without URL: ${missingUrl.length}`,
  );

  const invalidYear =
    uniqueSubjects.filter(
      (subject) =>
        subject.url &&
        !subject.url.includes(
          '/subject/2026/',
        ),
    );

  console.log(
    `Subjects with non-2026 URL: ${invalidYear.length}`,
  );

  if (
    invalidYear.length > 0
  ) {
    console.log(
      '\nNon-2026 subject URLs:',
    );

    for (
      const subject
      of invalidYear
    ) {
      console.log(
        `${subject.code} -> ${subject.url}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});