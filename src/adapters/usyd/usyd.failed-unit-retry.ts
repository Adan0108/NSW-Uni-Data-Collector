import fs from 'node:fs/promises';
import path from 'node:path';

import {
  fetchUsydUnit,
} from './usyd.unit-parser';

import type {
  UsydUnit,
} from './usyd.types';

import type {
  UsydFullUnitCheckpoint,
  UsydFullUnitFailure,
} from './usyd.full-unit-collector';

/**
 * ------------------------------------------------
 * USYD FAILED UNIT RETRY
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * Retry ONLY unit-detail failures from:
 *
 * data/normalized/usyd/2026/usyd-units.failures.json
 *
 * We do NOT rerun the entire 3122-unit collector.
 *
 * Current expected state before this retry:
 *
 * 3010 successful
 * 112 unresolved
 *
 * PSYC3014 has now been fixed in the parser and should
 * succeed.
 *
 * Expected state after retry:
 *
 * 3011 successful
 * 111 unresolved
 *
 * The remaining 111 should be genuine missing/unavailable
 * USYD unit pages.
 */

const HANDBOOK_YEAR =
  2026;

const OUTPUT_DIRECTORY =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(HANDBOOK_YEAR),
  );

const CHECKPOINT_FILE =
  path.join(
    OUTPUT_DIRECTORY,
    'usyd-units.checkpoint.json',
  );

const FINAL_OUTPUT_FILE =
  path.join(
    OUTPUT_DIRECTORY,
    'usyd-units.json',
  );

const FAILURE_FILE =
  path.join(
    OUTPUT_DIRECTORY,
    'usyd-units.failures.json',
  );

/**
 * ------------------------------------------------
 * TYPES
 * ------------------------------------------------
 */

interface FailureFileShape {
  university?: string;

  handbookYear?: number;

  generatedAt?: string;

  inventoryCount?: number;

  failureCount?: number;

  failures: UsydFullUnitFailure[];
}

interface ExistingFinalOutput {
  university?: string;

  handbookYear?: number;

  collectedAt?: string;

  inventoryCount?: number;

  successfulCount?: number;

  failedCount?: number;

  historicalDetailCount?: number;

  currentYearDetailCount?: number;

  units?: UsydUnit[];

  failures?: UsydFullUnitFailure[];

  outputFile?: string;

  checkpointFile?: string;

  failureFile?: string;
}

export interface UsydFailedUnitRetryResult {
  university: 'USYD';

  handbookYear: number;

  retriedAt: string;

  inventoryCount: number;

  previousSuccessfulCount: number;

  previousFailureCount: number;

  attemptedCount: number;

  newlySuccessfulCount: number;

  remainingFailureCount: number;

  finalSuccessfulCount: number;

  currentYearDetailCount: number;

  historicalDetailCount: number;

  newlySuccessfulUnits: UsydUnit[];

  remainingFailures: UsydFullUnitFailure[];

  checkpointFile: string;

  outputFile: string;

  failureFile: string;
}

/**
 * ------------------------------------------------
 * HELPERS
 * ------------------------------------------------
 */

function errorMessage(
  error: unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return String(error);
}

function normalizeUnits(
  units: UsydUnit[],
): UsydUnit[] {
  const map =
    new Map<
      string,
      UsydUnit
    >();

  for (
    const unit
    of units
  ) {
    map.set(
      unit.code,
      unit,
    );
  }

  return [
    ...map.values(),
  ].sort(
    (
      left,
      right,
    ) =>
      left.code.localeCompare(
        right.code,
      ),
  );
}

