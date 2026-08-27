import {
  collectAllUsydUnitDetails,
} from './usyd.full-unit-collector';

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'USYD FULL UNIT COLLECTION',
  );

  console.log(
    '================================',
  );

  const result =
    await collectAllUsydUnitDetails({
      concurrency: 4,
      retryCount: 3,
      checkpointEvery: 25,
      retryDelayMs: 1500,
    });

  console.log(
    '================================',
  );

  console.log(
    'FINAL USYD UNIT COLLECTION SUMMARY',
  );

  console.log(
    '================================',
  );

  console.log(
    `Inventory: ${result.inventoryCount}`,
  );

  console.log(
    `Successful: ${result.successfulCount}`,
  );

  console.log(
    `Failures: ${result.failedCount}`,
  );

  console.log(
    `2026 detail pages: ${result.currentYearDetailCount}`,
  );

  console.log(
    `Historical detail pages: ${result.historicalDetailCount}`,
  );

  console.log('');

  console.log(
    `Output: ${result.outputFile}`,
  );

  console.log(
    `Checkpoint: ${result.checkpointFile}`,
  );

  console.log(
    `Failures: ${result.failureFile}`,
  );

  console.log('');

  console.log(
    'FULL UNIT COLLECTION FINISHED',
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