import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

async function testLevel(
  level: string,
) {
  const items = await fetchAllUtsItems({
    contentType: 'aos',

    queryParams: [
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
        queryValue: level,
      },
    ],
  });

  console.log(
    `\n${level}: ${items.length}`,
  );

  for (const raw of items) {
    const item =
      parseAcademicItem(raw);

    console.log(
      `${item.code ?? '-'} - ${item.title ?? item.search_title ?? '-'}`,
    );
  }
}

async function main() {
  await testLevel('major');
  await testLevel('sub_major');
  await testLevel('stream');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});