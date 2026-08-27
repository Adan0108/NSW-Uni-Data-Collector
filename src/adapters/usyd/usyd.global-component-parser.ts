import {
  discoverUsydGlobalComponents,
  type UsydDiscoveredComponent,
} from './usyd.global-component-discovery';

import {
  fetchUsydSubjectAreaTable,
} from './usyd.subject-area-parser';

import {
  fetchUsydGlobalUnitTable,
  type UsydGlobalTableUnit,
} from './usyd.global-unit-table-parser';

import type {
  UsydSubjectAreaTable,
} from './usyd.types';

/**
 * ------------------------------------------------
 * GLOBAL COMPONENT PARSER
 * ------------------------------------------------
 *
 * Uses two complementary parsers:
 *
 * 1. Existing USYD subject-area parser
 *    -> formal requirement structure
 *
 * 2. Global physical-unit table parser
 *    -> actual unit rows
 *
 * We keep these separate because successful structural
 * parsing does not automatically guarantee that physical
 * unit rows were extracted.
 */

export interface UsydGlobalParsedComponentTable {
  url: string;

  /**
   * Existing formal requirement representation.
   */
  structure:
    UsydSubjectAreaTable;

  /**
   * Physical unit rows.
   */
  units:
    UsydGlobalTableUnit[];

  uniqueUnitCodes:
    string[];

  unitOccurrenceCount:
    number;

  uniqueUnitCount:
    number;
}

export interface UsydGlobalComponentParseFailure {
  url: string;

  stage:
    | 'STRUCTURE'
    | 'UNIT_ROWS';

  error: string;
}

export interface UsydGlobalParsedComponent {
  component:
    UsydDiscoveredComponent;

  parsedTables:
    UsydGlobalParsedComponentTable[];

  failedTables:
    UsydGlobalComponentParseFailure[];

  hasNoTable: boolean;

  complete: boolean;
}

export interface UsydGlobalComponentParseResult {
  collectedAt: string;

  totalComponents: number;

  componentsWithTables: number;

  componentsWithoutTables: number;

  totalTableUrls: number;

  successfulTables: number;

  failedTables: number;

  tablesWithUnits: number;

  tablesWithoutUnits: number;

  unitOccurrences: number;

  uniqueUnitCodes: string[];

  uniqueUnitCount: number;

  completeComponents: number;

  partialComponents: number;

  failedComponents: number;

  items:
    UsydGlobalParsedComponent[];
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

  return String(
    error,
  );
}

/**
 * ------------------------------------------------
 * PARSE ONE TABLE
 * ------------------------------------------------
 */

async function parseTable(
  url: string,
): Promise<{
  parsed:
    UsydGlobalParsedComponentTable | null;

  failures:
    UsydGlobalComponentParseFailure[];
}> {
  const failures:
    UsydGlobalComponentParseFailure[] =
    [];

  let structure:
    UsydSubjectAreaTable | null =
    null;

  try {
    structure =
      await fetchUsydSubjectAreaTable(
        url,
      );
  } catch (
    error
  ) {
    failures.push({
      url,

      stage:
        'STRUCTURE',

      error:
        errorMessage(
          error,
        ),
    });
  }

  let unitResult:
    Awaited<
      ReturnType<
        typeof fetchUsydGlobalUnitTable
      >
    > | null =
    null;

  try {
    unitResult =
      await fetchUsydGlobalUnitTable(
        url,
      );
  } catch (
    error
  ) {
    failures.push({
      url,

      stage:
        'UNIT_ROWS',

      error:
        errorMessage(
          error,
        ),
    });
  }

  if (
    !structure ||
    !unitResult
  ) {
    return {
      parsed:
        null,

      failures,
    };
  }

  return {
    parsed: {
      url,

      structure,

      units:
        unitResult.units,

      uniqueUnitCodes:
        unitResult.uniqueUnitCodes,

      unitOccurrenceCount:
        unitResult.unitOccurrenceCount,

      uniqueUnitCount:
        unitResult.uniqueUnitCount,
    },

    failures,
  };
}

