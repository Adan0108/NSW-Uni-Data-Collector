import fs from 'node:fs/promises';
import path from 'node:path';

import {
  parseUsydRequisite,
  type UsydParsedRequisite,
} from './usyd.requisite-parser';

import type {
  UsydUnit,
} from './usyd.types';

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

const UNIT_FILE =
  path.join(
    DATA_DIR,
    'usyd-units.json',
  );

const UNIT_FAILURE_FILE =
  path.join(
    DATA_DIR,
    'usyd-units.failures.json',
  );

const DEGREE_TABLE_OWNERSHIP_FILE =
  path.join(
    DATA_DIR,
    'usyd-degree-table-ownership.json',
  );

type UnknownRecord =
  Record<string, unknown>;

type UnknownFunction =
  (
    ...args: unknown[]
  ) => unknown |
  Promise<unknown>;

const dynamicImport =
  new Function(
    'specifier',
    'return import(specifier);',
  ) as (
    specifier: string,
  ) => Promise<UnknownRecord>;

export type UsydMasterRuleType =
  | 'PREREQUISITE'
  | 'COREQUISITE'
  | 'PROHIBITION';

export interface UsydMasterDegreeRecord {
  code: string;
  title: string;
  level: string;
  totalCreditPoints: number | null;
  requirements: unknown[];
  rawRequirements: string | null;
  handbookCategory: string | null;
  sourceUrl: string | null;
  resolutionsUrl: string | null;
  matchMethod: string | null;
  matchedAwardSection: boolean | null;
}

export interface UsydMasterAccessCondition {
  unitCode: string;
  prerequisite: string | null;
  corequisite: string | null;
  prohibition: string | null;
  assumedKnowledge: string | null;
}

export interface UsydMasterRequisiteRule {
  unitCode: string;
  type: UsydMasterRuleType;
  rawText: string;

  /**
   * The parsed AST is authoritative only when this is true.
   *
   * For the frozen V6.2 fallback rules:
   * authoritative = false
   * rawText remains the handbook source of truth.
   */
  authoritative: boolean;

  containsUnparsedText: boolean;

  parsed:
    UsydParsedRequisite;
}

export interface UsydMasterMetadata {
  generatedAt: string;

  coverage: {
    globalDegreeDiscovery: boolean;
    globalDegreeParsing: boolean;
    globalComponentDiscovery: boolean;
    globalComponentParsing: boolean;
    degreeSpecificTableOwnership: boolean;
    unitDetails: boolean;
    unresolvedUnitDetails: boolean;
    requisites: boolean;

    /**
     * These are deliberately false until separate global stages
     * are built/audited. Do NOT infer them from unit-table order.
     */
    degreeComponentRelationships: boolean;
    degreeRequirementSemantics: boolean;
    recommendedStudyPlans: boolean;
  };

  counts: {
    degreeSourcePages: number;
    degrees: number;
    components: number;
    componentSourceRecords: number;
    componentRequirementObjects: number;
    degreeSpecificTables: number;
    degreeTableOwnerGroups: number;
    units: number;
    unresolvedUnits: number;
    accessConditions: number;
    requisiteRules: number;
    authoritativeRequisiteRules: number;
    rawFallbackRequisiteRules: number;
  };
}

export interface UsydGlobalMaster {
  university: {
    code: 'USYD';
    name: 'The University of Sydney';
  };

  handbookYear: 2026;

  degrees:
    UsydMasterDegreeRecord[];

  /**
   * Full parsed global component objects.
   *
   * Kept lossless at this stage because the USYD component model
   * contains conditional rules and component references that must
   * not be flattened before the database normalizer is audited.
   */
  /**
   * The canonical 358 discovered component families.
   *
   * These are the entities used for degree-component relationships.
   * Do not reduce this list to only components that happened to expose
   * formal requirement blocks.
   */
  components:
    unknown[];

  /**
   * Parsed table/page results for the 358 discovered component families.
   * Kept separately for provenance and requirement extraction.
   */
  componentSources:
    unknown[];

  /**
   * Parsed requirement-bearing component objects found inside the
   * component table/page results. This is a subset of the 358 component
   * families and must not be used as the canonical component catalogue.
   */
  componentRequirementObjects:
    unknown[];

  degreeSpecificTables:
    unknown[];

  degreeTableOwnership:
    unknown[];

  subjects:
    UsydUnit[];

  unresolvedSubjectDetails:
    unknown[];

  subjectAccessConditions:
    UsydMasterAccessCondition[];

