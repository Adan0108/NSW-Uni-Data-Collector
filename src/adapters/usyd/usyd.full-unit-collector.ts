import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydUnitInventory,
  type UsydUnitInventory,
  type UsydUnitInventoryItem,
} from './usyd.unit-collector';

import {
  fetchUsydUnit,
} from './usyd.unit-parser';

import type {
  UsydUnit,
} from './usyd.types';

/**
 * ------------------------------------------------
 * USYD FULL UNIT DETAIL COLLECTOR
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * Fetch every unit detail page from the final,
 * deduplicated USYD unit inventory.
 *
 * Current inventory baseline:
 *
 * 3122 unique unit codes
 *
 * The important difference from the small test collector
 * is that this collector is RESUME SAFE.
 *
 * It:
 *
 * 1. builds the unified inventory
 * 2. loads an existing checkpoint if available
 * 3. skips units already collected
 * 4. fetches remaining units in small concurrent batches
 * 5. retries temporary failures
 * 6. periodically saves progress
 * 7. saves failures separately
 * 8. produces final normalized JSON output
 *
 * This means:
 *
 * run stops at unit 1800
 * ↓
 * rerun command
 * ↓
 * units 1-1800 are loaded from checkpoint
 * ↓
 * collector continues from remaining units
 */

/**
 * ------------------------------------------------
 * CONFIG
 * ------------------------------------------------
 */

const HANDBOOK_YEAR =
  2026;

const DEFAULT_CONCURRENCY =
  4;

const DEFAULT_RETRY_COUNT =
  3;

const DEFAULT_CHECKPOINT_EVERY =
  25;

const DEFAULT_RETRY_DELAY_MS =
  1500;

const OUTPUT_DIRECTORY =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
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

const FAILURE_OUTPUT_FILE =
  path.join(
    OUTPUT_DIRECTORY,
    'usyd-units.failures.json',
  );

/**
 * ------------------------------------------------
 * TYPES
 * ------------------------------------------------
 */

export interface UsydFullUnitFailure {
  code: string;

  url: string;

  attempts: number;

  error: string;

  lastAttemptAt: string;
}

export interface UsydFullUnitCheckpoint {
  university:
    'USYD';

  handbookYear:
    number;

  startedAt:
    string;

  updatedAt:
    string;

  inventoryCount:
    number;

  completedCodes:
    string[];

  units:
    UsydUnit[];

  failures:
    UsydFullUnitFailure[];
}

export interface UsydFullUnitCollectionResult {
  university:
    'USYD';

  handbookYear:
    number;

  collectedAt:
    string;

  inventoryCount:
    number;

  successfulCount:
    number;

  failedCount:
    number;

  historicalDetailCount:
    number;

  currentYearDetailCount:
    number;

  units:
    UsydUnit[];

  failures:
    UsydFullUnitFailure[];

  outputFile:
    string;

  checkpointFile:
    string;

  failureFile:
    string;
}

export interface UsydFullUnitCollectorOptions {
  concurrency?:
    number;

  retryCount?:
    number;

  checkpointEvery?:
    number;

  retryDelayMs?:
    number;

  /**
   * Useful for testing.
   *
   * When omitted, all inventory items are processed.
   */
  limit?:
    number;
}

/**
 * ------------------------------------------------
 * GENERAL HELPERS
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

  return String(
    error,
  );
}

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

async function fileExists(
  filePath: string,
): Promise<boolean> {
  try {
    await fs.access(
      filePath,
    );

    return true;
  } catch {
    return false;
  }
}

async function ensureOutputDirectory():
Promise<void> {
  await fs.mkdir(
    OUTPUT_DIRECTORY,
    {
      recursive:
        true,
    },
  );
}

async function writeJson(
  filePath: string,
  value: unknown,
): Promise<void> {
  await fs.writeFile(
    filePath,

    JSON.stringify(
      value,
      null,
      2,
    ),

    'utf8',
  );
}

/**
 * ------------------------------------------------
 * LOAD CHECKPOINT
 * ------------------------------------------------
 */

async function loadCheckpoint():
Promise<UsydFullUnitCheckpoint | null> {
  if (
    !await fileExists(
      CHECKPOINT_FILE,
    )
  ) {
    return null;
  }

  try {
    const raw =
      await fs.readFile(
        CHECKPOINT_FILE,
        'utf8',
      );

    const parsed =
      JSON.parse(
        raw,
      ) as UsydFullUnitCheckpoint;

    if (
      parsed.university !==
        'USYD' ||
      parsed.handbookYear !==
        HANDBOOK_YEAR ||
      !Array.isArray(
        parsed.units,
      ) ||
      !Array.isArray(
        parsed.failures,
      ) ||
      !Array.isArray(
        parsed.completedCodes,
      )
    ) {
      throw new Error(
        'Checkpoint structure is invalid.',
      );
    }

    return parsed;
  } catch (
    error
  ) {
    console.warn(
      '[USYD full units] checkpoint exists but could not be loaded.',
    );

    console.warn(
      errorMessage(
        error,
      ),
    );

    /**
     * Do NOT silently delete a potentially useful
     * checkpoint.
     *
     * We fail here so the user can inspect it.
     */
    throw error;
  }
}

