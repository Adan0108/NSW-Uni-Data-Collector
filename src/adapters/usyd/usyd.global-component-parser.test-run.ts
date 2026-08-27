import {
  parseUsydGlobalComponents,
  type UsydGlobalParsedComponent,
} from './usyd.global-component-parser';

import type {
  UsydHandbookCategory,
} from './usyd.handbook-discovery';

const HANDBOOKS:
  UsydHandbookCategory[] = [
    'ARCHITECTURE',
    'ARTS',
    'BUSINESS',
    'ENGINEERING',
    'INTERDISCIPLINARY',
    'MEDICINE_HEALTH',
    'SCIENCE',
    'CONSERVATORIUM',
    'LAW',
  ];

function divider(): void {
  console.log(
    '================================',
  );
}

function printFailure(
  item:
    UsydGlobalParsedComponent,
): void {
  console.log(
    `${item.component.handbookCategory} / ` +
    `${item.component.type} / ` +
    `${item.component.name}`,
  );

  for (
    const failure
    of item.failedTables
  ) {
    console.log(
      `  ${failure.stage}`,
    );

    console.log(
      `  ${failure.url}`,
    );

    console.log(
      `  ${failure.error}`,
    );
  }

  console.log('');
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD GLOBAL COMPONENT + UNIT TABLE AUDIT',
  );

  divider();

  const result =
    await parseUsydGlobalComponents();

  /**
   * ------------------------------------------------
   * GLOBAL SUMMARY
   * ------------------------------------------------
   */

  divider();

  console.log(
    'GLOBAL PARSER SUMMARY',
  );

  divider();

  console.log(
    `Total components: ${result.totalComponents}`,
  );

  console.log(
    `Components with tables: ${result.componentsWithTables}`,
  );

  console.log(
    `Components without tables: ${result.componentsWithoutTables}`,
  );

  console.log(
    `Table URLs: ${result.totalTableUrls}`,
  );

  console.log(
    `Fully parsed tables: ${result.successfulTables}`,
  );

  console.log(
    `Parser-stage failures: ${result.failedTables}`,
  );

  console.log(
    `Tables containing units: ${result.tablesWithUnits}`,
  );

  console.log(
    `Tables containing zero units: ${result.tablesWithoutUnits}`,
  );

  console.log(
    `Unit row occurrences: ${result.unitOccurrences}`,
  );

  console.log(
    `Unique unit codes: ${result.uniqueUnitCount}`,
  );

  /**
   * ------------------------------------------------
   * BY HANDBOOK
   * ------------------------------------------------
   */

  divider();

  console.log(
    'PARSE RESULT BY HANDBOOK',
  );

  divider();

  for (
    const handbook
    of HANDBOOKS
  ) {
    const items =
      result.items.filter(
        (item) =>
          item.component.handbookCategory ===
          handbook,
      );

    const tableCount =
      items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.component.tableUrls.length,
        0,
      );

    const parsedCount =
      items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.parsedTables.length,
        0,
      );

    const tableWithUnits =
      items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.parsedTables.filter(
            (table) =>
              table.uniqueUnitCount >
              0,
          ).length,
        0,
      );

    const zeroUnitTables =
      items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.parsedTables.filter(
            (table) =>
              table.uniqueUnitCount ===
              0,
          ).length,
        0,
      );

    const unitCodes =
      new Set<string>();

    for (
      const item
      of items
    ) {
      for (
        const table
        of item.parsedTables
      ) {
        for (
          const code
          of table.uniqueUnitCodes
        ) {
          unitCodes.add(
            code,
          );
        }
      }
    }

    const failures =
      items.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.failedTables.length,
        0,
      );

    console.log(
      handbook,
    );

    console.log(
      `  Components: ${items.length}`,
    );

    console.log(
      `  Tables: ${tableCount}`,
    );

    console.log(
      `  Fully parsed: ${parsedCount}`,
    );

    console.log(
      `  Tables with units: ${tableWithUnits}`,
    );

    console.log(
      `  Zero-unit tables: ${zeroUnitTables}`,
    );

    console.log(
      `  Unique unit codes: ${unitCodes.size}`,
    );

    console.log(
      `  Failures: ${failures}`,
    );

    console.log('');
  }

  /**
   * ------------------------------------------------
   * FAILED PARSES
   * ------------------------------------------------
   */

  const failedComponents =
    result.items.filter(
      (item) =>
        item.failedTables.length >
        0,
    );

  divider();

  console.log(
    'FAILED TABLE PARSES',
  );

  divider();

  if (
    failedComponents.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const item
      of failedComponents
    ) {
      printFailure(
        item,
      );
    }
  }

  /**
   * ------------------------------------------------
   * ZERO-UNIT TABLES
   * ------------------------------------------------
   */

  const zeroUnitTables:
    Array<{
      handbook: string;

      component: string;

      url: string;
    }> =
    [];

  for (
    const item
    of result.items
  ) {
    for (
      const table
      of item.parsedTables
    ) {
      if (
        table.uniqueUnitCount ===
        0
      ) {
        zeroUnitTables.push({
          handbook:
            item.component.handbookCategory,

          component:
            item.component.name,

          url:
            table.url,
        });
      }
    }
  }

  divider();

  console.log(
    'TABLES WITH ZERO PHYSICAL UNIT ROWS',
  );

  divider();

  if (
    zeroUnitTables.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const item
      of zeroUnitTables.slice(
        0,
        100,
      )
    ) {
      console.log(
        `${item.handbook} / ${item.component}`,
      );

      console.log(
        `  ${item.url}`,
      );
    }

    if (
      zeroUnitTables.length >
      100
    ) {
      console.log(
        `... ${zeroUnitTables.length - 100} more`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * COMPONENTS WITHOUT TABLES
   * ------------------------------------------------
   */

  const withoutTables =
    result.items.filter(
      (item) =>
        item.hasNoTable,
    );

  divider();

  console.log(
    'COMPONENTS WITHOUT TABLES',
  );

  divider();

  if (
    withoutTables.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const item
      of withoutTables
    ) {
      console.log(
        `${item.component.handbookCategory} / ` +
        `${item.component.type} / ` +
        `${item.component.name}`,
      );

      console.log(
        `  ${item.component.overviewUrl}`,
      );

      console.log('');
    }
  }

  /**
   * ------------------------------------------------
   * SAMPLE EXTRACTED UNITS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'SAMPLE EXTRACTED UNITS',
  );

  divider();

  let sampleCount =
    0;

  for (
    const item
    of result.items
  ) {
    for (
      const table
      of item.parsedTables
    ) {
      for (
        const unit
        of table.units
      ) {
        console.log(
          `${unit.code} — ${unit.title}`,
        );

        console.log(
          `  CP: ${
            unit.creditPoints ??
            'UNKNOWN'
          }`,
        );

        console.log(
          `  Section: ${
            unit.section ??
            'UNKNOWN'
          }`,
        );

        console.log(
          `  A/P/C/N: ${
            unit.accessConditionsRaw ??
            'NONE'
          }`,
        );

        console.log(
          `  ${unit.sourceUrl}`,
        );

        console.log('');

        sampleCount +=
          1;

        if (
          sampleCount >=
          30
        ) {
          break;
        }
      }

      if (
        sampleCount >=
        30
      ) {
        break;
      }
    }

    if (
      sampleCount >=
        30
    ) {
      break;
    }
  }

  /**
   * ------------------------------------------------
   * SCIENCE REGRESSION
   * ------------------------------------------------
   */

  const scienceItems =
    result.items.filter(
      (item) =>
        item.component.handbookCategory ===
        'SCIENCE',
    );

  const scienceTables =
    scienceItems.flatMap(
      (item) =>
        item.parsedTables,
    );

  const scienceTablesWithUnits =
    scienceTables.filter(
      (table) =>
        table.uniqueUnitCount >
        0,
    ).length;

  const scienceZeroTables =
    scienceTables.filter(
      (table) =>
        table.uniqueUnitCount ===
        0,
    ).length;

  const scienceUnitCodes =
    new Set<string>();

  for (
    const table
    of scienceTables
  ) {
    for (
      const code
      of table.uniqueUnitCodes
    ) {
      scienceUnitCodes.add(
        code,
      );
    }
  }

  divider();

  console.log(
    'SCIENCE UNIT EXTRACTION REGRESSION',
  );

  divider();

  console.log(
    `Science parsed tables: ${scienceTables.length}`,
  );

  console.log(
    `Science tables with units: ${scienceTablesWithUnits}`,
  );

  console.log(
    `Science zero-unit tables: ${scienceZeroTables}`,
  );

  console.log(
    `Science unique unit codes: ${scienceUnitCodes.size}`,
  );

  const sciencePass =
    scienceTables.length >
      0 &&
    scienceTablesWithUnits >
      0;

  console.log(
    `${
      sciencePass
        ? 'PASS'
        : 'FAIL'
    } Science unit extraction baseline`,
  );

  /**
   * ------------------------------------------------
   * FINAL AUDIT
   * ------------------------------------------------
   */

  const successRate =
    result.totalTableUrls ===
      0
      ? 0
      : (
          result.tablesWithUnits /
          result.totalTableUrls
        ) *
        100;

  divider();

  console.log(
    'FINAL GLOBAL UNIT EXTRACTION AUDIT',
  );

  divider();

  console.log(
    `Components: ${result.totalComponents}`,
  );

  console.log(
    `Table URLs: ${result.totalTableUrls}`,
  );

  console.log(
    `Tables with extracted units: ${result.tablesWithUnits}`,
  );

  console.log(
    `Zero-unit tables: ${result.tablesWithoutUnits}`,
  );

  console.log(
    `Physical-unit extraction rate: ${successRate.toFixed(
      2,
    )}%`,
  );

  console.log(
    `Unit occurrences: ${result.unitOccurrences}`,
  );

  console.log(
    `Unique global unit codes: ${result.uniqueUnitCount}`,
  );

  console.log(
    `Parser failures: ${result.failedTables}`,
  );

  console.log(
    `Components without tables: ${result.componentsWithoutTables}`,
  );

  const hardFailure =
    result.successfulTables ===
      0 ||
    result.uniqueUnitCount ===
      0 ||
    !sciencePass;

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
    (
      result.tablesWithoutUnits >
        0 ||
      result.failedTables >
        0 ||
      result.componentsWithoutTables >
        0
    )
  ) {
    console.log(
      'UNIT EXTRACTION STATUS: REVIEW',
    );
  } else if (
    !hardFailure
  ) {
    console.log(
      'UNIT EXTRACTION STATUS: CLEAN',
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