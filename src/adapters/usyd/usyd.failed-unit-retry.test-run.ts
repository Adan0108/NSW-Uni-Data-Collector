import fs from 'node:fs/promises';

import {
  retryUsydFailedUnits,
  USYD_FAILED_UNIT_RETRY_PATHS,
} from './usyd.failed-unit-retry';

import type {
  UsydFullUnitCheckpoint,
} from './usyd.full-unit-collector';

interface FailureFileShape {
  failureCount?: number;

  failures: Array<{
    code: string;

    error: string;
  }>;
}

function divider(): void {
  console.log(
    '================================',
  );
}

async function readJson<T>(
  filePath: string,
): Promise<T> {
  const raw =
    await fs.readFile(
      filePath,
      'utf8',
    );

  return JSON.parse(
    raw,
  ) as T;
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD FAILED UNIT RETRY AUDIT',
  );

  divider();

  /**
   * ------------------------------------------------
   * BEFORE STATE
   * ------------------------------------------------
   */

  const beforeCheckpoint =
    await readJson<UsydFullUnitCheckpoint>(
      USYD_FAILED_UNIT_RETRY_PATHS
        .checkpointFile,
    );

  const beforeFailureFile =
    await readJson<FailureFileShape>(
      USYD_FAILED_UNIT_RETRY_PATHS
        .failureFile,
    );

  console.log(
    `Successful before: ${beforeCheckpoint.units.length}`,
  );

  console.log(
    `Failures before: ${beforeFailureFile.failures.length}`,
  );

  console.log(
    `PSYC3014 failed before: ${
      beforeFailureFile.failures.some(
        (failure) =>
          failure.code ===
          'PSYC3014',
      )
        ? 'YES'
        : 'NO'
    }`,
  );

  /**
   * ------------------------------------------------
   * RETRY
   * ------------------------------------------------
   */

  const result =
    await retryUsydFailedUnits();

  /**
   * ------------------------------------------------
   * AFTER STATE
   * ------------------------------------------------
   */

  const afterCheckpoint =
    await readJson<UsydFullUnitCheckpoint>(
      USYD_FAILED_UNIT_RETRY_PATHS
        .checkpointFile,
    );

  const afterFailureFile =
    await readJson<FailureFileShape>(
      USYD_FAILED_UNIT_RETRY_PATHS
        .failureFile,
    );

  divider();

  console.log(
    'RETRY RESULT',
  );

  divider();

  console.log(
    `Inventory: ${result.inventoryCount}`,
  );

  console.log(
    `Attempted: ${result.attemptedCount}`,
  );

  console.log(
    `New successes: ${result.newlySuccessfulCount}`,
  );

  console.log(
    `Successful total: ${result.finalSuccessfulCount}`,
  );

  console.log(
    `Remaining failures: ${result.remainingFailureCount}`,
  );

  console.log(
    `2026 detail pages: ${result.currentYearDetailCount}`,
  );

  console.log(
    `Historical detail pages: ${result.historicalDetailCount}`,
  );

  /**
   * ------------------------------------------------
   * RECOVERED UNITS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'RECOVERED UNITS',
  );

  divider();

  if (
    result.newlySuccessfulUnits.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const unit
      of result.newlySuccessfulUnits
    ) {
      console.log(
        `${unit.code} — ${unit.name} — ${unit.year}`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * PSYC3014 REGRESSION
   * ------------------------------------------------
   */

  const psyc3014 =
    afterCheckpoint.units.find(
      (unit) =>
        unit.code ===
        'PSYC3014',
    );

  const psyc3014StillFailed =
    afterFailureFile.failures.some(
      (failure) =>
        failure.code ===
        'PSYC3014',
    );

  divider();

  console.log(
    'PSYC3014 REGRESSION',
  );

  divider();

  console.log(
    `In successful units: ${
      psyc3014
        ? 'YES'
        : 'NO'
    }`,
  );

  console.log(
    `Still in failures: ${
      psyc3014StillFailed
        ? 'YES'
        : 'NO'
    }`,
  );

  if (
    psyc3014
  ) {
    console.log(
      `Code: ${psyc3014.code}`,
    );

    console.log(
      `Name: ${psyc3014.name}`,
    );

    console.log(
      `Year: ${psyc3014.year}`,
    );

    console.log(
      `CP: ${psyc3014.creditPoints ?? 'NONE'}`,
    );

    console.log(
      `Availability records: ${psyc3014.availabilities.length}`,
    );

    console.log(
      `Learning outcomes: ${psyc3014.learningOutcomes.length}`,
    );
  }

  /**
   * ------------------------------------------------
   * FAILURE CLASSIFICATION
   * ------------------------------------------------
   */

  let pageNotFoundCount =
    0;

  let unavailableCount =
    0;

  let otherCount =
    0;

  for (
    const failure
    of afterFailureFile.failures
  ) {
    const lower =
      failure.error
        .toLowerCase();

    if (
      lower.includes(
        'page not found',
      )
    ) {
      pageNotFoundCount +=
        1;

      continue;
    }

    if (
      lower.includes(
        'unit of study is not available',
      ) ||
      lower.includes(
        'may be under development',
      )
    ) {
      unavailableCount +=
        1;

      continue;
    }

    otherCount +=
      1;
  }

  divider();

  console.log(
    'REMAINING FAILURE CLASSIFICATION',
  );

  divider();

  console.log(
    `PAGE_NOT_FOUND: ${pageNotFoundCount}`,
  );

  console.log(
    `NOT_AVAILABLE_OR_UNDER_DEVELOPMENT: ${unavailableCount}`,
  );

  console.log(
    `OTHER: ${otherCount}`,
  );

  /**
   * ------------------------------------------------
   * STRUCTURE
   * ------------------------------------------------
   */

  const successfulCodes =
    afterCheckpoint.units.map(
      (unit) =>
        unit.code,
    );

  const failureCodes =
    afterFailureFile.failures.map(
      (failure) =>
        failure.code,
    );

  const duplicateSuccessful =
    successfulCodes.length -
    new Set(
      successfulCodes,
    ).size;

  const duplicateFailures =
    failureCodes.length -
    new Set(
      failureCodes,
    ).size;

  const successfulSet =
    new Set(
      successfulCodes,
    );

  const overlap =
    failureCodes.filter(
      (code) =>
        successfulSet.has(
          code,
        ),
    );

  const totalCoverage =
    successfulCodes.length +
    failureCodes.length;

  divider();

  console.log(
    'STRUCTURAL VALIDATION',
  );

  divider();

  console.log(
    `Successful units: ${successfulCodes.length}`,
  );

  console.log(
    `Failures: ${failureCodes.length}`,
  );

  console.log(
    `Total coverage: ${totalCoverage}`,
  );

  console.log(
    `Duplicate successful codes: ${duplicateSuccessful}`,
  );

  console.log(
    `Duplicate failure codes: ${duplicateFailures}`,
  );

  console.log(
    `Success/failure overlap: ${overlap.length}`,
  );

  /**
   * ------------------------------------------------
   * EXPECTED RESULT
   * ------------------------------------------------
   *
   * Based on the previous audit:
   *
   * Before:
   *
   * 3010 success
   * 112 failures
   *
   * Failure categories:
   *
   * 107 PAGE_NOT_FOUND
   * 4 NOT_AVAILABLE_OR_UNDER_DEVELOPMENT
   * 1 PSYC3014 parser/year problem
   *
   * PSYC3014 now parses correctly.
   *
   * Therefore expected:
   *
   * 3011 success
   * 111 failures
   *
   * Remaining:
   *
   * 107 page not found
   * 4 unavailable
   * 0 other
   */

  const psycPass =
    psyc3014 !==
      undefined &&
    psyc3014.year ===
      2026 &&
    !psyc3014StillFailed;

  const coveragePass =
    totalCoverage ===
    3122;

  const expectedFinalCounts =
    afterCheckpoint.units.length ===
      3011 &&
    afterFailureFile.failures.length ===
      111;

  const expectedFailureClasses =
    pageNotFoundCount ===
      107 &&
    unavailableCount ===
      4 &&
    otherCount ===
      0;

  const hardFailure =
    result.inventoryCount !==
      3122 ||
    !psycPass ||
    !coveragePass ||
    duplicateSuccessful >
      0 ||
    duplicateFailures >
      0 ||
    overlap.length >
      0 ||
    !expectedFinalCounts ||
    !expectedFailureClasses;

  divider();

  console.log(
    'FINAL FAILED UNIT RETRY AUDIT',
  );

  divider();

  console.log(
    `Inventory: ${result.inventoryCount}`,
  );

  console.log(
    `Successful: ${afterCheckpoint.units.length}`,
  );

  console.log(
    `Unresolved: ${afterFailureFile.failures.length}`,
  );

  console.log(
    `PSYC3014 recovered: ${
      psycPass
        ? 'YES'
        : 'NO'
    }`,
  );

  console.log(
    `Total coverage: ${totalCoverage}/3122`,
  );

  console.log(
    `Other unresolved errors: ${otherCount}`,
  );

  console.log('');

  console.log(
    `RESULT: ${
      hardFailure
        ? 'FAIL'
        : 'PASS'
    }`,
  );

  if (
    !hardFailure
  ) {
    console.log(
      'UNIT DETAIL DATASET: CLEAN',
    );

    console.log(
      'SUCCESSFUL DETAIL RECORDS: 3011',
    );

    console.log(
      'PRESERVED UNRESOLVED REFERENCES: 111',
    );

    console.log(
      'UNIT DETAIL STAGE: COMPLETE',
    );
  }

  if (
    hardFailure
  ) {
    process.exitCode =
      1;
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