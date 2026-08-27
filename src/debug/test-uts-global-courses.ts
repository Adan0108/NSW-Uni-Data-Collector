import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

const AREAS = [
  {
    name: 'Business',
    id: 'c6142b2fc3ddc2107fe22c4bb0013127',
  },
];

async function main() {
  let total = 0;

  for (const area of AREAS) {
    console.log(`\n=============================`);
    console.log(`AREA: ${area.name}`);

    const items = await fetchAllUtsItems({
      contentType: 'course',

      queryParams: [
        {
          queryField: 'educationalArea',
          queryValue: area.id,
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

    console.log(`Found: ${items.length}`);

    total += items.length;

    for (const raw of items) {
      const course =
        parseAcademicItem(raw);

      console.log(
        `${course.code ?? '-'} - ${
          course.title ??
          course.search_title ??
          '-'
        } - ${course.credit_points ?? '-'} CP - structure: ${
          raw.CurriculumStructure
            ? 'yes'
            : 'no'
        }`,
      );
    }
  }

  console.log(`\nTOTAL: ${total}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});