import {
  discoverUsydHandbooks,
} from './usyd.handbook-discovery';

import {
  discoverUsydCourseworkRoot,
} from './usyd.coursework-discovery';

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'USYD COURSE ROOT DISCOVERY',
  );

  console.log(
    '================================',
  );

  const handbooks =
    await discoverUsydHandbooks();

  console.log(
    `Handbooks: ${handbooks.length}`,
  );

  console.log('');

  let pass =
    0;

  let review =
    0;

  for (
    const handbook
    of handbooks
  ) {
    console.log(
      `Checking: ${handbook.name}`,
    );

    try {
      const root =
        await discoverUsydCourseworkRoot(
          handbook,
        );

      if (
        !root
      ) {
        review +=
          1;

        console.log(
          '  REVIEW: No undergraduate/coursework root discovered',
        );

        console.log('');

        continue;
      }

      pass +=
        1;

      console.log(
        '  PASS',
      );

      console.log(
        `  Type: ${root.rootType}`,
      );

      console.log(
        `  URL: ${root.courseworkUrl ?? 'N/A'}`,
      );
    } catch (
      error
    ) {
      review +=
        1;

      console.log(
        '  REVIEW',
      );

      console.log(
        `  ${
          error instanceof Error
            ? error.message
            : String(
                error,
              )
        }`,
      );
    }

    console.log('');
  }

  console.log(
    '================================',
  );

  console.log(
    'SUMMARY',
  );

  console.log(
    '================================',
  );

  console.log(
    `PASS: ${pass}`,
  );

  console.log(
    `REVIEW: ${review}`,
  );
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