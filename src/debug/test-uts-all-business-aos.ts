import {
  collectUtsAos,
} from '../adapters/uts/uts.aos.collector.js';

const BUSINESS_AREA =
  'c6142b2fc3ddc2107fe22c4bb0013127';

const AOS_UNDERGRADUATE =
  '817ed8571b875d1002b942e7b04bcb4f';

async function main() {
  const levels = [
    'major',
    'sub_major',
    'stream',
  ];

  for (const level of levels) {
    console.log(
      `\n=============================`,
    );

    console.log(
      `COLLECTING: ${level}`,
    );

    const items =
      await collectUtsAos({
        educationalAreaId:
          BUSINESS_AREA,

        studyLevelId:
          AOS_UNDERGRADUATE,

        year:
          '2026',

        level,
      });

    console.log(
      `Found: ${items.length}`,
    );

    for (const item of items) {
      console.log(
        `${item.code} - ${item.name} - ${
          item.creditPoints ?? '-'
        } CP - structure: ${
          item.structure
            ? 'yes'
            : 'no'
        }`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});