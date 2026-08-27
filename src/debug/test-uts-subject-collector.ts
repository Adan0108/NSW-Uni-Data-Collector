import {
  collectUtsMaster,
} from '../adapters/uts/uts.master.collector.js';

import {
  collectSubjectReferences,
  getUniqueSubjectReferences,
} from '../adapters/uts/uts.subject-reference.collector.js';

import {
  collectUtsSubjects,
} from '../adapters/uts/uts.subject.collector.js';

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

  const referencedSubjects =
    getUniqueSubjectReferences(
      references,
    );

  console.log(
    '\nCollecting global subject catalogue...',
  );

  const subjects =
    await collectUtsSubjects(
      '2026',
    );

  const subjectCodes =
    new Set(
      subjects
        .map(
          (subject) =>
            subject.code,
        )
        .filter(
          Boolean,
        ),
    );

  const missingReferencedSubjects =
    referencedSubjects.filter(
      (subject) =>
        !subjectCodes.has(
          subject.code,
        ),
    );

  console.log(
    '\n=============================',
  );

  console.log(
    'UTS SUBJECT SUMMARY',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Global subjects: ${subjects.length}`,
  );

  console.log(
    `Referenced unique subjects: ${referencedSubjects.length}`,
  );

  console.log(
    `Missing referenced subjects: ${missingReferencedSubjects.length}`,
  );

  if (
    missingReferencedSubjects.length > 0
  ) {
    console.log(
      '\nMissing subject codes:',
    );

    for (
      const subject
      of missingReferencedSubjects
    ) {
      console.log(
        `${subject.code} -> ${subject.url ?? '-'}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});