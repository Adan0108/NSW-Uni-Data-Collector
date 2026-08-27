import fs from 'node:fs/promises';
import path from 'node:path';

import { fetchUsydUnit } from './usyd.unit-parser';
import type { UsydUnit } from './usyd.types';

const HANDBOOK_YEAR = 2026;
const CONCURRENCY = 2;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_500;

const REQUIRED_CODES = [
  'ATHK1001',
  'WRIT1001',
  'INLI1001',
  'INLI1002',
  'MATH1100',
  'MATH1200',
  'OLES1602',
] as const;

export const USYD_STUDY_PLAN_SUBJECT_SUPPLEMENT_FILE = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  String(HANDBOOK_YEAR),
  'usyd-study-plan-subject-supplement.v1.json',
);

export interface UsydStudyPlanSubjectSupplement {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;
  purpose: 'OFFICIAL_STUDY_PLAN_SUBJECT_CROSS_REFERENCE';
  requiredCodes: string[];
  counts: {
    requested: number;
    collected: number;
  };
  units: UsydUnit[];
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchWithRetry(code: string): Promise<UsydUnit> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const unit = await fetchUsydUnit(code);

      if (unit.code !== code) {
        throw new Error(`Requested ${code}, but parser returned ${unit.code}.`);
      }

      return unit;
    } catch (error) {
      lastError = error;
      console.warn(
        `[USYD study-plan subject supplement] ${code} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${errorMessage(error)}`,
      );

      if (attempt < MAX_ATTEMPTS) {
        await wait(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(
    `Could not collect ${code} after ${MAX_ATTEMPTS} attempts: ${errorMessage(lastError)}`,
  );
}

/**
 * Collects only the seven official units referenced by normalized study plans
 * but absent from the table-derived Stage 1 unit inventory.
 *
 * The output is written only after every unit succeeds. A partial network run
 * therefore cannot replace a previously complete supplement.
 */
export async function collectUsydStudyPlanSubjectSupplement():
Promise<UsydStudyPlanSubjectSupplement> {
  const queue = [...REQUIRED_CODES];
  const units: UsydUnit[] = [];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const code = queue.shift();
      if (code === undefined) {
        return;
      }

      console.log(`[USYD study-plan subject supplement] collecting ${code}`);
      units.push(await fetchWithRetry(code));
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(CONCURRENCY, REQUIRED_CODES.length) },
      async () => worker(),
    ),
  );

  units.sort((left, right) => left.code.localeCompare(right.code));

  const actualCodes = units.map((unit) => unit.code);
  const expectedCodes = [...REQUIRED_CODES].sort();

  if (
    actualCodes.length !== expectedCodes.length ||
    actualCodes.some((code, index) => code !== expectedCodes[index])
  ) {
    throw new Error(
      `Collected unit set is incomplete. Expected ${expectedCodes.join(', ')}, got ${actualCodes.join(', ')}.`,
    );
  }

  const result: UsydStudyPlanSubjectSupplement = {
    university: 'USYD',
    handbookYear: HANDBOOK_YEAR,
    generatedAt: new Date().toISOString(),
    purpose: 'OFFICIAL_STUDY_PLAN_SUBJECT_CROSS_REFERENCE',
    requiredCodes: [...REQUIRED_CODES],
    counts: {
      requested: REQUIRED_CODES.length,
      collected: units.length,
    },
    units,
  };

  await fs.mkdir(path.dirname(USYD_STUDY_PLAN_SUBJECT_SUPPLEMENT_FILE), {
    recursive: true,
  });

  await fs.writeFile(
    USYD_STUDY_PLAN_SUBJECT_SUPPLEMENT_FILE,
    `${JSON.stringify(result, null, 2)}\n`,
    'utf8',
  );

  return result;
}
