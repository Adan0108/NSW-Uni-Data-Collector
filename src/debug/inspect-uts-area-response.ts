import {
  callUtsApi,
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
            'educationalArea',

          queryValue:
            'c6142b2fc3ddc2107fe22c4bb0013127',
        },
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
    JSON.stringify(
      response,
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});