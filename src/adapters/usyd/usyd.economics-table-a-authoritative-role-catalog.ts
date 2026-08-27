import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydEconomicsTableARoles,
} from './usyd.economics-table-a-role-audit';

const DATA_DIR =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    '2026',
  );

const COMPONENT_FILE =
  path.join(
    DATA_DIR,
    'usyd-components-complete.json',
  );

type UnknownRecord =
  Record<string, unknown>;

interface ExistingComponent {
  index: number;
  name: string;
  type: string;
  handbook: string;
}

export interface UsydEconomicsTableAAuthoritativeRole {
  name: string;

  type:
    | 'MAJOR'
    | 'MINOR';

  handbook:
    'ARTS';

  tableName:
    'Table A for the Bachelor of Economics';

  authoritative:
    true;

  evidenceUrl:
    string;

  evidenceText:
    string[];

  existingSourceComponentIndexes:
    number[];

  supplementalRole:
    boolean;
}

export interface UsydEconomicsTableAAuthoritativeRoleCatalog {
  university:
    'USYD';

  handbookYear:
    2026;

  generatedAt:
    string;

  counts: {
    families: number;
    roles: number;
    majors: number;
    minors: number;
    supplementalRoles: number;
    unresolvedFamilies: number;
  };

  roles:
    UsydEconomicsTableAAuthoritativeRole[];

  unresolvedFamilies:
    string[];
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function stringValue(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (
    const key
    of keys
  ) {
    const value =
      record[
        key
      ];

    if (
      typeof value ===
        'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

async function loadComponents():
Promise<ExistingComponent[]> {
  const raw =
    await fs.readFile(
      COMPONENT_FILE,
      'utf8',
    );

  const value =
    JSON.parse(
      raw,
    ) as unknown;

  if (
    !isRecord(
      value,
    ) ||
    !Array.isArray(
      value.components,
    )
  ) {
    throw new Error(
      'USYD complete component catalogue is missing components[].',
    );
  }

  const output:
    ExistingComponent[] =
    [];

  value.components.forEach(
    (
      item,
      index,
    ) => {
      if (
        !isRecord(
          item,
        )
      ) {
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
      });
    },
  );

  return output;
}

export async function collectUsydEconomicsTableAAuthoritativeRoles():
Promise<UsydEconomicsTableAAuthoritativeRoleCatalog> {
  const [
    sourceRecords,
    components,
  ] =
    await Promise.all(
      [
        auditUsydEconomicsTableARoles(),
        loadComponents(),
      ],
    );

  const roles:
    UsydEconomicsTableAAuthoritativeRole[] =
    [];

  const unresolvedFamilies:
    string[] =
    [];

  for (
    const record
    of sourceRecords
  ) {
    if (
      record.fetchError !==
        null ||
      !record.roles.includes(
        'MAJOR',
      ) ||
      !record.roles.includes(
        'MINOR',
      )
    ) {
      unresolvedFamilies.push(
        record.name,
      );

      continue;
    }

    for (
      const role
      of [
        'MAJOR',
        'MINOR',
      ] as const
    ) {
      const matching =
        components.filter(
          (
            component,
          ) =>
            component.handbook ===
              'ARTS' &&
            component.name ===
              record.name &&
            component.type ===
              role,
        );

      roles.push({
        name:
          record.name,

        type:
          role,

        handbook:
          'ARTS',

        tableName:
          'Table A for the Bachelor of Economics',

        authoritative:
          true,

        evidenceUrl:
          record.url,

        evidenceText:
          record.evidence,

        existingSourceComponentIndexes:
          matching.map(
            (
              component,
            ) =>
              component.index,
          ),

        supplementalRole:
          matching.length ===
          0,
      });
    }
  }

  roles.sort(
    (
      left,
      right,
    ) =>
      left.name.localeCompare(
        right.name,
      ) ||
      left.type.localeCompare(
        right.type,
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
      families:
        sourceRecords.length,

      roles:
        roles.length,

      majors:
        roles.filter(
          (
            role,
          ) =>
            role.type ===
            'MAJOR',
        ).length,

      minors:
        roles.filter(
          (
            role,
          ) =>
            role.type ===
            'MINOR',
        ).length,

      supplementalRoles:
        roles.filter(
          (
            role,
          ) =>
            role.supplementalRole,
        ).length,

      unresolvedFamilies:
        unresolvedFamilies.length,
    },

    roles,

    unresolvedFamilies,
  };
}