/**
 * ------------------------------------------------
 * CREATE EMPTY CHECKPOINT
 * ------------------------------------------------
 */

function createCheckpoint(
  inventory:
    UsydUnitInventory,
): UsydFullUnitCheckpoint {
  const now =
    new Date()
      .toISOString();

  return {
    university:
      'USYD',

    handbookYear:
      HANDBOOK_YEAR,

    startedAt:
      now,

    updatedAt:
      now,

    inventoryCount:
      inventory.uniqueCodeCount,

    completedCodes:
      [],

    units:
      [],

    failures:
      [],
  };
}

/**
 * ------------------------------------------------
 * CHECKPOINT NORMALISATION
 * ------------------------------------------------
 *
 * Protect against duplicate entries after an interrupted
 * run or manual checkpoint editing.
 */

function normalizeCheckpoint(
  checkpoint:
    UsydFullUnitCheckpoint,
): UsydFullUnitCheckpoint {
  const unitMap =
    new Map<
      string,
      UsydUnit
    >();

  for (
    const unit
    of checkpoint.units
  ) {
    unitMap.set(
      unit.code,
      unit,
    );
  }

  const failureMap =
    new Map<
      string,
      UsydFullUnitFailure
    >();

  for (
    const failure
    of checkpoint.failures
  ) {
    failureMap.set(
      failure.code,
      failure,
    );
  }

  /**
   * Successful units should not remain in failures.
   */
  for (
    const code
    of unitMap.keys()
  ) {
    failureMap.delete(
      code,
    );
  }

  const units =
    [
      ...unitMap.values(),
    ].sort(
      (
        left,
        right,
      ) =>
        left.code.localeCompare(
          right.code,
        ),
    );

  const failures =
    [
      ...failureMap.values(),
    ].sort(
      (
        left,
        right,
      ) =>
        left.code.localeCompare(
          right.code,
        ),
    );

  const completedCodes =
    units
      .map(
        (unit) =>
          unit.code,
      )
      .sort();

  return {
    ...checkpoint,

    updatedAt:
      new Date()
        .toISOString(),

    completedCodes,

    units,

    failures,
  };
}

/**
 * ------------------------------------------------
 * SAVE CHECKPOINT
 * ------------------------------------------------
 */

async function saveCheckpoint(
  checkpoint:
    UsydFullUnitCheckpoint,
): Promise<void> {
  const normalized =
    normalizeCheckpoint(
      checkpoint,
    );

  /**
   * Update caller object as well.
   */
  checkpoint.updatedAt =
    normalized.updatedAt;

  checkpoint.completedCodes =
    normalized.completedCodes;

  checkpoint.units =
    normalized.units;

  checkpoint.failures =
    normalized.failures;

  await writeJson(
    CHECKPOINT_FILE,
    checkpoint,
  );
}

/**
 * ------------------------------------------------
 * FETCH ONE UNIT WITH RETRY
 * ------------------------------------------------
 */

async function fetchUnitWithRetry(
  item:
    UsydUnitInventoryItem,

  retryCount:
    number,

  retryDelayMs:
    number,
): Promise<
  | {
      ok:
        true;

      unit:
        UsydUnit;
    }
  | {
      ok:
        false;

      failure:
        UsydFullUnitFailure;
    }
> {
  let lastError =
    'Unknown error';

  const maximumAttempts =
    Math.max(
      1,
      retryCount,
    );

  for (
    let attempt = 1;
    attempt <=
    maximumAttempts;
    attempt += 1
  ) {
    try {
      const unit =
        await fetchUsydUnit(
          item.code,
        );

      /**
       * Protect against a parser accidentally returning
       * the wrong unit after a redirect.
       */
      if (
        unit.code !==
        item.code
      ) {
        throw new Error(
          `Unit code mismatch. Requested ${item.code}, received ${unit.code}.`,
        );
      }

      return {
        ok:
          true,

        unit,
      };
    } catch (
      error
    ) {
      lastError =
        errorMessage(
          error,
        );

      if (
        attempt <
        maximumAttempts
      ) {
        const delay =
          retryDelayMs *
          attempt;

        console.warn(
          `[USYD full units] ${item.code} attempt ${attempt}/${maximumAttempts} failed. Retrying in ${delay}ms.`,
        );

        await sleep(
          delay,
        );
      }
    }
  }

  return {
    ok:
      false,

    failure: {
      code:
        item.code,

      url:
        item.unitUrl,

      attempts:
        maximumAttempts,

      error:
        lastError,

      lastAttemptAt:
        new Date()
          .toISOString(),
    },
  };
}

