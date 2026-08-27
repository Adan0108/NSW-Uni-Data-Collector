import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydUnitInventory,
  type UsydUnitSource,
} from './usyd.unit-collector';

import type {
  UsydFullUnitFailure,
} from './usyd.full-unit-collector';

/**
 * ------------------------------------------------
 * USYD UNIT FAILURE AUDIT
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * Classify unit-detail failures produced by the full
 * 3122-unit collection.
 *
 * IMPORTANT
 *
 * We do NOT refetch successful unit pages.
 *
 * This audit:
 *
 * 1. loads the existing failure file
 * 2. rebuilds the validated unit inventory
 * 3. joins every failed code back to its handbook sources
 * 4. classifies the failure
 * 5. decides whether it should:
 *
 *    - remain an unresolved handbook reference
 *    - be retried
 *    - trigger parser review
 *
 * Current full collection:
 *
 * - inventory: 3122
 * - successful details: 3010
 * - unresolved: 112
 */

const HANDBOOK_YEAR =
  2026;

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

const FAILURE_FILE =
  path.join(
    OUTPUT_DIRECTORY,
    'usyd-units.failures.json',
  );

const AUDIT_FILE =
  path.join(
    OUTPUT_DIRECTORY,
    'usyd-unit-failure-audit.json',
  );

/**
 * ------------------------------------------------
 * CLASSIFICATION
 * ------------------------------------------------
 */

export type UsydUnitFailureCategory =
  | 'PAGE_NOT_FOUND'
  | 'NOT_AVAILABLE_OR_UNDER_DEVELOPMENT'
  | 'NETWORK_OR_HTTP_ERROR'
  | 'PARSER_ERROR'
  | 'OTHER';

export type UsydUnitFailureAction =
  | 'PRESERVE_UNRESOLVED'
  | 'RETRY'
  | 'REVIEW_PARSER'
  | 'MANUAL_REVIEW';

export interface UsydUnitFailureAuditItem {
  code:
    string;

  url:
    string;

  attempts:
    number;

  originalError:
    string;

  category:
    UsydUnitFailureCategory;

  recommendedAction:
    UsydUnitFailureAction;

  /**
   * True when the failure appears temporary and should
   * be retried.
   */
  retryable:
    boolean;

  /**
   * True when this code was actually found in the
   * validated 2026 handbook inventory.
   */
  foundInInventory:
    boolean;

  /**
   * Every handbook table that referenced this code.
   *
   * This is important because even if /units/CODE is
   * missing, we still have evidence that the 2026
   * handbook referenced it.
   */
  sources:
    UsydUnitSource[];

  sourceCount:
    number;

  sourceKinds:
    string[];

  handbookCategories:
    string[];
}

export interface UsydUnitFailureAuditSummary {
  university:
    'USYD';

  handbookYear:
    number;

  generatedAt:
    string;

  inventoryCount:
    number;

  failureCount:
    number;

  foundInInventoryCount:
    number;

  missingFromInventoryCount:
    number;

  retryableCount:
    number;

  preserveUnresolvedCount:
    number;

  parserReviewCount:
    number;

  manualReviewCount:
    number;

  byCategory:
    Record<
      UsydUnitFailureCategory,
      number
    >;

  items:
    UsydUnitFailureAuditItem[];
}

/**
 * ------------------------------------------------
 * FAILURE FILE SHAPE
 * ------------------------------------------------
 */

interface FailureFileShape {
  university?:
    string;

  handbookYear?:
    number;

  generatedAt?:
    string;

  inventoryCount?:
    number;

  failureCount?:
    number;

  failures:
    UsydFullUnitFailure[];
}

/**
 * ------------------------------------------------
 * HELPERS
 * ------------------------------------------------
 */

