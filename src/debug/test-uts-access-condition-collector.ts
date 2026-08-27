import {
  collectUtsAccessConditions,
} from '../adapters/uts/uts.access-condition.collector.js';

async function main() {
  const subjectCodes = [
    '22108',
    '23115',
    '21212',
    '26134',
    '22321',
    '22319',
    '21504',
    '25556',
    '31061',
    '22581',
  ];

  const result =
    await collectUtsAccessConditions(
      subjectCodes,
      '2026',
    );

  console.log(
    '\n=============================',
  );

  console.log(
    'ACCESS CONDITION COLLECTOR TEST',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Requested: ${subjectCodes.length}`,
  );

  console.log(
    `Collected: ${result.records.length}`,
  );

  console.log(
    `Failures: ${result.failures.length}`,
  );

  console.log(
    `With conditions: ${
      result.records.filter(
        (record) =>
          record.hasConditions,
      ).length
    }`,
  );

  console.log(
    `Without conditions: ${
      result.records.filter(
        (record) =>
          !record.hasConditions,
      ).length
    }`,
  );

  console.log(
    '\nSubjects:',
  );

  for (const record of result.records) {
    console.log(
      `${record.subjectCode} -> ${
        record.hasConditions
          ? `${record.items.length} conditions`
          : 'no conditions'
      }`,
    );
  }

  if (
    result.failures.length > 0
  ) {
    console.log(
      '\nFailures:',
    );

    for (
      const failure
      of result.failures
    ) {
      console.log(
        `${failure.subjectCode} -> ${failure.error}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});