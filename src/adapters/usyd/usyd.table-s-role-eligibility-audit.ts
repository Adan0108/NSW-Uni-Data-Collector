import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydTablePoolRoleGaps,
} from './usyd.table-pool-role-gap-audit';

const HANDBOOK_YEAR =
  2026;

const COMPONENT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
    'usyd-components-complete.json',
  );

type UnknownRecord =
  Record<string, unknown>;

interface ComponentRecord {
  index: number;
  name: string;
  type: string;
  handbook: string;
  sourceUrl: string | null;
  overviewUrl: string | null;
  tableUrl: string | null;
}

export interface UsydTableSRoleEligibilityFamily {
  name: string;

  existingTypes: string[];

  requestedMissingTypes: string[];

  sourceUrls: string[];
  overviewUrls: string[];
  tableUrls: string[];

  sourceRecordCount: number;

  /**
   * Diagnostic only.
   * We deliberately do not infer a MINOR/PROGRAM role merely because
   * the same Table S subject area exists as a MAJOR.
   */
  canAutoCreateRole:
    false;
}

export interface UsydTableSRoleEligibilityAudit {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    tableSRoleGapGroups: number;
    uniqueRequestedMissingTypes: number;
    tableSComponentFamilies: number;
    familiesWithMultipleSourceRecords: number;
  };

  requestedMissingTypes: string[];

  degreeRoleGaps: Array<{
    degreeCode: string;
    degreeTitle: string;
    requestedTypes: string[];
  }>;

  families: UsydTableSRoleEligibilityFamily[];
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function stringValue(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value =
      record[key];

    if (
      typeof value === 'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function normalize(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadComponents():
Promise<ComponentRecord[]> {
  const raw =
    await fs.readFile(
      COMPONENT_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as unknown;

  if (
    !isRecord(parsed) ||
    !Array.isArray(parsed.components)
  ) {
    throw new Error(
      'USYD complete component catalogue is missing components[].',
    );
  }

  const output:
    ComponentRecord[] =
    [];

  parsed.components.forEach(
    (
      item,
      index,
    ) => {
      if (!isRecord(item)) {
        return;
      }

      const name =
        stringValue(
          item,
          [
            'name',
            'title',
            'componentName',
          ],
        );

      const type =
        stringValue(
          item,
          [
            'type',
            'componentType',
          ],
        );

      const handbook =
        stringValue(
          item,
          [
            'handbook',
            'handbookCategory',
            'category',
          ],
        );

      if (
        !name ||
        !type ||
        !handbook
      ) {
        return;
      }

      output.push({
        index,
        name,
        type:
          type.toUpperCase(),
        handbook:
          handbook.toUpperCase(),
        sourceUrl:
          stringValue(
            item,
            [
              'sourceUrl',
              'url',
            ],
          ),
        overviewUrl:
          stringValue(
            item,
            [
              'overviewUrl',
            ],
          ),
        tableUrl:
          stringValue(
            item,
            [
              'tableUrl',
              'unitTableUrl',
              'unitOfStudyTableUrl',
            ],
          ),
      });
    },
  );

  return output;
}

function uniqueStrings(
  values:
    Array<string | null>,
): string[] {
  return [
    ...new Set(
      values.filter(
        (
          value,
        ): value is string =>
          typeof value ===
            'string' &&
          value.length >
            0,
      ),
    ),
  ].sort();
}

export async function auditUsydTableSRoleEligibility():
Promise<UsydTableSRoleEligibilityAudit> {
  const [
    gapAudit,
    components,
  ] =
    await Promise.all(
      [
        auditUsydTablePoolRoleGaps(),
        loadComponents(),
      ],
    );

  const tableSGaps =
    gapAudit.gaps.filter(
      (
        gap,
      ) =>
        gap.classification ===
          'TABLE_S' &&
        gap.status ===
          'ROLE_VARIANT_MISSING',
    );

  const requestedMissingTypes =
    [
      ...new Set(
        tableSGaps.flatMap(
          (
            gap,
          ) =>
            gap.requestedTypes,
        ),
      ),
    ].sort();

  const tableSComponents =
    components.filter(
      (
        component,
      ) =>
        component.handbook ===
          'INTERDISCIPLINARY',
    );

  const grouped =
    new Map<
      string,
      ComponentRecord[]
    >();

  for (
    const component
    of tableSComponents
  ) {
    const key =
      normalize(
        component.name,
      );

    const existing =
      grouped.get(
        key,
      );

    if (existing) {
      existing.push(
        component,
      );
    } else {
      grouped.set(
        key,
        [
          component,
        ],
      );
    }
  }

  const families:
    UsydTableSRoleEligibilityFamily[] =
    [];

  for (
    const records
    of grouped.values()
  ) {
    const first =
      records[0];

    families.push({
      name:
        first.name,

      existingTypes:
        [
          ...new Set(
            records.map(
              (
                record,
              ) =>
                record.type,
            ),
          ),
        ].sort(),

      requestedMissingTypes:
        requestedMissingTypes.filter(
          (
            type,
          ) =>
            !records.some(
              (
                record,
              ) =>
                record.type ===
                type,
            ),
        ),

      sourceUrls:
        uniqueStrings(
          records.map(
            (
              record,
            ) =>
              record.sourceUrl,
          ),
        ),

      overviewUrls:
        uniqueStrings(
          records.map(
            (
              record,
            ) =>
              record.overviewUrl,
          ),
        ),

      tableUrls:
        uniqueStrings(
          records.map(
            (
              record,
            ) =>
              record.tableUrl,
          ),
        ),

      sourceRecordCount:
        records.length,

      canAutoCreateRole:
        false,
    });
  }

  families.sort(
    (
      left,
      right,
    ) =>
      left.name.localeCompare(
        right.name,
      ),
  );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date()
        .toISOString(),

    counts: {
      tableSRoleGapGroups:
        tableSGaps.length,

      uniqueRequestedMissingTypes:
        requestedMissingTypes.length,

      tableSComponentFamilies:
        families.length,

      familiesWithMultipleSourceRecords:
        families.filter(
          (
            family,
          ) =>
            family.sourceRecordCount >
            1,
        ).length,
    },

    requestedMissingTypes,

    degreeRoleGaps:
      tableSGaps.map(
        (
          gap,
        ) => ({
          degreeCode:
            gap.degreeCode,

          degreeTitle:
            gap.degreeTitle,

          requestedTypes:
            gap.requestedTypes,
        }),
      ),

    families,
  };
}
