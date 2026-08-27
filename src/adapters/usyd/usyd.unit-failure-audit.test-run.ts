import {
  auditUsydUnitFailures,
  USYD_UNIT_FAILURE_AUDIT_PATHS,
  type UsydUnitFailureAuditItem,
  type UsydUnitFailureCategory,
} from './usyd.unit-failure-audit';

/**
 * ------------------------------------------------
 * USYD UNIT FAILURE AUDIT RUNNER
 * ------------------------------------------------
 *
 * Validates the 112 unresolved unit-detail failures after
 * the full 3122-unit collection.
 *
 * IMPORTANT
 *
 * This does NOT refetch failed unit pages.
 *
 * It only:
 *
 * - loads failures
 * - rebuilds handbook source inventory
 * - classifies failures
 * - maps failed codes back to handbook tables
 */

function divider(): void {
  console.log(
    '================================',
  );
}

function printSamples(
  title: string,
  items: UsydUnitFailureAuditItem[],
  limit = 20,
): void {
  divider();

  console.log(
    title,
  );

  divider();

  if (
    items.length ===
    0
  ) {
    console.log(
      'NONE',
    );

    return;
  }

  for (
    const item
    of items.slice(
      0,
      limit,
    )
  ) {
    console.log(
      `${item.code}`,
    );

    console.log(
      `  Category: ${item.category}`,
    );

    console.log(
      `  Action: ${item.recommendedAction}`,
    );

    console.log(
      `  Attempts: ${item.attempts}`,
    );

    console.log(
      `  Sources: ${item.sourceCount}`,
    );

    console.log(
      `  Handbooks: ${
        item.handbookCategories.join(
          ', ',
        ) ||
        'NONE'
      }`,
    );

    console.log(
      `  Error: ${item.originalError}`,
    );

    for (
      const source
      of item.sources.slice(
        0,
        5,
      )
    ) {
      console.log(
        `    ${source.kind} / ` +
        `${source.handbookCategory} / ` +
        `${source.ownerName}`,
      );

      console.log(
        `      ${source.tableUrl}`,
      );
    }

    if (
      item.sources.length >
      5
    ) {
      console.log(
        `    ... ${item.sources.length - 5} more sources`,
      );
    }

    console.log('');
  }
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD UNIT FAILURE AUDIT',
  );

  divider();

  const audit =
    await auditUsydUnitFailures();

  /**
   * ------------------------------------------------
   * SUMMARY
   * ------------------------------------------------
   */

  divider();

  console.log(
    'FAILURE SUMMARY',
  );

  divider();

  console.log(
    `Inventory: ${audit.inventoryCount}`,
  );

  console.log(
    `Failures: ${audit.failureCount}`,
  );

  console.log(
    `Found in 2026 inventory: ${audit.foundInInventoryCount}`,
  );

  console.log(
    `Missing from inventory: ${audit.missingFromInventoryCount}`,
  );

  /**
   * ------------------------------------------------
   * CATEGORY COUNTS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'FAILURES BY CATEGORY',
  );

  divider();

  const categories:
    UsydUnitFailureCategory[] =
    [
      'PAGE_NOT_FOUND',
      'NOT_AVAILABLE_OR_UNDER_DEVELOPMENT',
      'NETWORK_OR_HTTP_ERROR',
      'PARSER_ERROR',
      'OTHER',
    ];

  for (
    const category
    of categories
  ) {
    console.log(
      `${category}: ${audit.byCategory[category]}`,
    );
  }

  /**
   * ------------------------------------------------
   * ACTION COUNTS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'RECOMMENDED ACTIONS',
  );

  divider();

  console.log(
    `Preserve unresolved: ${audit.preserveUnresolvedCount}`,
  );

  console.log(
    `Retry: ${audit.retryableCount}`,
  );

  console.log(
    `Parser review: ${audit.parserReviewCount}`,
  );

  console.log(
    `Manual review: ${audit.manualReviewCount}`,
  );

  /**
   * ------------------------------------------------
   * SOURCE COVERAGE
   * ------------------------------------------------
   */

  const noSourceItems =
    audit.items.filter(
      (item) =>
        item.sourceCount ===
        0,
    );

  const multipleSourceItems =
    audit.items.filter(
      (item) =>
        item.sourceCount >
        1,
    );

  const componentOnlyFailures =
    audit.items.filter(
      (item) =>
        item.sourceKinds.length ===
          1 &&
        item.sourceKinds[
          0
        ] ===
          'COMPONENT_TABLE',
    );

  const degreeOnlyFailures =
    audit.items.filter(
      (item) =>
        item.sourceKinds.length ===
          1 &&
        item.sourceKinds[
          0
        ] ===
          'DEGREE_SPECIFIC_TABLE',
    );

  const bothSourceFailures =
    audit.items.filter(
      (item) =>
        item.sourceKinds.includes(
          'COMPONENT_TABLE',
        ) &&
        item.sourceKinds.includes(
          'DEGREE_SPECIFIC_TABLE',
        ),
    );

  divider();

  console.log(
    'FAILURE SOURCE COVERAGE',
  );

  divider();

  console.log(
    `Failures without handbook source: ${noSourceItems.length}`,
  );

  console.log(
    `Failures with multiple sources: ${multipleSourceItems.length}`,
  );

  console.log(
    `Component-table only: ${componentOnlyFailures.length}`,
  );

  console.log(
    `Degree-specific only: ${degreeOnlyFailures.length}`,
  );

  console.log(
    `Both source kinds: ${bothSourceFailures.length}`,
  );

  /**
   * ------------------------------------------------
   * HANDBOOK DISTRIBUTION
   * ------------------------------------------------
   */

  const handbookCounts =
    new Map<
      string,
      number
    >();

  for (
    const item
    of audit.items
  ) {
    for (
      const handbook
      of item.handbookCategories
    ) {
      handbookCounts.set(
        handbook,

        (
          handbookCounts.get(
            handbook,
          ) ??
          0
        ) +
          1,
      );
    }
  }

  divider();

  console.log(
    'FAILED CODES BY HANDBOOK',
  );

  divider();

  for (
    const [
      handbook,
      count,
    ]
    of [
      ...handbookCounts.entries(),
    ].sort(
      (
        left,
        right,
      ) =>
        right[
          1
        ] -
        left[
          1
        ],
    )
  ) {
    console.log(
      `${handbook}: ${count}`,
    );
  }

  /**
   * ------------------------------------------------
   * SAMPLES
   * ------------------------------------------------
   */

  printSamples(
    'PAGE NOT FOUND SAMPLE',

    audit.items.filter(
      (item) =>
        item.category ===
        'PAGE_NOT_FOUND',
    ),
  );

  printSamples(
    'NOT AVAILABLE / UNDER DEVELOPMENT SAMPLE',

    audit.items.filter(
      (item) =>
        item.category ===
        'NOT_AVAILABLE_OR_UNDER_DEVELOPMENT',
    ),
  );

  printSamples(
    'RETRYABLE FAILURE SAMPLE',

    audit.items.filter(
      (item) =>
        item.retryable,
    ),
  );

  printSamples(
    'PARSER REVIEW SAMPLE',

    audit.items.filter(
      (item) =>
        item.category ===
        'PARSER_ERROR',
    ),
  );

  printSamples(
    'OTHER / MANUAL REVIEW SAMPLE',

    audit.items.filter(
      (item) =>
        item.category ===
        'OTHER',
    ),
  );

  /**
   * ------------------------------------------------
   * KNOWN FAILURE REGRESSION
   * ------------------------------------------------
   */

  const knownExpectedFailures =
    [
      'AERO5500',
      'AMME4912',
    ];

  divider();

  console.log(
    'KNOWN FAILURE REGRESSION',
  );

  divider();

  let knownRegressionPass =
    true;

  for (
    const code
    of knownExpectedFailures
  ) {
    const item =
      audit.items.find(
        (candidate) =>
          candidate.code ===
          code,
      );

    if (
      !item
    ) {
      knownRegressionPass =
        false;

      console.log(
        `FAIL ${code} missing from failure audit`,
      );

      continue;
    }

    console.log(
      `PASS ${code} -> ${item.category}`,
    );
  }

  /**
   * ------------------------------------------------
   * STRUCTURAL VALIDATION
   * ------------------------------------------------
   */

  const duplicateFailureCodes =
    audit.items.length -
    new Set(
      audit.items.map(
        (item) =>
          item.code,
      ),
    ).size;

  const categoryTotal =
    Object.values(
      audit.byCategory,
    ).reduce(
      (
        sum,
        count,
      ) =>
        sum +
        count,
      0,
    );

  const actionTotal =
    audit.preserveUnresolvedCount +
    audit.retryableCount +
    audit.parserReviewCount +
    audit.manualReviewCount;

  divider();

  console.log(
    'STRUCTURAL VALIDATION',
  );

  divider();

  console.log(
    `Duplicate failure codes: ${duplicateFailureCodes}`,
  );

  console.log(
    `Category total: ${categoryTotal}`,
  );

  console.log(
    `Action total: ${actionTotal}`,
  );

  console.log(
    `Every failure classified: ${
      categoryTotal ===
      audit.failureCount
        ? 'YES'
        : 'NO'
    }`,
  );

  console.log(
    `Every failure has action: ${
      actionTotal ===
      audit.failureCount
        ? 'YES'
        : 'NO'
    }`,
  );

  /**
   * ------------------------------------------------
   * OUTPUT
   * ------------------------------------------------
   */

  divider();

  console.log(
    'OUTPUT',
  );

  divider();

  console.log(
    USYD_UNIT_FAILURE_AUDIT_PATHS.auditFile,
  );

  /**
   * ------------------------------------------------
   * FINAL RESULT
   * ------------------------------------------------
   *
   * Current expected baseline:
   *
   * inventory = 3122
   * unresolved failures = 112
   *
   * We require all failed codes to map back to the
   * validated inventory.
   *
   * Parser/manual/retry categories are not automatically
   * failures of this audit. They are exactly what this
   * audit is supposed to identify.
   */

  const hardFailure =
    audit.inventoryCount !==
      3122 ||
    audit.failureCount !==
      112 ||
    audit.missingFromInventoryCount >
      0 ||
    noSourceItems.length >
      0 ||
    duplicateFailureCodes >
      0 ||
    categoryTotal !==
      audit.failureCount ||
    actionTotal !==
      audit.failureCount ||
    !knownRegressionPass;

  divider();

  console.log(
    'FINAL UNIT FAILURE AUDIT',
  );

  divider();

  console.log(
    `Inventory: ${audit.inventoryCount}`,
  );

  console.log(
    `Failures: ${audit.failureCount}`,
  );

  console.log(
    `Mapped to handbook source: ${audit.foundInInventoryCount}/${audit.failureCount}`,
  );

  console.log(
    `Preserve unresolved: ${audit.preserveUnresolvedCount}`,
  );

  console.log(
    `Retryable: ${audit.retryableCount}`,
  );

  console.log(
    `Parser review: ${audit.parserReviewCount}`,
  );

  console.log(
    `Manual review: ${audit.manualReviewCount}`,
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
      'FAILURE SOURCE MAPPING: CLEAN',
    );

    if (
      audit.retryableCount ===
        0 &&
      audit.parserReviewCount ===
        0 &&
      audit.manualReviewCount ===
        0
    ) {
      console.log(
        'UNIT FAILURE STATUS: SAFE TO PRESERVE AS UNRESOLVED',
      );
    } else {
      console.log(
        'UNIT FAILURE STATUS: REVIEW REQUIRED',
      );
    }
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