  subjectRequisites:
    UsydMasterRequisiteRule[];

  /**
   * Intentionally empty until the dedicated global relationship
   * and study-plan stages are completed.
   *
   * Never infer compulsory/degree ownership from a recommended
   * sequence or from the mere presence of a unit in a table.
   */
  degreeComponents:
    unknown[];

  degreeRequirements:
    unknown[];

  studyPlans:
    unknown[];

  metadata:
    UsydMasterMetadata;
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
  record:
    UnknownRecord,
  keys:
    string[],
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

function numberValue(
  record:
    UnknownRecord,
  keys:
    string[],
): number | null {
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
        'number' &&
      Number.isFinite(
        value,
      )
    ) {
      return value;
    }
  }

  return null;
}

function booleanValue(
  record:
    UnknownRecord,
  keys:
    string[],
): boolean | null {
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
      'boolean'
    ) {
      return value;
    }
  }

  return null;
}

function arrayValue(
  record:
    UnknownRecord,
  keys:
    string[],
): unknown[] {
  for (
    const key
    of keys
  ) {
    const value =
      record[
        key
      ];

    if (
      Array.isArray(
        value,
      )
    ) {
      return value;
    }
  }

  return [];
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

function findArrayByKeys(
  value: unknown,
  keys: string[],
): unknown[] {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value;
  }

  if (
    !isRecord(
      value,
    )
  ) {
    return [];
  }

  for (
    const key
    of keys
  ) {
    const candidate =
      value[
        key
      ];

    if (
      Array.isArray(
        candidate,
      )
    ) {
      return candidate;
    }
  }

  return [];
}

function findFunction(
  module:
    UnknownRecord,
  candidateNames:
    string[],
  fallbackNamePattern:
    RegExp,
): UnknownFunction {
  for (
    const name
    of candidateNames
  ) {
    const value =
      module[
        name
      ];

    if (
      typeof value ===
      'function'
    ) {
      return value as
        UnknownFunction;
    }
  }

  for (
    const [
      name,
      value,
    ]
    of Object.entries(
      module,
    )
  ) {
    if (
      typeof value ===
        'function' &&
      fallbackNamePattern.test(
        name,
      )
    ) {
      return value as
        UnknownFunction;
    }
  }

  throw new Error(
    [
      'Could not resolve expected function export.',
      `Tried: ${candidateNames.join(', ')}`,
      `Available exports: ${Object.keys(module).join(', ')}`,
    ].join(
      ' ',
    ),
  );
}

async function mapWithConcurrency<T, R>(
  values:
    T[],
  concurrency:
    number,
  worker:
    (
      value: T,
      index: number,
    ) => Promise<R>,
): Promise<R[]> {
  const output =
    new Array<R>(
      values.length,
    );

  let cursor =
    0;

  async function runner():
  Promise<void> {
    while (
      true
    ) {
      const index =
        cursor;

      cursor +=
        1;

      if (
        index >=
        values.length
      ) {
        return;
      }

      output[
        index
      ] =
        await worker(
          values[
            index
          ],
          index,
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            Math.max(
              1,
              values.length,
            ),
          ),
      },
      () =>
        runner(),
    ),
  );

  return output;
}

/**
 * ------------------------------------------------
 * GLOBAL DEGREES
 * ------------------------------------------------
 */

async function collectGlobalDegreeCourses():
Promise<unknown[]> {
  const discoveryModule =
    await dynamicImport(
      './usyd.global-degree-discovery',
    );

  const parserModule =
    await dynamicImport(
      './usyd.global-degree-parser',
    );

  const discover =
    findFunction(
      discoveryModule,
      [
        'discoverUsydGlobalDegrees',
        'discoverUsydGlobalDegreeLinks',
        'discoverGlobalUsydDegrees',
        'discoverUsydDegrees',
      ],
      /discover.*degree/i,
    );

  const parse =
    findFunction(
      parserModule,
      [
        'parseUsydGlobalCourse',
      ],
      /parse.*global.*course/i,
    );


  const discoveredRaw =
    await discover();

  const discovered =
    findArrayByKeys(
      discoveredRaw,
      [
        'degrees',
        'links',
        'courses',
        'items',
      ],
    );

  if (
    discovered.length !==
    86
  ) {
    throw new Error(
      `Expected 86 canonical USYD degree source pages, got ${discovered.length}.`,
    );
  }

  console.log(
    `[USYD master] parsing ${discovered.length} global degree pages...`,
  );

  return mapWithConcurrency(
    discovered,
    4,
    async (
      degree,
      index,
    ) => {
      console.log(
        `[USYD master] degree ${index + 1}/${discovered.length}`,
      );

      return parse(
        degree,
      );
    },
  );
}

