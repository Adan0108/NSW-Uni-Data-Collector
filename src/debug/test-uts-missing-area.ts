import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

const KNOWN_AREAS = [
  {
    name: 'Business',
    id: 'c6142b2fc3ddc2107fe22c4bb0013127',
  },
  {
    name: 'Communication',
    id: '0a142b2fc3ddc2107fe22c4bb0013128',
  },
  {
    name: 'Creative Intelligence and Innovation',
    id: 'ca142b2fc3ddc2107fe22c4bb0013128',
  },
  {
    name: 'Design, Architecture and Building',
    id: '46142b2fc3ddc2107fe22c4bb0013128',
  },
  {
    name: 'Education',
    id: '8e142b2fc3ddc2107fe22c4bb0013128',
  },
  {
    name: 'Engineering',
    id: '06142b2fc3ddc2107fe22c4bb0013129',
  },
  {
    name: 'General',
    id: '0e142b2fc3ddc2107fe22c4bb001312a',
  },
  {
    name: 'Graduate School of Health',
    id: '02142b2fc3ddc2107fe22c4bb001312a',
  },
  {
    name: 'Health',
    id: '4e142b2fc3ddc2107fe22c4bb0013129',
  },
  {
    name: 'Information Technology',
    id: 'c6142b2fc3ddc2107fe22c4bb0013129',
  },
  {
    name: 'International Studies and Social Sciences',
    id: '42142b2fc3ddc2107fe22c4bb0013129',
  },
  {
    name: 'Law',
    id: '8a142b2fc3ddc2107fe22c4bb0013129',
  },
  {
    name: 'Science',
    id: 'c2142b2fc3ddc2107fe22c4bb001312a',
  },
  {
    name: 'Transdisciplinary Innovation',
    id: '4a142b2fc3ddc2107fe22c4bb001312a',
  },
];

async function main() {
  let total = 0;

  for (const area of KNOWN_AREAS) {
    console.log(
      `\n=============================`,
    );

    console.log(
      `AREA: ${area.name}`,
    );

    const items =
      await fetchAllUtsItems({
        contentType: 'course',

        queryParams: [
          {
            queryField:
              'educationalArea',

            queryValue:
              area.id,
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
      });

    console.log(
      `Found: ${items.length}`,
    );

    total +=
      items.length;

    for (const raw of items) {
      const course =
        parseAcademicItem(
          raw,
        );

      console.log(
        `${course.code ?? '-'} - ${
          course.title ??
          course.search_title ??
          '-'
        }`,
      );
    }
  }

  console.log(
    `\nTOTAL COURSE RECORDS: ${total}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});