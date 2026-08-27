import {
  discoverUsydHandbooks,
} from './usyd.handbook-discovery';

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'USYD HANDBOOK DISCOVERY',
  );

  console.log(
    '================================',
  );

  const handbooks =
    await discoverUsydHandbooks();

  console.log(
    `Discovered: ${handbooks.length}`,
  );

  console.log('');

  for (
    let index = 0;
    index <
    handbooks.length;
    index += 1
  ) {
    const handbook =
      handbooks[
        index
      ];

    console.log(
      `${index + 1}. ${handbook.name}`,
    );

    console.log(
      `   Category: ${handbook.category}`,
    );

    console.log(
      `   URL: ${handbook.url}`,
    );

    console.log('');
  }
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);