function classifyDegreeLevel(
  code: string,
  title: string,
): string {
  const normalizedTitle =
    title.toLowerCase();

  if (
    /^DL/i.test(
      code,
    ) ||
    normalizedTitle.startsWith(
      'diploma of ',
    )
  ) {
    return 'DIPLOMA';
  }

  if (
    /^BH/i.test(
      code,
    ) ||
    normalizedTitle.includes(
      '(honours)',
    ) ||
    normalizedTitle.endsWith(
      ' honours',
    )
  ) {
    return 'HONOURS';
  }

  if (
    normalizedTitle.includes(
      ' and '
    ) ||
    normalizedTitle.includes(
      ';'
    )
  ) {
    return 'COMBINED';
  }

  return 'UNDERGRADUATE';
}

function isPostgraduateConstituent(
  code: string,
): boolean {
  return (
    code ===
      'MAPHAPHP-01' ||
    code ===
      'MAPHMPHP-01' ||
    code ===
      'MANUTDIE-02'
  );
}

function flattenDegrees(
  courses:
    unknown[],
): UsydMasterDegreeRecord[] {
  const byCode =
    new Map<
      string,
      UsydMasterDegreeRecord
    >();

  for (
    const course
    of courses
  ) {
    if (
      !isRecord(
        course,
      )
    ) {
      continue;
    }

    const handbookCategory =
      stringValue(
        course,
        [
          'handbookCategory',
          'category',
        ],
      );

    const sourceUrl =
      stringValue(
        course,
        [
          'sourceUrl',
          'overviewUrl',
        ],
      );

    const resolutionsUrl =
      stringValue(
        course,
        [
          'resolutionsUrl',
        ],
      );

    const awards =
      arrayValue(
        course,
        [
          'awards',
        ],
      );

    for (
      const award
      of awards
    ) {
      if (
        !isRecord(
          award,
        )
      ) {
        continue;
      }

      const code =
        stringValue(
          award,
          [
            'code',
          ],
        );

      const title =
        stringValue(
          award,
          [
            'title',
            'name',
          ],
        );

      if (
        !code ||
        !title ||
        isPostgraduateConstituent(
          code,
        )
      ) {
        continue;
      }

      const record:
        UsydMasterDegreeRecord =
        {
          code,

          title,

          level:
            classifyDegreeLevel(
              code,
              title,
            ),

          totalCreditPoints:
            numberValue(
              award,
              [
                'totalCreditPoints',
                'creditPoints',
              ],
            ),

          requirements:
            arrayValue(
              award,
              [
                'awardRequirements',
                'requirements',
              ],
            ),

          rawRequirements:
            stringValue(
              award,
              [
                'rawAwardRequirements',
                'rawRequirements',
              ],
            ),

          handbookCategory,

          sourceUrl,

          resolutionsUrl,

          matchMethod:
            stringValue(
              award,
              [
                'matchMethod',
              ],
            ),

          matchedAwardSection:
            booleanValue(
              award,
              [
                'matchedAwardSection',
              ],
            ),
        };

      const existing =
        byCode.get(
          code,
        );

      if (
        !existing
      ) {
        byCode.set(
          code,
          record,
        );

        continue;
      }

      /**
       * Prefer the richer copy when one code appears on more than
       * one canonical page.
       */
      const existingScore =
        existing.requirements.length +
        (
          existing.totalCreditPoints !==
          null
            ? 10
            : 0
        ) +
        (
          existing.matchedAwardSection
            ? 5
            : 0
        );

      const nextScore =
        record.requirements.length +
        (
          record.totalCreditPoints !==
          null
            ? 10
            : 0
        ) +
        (
          record.matchedAwardSection
            ? 5
            : 0
        );

      if (
        nextScore >
        existingScore
      ) {
        byCode.set(
          code,
          record,
        );
      }
    }
  }

  return [
    ...byCode.values(),
  ].sort(
    (
      left,
      right,
    ) =>
      left.title.localeCompare(
        right.title,
      ) ||
      left.code.localeCompare(
        right.code,
      ),
  );
}

/**
 * ------------------------------------------------
 * GLOBAL COMPONENTS
 * ------------------------------------------------
 */

