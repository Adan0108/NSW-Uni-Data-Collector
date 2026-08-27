import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

interface EducationalArea {
  id: string;
  name: string;
}

const LEVELS = [
  'major',
  'sub_major',
  'stream',
];

async function main() {
  const areas =
    new Map<
      string,
      EducationalArea
    >();

  for (const level of LEVELS) {
    console.log(
      `\nCollecting areas from: ${level}`,
    );

    const items =
      await fetchAllUtsItems({
        contentType: 'aos',

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
              '817ed8571b875d1002b942e7b04bcb4f',
          },
          {
            queryField:
              'level',
            queryValue:
              level,
          },
        ],
      });

    for (const raw of items) {
      const id =
        raw.educationalArea;

      const parsed =
        parseAcademicItem(raw);

      const name =
        parsed.educational_area;

      if (!id || !name) {
        continue;
      }

      areas.set(
        id,
        {
          id,
          name,
        },
      );
    }
  }

  const sorted =
    [...areas.values()]
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
          ),
      );

  console.log(
    '\n=============================',
  );

  console.log(
    'UTS EDUCATIONAL AREAS',
  );

  console.log(
    '=============================\n',
  );

  for (const area of sorted) {
    console.log(
      `${area.name} = ${area.id}`,
    );
  }

  console.log(
    `\nTotal areas: ${sorted.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});