async function readFailureFile():
Promise<FailureFileShape> {
  const raw =
    await fs.readFile(
      FAILURE_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as FailureFileShape;

  if (
    !Array.isArray(
      parsed.failures,
    )
  ) {
    throw new Error(
      'USYD failure file does not contain a failures array.',
    );
  }

  return parsed;
}

function normalizeError(
  value: string,
): string {
  return value
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

/**
 * ------------------------------------------------
 * FAILURE CLASSIFIER
 * ------------------------------------------------
 */

export function classifyUsydUnitFailure(
  rawError: string,
): {
  category:
    UsydUnitFailureCategory;

  action:
    UsydUnitFailureAction;

  retryable:
    boolean;
} {
  const error =
    normalizeError(
      rawError,
    );

  const lower =
    error.toLowerCase();

  /**
   * ----------------------------------------------
   * PAGE NOT FOUND
   * ----------------------------------------------
   *
   * These are normally old/stale unit references.
   *
   * Do not keep retrying them automatically.
   */
  if (
    lower.includes(
      'page not found',
    ) ||
    /\b404\b/.test(
      lower,
    ) &&
    !lower.includes(
      '429',
    )
  ) {
    return {
      category:
        'PAGE_NOT_FOUND',

      action:
        'PRESERVE_UNRESOLVED',

      retryable:
        false,
    };
  }

  /**
   * ----------------------------------------------
   * NOT AVAILABLE / UNDER DEVELOPMENT
   * ----------------------------------------------
   */

  if (
    lower.includes(
      'unit of study is not available',
    ) ||
    lower.includes(
      'may be under development',
    )
  ) {
    return {
      category:
        'NOT_AVAILABLE_OR_UNDER_DEVELOPMENT',

      action:
        'PRESERVE_UNRESOLVED',

      retryable:
        false,
    };
  }

  /**
   * ----------------------------------------------
   * TEMPORARY NETWORK / HTTP
   * ----------------------------------------------
   */

  if (
    lower.includes(
      'timeout',
    ) ||
    lower.includes(
      'timed out',
    ) ||
    lower.includes(
      'etimedout',
    ) ||
    lower.includes(
      'econnreset',
    ) ||
    lower.includes(
      'econnrefused',
    ) ||
    lower.includes(
      'socket hang up',
    ) ||
    lower.includes(
      'network error',
    ) ||
    lower.includes(
      'fetch failed',
    ) ||
    lower.includes(
      'too many requests',
    ) ||
    lower.includes(
      'rate limit',
    ) ||
    /\b429\b/.test(
      lower,
    ) ||
    /\b500\b/.test(
      lower,
    ) ||
    /\b502\b/.test(
      lower,
    ) ||
    /\b503\b/.test(
      lower,
    ) ||
    /\b504\b/.test(
      lower,
    )
  ) {
    return {
      category:
        'NETWORK_OR_HTTP_ERROR',

      action:
        'RETRY',

      retryable:
        true,
    };
  }

  /**
   * ----------------------------------------------
   * PARSER FAILURE
   * ----------------------------------------------
   *
   * If a real page came back but our parser could not
   * interpret it, that needs parser inspection.
   *
   * Known "Page not found" and "not available" headings
   * have already been classified above.
   */
  if (
    lower.includes(
      'could not parse',
    ) ||
    lower.includes(
      'failed to parse',
    ) ||
    lower.includes(
      'parse usyd',
    ) ||
    lower.includes(
      'heading',
    )
  ) {
    return {
      category:
        'PARSER_ERROR',

      action:
        'REVIEW_PARSER',

      retryable:
        false,
    };
  }

  return {
    category:
      'OTHER',

    action:
      'MANUAL_REVIEW',

    retryable:
      false,
  };
}

/**
 * ------------------------------------------------
 * UNIQUE STRINGS
 * ------------------------------------------------
 */

function uniqueSorted(
  values: string[],
): string[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}

/**
 * ------------------------------------------------
 * PUBLIC AUDIT
 * ------------------------------------------------
 */

export async function auditUsydUnitFailures():
Promise<UsydUnitFailureAuditSummary> {
  console.log(
    '[USYD unit failure audit] loading failure file...',
  );

  const failureFile =
    await readFailureFile();

  console.log(
    `[USYD unit failure audit] failures: ${failureFile.failures.length}`,
  );

  /**
   * Rebuild the inventory so failures can be joined back
   * to their exact 2026 handbook source tables.
   *
   * This DOES NOT fetch unit-detail pages.
   */
  console.log(
    '[USYD unit failure audit] rebuilding unit inventory for source mapping...',
  );

  const inventory =
    await collectUsydUnitInventory();

  const inventoryMap =
    new Map(
      inventory.items.map(
        (item) =>
          [
            item.code,
            item,
          ] as const,
      ),
    );

  const items:
    UsydUnitFailureAuditItem[] =
    [];

  for (
    const failure
    of failureFile.failures
  ) {
    const inventoryItem =
      inventoryMap.get(
        failure.code,
      );

    const classification =
      classifyUsydUnitFailure(
        failure.error,
      );

    const sources =
      inventoryItem
        ?.sources ??
      [];

    items.push({
      code:
        failure.code,

      url:
        failure.url,

      attempts:
        failure.attempts,

      originalError:
        failure.error,

      category:
        classification.category,

      recommendedAction:
        classification.action,

      retryable:
        classification.retryable,

      foundInInventory:
        inventoryItem !==
        undefined,

      sources,

      sourceCount:
        sources.length,

      sourceKinds:
        uniqueSorted(
          sources.map(
            (source) =>
              source.kind,
          ),
        ),

      handbookCategories:
        uniqueSorted(
          sources.map(
            (source) =>
              source.handbookCategory,
          ),
        ),
    });
  }

  items.sort(
    (
      left,
      right,
    ) =>
      left.code.localeCompare(
        right.code,
      ),
  );

  /**
   * ------------------------------------------------
   * COUNTS
   * ------------------------------------------------
   */

  const byCategory:
    Record<
      UsydUnitFailureCategory,
      number
    > =
    {
      PAGE_NOT_FOUND:
        0,

      NOT_AVAILABLE_OR_UNDER_DEVELOPMENT:
        0,

      NETWORK_OR_HTTP_ERROR:
        0,

      PARSER_ERROR:
        0,

      OTHER:
        0,
    };

  for (
    const item
    of items
  ) {
    byCategory[
      item.category
    ] +=
      1;
  }

  const result:
    UsydUnitFailureAuditSummary =
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
        items.length,

      foundInInventoryCount:
        items.filter(
          (item) =>
            item.foundInInventory,
        ).length,

      missingFromInventoryCount:
        items.filter(
          (item) =>
            !item.foundInInventory,
        ).length,

      retryableCount:
        items.filter(
          (item) =>
            item.recommendedAction ===
            'RETRY',
        ).length,

      preserveUnresolvedCount:
        items.filter(
          (item) =>
            item.recommendedAction ===
            'PRESERVE_UNRESOLVED',
        ).length,

      parserReviewCount:
        items.filter(
          (item) =>
            item.recommendedAction ===
            'REVIEW_PARSER',
        ).length,

      manualReviewCount:
        items.filter(
          (item) =>
            item.recommendedAction ===
            'MANUAL_REVIEW',
        ).length,

      byCategory,

      items,
    };

  await fs.writeFile(
    AUDIT_FILE,

    JSON.stringify(
      result,
      null,
      2,
    ),

    'utf8',
  );

  return result;
}

/**
 * ------------------------------------------------
 * PATHS
 * ------------------------------------------------
 */

export const USYD_UNIT_FAILURE_AUDIT_PATHS =
  {
    failureFile:
      FAILURE_FILE,

    auditFile:
      AUDIT_FILE,
  } as const;