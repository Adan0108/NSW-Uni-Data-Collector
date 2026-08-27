import {
  parseUtsAccessConditions,
} from '../adapters/uts/uts.access-condition.parser.js';

const SUBJECT_CODES = [
  '70103',
  '70114',
  '81513',
  '43001',
  '23571',
  '41201',
  '41202',

  // Previously fixed cases.
  '31061',
  '22108',
  '23115',
  '22321',
];

async function main() {
  for (
    const subjectCode
    of SUBJECT_CODES
  ) {
    const url =
      `https://studentforms.uts.edu.au/evop/access/search.cfm?subjectcode=${subjectCode}`;

    const response =
      await fetch(
        url,
        {
          headers: {
            Accept:
              'text/html,application/xhtml+xml',

            'User-Agent':
              'Mozilla/5.0',
          },
        },
      );

    if (!response.ok) {
      console.log(
        `${subjectCode} -> HTTP ${response.status}`,
      );

      continue;
    }

    const html =
      await response.text();

    const parsed =
      parseUtsAccessConditions(
        html,
        subjectCode,
      );

    console.log(
      '\n=============================',
    );

    console.log(
      `${parsed.subjectCode} - ${parsed.subjectName ?? '-'}`,
    );

    console.log(
      '=============================',
    );

    console.log(
      `Has conditions: ${parsed.hasConditions}`,
    );

    console.log(
      `Requisite groups: ${parsed.requisiteGroups.length}`,
    );

    for (
      let index = 0;
      index <
      parsed.requisiteGroups.length;
      index++
    ) {
      const group =
        parsed.requisiteGroups[index];

      if (!group) {
        continue;
      }

      console.log(
        `\nGROUP ${index + 1}`,
      );

      console.log(
        `Rule: ${group.rule ?? '-'}`,
      );

      console.log(
        `Items: ${group.items.length}`,
      );

      console.log(
        `IDs: ${
          group.items
            .map(
              (item) =>
                item.id,
            )
            .join(
              ', ',
            ) || '-'
        }`,
      );

      for (
        const item
        of group.items
      ) {
        console.log(
          `${item.id} | ${item.sourceType} | ${item.details}`,
        );
      }
    }

    console.log(
      `\nAnti-requisite rule: ${parsed.antiRequisiteRule ?? '-'}`,
    );

    console.log(
      `Anti-requisites: ${parsed.antiRequisites.length}`,
    );

    for (
      const item
      of parsed.antiRequisites
    ) {
      console.log(
        `${item.id} | ${item.details}`,
      );
    }

    await sleep(
      400,
    );
  }
}

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exit(
      1,
    );
  },
);