/**
 * ------------------------------------------------
 * PARSE ONE COMPONENT
 * ------------------------------------------------
 */

export async function parseUsydGlobalComponent(
  component:
    UsydDiscoveredComponent,
): Promise<UsydGlobalParsedComponent> {
  const parsedTables:
    UsydGlobalParsedComponentTable[] =
    [];

  const failedTables:
    UsydGlobalComponentParseFailure[] =
    [];

  const tableUrls =
    [
      ...new Set(
        component.tableUrls,
      ),
    ];

  if (
    tableUrls.length ===
    0
  ) {
    return {
      component,

      parsedTables,

      failedTables,

      hasNoTable:
        true,

      complete:
        false,
    };
  }

  for (
    const tableUrl
    of tableUrls
  ) {
    const result =
      await parseTable(
        tableUrl,
      );

    if (
      result.parsed
    ) {
      parsedTables.push(
        result.parsed,
      );
    }

    failedTables.push(
      ...result.failures,
    );
  }

  return {
    component,

    parsedTables,

    failedTables,

    hasNoTable:
      false,

    complete:
      parsedTables.length ===
        tableUrls.length &&
      failedTables.length ===
        0,
  };
}

/**
 * ------------------------------------------------
 * PARSE ALL COMPONENTS
 * ------------------------------------------------
 */

export async function parseUsydGlobalComponents():
Promise<UsydGlobalComponentParseResult> {
  const components =
    await discoverUsydGlobalComponents();

  const items:
    UsydGlobalParsedComponent[] =
    [];

  let totalTableUrls =
    0;

  let successfulTables =
    0;

  let failedTables =
    0;

  let tablesWithUnits =
    0;

  let tablesWithoutUnits =
    0;

  let unitOccurrences =
    0;

  const globalUnitCodes =
    new Set<string>();

  for (
    let index = 0;
    index <
    components.length;
    index += 1
  ) {
    const component =
      components[
        index
      ];

    console.log(
      `[USYD component parser] ${index + 1}/${components.length} ` +
      `${component.handbookCategory} / ` +
      `${component.type} / ` +
      `${component.name}`,
    );

    totalTableUrls +=
      component.tableUrls.length;

    const parsed =
      await parseUsydGlobalComponent(
        component,
      );

    successfulTables +=
      parsed.parsedTables.length;

    failedTables +=
      parsed.failedTables.length;

    for (
      const table
      of parsed.parsedTables
    ) {
      if (
        table.uniqueUnitCount >
        0
      ) {
        tablesWithUnits +=
          1;
      } else {
        tablesWithoutUnits +=
          1;
      }

      unitOccurrences +=
        table.unitOccurrenceCount;

      for (
        const code
        of table.uniqueUnitCodes
      ) {
        globalUnitCodes.add(
          code,
        );
      }
    }

    items.push(
      parsed,
    );
  }

  const componentsWithTables =
    items.filter(
      (item) =>
        !item.hasNoTable,
    ).length;

  const componentsWithoutTables =
    items.filter(
      (item) =>
        item.hasNoTable,
    ).length;

  const completeComponents =
    items.filter(
      (item) =>
        item.complete,
    ).length;

  const partialComponents =
    items.filter(
      (item) =>
        !item.hasNoTable &&
        item.parsedTables.length >
          0 &&
        !item.complete,
    ).length;

  const failedComponents =
    items.filter(
      (item) =>
        !item.hasNoTable &&
        item.parsedTables.length ===
          0,
    ).length;

  const uniqueUnitCodes =
    [
      ...globalUnitCodes,
    ].sort();

  return {
    collectedAt:
      new Date()
        .toISOString(),

    totalComponents:
      components.length,

    componentsWithTables,

    componentsWithoutTables,

    totalTableUrls,

    successfulTables,

    failedTables,

    tablesWithUnits,

    tablesWithoutUnits,

    unitOccurrences,

    uniqueUnitCodes,

    uniqueUnitCount:
      uniqueUnitCodes.length,

    completeComponents,

    partialComponents,

    failedComponents,

    items,
  };
}