function collectComponentObjects(
  value: unknown,
  output: unknown[],
): void {
  if (
    Array.isArray(
      value,
    )
  ) {
    for (
      const item
      of value
    ) {
      collectComponentObjects(
        item,
        output,
      );
    }

    return;
  }

  if (
    !isRecord(
      value,
    )
  ) {
    return;
  }

  const name =
    stringValue(
      value,
      [
        'name',
      ],
    );

  const type =
    stringValue(
      value,
      [
        'type',
      ],
    );

  const allowed =
    new Set(
      [
        'MAJOR',
        'MINOR',
        'PROGRAM',
        'STREAM',
        'SPECIALISATION',
        'OTHER',
      ],
    );

  if (
    name &&
    type &&
    allowed.has(
      type.toUpperCase(),
    ) &&
    (
      Array.isArray(
        value[
          'formalRequirements'
        ],
      ) ||
      Array.isArray(
        value[
          'requirementGroups'
        ],
      )
    )
  ) {
    output.push(
      value,
    );

    return;
  }

  for (
    const nested
    of Object.values(
      value,
    )
  ) {
    if (
      typeof nested ===
        'object' &&
      nested !==
        null
    ) {
      collectComponentObjects(
        nested,
        output,
      );
    }
  }
}

function dedupeComponents(
  values:
    unknown[],
): unknown[] {
  const seen =
    new Set<string>();

  const output:
    unknown[] =
    [];

  for (
    const value
    of values
  ) {
    if (
      !isRecord(
        value,
      )
    ) {
      continue;
    }

    const name =
      stringValue(
        value,
        [
          'name',
        ],
      );

    const type =
      stringValue(
        value,
        [
          'type',
        ],
      );

    const sourceUrl =
      stringValue(
        value,
        [
          'sourceUrl',
        ],
      ) ??
      '';

    if (
      !name ||
      !type
    ) {
      continue;
    }

    /**
     * A same-named MAJOR can legitimately exist in multiple handbook
     * tables. Keep source URL in the key to avoid destructive merging.
     */
    const key =
      `${type}|${name}|${sourceUrl}`;

    if (
      seen.has(
        key,
      )
    ) {
      continue;
    }

    seen.add(
      key,
    );

    output.push(
      value,
    );
  }

  return output;
}

async function collectGlobalComponents():
Promise<{
  components: unknown[];
  parsedSources: unknown[];
  requirementObjects: unknown[];
}> {
  const discoveryModule =
    await dynamicImport(
      './usyd.global-component-discovery',
    );

  const parserModule =
    await dynamicImport(
      './usyd.global-component-parser',
    );

  const discover =
    findFunction(
      discoveryModule,
      [
        'discoverUsydGlobalComponents',
        'discoverUsydGlobalComponentFamilies',
        'discoverGlobalUsydComponents',
        'discoverUsydComponents',
      ],
      /discover.*component/i,
    );

  const parse =
    findFunction(
      parserModule,
      [
        'parseUsydGlobalComponent',
        'parseUsydGlobalComponentTable',
        'parseUsydGlobalComponentFamily',
      ],
      /parse.*component/i,
    );

  const discoveredRaw =
    await discover();

  const sources =
    findArrayByKeys(
      discoveredRaw,
      [
        'components',
        'families',
        'links',
        'items',
      ],
    );

  if (
    sources.length !==
    358
  ) {
    throw new Error(
      `Expected 358 global USYD component families, got ${sources.length}.`,
    );
  }

  console.log(
    `[USYD master] parsing ${sources.length} component families...`,
  );

  const parsedSources =
    await mapWithConcurrency(
      sources,
      4,
      async (
        source,
        index,
      ) => {
        console.log(
          `[USYD master] component ${index + 1}/${sources.length}`,
        );

        return parse(
          source,
        );
      },
    );

  const found:
    unknown[] =
    [];

  for (
    const parsed
    of parsedSources
  ) {
    collectComponentObjects(
      parsed,
      found,
    );
  }

  const components =
    dedupeComponents(
      found,
    );

  if (
    components.length ===
    0
  ) {
    throw new Error(
      'Global component parser completed but no component requirement objects were found.',
    );
  }

  return {
    /**
     * IMPORTANT:
     * `sources` is the 358-item discovery catalogue. Those are the
     * canonical component-family entities.
     */
    components:
      sources,

    /**
     * One parsed result per discovered component family.
     */
    parsedSources,

    /**
     * Only the requirement-bearing component objects found inside
     * parsed pages/tables. This is intentionally a subset.
     */
    requirementObjects:
      components,
  };
}

