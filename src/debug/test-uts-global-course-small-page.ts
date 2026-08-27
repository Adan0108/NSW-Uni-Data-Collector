import {
  callUtsApi,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

async function main() {
  const response =
    await callUtsApi({
      siteId:
        'uts-prod-pres',

      contentType:
        'course',

      queryParams: [
        {
          queryField:
            'implementationYear',
          queryValue:
            '2026',
        },
        {
          queryField:
            'studyLevel',
          queryValue:
            '0c2074dcdb6afc5087f743ea13961960',
        },
      ],

      offset: 0,
      limit: 10,
    });

  console.log(
    'Returned:',
    response.data.data.length,
  );

  console.log(
    'API count:',
    response.data.count,
  );

  for (
    const raw
    of response.data.data
  ) {
    const course =
      parseAcademicItem(raw);

    console.log('\n-----------------------------');

    console.log(
      `${course.code ?? '-'} - ${
        course.title ??
        course.search_title ??
        '-'
      }`,
    );

    console.log(
      'Area display:',
      raw.educationalAreaDisplay ??
        '-',
    );

    console.log(
      'Area ID:',
      raw.educationalArea ??
        '-',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});