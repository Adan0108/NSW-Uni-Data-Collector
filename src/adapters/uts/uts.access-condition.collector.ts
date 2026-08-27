import {
  resolve,
} from 'node:path';

import {
  parseUtsAccessConditions,
  type ParsedUtsAccessConditions,
} from './uts.access-condition.parser.js';

import {
  readJsonSnapshot,
  writeJsonSnapshot,
} from '../../storage/snapshot.storage.js';

export interface CollectedUtsAccessCondition
  extends ParsedUtsAccessConditions {
  sourceUrl: string;

  fetchedAt: string;
}

export interface UtsAccessConditionFailure {
  subjectCode: string;

  sourceUrl: string;

  error: string;
}

export interface UtsAccessConditionCollection {
  records:
    CollectedUtsAccessCondition[];

  failures:
    UtsAccessConditionFailure[];
}

interface AccessConditionSnapshot {
  records:
    CollectedUtsAccessCondition[];

  failures:
    UtsAccessConditionFailure[];
}

const REQUEST_DELAY_MS =
  300;

const MAX_ATTEMPTS =
  4;

const CHECKPOINT_INTERVAL =
  25;

export async function collectUtsAccessConditions(
  subjectCodes: string[],
  year: string,
): Promise<UtsAccessConditionCollection> {
  const uniqueCodes =
    [
      ...new Set(
        subjectCodes.filter(
          Boolean,
        ),
      ),
    ];

  const snapshotPath =
    resolve(
      'data',
      'raw',
      'uts',
      year,
      'access-conditions-snapshot.json',
    );

  const previousSnapshot =
    await readJsonSnapshot<
      AccessConditionSnapshot
    >(
      snapshotPath,
    );

  const records =
    previousSnapshot?.records
      ? [...previousSnapshot.records]
      : [];

  const failures =
    previousSnapshot?.failures
      ? [...previousSnapshot.failures]
      : [];

  const completedCodes =
    new Set(
      records.map(
        (record) =>
          record.subjectCode,
      ),
    );

  console.log(
    '\n=============================',
  );

  console.log(
    'COLLECTING ACCESS CONDITIONS',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Referenced subjects: ${uniqueCodes.length}`,
  );

  console.log(
    `Already cached: ${completedCodes.size}`,
  );

  const remainingCodes =
    uniqueCodes.filter(
      (code) =>
        !completedCodes.has(
          code,
        ),
    );

  console.log(
    `Remaining: ${remainingCodes.length}`,
  );

  /*
   * Previous failures are retried.
   *
   * We therefore remove them from the active
   * failure list before starting this run.
   */
  const remainingCodeSet =
    new Set(
      remainingCodes,
    );

  const retainedFailures =
    failures.filter(
      (failure) =>
        !remainingCodeSet.has(
          failure.subjectCode,
        ),
    );

  failures.length = 0;

  failures.push(
    ...retainedFailures,
  );

  let processedThisRun = 0;

  for (
    const subjectCode
    of remainingCodes
  ) {
    const sourceUrl =
      buildAccessConditionUrl(
        subjectCode,
      );

    try {
      const html =
        await fetchAccessConditionPage(
          subjectCode,
        );

      const parsed =
        parseUtsAccessConditions(
          html,
          subjectCode,
        );

      records.push({
        ...parsed,

        sourceUrl,

        fetchedAt:
          new Date().toISOString(),
      });

      console.log(
        `[${records.length}/${uniqueCodes.length}] ${subjectCode} -> ${
          parsed.hasConditions
            ? `${parsed.items.length} conditions`
            : 'no conditions'
        }`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      failures.push({
        subjectCode,

        sourceUrl,

        error:
          message,
      });

      console.log(
        `[FAILED] ${subjectCode} -> ${message}`,
      );
    }

    processedThisRun++;

    /*
     * Periodic checkpoint.
     *
     * If the process is interrupted, the next
     * run continues from the saved records.
     */
    if (
      processedThisRun %
        CHECKPOINT_INTERVAL ===
      0
    ) {
      await saveSnapshot(
        snapshotPath,
        records,
        failures,
      );

      console.log(
        `Checkpoint saved after ${processedThisRun} requests.`,
      );
    }

    await sleep(
      REQUEST_DELAY_MS,
    );
  }

  /*
   * Always save once more when collection ends.
   */
  await saveSnapshot(
    snapshotPath,
    records,
    failures,
  );

  const finalRecords =
    deduplicateRecords(
      records,
    );

  const finalFailures =
    deduplicateFailures(
      failures,
    ).filter(
      (failure) =>
        !finalRecords.some(
          (record) =>
            record.subjectCode ===
            failure.subjectCode,
        ),
    );

  console.log(
    '\n=============================',
  );

  console.log(
    'ACCESS CONDITION SUMMARY',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Collected: ${finalRecords.length}`,
  );

  console.log(
    `With conditions: ${
      finalRecords.filter(
        (record) =>
          record.hasConditions,
      ).length
    }`,
  );

  console.log(
    `Without conditions: ${
      finalRecords.filter(
        (record) =>
          !record.hasConditions,
      ).length
    }`,
  );

  console.log(
    `Failures: ${finalFailures.length}`,
  );

  return {
    records:
      finalRecords,

    failures:
      finalFailures,
  };
}