/**
 * ------------------------------------------------
 * SAVED DATASETS
 * ------------------------------------------------
 */

async function loadUnits():
Promise<UsydUnit[]> {
  const value =
    await readJson(
      UNIT_FILE,
    );

  const units =
    findArrayByKeys(
      value,
      [
        'units',
        'subjects',
      ],
    );

  return units as
    UsydUnit[];
}

async function loadUnresolvedUnits():
Promise<unknown[]> {
  const value =
    await readJson(
      UNIT_FAILURE_FILE,
    );

  return findArrayByKeys(
    value,
    [
      'failures',
      'unresolved',
      'items',
    ],
  );
}

async function loadDegreeTableOwnership():
Promise<{
  ownership: unknown[];
  ownerGroups: number;
}> {
  const value =
    await readJson(
      DEGREE_TABLE_OWNERSHIP_FILE,
    );

  const ownership =
    findArrayByKeys(
      value,
      [
        'ownership',
        'items',
      ],
    );

  const ownerKeys =
    new Set<string>();

  for (
    const item
    of ownership
  ) {
    if (
      !isRecord(
        item,
      )
    ) {
      continue;
    }

    const ownerKey =
      stringValue(
        item,
        [
          'ownerKey',
        ],
      );

    if (
      ownerKey
    ) {
      ownerKeys.add(
        ownerKey,
      );
    }
  }

  return {
    ownership,
    ownerGroups:
      ownerKeys.size,
  };
}

/**
 * ------------------------------------------------
 * DEGREE-SPECIFIC TABLES
 * ------------------------------------------------
 */

async function collectDegreeSpecificTables(
  ownership:
    unknown[],
): Promise<unknown[]> {
  const parserModule =
    await dynamicImport(
      './usyd.global-unit-table-parser',
    );

  const parse =
    findFunction(
      parserModule,
      [
        'fetchUsydGlobalUnitTable',
        'parseUsydGlobalUnitTable',
        'parseUsydUnitTable',
        'parseUsydDegreeSpecificUnitTable',
      ],
      /(?:fetch|parse).*unit.*table/i,
    );

  return mapWithConcurrency(
    ownership,
    4,
    async (
      item,
      index,
    ) => {
      if (
        !isRecord(
          item,
        )
      ) {
        throw new Error(
          `Invalid degree-table ownership record at index ${index}.`,
        );
      }

      const tableUrl =
        stringValue(
          item,
          [
            'tableUrl',
          ],
        );

      if (
        !tableUrl
      ) {
        throw new Error(
          `Ownership row ${index} has no tableUrl.`,
        );
      }

      console.log(
        `[USYD master] degree table ${index + 1}/${ownership.length}`,
      );

      const parsed =
        await parse(
          tableUrl,
        );

      return {
        ownership:
          item,

        parsed,
      };
    },
  );
}

/**
 * ------------------------------------------------
 * ACCESS CONDITIONS + REQUISITES
 * ------------------------------------------------
 */

function buildAccessConditions(
  units:
    UsydUnit[],
): UsydMasterAccessCondition[] {
  return units
    .filter(
      (
        unit,
      ) => {
        const access =
          unit.accessConditions;

        return Boolean(
          access.prerequisite ||
          access.corequisite ||
          access.prohibition ||
          access.assumedKnowledge,
        );
      },
    )
    .map(
      (
        unit,
      ) => ({
        unitCode:
          unit.code,

        prerequisite:
          unit.accessConditions
            .prerequisite,

        corequisite:
          unit.accessConditions
            .corequisite,

        prohibition:
          unit.accessConditions
            .prohibition,

        assumedKnowledge:
          unit.accessConditions
            .assumedKnowledge,
      }),
    );
}

function buildRequisiteRules(
  units:
    UsydUnit[],
): UsydMasterRequisiteRule[] {
  const output:
    UsydMasterRequisiteRule[] =
    [];

  for (
    const unit
    of units
  ) {
    const conditions:
      Array<{
        type:
          UsydMasterRuleType;
        rawText:
          string | null;
      }> =
      [
        {
          type:
            'PREREQUISITE',
          rawText:
            unit
              .accessConditions
              .prerequisite,
        },
        {
          type:
            'COREQUISITE',
          rawText:
            unit
              .accessConditions
              .corequisite,
        },
        {
          type:
            'PROHIBITION',
          rawText:
            unit
              .accessConditions
              .prohibition,
        },
      ];

    for (
      const condition
      of conditions
    ) {
      if (
        !condition.rawText
      ) {
        continue;
      }

      const parsed =
        parseUsydRequisite(
          condition.rawText,
        );

      if (
        !parsed
      ) {
        continue;
      }

      output.push({
        unitCode:
          unit.code,

        type:
          condition.type,

        rawText:
          condition.rawText,

        authoritative:
          !parsed
            .containsUnparsedText,

        containsUnparsedText:
          parsed
            .containsUnparsedText,

        parsed,
      });
    }
  }

  return output;
}

