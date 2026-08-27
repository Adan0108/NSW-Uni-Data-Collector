import {
  callUtsApi,
} from '../adapters/uts/uts.api.js';

async function main() {
  const queryParams = [
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
  ];

  const first = await callUtsApi({
    siteId: 'uts-prod-pres',
    contentType: 'aos',
    queryParams,
    offset: 0,
    limit: 100,
  });

  const second = await callUtsApi({
    siteId: 'uts-prod-pres',
    contentType: 'aos',
    queryParams,
    offset: 100,
    limit: 100,
  });

  console.log(
    'FIRST count:',
    first.data.count,
  );

  console.log(
    'FIRST records:',
    first.data.data.length,
  );

  console.log(
    'SECOND count:',
    second.data.count,
  );

  console.log(
    'SECOND records:',
    second.data.data.length,
  );

  if (second.data.data.length > 0) {
    const firstSecondPage =
      JSON.parse(
        second.data.data[0].data,
      );

    console.log(
      '\nFIRST RECORD PAGE 2:',
    );

    console.log(
      firstSecondPage.search_title,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});