/**
 * ------------------------------------------------
 * FINAL OUTPUT
 * ------------------------------------------------
 */

async function writeFinalOutputs(
  inventory:
    UsydUnitInventory,

  checkpoint:
    UsydFullUnitCheckpoint,
): Promise<UsydFullUnitCollectionResult> {
  const normalized =
    normalizeCheckpoint(
      checkpoint,
    );

  const historicalDetailCount =
    normalized.units.filter(
      (unit) =>
        unit.year !==
        HANDBOOK_YEAR,
    ).length;

  const currentYearDetailCount =
    normalized.units.filter(
      (unit) =>
        unit.year ===
        HANDBOOK_YEAR,
    ).length;

  const result:
    UsydFullUnitCollectionResult =
    {
      university:
        'USYD',

      handbookYear:
        HANDBOOK_YEAR,

      collectedAt:
        new Date()
          .toISOString(),

      inventoryCount:
        inventory.uniqueCodeCount,

      successfulCount:
        normalized.units.length,

      failedCount:
        normalized.failures.length,

      historicalDetailCount,

      currentYearDetailCount,

      units:
        normalized.units,

      failures:
        normalized.failures,

      outputFile:
        FINAL_OUTPUT_FILE,

      checkpointFile:
        CHECKPOINT_FILE,

      failureFile:
        FAILURE_OUTPUT_FILE,
    };

  /**
   * Main normalized unit output.
   *
   * Failures are also included here for traceability.
   */
  await writeJson(
    FINAL_OUTPUT_FILE,
    result,
  );

  /**
   * Separate failure file for easier retries/audits.
   */
  await writeJson(
    FAILURE_OUTPUT_FILE,
    {
      university:
        'USYD',

      handbookYear:
        HANDBOOK_YEAR,

      generatedAt:
        new Date()
          .toISOString(),

      inventoryCount:
        inventory.uniqueCodeCount,

      failureCount:
        normalized.failures.length,

      failures:
        normalized.failures,
    },
  );

  return result;
}

/**
 * ------------------------------------------------
 * PUBLIC FULL COLLECTOR
 * ------------------------------------------------
 */

