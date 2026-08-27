import {
  parseUtsAccessConditions,
} from '../adapters/uts/uts.access-condition.parser.js';

async function main() {
  const subjectCode =
    '22321';

  const url =
    `https://studentforms.uts.edu.au/evop/access/search.cfm?subjectcode=${subjectCode}`;

  console.log(
    `Fetching access conditions for ${subjectCode}...`,
  );

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
    throw new Error(
      `Access conditions request failed: ${response.status}`,
    );
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
    'PARSED ACCESS CONDITIONS',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Subject: ${parsed.subjectCode} - ${parsed.subjectName ?? '-'}`,
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
      `\n${item.id}`,
    );

    console.log(
      `  Type: ${item.sourceType}`,
    );

    console.log(
      `  Details: ${item.details}`,
    );

    console.log(
      `  References: ${
        item.referencedCodes.join(
          ', ',
        ) || '-'
      }`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});