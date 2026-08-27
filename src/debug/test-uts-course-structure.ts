import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

import type {
  ParsedRequirementGroup,
} from '../adapters/uts/uts.structure.parser.js';

import {
  parseUtsCurriculumStructure,
} from '../adapters/uts/uts.structure.parser.js';

function printGroup(
  group: ParsedRequirementGroup,
  indent = 0,
) {
  const space = ' '.repeat(indent);

  console.log(
    `${space}${group.title} | ${group.logic} | ${group.requiredCreditPoints ?? '-'} CP`,
  );

  for (const item of group.items) {
    console.log(
      `${space}  [${item.type}] ${item.code ?? '-'} - ${item.name ?? '-'} - ${item.creditPoints ?? '-'} CP`,
    );
  }

  for (const child of group.children) {
    printGroup(
      child,
      indent + 2,
    );
  }
}

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
      const course =
        parseAcademicItem(item);

      return course.code === 'C10026';
    });

  if (!rawCourse) {
    throw new Error(
      'C10026 Bachelor of Business not found',
    );
  }

  const course =
    parseAcademicItem(rawCourse);

  console.log('\n============================');
  console.log(
    `${course.code} - ${course.title}`,
  );
  console.log(
    `Total CP: ${course.credit_points}`,
  );
  console.log('============================\n');

  if (!rawCourse.CurriculumStructure) {
    throw new Error(
      'C10026 has no CurriculumStructure',
    );
  }

  const structure =
    parseUtsCurriculumStructure(
      rawCourse.CurriculumStructure,
    );

  for (const group of structure.groups) {
    printGroup(group);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});