async function fetchAccessConditionPage(
  subjectCode: string,
): Promise<string> {
  const url =
    buildAccessConditionUrl(
      subjectCode,
    );

  let lastError:
    unknown;

  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      const response =
        await fetch(
          url,
          {
            headers: {
              Accept:
                'text/html,application/xhtml+xml',

              'User-Agent':
                'Mozilla/5.0',
            },
          },
        );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText}`,
        );
      }

      const html =
        await response.text();

      if (
        html.trim().length === 0
      ) {
        throw new Error(
          'Empty HTML response',
        );
      }

      return html;
    } catch (error) {
      lastError =
        error;

      if (
        attempt ===
        MAX_ATTEMPTS
      ) {
        break;
      }

      const retryDelay =
        attempt * 2000;

      console.log(
        `${subjectCode} request failed. Retrying in ${retryDelay}ms (${attempt}/${MAX_ATTEMPTS})...`,
      );

      await sleep(
        retryDelay,
      );
    }
  }

  if (
    lastError instanceof Error
  ) {
    throw lastError;
  }

  throw new Error(
    'Unknown access-condition request failure',
  );
}

function buildAccessConditionUrl(
  subjectCode: string,
): string {
  return (
    'https://studentforms.uts.edu.au/evop/access/search.cfm' +
    `?subjectcode=${encodeURIComponent(subjectCode)}`
  );
}

async function saveSnapshot(
  snapshotPath: string,
  records:
    CollectedUtsAccessCondition[],
  failures:
    UtsAccessConditionFailure[],
): Promise<void> {
  await writeJsonSnapshot(
    snapshotPath,
    {
      records:
        deduplicateRecords(
          records,
        ),

      failures:
        deduplicateFailures(
          failures,
        ),
    },
  );
}

function deduplicateRecords(
  records:
    CollectedUtsAccessCondition[],
): CollectedUtsAccessCondition[] {
  const map =
    new Map<
      string,
      CollectedUtsAccessCondition
    >();

  for (const record of records) {
    map.set(
      record.subjectCode,
      record,
    );
  }

  return [
    ...map.values(),
  ];
}

function deduplicateFailures(
  failures:
    UtsAccessConditionFailure[],
): UtsAccessConditionFailure[] {
  const map =
    new Map<
      string,
      UtsAccessConditionFailure
    >();

  for (const failure of failures) {
    map.set(
      failure.subjectCode,
      failure,
    );
  }

  return [
    ...map.values(),
  ];
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