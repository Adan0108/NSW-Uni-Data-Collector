import {
  parseUsydGlobalComponents,
} from './usyd.global-component-parser';

import {
  discoverUsydDegreeSpecificTables,
  type UsydDegreeSpecificTable,
} from './usyd.degree-specific-table-discovery';

import {
  fetchUsydGlobalUnitTable,
} from './usyd.global-unit-table-parser';

import {
  fetchUsydUnit,
} from './usyd.unit-parser';

import type {
  UsydUnit,
} from './usyd.types';

/**
 * ------------------------------------------------
 * USYD UNIFIED UNIT COLLECTOR
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * Build one deduplicated inventory of all USYD units
 * discovered from:
 *
 * 1. reusable component tables
 * 2. undergraduate degree-specific tables
 *
 * Then fetch unit-detail pages exactly once per unique
 * unit code.
 *
 * IMPORTANT
 *
 * We keep inventory collection and detail collection
 * separate.
 *
 * Why?
 *
 * The inventory stage already requires hundreds of
 * handbook-table requests.
 *
 * Fetching several thousand individual unit pages is a
 * much larger operation and should only start after the
 * merged code inventory passes validation.
 */

/**
 * ------------------------------------------------
 * SOURCE TYPES
 * ------------------------------------------------
 */

export type UsydUnitSourceKind =
  | 'COMPONENT_TABLE'
  | 'DEGREE_SPECIFIC_TABLE';

export interface UsydUnitSource {
  kind: UsydUnitSourceKind;

  /**
   * Handbook category where known.
   *
   * Examples:
   *
   * ARTS
   * SCIENCE
   * ARCHITECTURE
   */
  handbookCategory: string;

  /**
   * Component/course name associated with this unit.
   */
  ownerName: string;

  /**
   * Physical handbook table containing the unit.
   */
  tableUrl: string;
}

/**
 * ------------------------------------------------
 * INVENTORY ITEM
 * ------------------------------------------------
 */

export interface UsydUnitInventoryItem {
  code: string;

  unitUrl: string;

  sources: UsydUnitSource[];

  /**
   * True when the unit occurs in both:
   *
   * - reusable component tables
   * - degree-specific tables
   */
  appearsInBothSourceKinds: boolean;
}

export interface UsydUnitInventory {
  collectedAt: string;

  componentTableCodeCount: number;

  degreeSpecificCodeCount: number;

  overlapCodeCount: number;

  uniqueCodeCount: number;

  duplicateInventoryCodes: number;

  items: UsydUnitInventoryItem[];
}

/**
 * ------------------------------------------------
 * DETAIL COLLECTION
 * ------------------------------------------------
 */

export interface UsydUnitDetailFailure {
  code: string;

  url: string;

  error: string;
}

export interface UsydUnitDetailCollection {
  collectedAt: string;

  requestedCount: number;

  successfulCount: number;

  failedCount: number;

  units: UsydUnit[];

  failures: UsydUnitDetailFailure[];
}

export interface UsydUnitDetailCollectionOptions {
  /**
   * Restrict collection to the first N codes.
   *
   * Useful for tests.
   *
   * Omit for the eventual full production collection.
   */
  limit?: number;

  /**
   * Number of unit pages fetched at once.
   *
   * Keep this conservative.
   */
  concurrency?: number;
}

/**
 * ------------------------------------------------
 * HELPERS
 * ------------------------------------------------
 */

function buildUnitUrl(
  code: string,
): string {
  return (
    'https://www.sydney.edu.au/units/' +
    encodeURIComponent(
      code,
    )
  );
}

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

function inventoryKey(
  code: string,
): string {
  return code
    .trim()
    .toUpperCase();
}

function sourceKey(
  source: UsydUnitSource,
): string {
  return [
    source.kind,
    source.handbookCategory,
    source.ownerName,
    source.tableUrl,
  ].join(
    '::',
  );
}

/**
 * ------------------------------------------------
 * INVENTORY MAP HELPER
 * ------------------------------------------------
 */

function addInventorySource(
  inventoryMap:
    Map<
      string,
      UsydUnitInventoryItem
    >,

  rawCode: string,

  source: UsydUnitSource,
): void {
  const code =
    inventoryKey(
      rawCode,
    );

  if (
    !/^[A-Z]{4}\d{4}$/.test(
      code,
    )
  ) {
    return;
  }

  let item =
    inventoryMap.get(
      code,
    );

  if (
    !item
  ) {
    item = {
      code,

      unitUrl:
        buildUnitUrl(
          code,
        ),

      sources:
        [],

      appearsInBothSourceKinds:
        false,
    };

    inventoryMap.set(
      code,
      item,
    );
  }

  const existingSourceKeys =
    new Set(
      item.sources.map(
        sourceKey,
      ),
    );

  const nextSourceKey =
    sourceKey(
      source,
    );

  if (
    !existingSourceKeys.has(
      nextSourceKey,
    )
  ) {
    item.sources.push(
      source,
    );
  }
}

