import {
  callUtsApi,
} from '../adapters/uts/uts.api.js';

async function main() {
  const pageSizes = [
    20,
    30,
    50,
  ];

  for (const limit of pageSizes) {
    console.log(
      `\nTesting subject page size: ${limit}`,
    );

    try {
      const response =
        await callUtsApi({
          siteId:
            'uts-prod-pres',

          contentType:
            'subject',

          queryParams: [
            {
              queryField:
                'implementationYear',

              queryValue:
                '2026',
            },
          ],

          offset: 0,
          limit,
        });

      console.log(
        `SUCCESS: ${response.data.data.length} records`,
      );
    } catch (error) {
      console.log(
        `FAILED: ${String(error)}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});