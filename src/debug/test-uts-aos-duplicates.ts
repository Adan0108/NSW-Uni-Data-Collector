import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

const UTS_AOS_STUDY_LEVEL =
  '817ed8571b875d1002b942e7b04bcb4f';

const LEVELS = [
  'major',
  'sub_major',
  'stream',
];

interface AosRecord {
  code: string;
  level: string;
  name: string;
}

async function main() {
  const records:
    AosRecord[] = [];

  for (const level of LEVELS) {
    console.log(
      `\nCollecting ${level}...`,
    );

    const items =
      await fetchAllUtsItems({
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
              'studyLevel',
            queryValue:
              UTS_AOS_STUDY_LEVEL,
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
      const item =
        parseAcademicItem(
          raw,
        );

      records.push({
        code:
          item.code ?? '',

        level,

        name:
          item.search_title ??
          item.title ??
          '',
      });
    }
  }

  const byCode =
    new Map<
      string,
      AosRecord[]
    >();

  for (const record of records) {
    if (!record.code) {
      continue;
    }

    const existing =
      byCode.get(
        record.code,
      ) ?? [];

    existing.push(
      record,
    );

    byCode.set(
      record.code,
      existing,
    );
  }

  const duplicates =
    [...byCode.entries()]
      .filter(
        ([, items]) =>
          items.length > 1,
      );

  console.log(
    '\n=============================',
  );

  console.log(
    'UTS AOS DUPLICATE CHECK',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Raw records: ${records.length}`,
  );

  console.log(
    `Unique codes: ${byCode.size}`,
  );

  console.log(
    `Duplicate codes: ${duplicates.length}`,
  );

  for (
    const [
      code,
      items,
    ]
    of duplicates
  ) {
    console.log(
      `\n${code}`,
    );

    for (const item of items) {
      console.log(
        `  ${item.level} -> ${item.name}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});