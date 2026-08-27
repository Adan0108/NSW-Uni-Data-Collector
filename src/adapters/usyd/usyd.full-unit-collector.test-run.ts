import fs from 'node:fs/promises';

import {
  collectAllUsydUnitDetails,
  USYD_FULL_UNIT_PATHS,
  type UsydFullUnitCheckpoint,
  type UsydFullUnitCollectionResult,
} from './usyd.full-unit-collector';

/**
 * ------------------------------------------------
 * USYD FULL UNIT COLLECTOR CHECKPOINT AUDIT
 * ------------------------------------------------
 *
 * IMPORTANT
 *
 * This is NOT the final 3122-unit run yet.
 *
 * We first fetch only 50 remaining units.
 *
 * This proves:
 *
 * - checkpoint file works
 * - collected units are preserved
 * - retries work
 * - historical years are preserved
 * - rerunning skips successful units
 * - JSON output is valid
 *
 * Once this passes, remove the limit in the production
 * run.
 */

function divider(): void {
  console.log(
    '================================',
  );
}

async function readCheckpoint():
Promise<UsydFullUnitCheckpoint> {
  const raw =
    await fs.readFile(
      USYD_FULL_UNIT_PATHS.checkpointFile,
      'utf8',
    );

  return JSON.parse(
    raw,
  ) as UsydFullUnitCheckpoint;
}

