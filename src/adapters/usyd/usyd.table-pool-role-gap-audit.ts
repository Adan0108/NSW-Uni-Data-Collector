import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydDegreeComponentTableSignals,
  type UsydTableSignalGroup,
} from './usyd.degree-component-table-signal-audit';

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

export interface UsydTablePoolRoleGap {
  degreeCode: string;
  degreeTitle: string;
  tableName: string;
  requestedTypes: string[];
  classification:
    UsydTableSignalGroup['classification'];

  exactTypeCandidates: number;

  samePoolOtherTypeCandidates:
    ComponentRecord[];

  status:
    | 'HAS_EXACT_TYPE'
    | 'ROLE_VARIANT_MISSING'
    | 'NO_COMPONENT_POOL'
    | 'LIKELY_FALSE_STREAM_SIGNAL';
}

export interface UsydTablePoolRoleGapAudit {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    inspectedGroups: number;
    hasExactType: number;
    roleVariantMissing: number;
    noComponentPool: number;
    likelyFalseStreamSignal: number;
  };

  gaps: UsydTablePoolRoleGap[];
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

function canonicalQualifiedTableOwner(
  tableName: string,
): {
  handbook: string;
  pathTokens: string[];
} | null {
  const value =
    normalize(tableName);

  if (
    value.startsWith(
      'table a for the bachelor of commerce',
    )
  ) {
    return {
      handbook:
        'BUSINESS',
      pathTokens:
        [
          '/handbooks/business/',
        ],
    };
  }

  if (
    value.startsWith(
      'table a for the bachelor of computing',
    )
  ) {
    return {
      handbook:
        'ENGINEERING',
      pathTokens:
        [
          '/handbooks/engineering/advanced-computing/',
        ],
    };
  }

  if (
    value.startsWith(
      'table a for the bachelor of arts',
    )
  ) {
    return {
      handbook:
        'ARTS',
      pathTokens:
        [
          '/handbooks/arts/',
        ],
    };
  }

  if (
    value.startsWith(
      'table a for the bachelor of economics',
    )
  ) {
    return {
      handbook:
        'ARTS',
      pathTokens:
        [
          '/handbooks/arts/',
        ],
    };
  }

  if (
    value.startsWith(
      'table a for the bachelor of science',
    )
  ) {
    return {
      handbook:
        'SCIENCE',
      pathTokens:
        [
          '/handbooks/science/table-a/',
        ],
    };
  }

  return null;
}

function componentHaystack(
  component: ComponentRecord,
): string {
  return [
    component.sourceUrl ?? '',
    component.overviewUrl ?? '',
    component.tableUrl ?? '',
  ]
    .join(' ')
    .toLowerCase();
}

function getUntypedPool(
  group: UsydTableSignalGroup,
  components: ComponentRecord[],
): ComponentRecord[] {
  if (
    group.classification ===
      'TABLE_S'
  ) {
    return components.filter(
      (
        component,
      ) =>
        component.handbook ===
        'INTERDISCIPLINARY',
    );
  }

  if (
    group.classification !==
      'QUALIFIED_TABLE_A'
  ) {
    return [];
  }

  const tableName =
    group.originalTableNames[0];

  if (!tableName) {
    return [];
  }

  const owner =
    canonicalQualifiedTableOwner(
      tableName,
    );

  if (!owner) {
    return [];
  }

  return components.filter(
    (
      component,
    ) => {
      if (
        component.handbook !==
        owner.handbook
      ) {
        return false;
      }

      const haystack =
        componentHaystack(
          component,
        );

      return owner.pathTokens.some(
        (
          token,
        ) =>
          haystack.includes(
            token,
          ),
      );
    },
  );
}

function isLikelyFalseStreamSignal(
  group: UsydTableSignalGroup,
): boolean {
  if (
    !group.componentTypes.includes(
      'STREAM',
    )
  ) {
    return false;
  }

  return group.rawExamples.some(
    (
      raw,
    ) =>
      /\bDalyell\s+stream\b/i.test(
        raw,
      ) ||
      /\bstudents?\s+(?:enrolled|previously enrolled)\s+in\s+(?:the\s+)?(?:Dalyell\s+)?stream\b/i.test(
        raw,
      ),
  );
}

export async function auditUsydTablePoolRoleGaps():
Promise<UsydTablePoolRoleGapAudit> {
  const [
    tableAudit,
    components,
  ] =
    await Promise.all(
      [
        auditUsydDegreeComponentTableSignals(),
        loadComponents(),
      ],
    );

  const inspected =
    tableAudit.groups.filter(
      (
        group,
      ) =>
        group.classification ===
          'QUALIFIED_TABLE_A' ||
        group.classification ===
          'TABLE_S',
    );

  const gaps:
    UsydTablePoolRoleGap[] =
    [];

  for (
    const group
    of inspected
  ) {
    const pool =
      getUntypedPool(
        group,
        components,
      );

    const requested =
      new Set(
        group.componentTypes,
      );

    const samePoolOtherTypeCandidates =
      pool.filter(
        (
          component,
        ) =>
          !requested.has(
            component.type,
          ),
      );

    let status:
      UsydTablePoolRoleGap['status'];

    if (
      group.candidateComponents.length >
      0
    ) {
      status =
        'HAS_EXACT_TYPE';
    } else if (
      isLikelyFalseStreamSignal(
        group,
      )
    ) {
      status =
        'LIKELY_FALSE_STREAM_SIGNAL';
    } else if (
      pool.length >
      0
    ) {
      status =
        'ROLE_VARIANT_MISSING';
    } else {
      status =
        'NO_COMPONENT_POOL';
    }

    gaps.push({
      degreeCode:
        group.degreeCode,
      degreeTitle:
        group.degreeTitle,
      tableName:
        group.originalTableNames.join(
          ' | ',
        ),
      requestedTypes:
        group.componentTypes,
      classification:
        group.classification,
      exactTypeCandidates:
        group.candidateComponents.length,
      samePoolOtherTypeCandidates,
      status,
    });
  }

  const count =
    (
      status:
        UsydTablePoolRoleGap['status'],
    ) =>
      gaps.filter(
        (
          gap,
        ) =>
          gap.status ===
          status,
      ).length;

  return {
    university:
      'USYD',
    handbookYear:
      2026,
    generatedAt:
      new Date()
        .toISOString(),

    counts: {
      inspectedGroups:
        gaps.length,
      hasExactType:
        count(
          'HAS_EXACT_TYPE',
        ),
      roleVariantMissing:
        count(
          'ROLE_VARIANT_MISSING',
        ),
      noComponentPool:
        count(
          'NO_COMPONENT_POOL',
        ),
      likelyFalseStreamSignal:
        count(
          'LIKELY_FALSE_STREAM_SIGNAL',
        ),
    },

    gaps,
  };
}