function normalizeFailures(
  failures: UsydFullUnitFailure[],
): UsydFullUnitFailure[] {
  const map =
    new Map<
      string,
      UsydFullUnitFailure
    >();

  for (
    const failure
    of failures
  ) {
    map.set(
      failure.code,
      failure,
    );
  }

  return [
    ...map.values(),
  ].sort(
    (
      left,
      right,
    ) =>
      left.code.localeCompare(
        right.code,
      ),
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

/**
 * ------------------------------------------------
 * ATOMIC JSON WRITE
 * ------------------------------------------------
 *
 * Write to a temporary file first, then rename.
 *
 * This protects the checkpoint/output from being partially
 * written if the process stops during fs.writeFile().
 */

async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  const temporaryPath =
    `${filePath}.tmp`;

  await fs.writeFile(
    temporaryPath,
    JSON.stringify(
      value,
      null,
      2,
    ),
    'utf8',
  );

  /**
   * Windows rename can fail if destination already exists.
   *
   * Remove the old destination first.
   */
  await fs.rm(
    filePath,
    {
      force: true,
    },
  );

  await fs.rename(
    temporaryPath,
    filePath,
  );
}

/**
 * ------------------------------------------------
 * FETCH ONE FAILED UNIT
 * ------------------------------------------------
 *
 * We only attempt once here.
 *
 * The original full collector already retried these units
 * three times.
 *
 * The purpose of this runner is mainly to recover parser
 * fixes such as PSYC3014.
 */

async function retryOneFailure(
  failure: UsydFullUnitFailure,
): Promise<
  | {
      ok: true;

      unit: UsydUnit;
    }
  | {
      ok: false;

      failure: UsydFullUnitFailure;
    }
> {
  try {
    const unit =
      await fetchUsydUnit(
        failure.code,
      );

    if (
      unit.code !==
      failure.code
    ) {
      throw new Error(
        `Unit code mismatch. Requested ${failure.code}, received ${unit.code}.`,
      );
    }

    return {
      ok: true,

      unit,
    };
  } catch (
    error
  ) {
    return {
      ok: false,

      failure: {
        ...failure,

        /**
         * This is one additional retry after the original
         * full collector attempts.
         */
        attempts:
          failure.attempts +
          1,

        error:
          errorMessage(
            error,
          ),

        lastAttemptAt:
          new Date()
            .toISOString(),
      },
    };
  }
}

/**
 * ------------------------------------------------
 * PUBLIC RETRY FUNCTION
 * ------------------------------------------------
 */

export async function retryUsydFailedUnits():
Promise<UsydFailedUnitRetryResult> {
  console.log(
    '[USYD failed-unit retry] loading checkpoint...',
  );

  const checkpoint =
    await readJson<UsydFullUnitCheckpoint>(
      CHECKPOINT_FILE,
    );

  console.log(
    '[USYD failed-unit retry] loading failure file...',
  );

  const failureFile =
    await readJson<FailureFileShape>(
      FAILURE_FILE,
    );

  const existingFinal =
    await readJson<ExistingFinalOutput>(
      FINAL_OUTPUT_FILE,
    );

  if (
    checkpoint.university !==
    'USYD'
  ) {
    throw new Error(
      'Checkpoint is not a USYD checkpoint.',
    );
  }

  if (
    checkpoint.handbookYear !==
    HANDBOOK_YEAR
  ) {
    throw new Error(
      `Expected handbook year ${HANDBOOK_YEAR}, got ${checkpoint.handbookYear}.`,
    );
  }

  if (
    !Array.isArray(
      checkpoint.units,
    )
  ) {
    throw new Error(
      'Checkpoint does not contain a units array.',
    );
  }

  if (
    !Array.isArray(
      failureFile.failures,
    )
  ) {
    throw new Error(
      'Failure file does not contain a failures array.',
    );
  }

  const previousSuccessfulCount =
    checkpoint.units.length;

  const previousFailureCount =
    failureFile.failures.length;

  const inventoryCount =
    checkpoint.inventoryCount;

  console.log(
    `[USYD failed-unit retry] successful before retry: ${previousSuccessfulCount}`,
  );

  console.log(
    `[USYD failed-unit retry] unresolved before retry: ${previousFailureCount}`,
  );

  console.log(
    `[USYD failed-unit retry] inventory: ${inventoryCount}`,
  );

  /**
   * ------------------------------------------------
   * SAFETY CHECK
   * ------------------------------------------------
   */

  if (
    previousSuccessfulCount +
      previousFailureCount !==
    inventoryCount
  ) {
    throw new Error(
      `Checkpoint/failure totals do not match inventory. ` +
      `${previousSuccessfulCount} successful + ` +
      `${previousFailureCount} failures != ` +
      `${inventoryCount} inventory.`,
    );
  }

  const existingSuccessfulCodes =
    new Set(
      checkpoint.units.map(
        (unit) =>
          unit.code,
      ),
    );

  const failuresToRetry =
    failureFile.failures.filter(
      (failure) =>
        !existingSuccessfulCodes.has(
          failure.code,
        ),
    );

  console.log(
    `[USYD failed-unit retry] retrying ${failuresToRetry.length} failed codes...`,
  );

  /**
   * ------------------------------------------------
   * RETRY
   * ------------------------------------------------
   *
   * Keep concurrency conservative.
   */

  const concurrency =
    4;

  const newlySuccessfulUnits:
    UsydUnit[] =
    [];

  const remainingFailures:
    UsydFullUnitFailure[] =
    [];

  for (
    let start = 0;
    start <
    failuresToRetry.length;
    start +=
    concurrency
  ) {
    const batch =
      failuresToRetry.slice(
        start,
        start +
          concurrency,
      );

    console.log(
      `[USYD failed-unit retry] ` +
      `${start + 1}-${Math.min(
        start + batch.length,
        failuresToRetry.length,
      )}/${failuresToRetry.length}`,
    );

    const results =
      await Promise.all(
        batch.map(
          retryOneFailure,
        ),
      );

    for (
      const result
      of results
    ) {
      if (
        result.ok
      ) {
        console.log(
          `[USYD failed-unit retry] RECOVERED ${result.unit.code}`,
        );

        newlySuccessfulUnits.push(
          result.unit,
        );
      } else {
        remainingFailures.push(
          result.failure,
        );
      }
    }
  }

  /**
   * ------------------------------------------------
   * MERGE SUCCESSFUL UNITS
   * ------------------------------------------------
   */

  const mergedUnits =
    normalizeUnits([
      ...checkpoint.units,
      ...newlySuccessfulUnits,
    ]);

  const normalizedRemainingFailures =
    normalizeFailures(
      remainingFailures,
    );

  const completedCodes =
    mergedUnits
      .map(
        (unit) =>
          unit.code,
      )
      .sort();

  /**
   * ------------------------------------------------
   * FINAL CONSISTENCY CHECK
   * ------------------------------------------------
   */

  if (
    mergedUnits.length +
      normalizedRemainingFailures.length !==
    inventoryCount
  ) {
    throw new Error(
      `Retry result does not match inventory. ` +
      `${mergedUnits.length} successful + ` +
      `${normalizedRemainingFailures.length} unresolved != ` +
      `${inventoryCount}.`,
    );
  }

  const duplicateSuccessfulCodes =
    mergedUnits.length -
    new Set(
      mergedUnits.map(
        (unit) =>
          unit.code,
      ),
    ).size;

  const duplicateFailureCodes =
    normalizedRemainingFailures.length -
    new Set(
      normalizedRemainingFailures.map(
        (failure) =>
          failure.code,
      ),
    ).size;

  if (
    duplicateSuccessfulCodes >
    0
  ) {
    throw new Error(
      `Retry produced ${duplicateSuccessfulCodes} duplicate successful codes.`,
    );
  }

  if (
    duplicateFailureCodes >
    0
  ) {
    throw new Error(
      `Retry produced ${duplicateFailureCodes} duplicate failure codes.`,
    );
  }

  const successfulCodeSet =
    new Set(
      completedCodes,
    );

  const overlapBetweenSuccessAndFailure =
    normalizedRemainingFailures.filter(
      (failure) =>
        successfulCodeSet.has(
          failure.code,
        ),
    );

  if (
    overlapBetweenSuccessAndFailure.length >
    0
  ) {
    throw new Error(
      `Successful and failure sets overlap: ${overlapBetweenSuccessAndFailure
        .map(
          (failure) =>
            failure.code,
        )
        .join(', ')}`,
    );
  }

  /**
   * ------------------------------------------------
   * YEAR COUNTS
   * ------------------------------------------------
   */

  const currentYearDetailCount =
    mergedUnits.filter(
      (unit) =>
        unit.year ===
        HANDBOOK_YEAR,
    ).length;

  const historicalDetailCount =
    mergedUnits.filter(
      (unit) =>
        unit.year <
        HANDBOOK_YEAR,
    ).length;

  const futureDetailCount =
    mergedUnits.filter(
      (unit) =>
        unit.year >
        HANDBOOK_YEAR,
    ).length;

  if (
    futureDetailCount >
    0
  ) {
    throw new Error(
      `Found ${futureDetailCount} future unit detail pages.`,
    );
  }

  /**
   * ------------------------------------------------
   * UPDATE CHECKPOINT
   * ------------------------------------------------
   */

  const updatedCheckpoint:
    UsydFullUnitCheckpoint =
    {
      ...checkpoint,

      updatedAt:
        new Date()
          .toISOString(),

      inventoryCount,

      completedCodes,

      units:
        mergedUnits,

      failures:
        normalizedRemainingFailures,
    };

  /**
   * ------------------------------------------------
   * UPDATE FINAL OUTPUT
   * ------------------------------------------------
   */

  const updatedFinalOutput =
    {
      ...existingFinal,

      university:
        'USYD',

      handbookYear:
        HANDBOOK_YEAR,

      collectedAt:
        new Date()
          .toISOString(),

      inventoryCount,

      successfulCount:
        mergedUnits.length,

      failedCount:
        normalizedRemainingFailures.length,

      historicalDetailCount,

      currentYearDetailCount,

      units:
        mergedUnits,

      failures:
        normalizedRemainingFailures,

      outputFile:
        FINAL_OUTPUT_FILE,

      checkpointFile:
        CHECKPOINT_FILE,

      failureFile:
        FAILURE_FILE,
    };

  /**
   * ------------------------------------------------
   * UPDATE FAILURE FILE
   * ------------------------------------------------
   */

  const updatedFailureFile:
    FailureFileShape =
    {
      university:
        'USYD',

      handbookYear:
        HANDBOOK_YEAR,

      generatedAt:
        new Date()
          .toISOString(),

      inventoryCount,

      failureCount:
        normalizedRemainingFailures.length,

      failures:
        normalizedRemainingFailures,
    };

  /**
   * ------------------------------------------------
   * WRITE OUTPUTS
   * ------------------------------------------------
   */

  await writeJsonAtomic(
    CHECKPOINT_FILE,
    updatedCheckpoint,
  );

  await writeJsonAtomic(
    FINAL_OUTPUT_FILE,
    updatedFinalOutput,
  );

  await writeJsonAtomic(
    FAILURE_FILE,
    updatedFailureFile,
  );

  return {
    university:
      'USYD',

    handbookYear:
      HANDBOOK_YEAR,

    retriedAt:
      new Date()
        .toISOString(),

    inventoryCount,

    previousSuccessfulCount,

    previousFailureCount,

    attemptedCount:
      failuresToRetry.length,

    newlySuccessfulCount:
      newlySuccessfulUnits.length,

    remainingFailureCount:
      normalizedRemainingFailures.length,

    finalSuccessfulCount:
      mergedUnits.length,

    currentYearDetailCount,

    historicalDetailCount,

    newlySuccessfulUnits:
      newlySuccessfulUnits.sort(
        (
          left,
          right,
        ) =>
          left.code.localeCompare(
            right.code,
          ),
      ),

    remainingFailures:
      normalizedRemainingFailures,

    checkpointFile:
      CHECKPOINT_FILE,

    outputFile:
      FINAL_OUTPUT_FILE,

    failureFile:
      FAILURE_FILE,
  };
}

export const USYD_FAILED_UNIT_RETRY_PATHS =
  {
    checkpointFile:
      CHECKPOINT_FILE,

    outputFile:
      FINAL_OUTPUT_FILE,

    failureFile:
      FAILURE_FILE,
  } as const;