import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

import {
  parseUtsCurriculumStructure,
} from '../adapters/uts/uts.structure.parser.js';

import {
  extractDegreeComponents,
} from '../adapters/uts/uts.degree-component.extractor.js';

async function main() {
  const items = await fetchAllUtsItems({
    contentType: 'course',

    queryParams: [
      {
        queryField: 'educationalArea',
        queryValue:
          'c6142b2fc3ddc2107fe22c4bb0013127',
      },
      {
        queryField: 'implementationYear',
        queryValue: '2026',
      },
      {
        queryField: 'studyLevel',
        queryValue:
          '0c2074dcdb6afc5087f743ea13961960',
      },
    ],
  });

  const rawCourse =
    items.find((item) => {
      const parsed =
        parseAcademicItem(item);

      return parsed.code === 'C10026';
    });

  if (
    !rawCourse ||
    !rawCourse.CurriculumStructure
  ) {
    throw new Error(
      'C10026 structure not found',
    );
  }

  const course =
    parseAcademicItem(
      rawCourse,
    );

  const structure =
    parseUtsCurriculumStructure(
      rawCourse.CurriculumStructure,
    );

  const components =
    extractDegreeComponents(
      course.code ?? 'C10026',
      structure,
    );

  console.log(
    `\n${course.code} - ${course.title}`,
  );

  console.log(
    `Components found: ${components.length}\n`,
  );

  for (const component of components) {
    console.log(
      `${component.componentType.padEnd(10)} ${component.componentCode} - ${component.componentName}`,
    );

    console.log(
      `  Path: ${component.path.join(' > ')}`,
    );

    console.log(
      `  CP: ${component.requiredCreditPoints ?? '-'}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});