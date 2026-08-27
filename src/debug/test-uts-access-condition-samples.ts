import {
  parseUtsAccessConditions,
} from '../adapters/uts/uts.access-condition.parser.js';

const SUBJECT_CODES = [
  '22108',
  '23115',
  '21212',
  '26134',
  '22321',
  '22319',
  '21504',
];

async function main() {
  for (
    const subjectCode
    of SUBJECT_CODES
  ) {
    console.log(
      '\n=============================',
    );

    console.log(
      `SUBJECT ${subjectCode}`,
    );

    console.log(
      '=============================\n',
    );

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

    console.log(
      `Status: ${response.status}`,
    );

    if (!response.ok) {
      console.log(
        'Request failed.',
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
      `Name: ${parsed.subjectName ?? '-'}`,
    );

    console.log(
      `Has conditions: ${parsed.hasConditions}`,
    );

    console.log(
      `Rule: ${parsed.rule ?? '-'}`,
    );

    console.log(
      `Items: ${parsed.items.length}`,
    );

    for (
      const item
      of parsed.items
    ) {
      console.log(
        `  ${item.id} | ${item.sourceType} | ${item.details}`,
      );

      if (
        item.referencedCodes.length >
        0
      ) {
        console.log(
          `    References: ${item.referencedCodes.join(', ')}`,
        );
      }
    }

    /*
     * Avoid hitting the old UTS service
     * too aggressively.
     */
    await sleep(
      500,
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});