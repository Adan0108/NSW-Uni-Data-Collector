import {
  collectUsydUnitDetails,
  collectUsydUnitInventory,
} from './usyd.unit-collector';

/**
 * ------------------------------------------------
 * USYD UNIFIED UNIT COLLECTOR AUDIT
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * Validate the final merged USYD unit inventory before
 * running the expensive full unit-detail collection.
 *
 * IMPORTANT YEAR SEMANTICS
 *
 * A unit may be referenced by the 2026 handbook while its
 * /units/<CODE> page resolves to an older final published
 * offering.
 *
 * Example:
 *
 * ACCT3020 is referenced by the current handbook inventory
 * but its detail page reports year 2021.
 *
 * That is NOT an inventory failure.
 *
 * We preserve:
 *
 * - handbook context = 2026
 * - unit detail year = actual year shown by USYD
 *
 * We only flag historical unit pages for review.
 */

function divider(): void {
  console.log(
    '================================',
  );
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD UNIFIED UNIT COLLECTOR AUDIT',
  );

  divider();

  /**
   * ------------------------------------------------
   * INVENTORY
   * ------------------------------------------------
   */

  const inventory =
    await collectUsydUnitInventory();

  divider();

  console.log(
    'UNIT INVENTORY SUMMARY',
  );

  divider();

  console.log(
    `Component-table unique codes: ${inventory.componentTableCodeCount}`,
  );

  console.log(
    `Degree-specific unique codes: ${inventory.degreeSpecificCodeCount}`,
  );

  console.log(
    `Codes appearing in both sources: ${inventory.overlapCodeCount}`,
  );

  console.log(
    `Final deduplicated unit codes: ${inventory.uniqueCodeCount}`,
  );

  console.log(
    `Duplicate inventory codes: ${inventory.duplicateInventoryCodes}`,
  );

  /**
   * ------------------------------------------------
   * CURRENT REGRESSION BASELINES
   * ------------------------------------------------
   */

  const componentBaselinePass =
    inventory.componentTableCodeCount ===
    2577;

  const degreeBaselinePass =
    inventory.degreeSpecificCodeCount ===
    662;

  const uniqueRangePass =
    inventory.uniqueCodeCount >=
      Math.max(
        inventory.componentTableCodeCount,
        inventory.degreeSpecificCodeCount,
      ) &&
    inventory.uniqueCodeCount <=
      inventory.componentTableCodeCount +
        inventory.degreeSpecificCodeCount;

  const overlapMathPass =
    inventory.uniqueCodeCount ===
    inventory.componentTableCodeCount +
      inventory.degreeSpecificCodeCount -
      inventory.overlapCodeCount;

  const duplicatePass =
    inventory.duplicateInventoryCodes ===
    0;

  divider();

  console.log(
    'INVENTORY REGRESSION CHECKS',
  );

  divider();

  console.log(
    `${
      componentBaselinePass
        ? 'PASS'
        : 'FAIL'
    } Component-table baseline = 2577`,
  );

  console.log(
    `${
      degreeBaselinePass
        ? 'PASS'
        : 'FAIL'
    } Degree-specific baseline = 662`,
  );

  console.log(
    `${
      uniqueRangePass
        ? 'PASS'
        : 'FAIL'
    } Unique-count range`,
  );

  console.log(
    `${
      overlapMathPass
        ? 'PASS'
        : 'FAIL'
    } Merge arithmetic`,
  );

  console.log(
    `${
      duplicatePass
        ? 'PASS'
        : 'FAIL'
    } No duplicate inventory codes`,
  );

  /**
   * ------------------------------------------------
   * SOURCE DISTRIBUTION
   * ------------------------------------------------
   */

  const componentOnly =
    inventory.items.filter(
      (item) => {
        const kinds =
          new Set(
            item.sources.map(
              (source) =>
                source.kind,
            ),
          );

        return (
          kinds.has(
            'COMPONENT_TABLE',
          ) &&
          !kinds.has(
            'DEGREE_SPECIFIC_TABLE',
          )
        );
      },
    );

  const degreeOnly =
    inventory.items.filter(
      (item) => {
        const kinds =
          new Set(
            item.sources.map(
              (source) =>
                source.kind,
            ),
          );

        return (
          kinds.has(
            'DEGREE_SPECIFIC_TABLE',
          ) &&
          !kinds.has(
            'COMPONENT_TABLE',
          )
        );
      },
    );

  const both =
    inventory.items.filter(
      (item) =>
        item.appearsInBothSourceKinds,
    );

  divider();

  console.log(
    'UNIT SOURCE DISTRIBUTION',
  );

  divider();

  console.log(
    `Component tables only: ${componentOnly.length}`,
  );

  console.log(
    `Degree-specific only: ${degreeOnly.length}`,
  );

  console.log(
    `Both source kinds: ${both.length}`,
  );

  /**
   * ------------------------------------------------
   * SAMPLE OVERLAP
   * ------------------------------------------------
   */

  divider();

  console.log(
    'SAMPLE UNITS FOUND IN BOTH SOURCES',
  );

  divider();

  if (
    both.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const item
      of both.slice(
        0,
        20,
      )
    ) {
      console.log(
        item.code,
      );

      for (
        const source
        of item.sources.slice(
          0,
          5,
        )
      ) {
        console.log(
          `  ${source.kind} / ` +
          `${source.handbookCategory} / ` +
          `${source.ownerName}`,
        );

        console.log(
          `    ${source.tableUrl}`,
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

  /**
   * ------------------------------------------------
   * SAMPLE DEGREE-ONLY UNITS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'SAMPLE DEGREE-SPECIFIC-ONLY UNITS',
  );

  divider();

  for (
    const item
    of degreeOnly.slice(
      0,
      20,
    )
  ) {
    console.log(
      `${item.code} -> ${item.unitUrl}`,
    );

    for (
      const source
      of item.sources.slice(
        0,
        3,
      )
    ) {
      console.log(
        `  ${source.handbookCategory} / ${source.ownerName}`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * INVENTORY STRUCTURE
   * ------------------------------------------------
   */

  const invalidCodes =
    inventory.items.filter(
      (item) =>
        !/^[A-Z]{4}\d{4}$/.test(
          item.code,
        ),
    );

  const invalidUrls =
    inventory.items.filter(
      (item) =>
        item.unitUrl !==
        `https://www.sydney.edu.au/units/${item.code}`,
    );

  const itemsWithoutSources =
    inventory.items.filter(
      (item) =>
        item.sources.length ===
        0,
    );

  divider();

  console.log(
    'INVENTORY STRUCTURE CHECK',
  );

  divider();

  console.log(
    `Invalid unit codes: ${invalidCodes.length}`,
  );

  console.log(
    `Invalid unit URLs: ${invalidUrls.length}`,
  );

  console.log(
    `Units without sources: ${itemsWithoutSources.length}`,
  );

  /**
   * ------------------------------------------------
   * DETAIL SAMPLE
   * ------------------------------------------------
   */

  divider();

  console.log(
    'UNIT DETAIL SAMPLE',
  );

  divider();

  const detailSample =
    await collectUsydUnitDetails(
      inventory,

      {
        limit:
          20,

        concurrency:
          4,
      },
    );

  console.log(
    `Requested: ${detailSample.requestedCount}`,
  );

  console.log(
    `Successful: ${detailSample.successfulCount}`,
  );

  console.log(
    `Failed: ${detailSample.failedCount}`,
  );

  /**
   * ------------------------------------------------
   * SAMPLE DETAILS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'SAMPLE PARSED UNIT DETAILS',
  );

  divider();

  for (
    const unit
    of detailSample.units.slice(
      0,
      10,
    )
  ) {
    console.log(
      `${unit.code} — ${unit.name}`,
    );

    console.log(
      `  Year: ${unit.year}`,
    );

    console.log(
      `  Study level: ${unit.studyLevel ?? 'NONE'}`,
    );

    console.log(
      `  Academic unit: ${unit.academicUnit ?? 'NONE'}`,
    );

    console.log(
      `  Faculty: ${unit.managingFaculty ?? 'NONE'}`,
    );

    console.log(
      `  CP: ${unit.creditPoints ?? 'NONE'}`,
    );

    console.log(
      `  P: ${unit.accessConditions.prerequisite ?? 'NONE'}`,
    );

    console.log(
      `  C: ${unit.accessConditions.corequisite ?? 'NONE'}`,
    );

    console.log(
      `  N: ${unit.accessConditions.prohibition ?? 'NONE'}`,
    );

    console.log(
      `  A: ${unit.accessConditions.assumedKnowledge ?? 'NONE'}`,
    );

    console.log(
      `  Availability records: ${unit.availabilities.length}`,
    );

    console.log(
      `  Learning outcomes: ${unit.learningOutcomes.length}`,
    );

    console.log(
      `  ${unit.sourceUrl}`,
    );

    console.log('');
  }

  /**
   * ------------------------------------------------
   * DETAIL FAILURES
   * ------------------------------------------------
   */

  divider();

  console.log(
    'UNIT DETAIL SAMPLE FAILURES',
  );

  divider();

  if (
    detailSample.failures.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const failure
      of detailSample.failures
    ) {
      console.log(
        failure.code,
      );

      console.log(
        `  ${failure.url}`,
      );

      console.log(
        `  ${failure.error}`,
      );

      console.log('');
    }
  }

  /**
   * ------------------------------------------------
   * YEAR SEMANTIC AUDIT
   * ------------------------------------------------
   *
   * Units referenced by the 2026 handbook may have an
   * older detail-page year when the unit is no longer
   * actively offered.
   *
   * That is REVIEW information, not an extraction error.
   */

  const currentYearUnits =
    detailSample.units.filter(
      (unit) =>
        unit.year ===
        2026,
    );

  const historicalDetailUnits =
    detailSample.units.filter(
      (unit) =>
        unit.year !==
        2026,
    );

  const futureDetailUnits =
    detailSample.units.filter(
      (unit) =>
        unit.year >
        2026,
    );

  const invalidYearUnits =
    detailSample.units.filter(
      (unit) =>
        !Number.isInteger(
          unit.year,
        ) ||
        unit.year <
        1900,
    );

  const wrongCodeUnits =
    detailSample.units.filter(
      (unit) =>
        !inventory.items.some(
          (inventoryItem) =>
            inventoryItem.code ===
            unit.code,
        ),
    );

  divider();

  console.log(
    'UNIT DETAIL YEAR AUDIT',
  );

  divider();

  console.log(
    `2026 detail pages: ${currentYearUnits.length}`,
  );

  console.log(
    `Historical/latest detail pages: ${historicalDetailUnits.length}`,
  );

  console.log(
    `Future detail pages: ${futureDetailUnits.length}`,
  );

  console.log(
    `Invalid years: ${invalidYearUnits.length}`,
  );

  console.log(
    `Returned codes absent from inventory: ${wrongCodeUnits.length}`,
  );

  if (
    historicalDetailUnits.length >
    0
  ) {
    console.log('');

    console.log(
      'HISTORICAL DETAIL PAGE SAMPLE',
    );

    for (
      const unit
      of historicalDetailUnits.slice(
        0,
        20,
      )
    ) {
      console.log(
        `  ${unit.code} — detail year ${unit.year}`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * FINAL RESULT
   * ------------------------------------------------
   */

  const hardFailure =
    !componentBaselinePass ||
    !degreeBaselinePass ||
    !uniqueRangePass ||
    !overlapMathPass ||
    !duplicatePass ||
    invalidCodes.length >
      0 ||
    invalidUrls.length >
      0 ||
    itemsWithoutSources.length >
      0 ||
    detailSample.failedCount >
      0 ||
    detailSample.successfulCount !==
      detailSample.requestedCount ||
    invalidYearUnits.length >
      0 ||
    futureDetailUnits.length >
      0 ||
    wrongCodeUnits.length >
      0;

  divider();

  console.log(
    'FINAL UNIFIED UNIT COLLECTOR AUDIT',
  );

  divider();

  console.log(
    `Component-table codes: ${inventory.componentTableCodeCount}`,
  );

  console.log(
    `Degree-specific codes: ${inventory.degreeSpecificCodeCount}`,
  );

  console.log(
    `Overlap: ${inventory.overlapCodeCount}`,
  );

  console.log(
    `Final unique unit codes: ${inventory.uniqueCodeCount}`,
  );

  console.log(
    `Duplicate codes: ${inventory.duplicateInventoryCodes}`,
  );

  console.log(
    `Detail sample successful: ${detailSample.successfulCount}/${detailSample.requestedCount}`,
  );

  console.log(
    `Detail sample failures: ${detailSample.failedCount}`,
  );

  console.log(
    `Historical detail pages in sample: ${historicalDetailUnits.length}`,
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
    !hardFailure &&
    historicalDetailUnits.length >
      0
  ) {
    console.log(
      'UNIT INVENTORY STATUS: CLEAN',
    );

    console.log(
      'UNIT DETAIL STATUS: PASS WITH HISTORICAL PAGE REVIEW',
    );
  } else if (
    !hardFailure
  ) {
    console.log(
      'UNIT INVENTORY STATUS: CLEAN',
    );

    console.log(
      'UNIT DETAIL STATUS: CLEAN',
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