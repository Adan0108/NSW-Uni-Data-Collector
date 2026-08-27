import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

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

  console.log('\nBUSINESS COURSES\n');

  for (const raw of items) {
    const item = parseAcademicItem(raw);

    console.log(
      `${item.code} - ${item.title} - ${item.credit_points} CP`,
    );
  }

  console.log(
    `\nTotal: ${items.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});