/**
 * ------------------------------------------------
 * COMPONENT-TABLE UNITS
 * ------------------------------------------------
 *
 * This intentionally uses the already-validated global
 * component parser.
 *
 * That parser currently covers:
 *
 * - Arts
 * - Business
 * - Engineering
 * - Interdisciplinary/Table S
 * - Science
 * - Conservatorium
 */

async function collectComponentTableUnits(
  inventoryMap:
    Map<
      string,
      UsydUnitInventoryItem
    >,
): Promise<Set<string>> {
  console.log(
    '[USYD unit collector] collecting component-table codes...',
  );

  const components =
    await parseUsydGlobalComponents();

  const codes =
    new Set<string>();

  for (
    const item
    of components.items
  ) {
    for (
      const table
      of item.parsedTables
    ) {
      for (
        const code
        of table.uniqueUnitCodes
      ) {
        const normalized =
          inventoryKey(
            code,
          );

        codes.add(
          normalized,
        );

        addInventorySource(
          inventoryMap,

          normalized,

          {
            kind:
              'COMPONENT_TABLE',

            handbookCategory:
              item.component.handbookCategory,

            ownerName:
              item.component.name,

            tableUrl:
              table.url,
          },
        );
      }
    }
  }

  return codes;
}

/**
 * ------------------------------------------------
 * DEGREE-SPECIFIC UNITS
 * ------------------------------------------------
 */

async function collectDegreeSpecificTableUnits(
  inventoryMap:
    Map<
      string,
      UsydUnitInventoryItem
    >,
): Promise<{
  codes: Set<string>;

  tables:
    UsydDegreeSpecificTable[];
}> {
  console.log(
    '[USYD unit collector] discovering undergraduate degree-specific tables...',
  );

  const tables =
    await discoverUsydDegreeSpecificTables();

  const codes =
    new Set<string>();

  for (
    let index = 0;
    index <
    tables.length;
    index += 1
  ) {
    const table =
      tables[
        index
      ];

    console.log(
      `[USYD unit collector] degree table ${index + 1}/${tables.length} ` +
      `${table.handbookCategory} / ${table.courseName}`,
    );

    const parsed =
      await fetchUsydGlobalUnitTable(
        table.tableUrl,
      );

    for (
      const code
      of parsed.uniqueUnitCodes
    ) {
      const normalized =
        inventoryKey(
          code,
        );

      codes.add(
        normalized,
      );

      addInventorySource(
        inventoryMap,

        normalized,

        {
          kind:
            'DEGREE_SPECIFIC_TABLE',

          handbookCategory:
            table.handbookCategory,

          ownerName:
            table.courseName,

          tableUrl:
            table.tableUrl,
        },
      );
    }
  }

  return {
    codes,

    tables,
  };
}

/**
 * ------------------------------------------------
 * PUBLIC INVENTORY COLLECTOR
 * ------------------------------------------------
 */