function validateResult(
  result:
    UsydFullUnitCollectionResult,
): string[] {
  const errors:
    string[] =
    [];

  /**
   * Current validated inventory baseline.
   */
  if (
    result.inventoryCount !==
    3122
  ) {
    errors.push(
      `Expected inventory count 3122, got ${result.inventoryCount}.`,
    );
  }

  const unitCodes =
    result.units.map(
      (unit) =>
        unit.code,
    );

  const uniqueUnitCodes =
    new Set(
      unitCodes,
    );

  if (
    uniqueUnitCodes.size !==
    unitCodes.length
  ) {
    errors.push(
      'Final result contains duplicate unit codes.',
    );
  }

  for (
    const unit
    of result.units
  ) {
    if (
      !/^[A-Z]{4}\d{4}$/.test(
        unit.code,
      )
    ) {
      errors.push(
        `Invalid unit code: ${unit.code}`,
      );
    }

    if (
      !unit.name.trim()
    ) {
      errors.push(
        `${unit.code} has empty name.`,
      );
    }

    if (
      !Number.isInteger(
        unit.year,
      ) ||
      unit.year <
        1900 ||
      unit.year >
        2026
    ) {
      errors.push(
        `${unit.code} has suspicious year ${unit.year}.`,
      );
    }

    if (
      unit.creditPoints !==
        null &&
      (
        !Number.isFinite(
          unit.creditPoints,
        ) ||
        unit.creditPoints <
          0
      )
    ) {
      errors.push(
        `${unit.code} has invalid credit points ${unit.creditPoints}.`,
      );
    }

    if (
      unit.sourceUrl !==
      `https://www.sydney.edu.au/units/${unit.code}`
    ) {
      errors.push(
        `${unit.code} source URL mismatch: ${unit.sourceUrl}`,
      );
    }
  }

  return errors;
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD FULL UNIT COLLECTOR CHECKPOINT AUDIT',
  );

  divider();

  /**
   * ------------------------------------------------
   * FIRST LIMITED RUN
   * ------------------------------------------------
   *
   * If a checkpoint already exists, this fetches the next
   * 50 unfinished units instead.
   */

  const beforeCheckpoint =
    await fs
      .readFile(
        USYD_FULL_UNIT_PATHS.checkpointFile,
        'utf8',
      )
      .then(
        (
          raw,
        ) =>
          JSON.parse(
            raw,
          ) as UsydFullUnitCheckpoint,
      )
      .catch(
        () =>
          null,
      );

  const beforeSuccessCount =
    beforeCheckpoint
      ?.units.length ??
    0;

  console.log(
    `Successful units before run: ${beforeSuccessCount}`,
  );

  const result =
    await collectAllUsydUnitDetails(
      {
        limit:
          50,

        concurrency:
          4,

        retryCount:
          3,

        checkpointEvery:
          10,

        retryDelayMs:
          1000,
      },
    );

  /**
   * ------------------------------------------------
   * CHECKPOINT READBACK
   * ------------------------------------------------
   */

  const checkpoint =
    await readCheckpoint();

  divider();

  console.log(
    'CHECKPOINT SUMMARY',
  );

  divider();

  console.log(
    `Inventory count: ${checkpoint.inventoryCount}`,
  );

  console.log(
    `Successful checkpoint units: ${checkpoint.units.length}`,
  );

  console.log(
    `Completed codes: ${checkpoint.completedCodes.length}`,
  );

  console.log(
    `Unresolved failures: ${checkpoint.failures.length}`,
  );

  console.log(
    `Started: ${checkpoint.startedAt}`,
  );

  console.log(
    `Updated: ${checkpoint.updatedAt}`,
  );

  /**
   * ------------------------------------------------
   * RESUME CHECK
   * ------------------------------------------------
   */

  const newlySuccessful =
    checkpoint.units.length -
    beforeSuccessCount;

  divider();

  console.log(
    'RESUME / PROGRESS CHECK',
  );

  divider();

  console.log(
    `Before run: ${beforeSuccessCount}`,
  );

  console.log(
    `After run: ${checkpoint.units.length}`,
  );

  console.log(
    `New successful units: ${newlySuccessful}`,
  );

  console.log(
    `Remaining inventory: ${
      checkpoint.inventoryCount -
      checkpoint.units.length
    }`,
  );

  /**
   * ------------------------------------------------
   * DUPLICATE CHECK
   * ------------------------------------------------
   */

  const checkpointCodes =
    checkpoint.units.map(
      (unit) =>
        unit.code,
    );

  const duplicateCount =
    checkpointCodes.length -
    new Set(
      checkpointCodes,
    ).size;

  const completedCodeDuplicateCount =
    checkpoint.completedCodes.length -
    new Set(
      checkpoint.completedCodes,
    ).size;

  divider();

  console.log(
    'CHECKPOINT STRUCTURE CHECK',
  );

  divider();

  console.log(
    `Duplicate units: ${duplicateCount}`,
  );

  console.log(
    `Duplicate completed codes: ${completedCodeDuplicateCount}`,
  );

  console.log(
    `Units vs completed codes match: ${
      checkpoint.units.length ===
      checkpoint.completedCodes.length
        ? 'YES'
        : 'NO'
    }`,
  );

  /**
   * ------------------------------------------------
   * YEAR AUDIT
   * ------------------------------------------------
   */

  const currentYearUnits =
    checkpoint.units.filter(
      (unit) =>
        unit.year ===
        2026,
    );

  const historicalUnits =
    checkpoint.units.filter(
      (unit) =>
        unit.year <
        2026,
    );

  const futureUnits =
    checkpoint.units.filter(
      (unit) =>
        unit.year >
        2026,
    );

  divider();

  console.log(
    'DETAIL YEAR AUDIT',
  );

  divider();

  console.log(
    `2026 detail pages: ${currentYearUnits.length}`,
  );

  console.log(
    `Historical detail pages: ${historicalUnits.length}`,
  );

  console.log(
    `Future detail pages: ${futureUnits.length}`,
  );

  if (
    historicalUnits.length >
    0
  ) {
    console.log('');

    console.log(
      'HISTORICAL DETAIL SAMPLE',
    );

    for (
      const unit
      of historicalUnits.slice(
        0,
        20,
      )
    ) {
      console.log(
        `  ${unit.code} — ${unit.year}`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * ACCESS CONDITION COUNTS
   * ------------------------------------------------
   */

  const withPrerequisite =
    checkpoint.units.filter(
      (unit) =>
        unit.accessConditions.prerequisite !==
        null,
    ).length;

  const withCorequisite =
    checkpoint.units.filter(
      (unit) =>
        unit.accessConditions.corequisite !==
        null,
    ).length;

  const withProhibition =
    checkpoint.units.filter(
      (unit) =>
        unit.accessConditions.prohibition !==
        null,
    ).length;

  const withAssumedKnowledge =
    checkpoint.units.filter(
      (unit) =>
        unit.accessConditions.assumedKnowledge !==
        null,
    ).length;

  divider();

  console.log(
    'RAW ACCESS CONDITION COVERAGE',
  );

  divider();

  console.log(
    `With prerequisite: ${withPrerequisite}`,
  );

  console.log(
    `With corequisite: ${withCorequisite}`,
  );

  console.log(
    `With prohibition: ${withProhibition}`,
  );

  console.log(
    `With assumed knowledge: ${withAssumedKnowledge}`,
  );

  /**
   * ------------------------------------------------
   * OTHER FIELD COVERAGE
   * ------------------------------------------------
   */

  const missingNames =
    checkpoint.units.filter(
      (unit) =>
        !unit.name.trim(),
    );

  const missingCreditPoints =
    checkpoint.units.filter(
      (unit) =>
        unit.creditPoints ===
        null,
    );

  const noAvailability =
    checkpoint.units.filter(
      (unit) =>
        unit.availabilities.length ===
        0,
    );

  const noLearningOutcomes =
    checkpoint.units.filter(
      (unit) =>
        unit.learningOutcomes.length ===
        0,
    );

  divider();

  console.log(
    'FIELD COVERAGE',
  );

  divider();

  console.log(
    `Missing names: ${missingNames.length}`,
  );

  console.log(
    `Missing credit points: ${missingCreditPoints.length}`,
  );

  console.log(
    `No availability records: ${noAvailability.length}`,
  );

  console.log(
    `No learning outcomes: ${noLearningOutcomes.length}`,
  );

  /**
   * ------------------------------------------------
   * FINAL OUTPUT VALIDATION
   * ------------------------------------------------
   */

  const validationErrors =
    validateResult(
      result,
    );

  divider();

  console.log(
    'VALIDATION ERRORS',
  );

  divider();

  if (
    validationErrors.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const error
      of validationErrors.slice(
        0,
        100,
      )
    ) {
      console.log(
        `- ${error}`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * FILE OUTPUT
   * ------------------------------------------------
   */

  divider();

  console.log(
    'OUTPUT FILES',
  );

  divider();

  console.log(
    `Checkpoint: ${result.checkpointFile}`,
  );

  console.log(
    `Final units: ${result.outputFile}`,
  );

  console.log(
    `Failures: ${result.failureFile}`,
  );

  /**
   * ------------------------------------------------
   * TEST RESULT
   * ------------------------------------------------
   *
   * We do NOT require exactly 50 new successful units.
   *
   * A genuine unreachable/historical unit could fail and
   * should remain visible in the failure file.
   *
   * But for this checkpoint smoke test, at least one unit
   * must progress successfully.
   */

  const checkpointConsistencyPass =
    checkpoint.units.length ===
      checkpoint.completedCodes.length;

  const progressPass =
    (
      beforeSuccessCount >=
      checkpoint.inventoryCount
    ) ||
    newlySuccessful >
      0;

  const hardFailure =
    checkpoint.inventoryCount !==
      3122 ||
    duplicateCount >
      0 ||
    completedCodeDuplicateCount >
      0 ||
    !checkpointConsistencyPass ||
    futureUnits.length >
      0 ||
    validationErrors.length >
      0 ||
    !progressPass;

  divider();

  console.log(
    'FINAL FULL UNIT CHECKPOINT AUDIT',
  );

  divider();

  console.log(
    `Inventory: ${checkpoint.inventoryCount}`,
  );

  console.log(
    `Successful stored units: ${checkpoint.units.length}`,
  );

  console.log(
    `Unresolved failures: ${checkpoint.failures.length}`,
  );

  console.log(
    `New units this run: ${newlySuccessful}`,
  );

  console.log(
    `Historical detail pages: ${historicalUnits.length}`,
  );

  console.log(
    `Duplicate units: ${duplicateCount}`,
  );

  console.log(
    `Validation errors: ${validationErrors.length}`,
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
      'CHECKPOINT STATUS: CLEAN',
    );

    console.log(
      'RESUME STATUS: READY',
    );

    console.log(
      'FULL COLLECTION STATUS: READY TO RUN',
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