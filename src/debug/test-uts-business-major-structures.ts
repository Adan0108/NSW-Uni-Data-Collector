import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

import {
  parseUtsCurriculumStructure,
} from '../adapters/uts/uts.structure.parser.js';

async function main() {
  const items = await fetchAllUtsItems({
    contentType: 'aos',

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
          '817ed8571b875d1002b942e7b04bcb4f',
      },
      {
        queryField: 'level',
        queryValue: 'major',
      },
    ],
  });

  for (const raw of items) {
    const item =
      parseAcademicItem(raw);

    console.log(
      '\n=================================',
    );

    console.log(
      item.search_title ??
        item.title,
    );

    console.log(
      `Credit points: ${item.credit_points}`,
    );

    if (!raw.CurriculumStructure) {
      console.log(
        'No curriculum structure',
      );

      continue;
    }

    const structure =
      parseUtsCurriculumStructure(
        raw.CurriculumStructure,
      );

    for (const group of structure.groups) {
      console.log(
        `\n  GROUP: ${group.title}`,
      );

      console.log(
        `  Logic: ${group.logic}`,
      );

      console.log(
        `  CP: ${group.requiredCreditPoints ?? '-'}`,
      );

      console.log(
        `  Description: ${group.description ?? '-'}`,
      );

      for (
        const subject
        of group.subjects
      ) {
        console.log(
          `    ${subject.code} - ${subject.name} - ${subject.creditPoints ?? '?'} CP`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);

  process.exit(1);
});