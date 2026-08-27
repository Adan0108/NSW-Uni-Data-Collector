import {
  collectUtsMaster,
} from '../adapters/uts/uts.master.collector.js';

async function main() {
  const result =
    await collectUtsMaster(
      '2026',
    );

  console.log(
    '\n=============================',
  );

  console.log(
    'UTS MASTER SUMMARY',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Courses: ${result.courses.length}`,
  );

  console.log(
    `AOS: ${result.aos.length}`,
  );

  console.log(
    `Degree component relationships: ${
      result.degreeComponentReferences.length
    }`,
  );

  console.log(
    `Unresolved AOS relationships: ${
      result.unresolvedAosReferences.length
    }`,
  );

  const unresolvedCodes =
    new Set(
      result.unresolvedAosReferences
        .map(
          (reference) =>
            reference.componentCode,
        )
        .filter(
          (
            code,
          ): code is string =>
            Boolean(code),
        ),
    );

  console.log(
    `Unresolved unique AOS codes: ${unresolvedCodes.size}`,
  );

  if (
    unresolvedCodes.size > 0
  ) {
    console.log(
      '\nUnresolved codes:',
    );

    for (
      const code
      of [...unresolvedCodes]
        .sort()
    ) {
      console.log(
        code,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});