import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

async function main() {
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
      ],
    });

  console.log(
    `\nTOTAL AOS WITHOUT LEVEL FILTER: ${items.length}`,
  );

  const levels =
    new Map<
      string,
      number
    >();

  const types =
    new Map<
      string,
      number
    >();

  const codes =
    new Set<string>();

  for (const raw of items) {
    const parsed =
      parseAcademicItem(
        raw,
      );

    if (parsed.code) {
      codes.add(
        parsed.code,
      );
    }

    const level =
      String(
        (
          raw as {
            level?: unknown;
          }
        ).level ?? 'UNKNOWN',
      );

    levels.set(
      level,
      (
        levels.get(
          level,
        ) ?? 0
      ) + 1,
    );

    const type =
      parsed.academic_item_type ??
      'UNKNOWN';

    types.set(
      type,
      (
        types.get(
          type,
        ) ?? 0
      ) + 1,
    );
  }

  console.log(
    `Unique codes: ${codes.size}`,
  );

  console.log(
    '\n=============================',
  );

  console.log(
    'LEVELS',
  );

  console.log(
    '=============================\n',
  );

  for (
    const [level, count]
    of [...levels.entries()]
      .sort()
  ) {
    console.log(
      `${level}: ${count}`,
    );
  }

  console.log(
    '\n=============================',
  );

  console.log(
    'ACADEMIC ITEM TYPES',
  );

  console.log(
    '=============================\n',
  );

  for (
    const [type, count]
    of [...types.entries()]
      .sort()
  ) {
    console.log(
      `${type}: ${count}`,
    );
  }

  /*
   * Check the specific codes currently
   * reported as missing.
   */
  const missingCodes = [
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

  console.log(
    '\n=============================',
  );

  console.log(
    'MISSING CODE CHECK',
  );

  console.log(
    '=============================\n',
  );

  for (const code of missingCodes) {
    console.log(
      `${code}: ${
        codes.has(code)
          ? 'FOUND'
          : 'NOT FOUND'
      }`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});