export async function collectUsydUnitInventory():
Promise<UsydUnitInventory> {
  const inventoryMap =
    new Map<
      string,
      UsydUnitInventoryItem
    >();

  /**
   * First source:
   *
   * global reusable components.
   */
  const componentCodes =
    await collectComponentTableUnits(
      inventoryMap,
    );

  /**
   * Second source:
   *
   * undergraduate degree-specific tables.
   */
  const degreeSpecific =
    await collectDegreeSpecificTableUnits(
      inventoryMap,
    );

  const degreeCodes =
    degreeSpecific.codes;

  /**
   * ------------------------------------------------
   * OVERLAP
   * ------------------------------------------------
   */

  const overlappingCodes =
    [
      ...componentCodes,
    ].filter(
      (code) =>
        degreeCodes.has(
          code,
        ),
    );

  /**
   * Mark items occurring in both source categories.
   */
  for (
    const item
    of inventoryMap.values()
  ) {
    const sourceKinds =
      new Set(
        item.sources.map(
          (source) =>
            source.kind,
        ),
      );

    item.appearsInBothSourceKinds =
      sourceKinds.has(
        'COMPONENT_TABLE',
      ) &&
      sourceKinds.has(
        'DEGREE_SPECIFIC_TABLE',
      );

    item.sources.sort(
      (
        left,
        right,
      ) => {
        const kindCompare =
          left.kind.localeCompare(
            right.kind,
          );

        if (
          kindCompare !==
          0
        ) {
          return kindCompare;
        }

        const handbookCompare =
          left.handbookCategory.localeCompare(
            right.handbookCategory,
          );

        if (
          handbookCompare !==
          0
        ) {
          return handbookCompare;
        }

        const ownerCompare =
          left.ownerName.localeCompare(
            right.ownerName,
          );

        if (
          ownerCompare !==
          0
        ) {
          return ownerCompare;
        }

        return left.tableUrl.localeCompare(
          right.tableUrl,
        );
      },
    );
  }

  const items =
    [
      ...inventoryMap.values(),
    ].sort(
      (
        left,
        right,
      ) =>
        left.code.localeCompare(
          right.code,
        ),
    );

  /**
   * This should always be zero because inventoryMap is
   * keyed by normalized unit code.
   *
   * We calculate it anyway as a regression assertion.
   */
  const duplicateInventoryCodes =
    items.length -
    new Set(
      items.map(
        (item) =>
          item.code,
      ),
    ).size;

  return {
    collectedAt:
      new Date()
        .toISOString(),

    componentTableCodeCount:
      componentCodes.size,

    degreeSpecificCodeCount:
      degreeCodes.size,

    overlapCodeCount:
      overlappingCodes.length,

    uniqueCodeCount:
      items.length,

    duplicateInventoryCodes,

    items,
  };
}

/**
 * ------------------------------------------------
 * DETAIL WORKER
 * ------------------------------------------------
 */

async function collectOneUnit(
  item: UsydUnitInventoryItem,
): Promise<
  | {
      ok: true;

      unit: UsydUnit;
    }
  | {
      ok: false;

      failure:
        UsydUnitDetailFailure;
    }
> {
  try {
    /**
     * Existing unit parser.
     *
     * It already parses:
     *
     * - name
     * - year
     * - study level
     * - academic unit
     * - managing faculty
     * - credit points
     * - description
     * - prerequisites
     * - corequisites
     * - prohibitions
     * - assumed knowledge
     * - availability
     * - learning outcomes
     */
    const unit =
      await fetchUsydUnit(
        item.code,
      );

    return {
      ok:
        true,

      unit,
    };
  } catch (
    error
  ) {
    return {
      ok:
        false,

      failure: {
        code:
          item.code,

        url:
          item.unitUrl,

        error:
          errorMessage(
            error,
          ),
      },
    };
  }
}

/**
 * ------------------------------------------------
 * DETAIL COLLECTION
 * ------------------------------------------------
 *
 * The collector uses small batches instead of firing
 * thousands of simultaneous requests at USYD.
 */

export async function collectUsydUnitDetails(
  inventory:
    UsydUnitInventory,

  options:
    UsydUnitDetailCollectionOptions =
    {},
): Promise<UsydUnitDetailCollection> {
  const concurrency =
    Math.max(
      1,

      Math.min(
        options.concurrency ??
          4,

        8,
      ),
    );

  const requestedItems =
    options.limit ===
      undefined
      ? inventory.items
      : inventory.items.slice(
          0,

          Math.max(
            0,
            options.limit,
          ),
        );

  const units:
    UsydUnit[] =
    [];

  const failures:
    UsydUnitDetailFailure[] =
    [];

  for (
    let start = 0;
    start <
    requestedItems.length;
    start +=
    concurrency
  ) {
    const batch =
      requestedItems.slice(
        start,
        start +
          concurrency,
      );

    console.log(
      `[USYD unit collector] detail ${start + 1}-` +
      `${Math.min(start + batch.length, requestedItems.length)}` +
      `/${requestedItems.length}`,
    );

    const results =
      await Promise.all(
        batch.map(
          collectOneUnit,
        ),
      );

    for (
      const result
      of results
    ) {
      if (
        result.ok
      ) {
        units.push(
          result.unit,
        );
      } else {
        failures.push(
          result.failure,
        );
      }
    }
  }

  units.sort(
    (
      left,
      right,
    ) =>
      left.code.localeCompare(
        right.code,
      ),
  );

  failures.sort(
    (
      left,
      right,
    ) =>
      left.code.localeCompare(
        right.code,
      ),
  );

  return {
    collectedAt:
      new Date()
        .toISOString(),

    requestedCount:
      requestedItems.length,

    successfulCount:
      units.length,

    failedCount:
      failures.length,

    units,

    failures,
  };
}