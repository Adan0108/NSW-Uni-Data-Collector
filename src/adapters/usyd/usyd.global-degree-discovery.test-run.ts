import {
  discoverUsydUndergraduateDegrees,
} from './usyd.global-degree-discovery';

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'USYD GLOBAL DEGREE DISCOVERY',
  );

  console.log(
    '================================',
  );

  const degrees =
    await discoverUsydUndergraduateDegrees();

  console.log(
    `Unique degrees: ${degrees.length}`,
  );

  console.log('');

  const counts =
    new Map<
      string,
      number
    >();

  for (
    let index = 0;
    index <
    degrees.length;
    index += 1
  ) {
    const degree =
      degrees[
        index
      ];

    counts.set(
      degree.handbookCategory,
      (
        counts.get(
          degree.handbookCategory,
        ) ??
        0
      ) +
        1,
    );

    console.log(
      `${index + 1}. ${degree.name}`,
    );

    console.log(
      `   Faculty: ${degree.handbookCategory}`,
    );

    console.log(
      `   URL: ${degree.overviewUrl}`,
    );

    console.log('');
  }

  console.log(
    '================================',
  );

  console.log(
    'BY HANDBOOK',
  );

  console.log(
    '================================',
  );

  for (
    const [
      category,
      count,
    ]
    of counts
  ) {
    console.log(
      `${category}: ${count}`,
    );
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