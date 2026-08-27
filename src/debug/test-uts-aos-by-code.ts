import {
  callUtsApi,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

const CODES = [
  'SMJ08195',
  'SMJ10198',
  'SMJ10199',
  'SMJ10200',
  'SMJ10201',
  'SMJ10202',
  'STM91949',
  'CBK92373',
  'STM90794',
  'SMJ10085',
  'CBK90795',
  'SMJ10197',
  'STM91953',
  'MAJ08980',
  'MAJ01170',
  'MAJ01191',
  'MAJ01190',
  'MAJ01080',
];

async function main() {
  let found = 0;

  const unresolved: string[] = [];

  for (const code of CODES) {
    const response =
      await callUtsApi({
        siteId:
          'uts-prod-pres',

        contentType:
          'aos',

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
              code,
          },
        ],

        offset: 0,
        limit: 10,
      });

    if (
      response.data.data.length === 0
    ) {
      console.log(
        `${code}: NOT FOUND`,
      );

      unresolved.push(
        code,
      );

      continue;
    }

    found++;

    const raw =
      response.data.data[0];

    const item =
      parseAcademicItem(
        raw,
      );

    console.log(
      `${code}: FOUND | ${
        item.academic_item_type ??
        '-'
      } | ${
        item.title ??
        item.search_title ??
        '-'
      } | Structure: ${
        raw.CurriculumStructure
          ? 'YES'
          : 'NO'
      }`,
    );
  }

  console.log(
    '\n=============================',
  );

  console.log(
    `Found directly: ${found}`,
  );

  console.log(
    `Still unresolved: ${unresolved.length}`,
  );

  console.log(
    unresolved.join(', '),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});