/**
 * ------------------------------------------------
 * MASTER
 * ------------------------------------------------
 */

export async function collectUsydGlobalMaster():
Promise<UsydGlobalMaster> {
  console.log(
    '[USYD master] loading saved unit datasets...',
  );

  const [
    units,
    unresolvedUnits,
    degreeTableOwnership,
  ] =
    await Promise.all(
      [
        loadUnits(),
        loadUnresolvedUnits(),
        loadDegreeTableOwnership(),
      ],
    );

  if (
    units.length !==
    3011
  ) {
    throw new Error(
      `Expected 3011 resolved unit details, got ${units.length}.`,
    );
  }

  if (
    unresolvedUnits.length !==
    111
  ) {
    throw new Error(
      `Expected 111 unresolved unit details, got ${unresolvedUnits.length}.`,
    );
  }

  if (
    degreeTableOwnership.ownership.length !==
    37
  ) {
    throw new Error(
      `Expected 37 degree-specific table ownership rows, got ${degreeTableOwnership.ownership.length}.`,
    );
  }

  const [
    degreeCourses,
    globalComponents,
    degreeSpecificTables,
  ] =
    await Promise.all(
      [
        collectGlobalDegreeCourses(),
        collectGlobalComponents(),
        collectDegreeSpecificTables(
          degreeTableOwnership
            .ownership,
        ),
      ],
    );

  const degrees =
    flattenDegrees(
      degreeCourses,
    );

  const accessConditions =
    buildAccessConditions(
      units,
    );

  const requisiteRules =
    buildRequisiteRules(
      units,
    );

  const rawFallbackRequisiteRules =
    requisiteRules.filter(
      (
        rule,
      ) =>
        !rule.authoritative,
    ).length;

  return {
    university: {
      code:
        'USYD',

      name:
        'The University of Sydney',
    },

    handbookYear:
      HANDBOOK_YEAR,

    degrees,

    components:
      globalComponents
        .components,

    componentSources:
      globalComponents
        .parsedSources,

    componentRequirementObjects:
      globalComponents
        .requirementObjects,

    degreeSpecificTables,

    degreeTableOwnership:
      degreeTableOwnership
        .ownership,

    subjects:
      units,

    unresolvedSubjectDetails:
      unresolvedUnits,

    subjectAccessConditions:
      accessConditions,

    subjectRequisites:
      requisiteRules,

    degreeComponents:
      [],

    degreeRequirements:
      [],

    studyPlans:
      [],

    metadata: {
      generatedAt:
        new Date()
          .toISOString(),

      coverage: {
        globalDegreeDiscovery:
          true,

        globalDegreeParsing:
          true,

        globalComponentDiscovery:
          true,

        globalComponentParsing:
          true,

        degreeSpecificTableOwnership:
          true,

        unitDetails:
          true,

        unresolvedUnitDetails:
          true,

        requisites:
          true,

        degreeComponentRelationships:
          false,

        degreeRequirementSemantics:
          false,

        recommendedStudyPlans:
          false,
      },

      counts: {
        degreeSourcePages:
          degreeCourses.length,

        degrees:
          degrees.length,

        components:
          globalComponents
            .components
            .length,

        componentSourceRecords:
          globalComponents
            .parsedSources
            .length,

        componentRequirementObjects:
          globalComponents
            .requirementObjects
            .length,

        degreeSpecificTables:
          degreeSpecificTables
            .length,

        degreeTableOwnerGroups:
          degreeTableOwnership
            .ownerGroups,

        units:
          units.length,

        unresolvedUnits:
          unresolvedUnits.length,

        accessConditions:
          accessConditions.length,

        requisiteRules:
          requisiteRules.length,

        authoritativeRequisiteRules:
          requisiteRules.length -
          rawFallbackRequisiteRules,

        rawFallbackRequisiteRules,
      },
    },
  };
}


/**
 * Backwards-compatible alias used by older debug scripts.
 */
export const collectUsydMaster =
  collectUsydGlobalMaster;