export async function collectAllUsydUnitDetails(
  options:
    UsydFullUnitCollectorOptions =
    {},
): Promise<UsydFullUnitCollectionResult> {
  await ensureOutputDirectory();

  const concurrency =
    Math.max(
      1,

      Math.min(
        options.concurrency ??
          DEFAULT_CONCURRENCY,

        8,
      ),
    );

  const retryCount =
    Math.max(
      1,

      options.retryCount ??
        DEFAULT_RETRY_COUNT,
    );

  const checkpointEvery =
    Math.max(
      1,

      options.checkpointEvery ??
        DEFAULT_CHECKPOINT_EVERY,
    );

  const retryDelayMs =
    Math.max(
      0,

      options.retryDelayMs ??
        DEFAULT_RETRY_DELAY_MS,
    );

  /**
   * ------------------------------------------------
   * BUILD INVENTORY
   * ------------------------------------------------
   */

  console.log(
    '[USYD full units] building unified inventory...',
  );

  const inventory =
    await collectUsydUnitInventory();

  console.log(
    `[USYD full units] inventory: ${inventory.uniqueCodeCount} unique codes`,
  );

  /**
   * ------------------------------------------------
   * LOAD OR CREATE CHECKPOINT
   * ------------------------------------------------
   */

  let checkpoint =
    await loadCheckpoint();

  if (
    checkpoint
  ) {
    console.log(
      '[USYD full units] checkpoint found.',
    );

    console.log(
      `[USYD full units] completed from checkpoint: ${checkpoint.units.length}`,
    );

    console.log(
      `[USYD full units] previous failures: ${checkpoint.failures.length}`,
    );

    /**
     * Inventory changing between runs is important.
     *
     * We allow continuation but make it visible.
     */
    if (
      checkpoint.inventoryCount !==
      inventory.uniqueCodeCount
    ) {
      console.warn(
        `[USYD full units] inventory changed from ${checkpoint.inventoryCount} to ${inventory.uniqueCodeCount}.`,
      );

      checkpoint.inventoryCount =
        inventory.uniqueCodeCount;
    }

    checkpoint =
      normalizeCheckpoint(
        checkpoint,
      );
  } else {
    console.log(
      '[USYD full units] no checkpoint found. Starting new collection.',
    );

    checkpoint =
      createCheckpoint(
        inventory,
      );

    await saveCheckpoint(
      checkpoint,
    );
  }

  /**
   * ------------------------------------------------
   * DETERMINE REMAINING ITEMS
   * ------------------------------------------------
   */

  const successfulCodes =
    new Set(
      checkpoint.units.map(
        (unit) =>
          unit.code,
      ),
    );

  let remainingItems =
    inventory.items.filter(
      (item) =>
        !successfulCodes.has(
          item.code,
        ),
    );

  /**
   * Test/debug mode.
   */
  if (
    options.limit !==
    undefined
  ) {
    remainingItems =
      remainingItems.slice(
        0,

        Math.max(
          0,
          options.limit,
        ),
      );
  }

  console.log(
    `[USYD full units] already completed: ${successfulCodes.size}`,
  );

  console.log(
    `[USYD full units] remaining this run: ${remainingItems.length}`,
  );

  if (
    remainingItems.length ===
    0
  ) {
    console.log(
      '[USYD full units] nothing left to fetch.',
    );

    await saveCheckpoint(
      checkpoint,
    );

    return writeFinalOutputs(
      inventory,
      checkpoint,
    );
  }

  /**
   * Existing failures should be retried during this run.
   *
   * Remove their old failure entry before processing.
   */
  const remainingCodeSet =
    new Set(
      remainingItems.map(
        (item) =>
          item.code,
      ),
    );

  checkpoint.failures =
    checkpoint.failures.filter(
      (failure) =>
        !remainingCodeSet.has(
          failure.code,
        ),
    );

  /**
   * ------------------------------------------------
   * FETCH IN BATCHES
   * ------------------------------------------------
   */

  let processedSinceSave =
    0;

  let processedThisRun =
    0;

  for (
    let start = 0;
    start <
    remainingItems.length;
    start +=
    concurrency
  ) {
    const batch =
      remainingItems.slice(
        start,
        start +
          concurrency,
      );

    const startDisplay =
      start +
      1;

    const endDisplay =
      Math.min(
        start +
          batch.length,

        remainingItems.length,
      );

    console.log(
      `[USYD full units] ${startDisplay}-${endDisplay}/${remainingItems.length} ` +
      `| total completed ${checkpoint.units.length}/${inventory.uniqueCodeCount}`,
    );

    const results =
      await Promise.all(
        batch.map(
          (item) =>
            fetchUnitWithRetry(
              item,
              retryCount,
              retryDelayMs,
            ),
        ),
      );

    for (
      const result
      of results
    ) {
      processedThisRun +=
        1;

      processedSinceSave +=
        1;

      if (
        result.ok
      ) {
        /**
         * Remove previous failure if the retry now works.
         */
        checkpoint.failures =
          checkpoint.failures.filter(
            (failure) =>
              failure.code !==
              result.unit.code,
          );

        const existingIndex =
          checkpoint.units.findIndex(
            (unit) =>
              unit.code ===
              result.unit.code,
          );

        if (
          existingIndex >=
          0
        ) {
          checkpoint.units[
            existingIndex
          ] =
            result.unit;
        } else {
          checkpoint.units.push(
            result.unit,
          );
        }
      } else {
        checkpoint.failures =
          checkpoint.failures.filter(
            (failure) =>
              failure.code !==
              result.failure.code,
          );

        checkpoint.failures.push(
          result.failure,
        );

        console.error(
          `[USYD full units] FAILED ${result.failure.code}: ${result.failure.error}`,
        );
      }
    }

    /**
     * ------------------------------------------------
     * PERIODIC CHECKPOINT
     * ------------------------------------------------
     */

    if (
      processedSinceSave >=
      checkpointEvery
    ) {
      await saveCheckpoint(
        checkpoint,
      );

      processedSinceSave =
        0;

      console.log(
        `[USYD full units] checkpoint saved: ${checkpoint.units.length} successful, ${checkpoint.failures.length} failed`,
      );
    }
  }

  /**
   * Always save at the end, even if the final chunk is
   * smaller than checkpointEvery.
   */
  await saveCheckpoint(
    checkpoint,
  );

  console.log(
    `[USYD full units] run processed: ${processedThisRun}`,
  );

  console.log(
    `[USYD full units] successful total: ${checkpoint.units.length}`,
  );

  console.log(
    `[USYD full units] unresolved failures: ${checkpoint.failures.length}`,
  );

  /**
   * ------------------------------------------------
   * FINAL JSON
   * ------------------------------------------------
   */

  return writeFinalOutputs(
    inventory,
    checkpoint,
  );
}

/**
 * ------------------------------------------------
 * EXPORTED PATHS
 * ------------------------------------------------
 *
 * Useful for the audit runner.
 */

export const USYD_FULL_UNIT_PATHS =
  {
    outputDirectory:
      OUTPUT_DIRECTORY,

    checkpointFile:
      CHECKPOINT_FILE,

    outputFile:
      FINAL_OUTPUT_FILE,

    failureFile:
      FAILURE_OUTPUT_FILE,
  } as const;