import {
  callUtsApi,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

async function main() {
  const limit = 10;

  let offset = 0;

  const allItems = [];

  while (true) {
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

        offset,
        limit,
      });

    const items =
      response.data.data;

    allItems.push(
      ...items,
    );

    console.log(
      `Offset ${offset}: ${items.length} records`,
    );

    if (
      items.length < limit
    ) {
      break;
    }

    if (
      items.length === 0
    ) {
      break;
    }

    offset +=
      items.length;
  }

  console.log(
    `\nTOTAL GLOBAL COURSES: ${allItems.length}`,
  );

  const areas =
    new Map<
      string,
      {
        id: string;
        name: string;
        count: number;
      }
    >();

  for (const raw of allItems) {
    const id =
      raw.educationalArea;

    const name =
      raw.educationalAreaDisplay;

    if (id && name) {
      const existing =
        areas.get(id);

      if (existing) {
        existing.count++;
      } else {
        areas.set(id, {
          id,
          name,
          count: 1,
        });
      }
    }
  }

  console.log(
    '\n=============================',
  );

  console.log(
    'COURSE AREAS',
  );

  console.log(
    '=============================\n',
  );

  const sortedAreas =
    [...areas.values()]
      .sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
          ),
      );

  for (const area of sortedAreas) {
    console.log(
      `${area.name} = ${area.id} (${area.count})`,
    );
  }

  console.log(
    `\nTotal course areas: ${sortedAreas.length}`,
  );

  /*
   * Check for duplicate course codes.
   */
  const codeCounts =
    new Map<
      string,
      number
    >();

  for (const raw of allItems) {
    const course =
      parseAcademicItem(
        raw,
      );

    if (!course.code) {
      continue;
    }

    codeCounts.set(
      course.code,
      (
        codeCounts.get(
          course.code,
        ) ?? 0
      ) + 1,
    );
  }

  const duplicates =
    [...codeCounts.entries()]
      .filter(
        ([, count]) =>
          count > 1,
      );

  console.log(
    `Duplicate course codes: ${duplicates.length}`,
  );

  for (
    const [
      code,
      count,
    ]
    of duplicates
  ) {
    console.log(
      `${code}: ${count}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});