import {
  fetchAllUtsItems,
} from '../adapters/uts/uts.api.js';

async function main() {
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
        queryValue: 'major',
      },
    ],
  });

  console.log(
    JSON.stringify(
      JSON.parse(items[0].data),
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});