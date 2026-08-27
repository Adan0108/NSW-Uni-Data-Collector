import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

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

  console.log('\nBUSINESS MAJORS\n');

  for (const raw of items) {
    const item = parseAcademicItem(raw);

    console.log(
      `${item.search_title ?? item.title} - ${item.credit_points} CP`,
    );

    if (raw.CurriculumStructure) {
      const structure =
        JSON.parse(raw.CurriculumStructure);

      console.log(
        '  Has curriculum structure:',
        Boolean(structure),
      );
    }
  }

  console.log(
    `\nTotal majors: ${items.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
