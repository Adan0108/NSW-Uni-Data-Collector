import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  UsydSupplementalComponent,
  UsydSupplementalComponentDataset,
} from './usyd.supplemental-component-collector';

const HANDBOOK_YEAR =
  2026;

const DATA_DIR =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
  );

const MASTER_FILE =
  path.join(
    DATA_DIR,
    'usyd-master-global.json',
  );

const SUPPLEMENTAL_FILE =
  path.join(
    DATA_DIR,
    'usyd-supplemental-components.json',
  );

type UnknownRecord =
  Record<string, unknown>;

export interface UsydMergedComponentCatalog {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  baseComponentCount: number;
  supplementalComponentCount: number;
  totalComponentCount: number;

  duplicateKeys: string[];

  components: unknown[];
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
  for (
    const key
    of keys
  ) {
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
    .replace(
      /&/g,
      'and',
    )
    .replace(
      /[’']/g,
      '',
    )
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function componentKey(
  component: unknown,
): string {
  if (
    !isRecord(component)
  ) {
    throw new Error(
      'Invalid component record.',
    );
  }

  const handbook =
    stringValue(
      component,
      [
        'handbook',
        'handbookCategory',
        'category',
      ],
    );

  const type =
    stringValue(
      component,
      [
        'type',
        'componentType',
      ],
    );

  const name =
    stringValue(
      component,
      [
        'name',
        'title',
        'componentName',
      ],
    );

  if (
    !handbook ||
    !type ||
    !name
  ) {
    throw new Error(
      `Component missing handbook/type/name: ${JSON.stringify(component)}`,
    );
  }

  return [
    handbook.toUpperCase(),
    type.toUpperCase(),
    normalize(
      name,
    ),
  ].join(
    '|',
  );
}

async function readJson(
  filePath: string,
): Promise<unknown> {
  const raw =
    await fs.readFile(
      filePath,
      'utf8',
    );

  return JSON.parse(
    raw,
  ) as unknown;
}

async function readBaseComponents():
Promise<unknown[]> {
  const master =
    await readJson(
      MASTER_FILE,
    );

  if (
    !isRecord(master) ||
    !Array.isArray(
      master.components,
    )
  ) {
    throw new Error(
      'USYD master does not contain components[].',
    );
  }

  return master.components;
}

async function readSupplemental():
Promise<UsydSupplementalComponentDataset> {
  const value =
    await readJson(
      SUPPLEMENTAL_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(
      value.components,
    )
  ) {
    throw new Error(
      'Supplemental component dataset is missing components[].',
    );
  }

  return value as unknown as
    UsydSupplementalComponentDataset;
}

function validateSupplemental(
  components:
    UsydSupplementalComponent[],
): void {
  for (
    const component
    of components
  ) {
    if (
      component.supplemental !==
      true
    ) {
      throw new Error(
        `Supplemental record missing supplemental=true: ${component.handbook}/${component.type}/${component.name}`,
      );
    }

    if (
      component.requiredCreditPoints ===
      null
    ) {
      throw new Error(
        `Supplemental component has null CP: ${component.handbook}/${component.type}/${component.name}`,
      );
    }

    if (
      component.evidence.length ===
      0
    ) {
      throw new Error(
        `Supplemental component has no evidence: ${component.handbook}/${component.type}/${component.name}`,
      );
    }
  }
}

export async function mergeUsydComponentCatalog():
Promise<UsydMergedComponentCatalog> {
  const [
    baseComponents,
    supplementalDataset,
  ] =
    await Promise.all(
      [
        readBaseComponents(),
        readSupplemental(),
      ],
    );

  validateSupplemental(
    supplementalDataset.components,
  );

  /**
   * IMPORTANT:
   *
   * The 358 discovered base component records are source-scoped.
   * Multiple rows can legitimately share the same
   * handbook + type + name while pointing at different source tables.
   *
   * Therefore:
   * - NEVER deduplicate the 358 base catalogue by logical name.
   * - Only validate that the 9 supplemental logical keys are unique.
   * - Only reject a supplemental record if its exact logical
   *   handbook/type/name key already exists in the base catalogue.
   */
  const baseKeys =
    new Set<string>();

  for (
    const component
    of baseComponents
  ) {
    baseKeys.add(
      componentKey(
        component,
      ),
    );
  }

  const supplementalKeys =
    new Set<string>();

  const duplicateKeys:
    string[] =
    [];

  for (
    const component
    of supplementalDataset.components
  ) {
    const key =
      componentKey(
        component,
      );

    if (
      supplementalKeys.has(
        key,
      )
    ) {
      duplicateKeys.push(
        `SUPPLEMENTAL_DUPLICATE:${key}`,
      );

      continue;
    }

    supplementalKeys.add(
      key,
    );

    if (
      baseKeys.has(
        key,
      )
    ) {
      duplicateKeys.push(
        `SUPPLEMENTAL_COLLIDES_WITH_BASE:${key}`,
      );
    }
  }

  const merged:
    unknown[] =
    [
      ...baseComponents,
      ...supplementalDataset.components,
    ];

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date()
        .toISOString(),

    baseComponentCount:
      baseComponents.length,

    supplementalComponentCount:
      supplementalDataset
        .components
        .length,

    totalComponentCount:
      merged.length,

    duplicateKeys:
      [
        ...new Set(
          duplicateKeys,
        ),
      ],

    components:
      merged,
  };
}
