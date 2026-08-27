import {
  callUtsApi,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

async function main() {
  /*
   * Test 1:
   * Fetch one known 2026 subject by code.
   */
  console.log(
    '\n=============================',
  );

  console.log(
    'SUBJECT BY CODE',
  );

  console.log(
    '=============================\n',
  );

  const byCode =
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
        {
          queryField:
            'code',

          queryValue:
            '22321',
        },
      ],

      offset: 0,
      limit: 10,
    });

  console.log(
    `Records: ${byCode.data.data.length}`,
  );

  for (
    const raw
    of byCode.data.data
  ) {
    const subject =
      parseAcademicItem(
        raw,
      );

    console.log(
      `Code: ${subject.code ?? '-'}`,
    );

    console.log(
      `Name: ${
        subject.title ??
        subject.search_title ??
        '-'
      }`,
    );

    console.log(
      `Credit points: ${
        subject.credit_points ??
        '-'
      }`,
    );

    console.log(
      '\nRAW PARSED KEYS:',
    );

    console.log(
      Object.keys(
        subject,
      ).sort(),
    );
  }

  /*
   * Test 2:
   * See whether subjects can be collected
   * globally with a small page size.
   */
  console.log(
    '\n=============================',
  );

  console.log(
    'GLOBAL SUBJECT TEST',
  );

  console.log(
    '=============================\n',
  );

  const global =
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
      limit: 10,
    });

  console.log(
    `Returned: ${global.data.data.length}`,
  );

  console.log(
    `API count: ${global.data.count}`,
  );

  for (
    const raw
    of global.data.data
  ) {
    const subject =
      parseAcademicItem(
        raw,
      );

    console.log(
      `${subject.code ?? '-'} - ${
        subject.title ??
        subject.search_title ??
        '-'
      }`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});