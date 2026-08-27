import {
  resolve,
} from 'node:path';

import {
  collectUtsMaster,
} from './adapters/uts/uts.master.collector.js';

import {
  collectUtsSubjects,
} from './adapters/uts/uts.subject.collector.js';

import {
  collectSubjectReferences,
  getUniqueSubjectReferences,
} from './adapters/uts/uts.subject-reference.collector.js';

import {
  collectUtsStudyPlans,
} from './adapters/uts/uts.study-plan.collector.js';

import {
  collectUtsAccessConditions,
} from './adapters/uts/uts.access-condition.collector.js';

import {
  writeJsonFile,
} from './storage/json.storage.js';

async function main() {
  const university =
    process.argv[2];

  const year =
    process.argv[3];

  if (!university) {
    throw new Error(
      'University is required. Example: uts',
    );
  }

  if (!year) {
    throw new Error(
      'Handbook year is required. Example: 2026',
    );
  }

  if (
    university.toLowerCase() !==
    'uts'
  ) {
    throw new Error(
      `University "${university}" is not implemented yet.`,
    );
  }

  await collectUts(
    year,
  );
}

async function collectUts(
  year: string,
) {
  console.log(
    '\n================================',
  );

  console.log(
    `UTS HANDBOOK COLLECTION ${year}`,
  );

  console.log(
    '================================\n',
  );

  /*
   * ------------------------------------------------
   * 1. COURSES + AOS
   * ------------------------------------------------
   */

  const master =
    await collectUtsMaster(
      year,
    );

  /*
   * ------------------------------------------------
   * 2. STUDY PLANS
   * ------------------------------------------------
   */

  const studyPlans =
    collectUtsStudyPlans(
      master.courses,
    );

  let studyPlanYears = 0;

  let studyPlanPeriods = 0;

  let studyPlanItems = 0;

  let studyPlanSubjects = 0;

  let studyPlanChoices = 0;

  for (const plan of studyPlans) {
    studyPlanYears +=
      plan.years.length;

    for (
      const yearItem
      of plan.years
    ) {
      studyPlanPeriods +=
        yearItem.periods.length;

      for (
        const period
        of yearItem.periods
      ) {
        studyPlanItems +=
          period.items.length;

        for (
          const item
          of period.items
        ) {
          if (
            item.type ===
            'SUBJECT'
          ) {
            studyPlanSubjects++;
          }

          if (
            item.type ===
            'CHOICE'
          ) {
            studyPlanChoices++;
          }
        }
      }
    }
  }

  console.log(
    `\nStudy plans: ${studyPlans.length}`,
  );

  console.log(
    `Study plan items: ${studyPlanItems}`,
  );

  /*
   * ------------------------------------------------
   * 3. SUBJECT RELATIONSHIPS
   * ------------------------------------------------
   */

  const subjectRelationships =
    collectSubjectReferences(
      master.courses,
      master.aos,
    );

  const referencedSubjects =
    getUniqueSubjectReferences(
      subjectRelationships,
    );

  console.log(
    `\nSubject relationships: ${subjectRelationships.length}`,
  );

  console.log(
    `Unique referenced subjects: ${referencedSubjects.length}`,
  );

  /*
   * ------------------------------------------------
   * 4. GLOBAL SUBJECT CATALOGUE
   * ------------------------------------------------
   */

  console.log(
    '\nCollecting UTS subject catalogue...',
  );

  const subjects =
    await collectUtsSubjects(
      year,
    );

  console.log(
    `Subjects collected: ${subjects.length}`,
  );

  /*
   * ------------------------------------------------
   * 5. SUBJECT VALIDATION
   * ------------------------------------------------
   */

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

  const unresolvedSubjectReferences =
    referencedSubjects.filter(
      (reference) =>
        !subjectCodes.has(
          reference.code,
        ),
    );

  const yearMismatchSubjectReferences =
    referencedSubjects.filter(
      (reference) =>
        reference.url !== undefined &&
        !reference.url.includes(
          `/subject/${year}/`,
        ),
    );

  /*
   * ------------------------------------------------
   * 6. ACCESS CONDITIONS
   * ------------------------------------------------
   *
   * Only subjects referenced by undergraduate
   * curriculum structures are checked.
   *
   * This gives us prerequisite, corequisite,
   * admission and other enrolment rules.
   */

  const accessConditionSubjectCodes =
    referencedSubjects.map(
      (subject) =>
        subject.code,
    );

  const accessConditions =
    await collectUtsAccessConditions(
      accessConditionSubjectCodes,
      year,
    );

  /*
   * ------------------------------------------------
   * 7. AOS VALIDATION
   * ------------------------------------------------
   */

  const unresolvedAosCodes =
    new Set(
      master.unresolvedAosReferences
        .map(
          (reference) =>
            reference.componentCode,
        )
        .filter(
          (
            code,
          ): code is string =>
            Boolean(code),
        ),
    );

  /*
   * ------------------------------------------------
   * 8. OUTPUT DIRECTORY
   * ------------------------------------------------
   */

  const outputDirectory =
    resolve(
      'data',
      'normalized',
      'uts',
      year,
    );

  /*
   * ------------------------------------------------
   * 9. EXPORT ENTITIES
   * ------------------------------------------------
   */

  await writeJsonFile(
    resolve(
      outputDirectory,
      'courses.json',
    ),
    master.courses,
  );

  await writeJsonFile(
    resolve(
      outputDirectory,
      'aos.json',
    ),
    master.aos,
  );

  await writeJsonFile(
    resolve(
      outputDirectory,
      'subjects.json',
    ),
    subjects,
  );

  await writeJsonFile(
    resolve(
      outputDirectory,
      'study-plans.json',
    ),
    studyPlans,
  );

  await writeJsonFile(
    resolve(
      outputDirectory,
      'access-conditions.json',
    ),
    accessConditions.records,
  );

  /*
   * ------------------------------------------------
   * 10. EXPORT RELATIONSHIPS
   * ------------------------------------------------
   */

  await writeJsonFile(
    resolve(
      outputDirectory,
      'degree-component-relationships.json',
    ),
    master.degreeComponentReferences,
  );

  await writeJsonFile(
    resolve(
      outputDirectory,
      'subject-relationships.json',
    ),
    subjectRelationships,
  );

  /*
   * ------------------------------------------------
   * 11. EXPORT UNRESOLVED REFERENCES
   * ------------------------------------------------
   */

  await writeJsonFile(
    resolve(
      outputDirectory,
      'unresolved-aos.json',
    ),
    master.unresolvedAosReferences,
  );

  await writeJsonFile(
    resolve(
      outputDirectory,
      'unresolved-subjects.json',
    ),
    unresolvedSubjectReferences,
  );

  await writeJsonFile(
    resolve(
      outputDirectory,
      'access-condition-failures.json',
    ),
    accessConditions.failures,
  );

  /*
   * ------------------------------------------------
   * 12. EXPORT YEAR MISMATCHES
   * ------------------------------------------------
   */

  await writeJsonFile(
    resolve(
      outputDirectory,
      'subject-year-mismatches.json',
    ),
    yearMismatchSubjectReferences,
  );

  /*
   * ------------------------------------------------
   * 13. ACCESS CONDITION STATISTICS
   * ------------------------------------------------
   */

  const accessConditionsWithRules =
    accessConditions.records.filter(
      (record) =>
        record.hasConditions,
    );

  const accessConditionsWithoutRules =
    accessConditions.records.filter(
      (record) =>
        !record.hasConditions,
    );

  const accessConditionItems =
    accessConditions.records.reduce(
      (
        total,
        record,
      ) =>
        total +
        record.items.length,
      0,
    );

  /*
   * ------------------------------------------------
   * 14. COLLECTION SUMMARY
   * ------------------------------------------------
   */

  const summary = {
    university:
      'UTS',

    handbookYear:
      year,

    collectedAt:
      new Date().toISOString(),

    courses: {
      total:
        master.courses.length,
    },

    aos: {
      total:
        master.aos.length,

      unresolvedRelationships:
        master.unresolvedAosReferences.length,

      unresolvedUniqueCodes:
        unresolvedAosCodes.size,
    },

    subjects: {
      globalCatalogue:
        subjects.length,

      referencedRelationships:
        subjectRelationships.length,

      referencedUnique:
        referencedSubjects.length,

      unresolvedReferenced:
        unresolvedSubjectReferences.length,

      yearMismatchReferences:
        yearMismatchSubjectReferences.length,
    },

    studyPlans: {
      total:
        studyPlans.length,

      years:
        studyPlanYears,

      periods:
        studyPlanPeriods,

      items:
        studyPlanItems,

      subjects:
        studyPlanSubjects,

      choices:
        studyPlanChoices,
    },

    accessConditions: {
      requestedSubjects:
        accessConditionSubjectCodes.length,

      collected:
        accessConditions.records.length,

      withConditions:
        accessConditionsWithRules.length,

      withoutConditions:
        accessConditionsWithoutRules.length,

      conditionItems:
        accessConditionItems,

      failures:
        accessConditions.failures.length,
    },

    degreeComponentRelationships:
      master.degreeComponentReferences.length,
  };

  await writeJsonFile(
    resolve(
      outputDirectory,
      'summary.json',
    ),
    summary,
  );

  /*
   * ------------------------------------------------
   * DONE
   * ------------------------------------------------
   */

  console.log(
    '\n================================',
  );

  console.log(
    'UTS COLLECTION COMPLETE',
  );

  console.log(
    '================================\n',
  );

  console.log(
    `Courses: ${summary.courses.total}`,
  );

  console.log(
    `AOS: ${summary.aos.total}`,
  );

  console.log(
    `Subjects: ${summary.subjects.globalCatalogue}`,
  );

  console.log(
    `Study plans: ${summary.studyPlans.total}`,
  );

  console.log(
    `Study plan subjects: ${summary.studyPlans.subjects}`,
  );

  console.log(
    `Study plan choices: ${summary.studyPlans.choices}`,
  );

  console.log(
    `Access conditions collected: ${summary.accessConditions.collected}`,
  );

  console.log(
    `Subjects with access conditions: ${summary.accessConditions.withConditions}`,
  );

  console.log(
    `Subjects without access conditions: ${summary.accessConditions.withoutConditions}`,
  );

  console.log(
    `Access condition items: ${summary.accessConditions.conditionItems}`,
  );

  console.log(
    `Access condition failures: ${summary.accessConditions.failures}`,
  );

  console.log(
    `Degree component relationships: ${summary.degreeComponentRelationships}`,
  );

  console.log(
    `Subject relationships: ${summary.subjects.referencedRelationships}`,
  );

  console.log(
    `Unresolved AOS codes: ${summary.aos.unresolvedUniqueCodes}`,
  );

  console.log(
    `Unresolved subject references: ${summary.subjects.unresolvedReferenced}`,
  );

  console.log(
    `Subject year mismatches: ${summary.subjects.yearMismatchReferences}`,
  );

  console.log(
    `\nSaved to:\n${outputDirectory}`,
  );
}

main().catch(
  (error) => {
    console.error(
      '\nCollection failed:',
    );

    console.error(
      error,
    );

    process.exit(1);
  },
);