import fs from 'node:fs/promises';
import path from 'node:path';

import {
  parseUsydRequisite,
  type UsydParsedRequisite,
} from './usyd.requisite-parser';

import type {
  UsydUnit,
} from './usyd.types';

const DATA_DIR =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    '2026',
  );

const BASE_MASTER_FILE =
  path.join(
    DATA_DIR,
    'usyd-master-global.json',
  );

const COMPONENTS_COMPLETE_FILE =
  path.join(
    DATA_DIR,
    'usyd-components-complete.json',
  );

const DEGREE_COMPONENTS_FILE =
  path.join(
    DATA_DIR,
    'usyd-degree-component-relationships.final.json',
  );

const DEGREE_REQUIREMENTS_FILE =
  path.join(
    DATA_DIR,
    'usyd-degree-requirement-enriched.v2.json',
  );

const DEGREE_ROOTS_FILE =
  path.join(
    DATA_DIR,
    'usyd-degree-root-semantics.v2.json',
  );

const DEGREE_RAW_AUDIT_FILE =
  path.join(
    DATA_DIR,
    'usyd-degree-requirement-raw-audit.v1.json',
  );

const REQUISITE_FREEZE_FILE =
  path.join(
    DATA_DIR,
    'usyd-requisite-freeze.v1.json',
  );

const STUDY_PLANS_FILE =
  path.join(
    DATA_DIR,
    'usyd-study-plans.normalized.v1.json',
  );

const STUDY_PLAN_SUBJECTS_FILE =
  path.join(
    DATA_DIR,
    'usyd-study-plan-subject-supplement.v1.json',
  );

const OUTPUT_FILE =
  path.join(
    DATA_DIR,
    'usyd-master-final.json',
  );

type UnknownRecord =
  Record<
    string,
    unknown
  >;

type MasterRuleType =
  | 'PREREQUISITE'
  | 'COREQUISITE'
  | 'PROHIBITION';

interface BaseMaster {
  university: {
    code: 'USYD';
    name: string;
  };

  handbookYear:
    number;

  degrees:
    unknown[];

  components:
    unknown[];

  componentSources:
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
    unknown[];

  subjectRequisites:
    unknown[];

  metadata:
    UnknownRecord;
}

interface FinalRequisiteRule {
  unitCode:
    string;

  type:
    MasterRuleType;

  rawText:
    string;

  authoritative:
    boolean;

  containsUnparsedText:
    boolean;

  parsed:
    UsydParsedRequisite;
}

interface TaggedDegreeComponentRelationship {
  relationshipKind:
    | 'EXPLICIT_NAMED'
    | 'CHOICE_POOL';

  data:
    unknown;
}

export interface UsydFinalMaster {
  university: {
    code: 'USYD';
    name: string;
  };

  handbookYear:
    2026;

  degrees:
    unknown[];

  /**
   * Authoritative role catalog:
   * 358 source-discovered records + 9 supplements = 367.
   */
  components:
    unknown[];

  /**
   * Parsed requirement-bearing component objects from the Stage 1 collector.
   * Kept separate because these are not the same thing as the canonical
   * 367 role identities.
   */
  componentRequirementObjects:
    unknown[];

  componentSources:
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
    unknown[];

  subjectRequisites:
    FinalRequisiteRule[];

  requisiteFreeze:
    unknown;

  /**
   * 18 explicit named relationships + 97 choice pools.
   * We preserve their original payloads without flattening their semantics.
   */
  degreeComponents:
    TaggedDegreeComponentRelationship[];

  /**
   * 1085 enriched clause records.
   * Safe structured clauses stay structured; unsafe clauses preserve raw.
   */
  degreeRequirements:
    unknown[];

  /**
   * One canonical source/root decision for each of 109 degree records.
   */
  degreeRequirementRoots:
    unknown[];

  /**
   * Full audit artifact retained for provenance and later Prisma mapping.
   */
  degreeRequirementRawAudit:
    unknown;

  studyPlans:
    unknown[];

  metadata: {
    generatedAt:
      string;

    status:
      'FINAL_INTEGRATED_PRE_PRISMA';

    coverage: {
      globalDegreeDiscovery:
        true;

      globalDegreeParsing:
        true;

      globalComponentDiscovery:
        true;

      globalComponentParsing:
        true;

      completeComponentRoleCatalog:
        true;

      degreeSpecificTableOwnership:
        true;

      unitDetails:
        true;

      unresolvedUnitDetails:
        true;

      requisites:
        true;

      requisiteSemanticsFrozen:
        true;

      degreeComponentRelationships:
        true;

      degreeRequirementSemantics:
        true;

      recommendedStudyPlans:
        true;
    };

    counts: {
      degrees:
        number;

      canonicalComponents:
        number;

      componentRequirementObjects:
        number;

      componentSourceRecords:
        number;

      degreeSpecificTables:
        number;

      degreeTableOwnershipRows:
        number;

      subjects:
        number;

      supplementalStudyPlanSubjects:
        number;

      unresolvedSubjects:
        number;

      accessConditions:
        number;

      supplementalAccessConditionRecords:
        number;

      requisiteRules:
        number;

      baseFrozenRequisiteRules:
        number;

      supplementalRequisiteRules:
        number;

      authoritativeRequisiteRules:
        number;

      supplementalAuthoritativeRequisiteRules:
        number;

      rawFallbackRequisiteRules:
        number;

      supplementalRawFallbackRequisiteRules:
        number;

      explicitNamedDegreeComponentRelationships:
        number;

      degreeComponentChoicePools:
        number;

      totalDegreeComponentRelationshipRecords:
        number;

      degreeRequirementClauses:
        number;

      degreeRequirementRoots:
        number;

      studyPlans:
        number;

      studyPlanYears:
        number;

      studyPlanPeriods:
        number;

      studyPlanItems:
        number;
    };
  };
}

function isRecord(
  value:
    unknown,
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

/**
 * Stage 1 stores 358 canonical/source-scoped component records in
 * `components`, while the parsed component source payloads contain the
 * 132 requirement-bearing component objects.
 *
 * These are deliberately different concepts. Rebuild the 132 objects from
 * `componentSources` rather than treating the 358 canonical records as
 * requirement-bearing objects.
 */
function collectRequirementBearingComponentObjects(
  value:
    unknown,
  output:
    unknown[],
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
      collectRequirementBearingComponentObjects(
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

  const allowedTypes =
    new Set([
      'MAJOR',
      'MINOR',
      'PROGRAM',
      'STREAM',
      'SPECIALISATION',
      'OTHER',
    ]);

  if (
    name &&
    type &&
    allowedTypes.has(
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
      collectRequirementBearingComponentObjects(
        nested,
        output,
      );
    }
  }
}

function dedupeRequirementBearingComponentObjects(
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

function buildStage1RequirementBearingComponents(
  componentSources:
    unknown[],
): unknown[] {
  const found:
    unknown[] =
    [];

  for (
    const source
    of componentSources
  ) {
    collectRequirementBearingComponentObjects(
      source,
      found,
    );
  }

  return dedupeRequirementBearingComponentObjects(
    found,
  );
}

async function readJson(
  filePath:
    string,
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

/**
 * Find a specific array without depending on every intermediate artifact
 * keeping exactly the same wrapper property name.
 *
 * Preferred keys are checked first. The length requirement prevents us from
 * silently selecting an unrelated nested array.
 */
function findArrayWithLength(
  value:
    unknown,
  expectedLength:
    number,
  preferredKeys:
    string[],
): unknown[] {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value.length ===
      expectedLength
      ? value
      : [];
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
    of preferredKeys
  ) {
    const candidate =
      value[
        key
      ];

    if (
      Array.isArray(
        candidate,
      ) &&
      candidate.length ===
        expectedLength
    ) {
      return candidate;
    }
  }

  for (
    const candidate
    of Object.values(
      value,
    )
  ) {
    const found =
      findArrayWithLength(
        candidate,
        expectedLength,
        preferredKeys,
      );

    if (
      found.length ===
      expectedLength
    ) {
      return found;
    }
  }

  return [];
}

function requireArrayWithLength(
  value:
    unknown,
  expectedLength:
    number,
  preferredKeys:
    string[],
  label:
    string,
): unknown[] {
  const found =
    findArrayWithLength(
      value,
      expectedLength,
      preferredKeys,
    );

  if (
    found.length !==
    expectedLength
  ) {
    throw new Error(
      `Could not locate ${label} array with expected length ${expectedLength}.`,
    );
  }

  return found;
}

/**
 * Returns the authoritative choice pools from the final relationship artifact.
 *
 * Unlike the other finalizer inputs, this artifact does not store its 97
 * records in one array. It preserves three source-grounded categories under
 * `relationshipLayers.choicePools`: Table S, qualified Table A, and
 * unqualified Table A. We flatten only those known categories so semantic
 * review signals can never be mistaken for authoritative relationships.
 */
function requireDegreeComponentChoicePools(
  value:
    unknown,
  expectedLength:
    number,
): unknown[] {
  if (
    !isRecord(
      value,
    )
  ) {
    throw new Error(
      'Could not locate degree-component relationship artifact object.',
    );
  }

  const relationshipLayers =
    value[
      'relationshipLayers'
    ];

  if (
    !isRecord(
      relationshipLayers,
    )
  ) {
    throw new Error(
      'Could not locate degree-component relationshipLayers object.',
    );
  }

  const groupedChoicePools =
    relationshipLayers[
      'choicePools'
    ];

  if (
    !isRecord(
      groupedChoicePools,
    )
  ) {
    throw new Error(
      'Could not locate degree-component relationshipLayers.choicePools object.',
    );
  }

  const categoryKeys =
    [
      'tableS',
      'qualifiedTableA',
      'unqualifiedTableA',
    ] as const;

  const pools:
    unknown[] =
    [];

  const categoryCounts:
    string[] =
    [];

  for (
    const categoryKey
    of categoryKeys
  ) {
    const categoryPools =
      groupedChoicePools[
        categoryKey
      ];

    if (
      !Array.isArray(
        categoryPools,
      )
    ) {
      throw new Error(
        `Degree-component choice-pool category ${categoryKey} must be an array.`,
      );
    }

    categoryCounts.push(
      `${categoryKey}=${categoryPools.length}`,
    );

    pools.push(
      ...categoryPools,
    );
  }

  if (
    pools.length !==
    expectedLength
  ) {
    throw new Error(
      [
        'Degree-component choice-pool total changed unexpectedly.',
        `expected=${expectedLength}`,
        `actual=${pools.length}`,
        ...categoryCounts,
      ].join(
        ' ',
      ),
    );
  }

  return pools;
}

function rebuildRequisiteRules(
  subjects:
    UsydUnit[],
): FinalRequisiteRule[] {
  const output:
    FinalRequisiteRule[] =
    [];

  for (
    const unit
    of subjects
  ) {
    const rules:
      Array<{
        type:
          MasterRuleType;

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
      const rule
      of rules
    ) {
      if (
        !rule.rawText
      ) {
        continue;
      }

      const parsed =
        parseUsydRequisite(
          rule.rawText,
        );

      if (
        !parsed
      ) {
        throw new Error(
          `Current requisite parser returned null for ${unit.code} ${rule.type}.`,
        );
      }

      output.push({
        unitCode:
          unit.code,

        type:
          rule.type,

        rawText:
          rule.rawText,

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

function studyPlanCounts(
  studyPlans:
    unknown[],
): {
  years: number;
  periods: number;
  items: number;
} {
  let years =
    0;

  let periods =
    0;

  let items =
    0;

  for (
    const plan
    of studyPlans
  ) {
    if (
      !isRecord(
        plan,
      ) ||
      !Array.isArray(
        plan.years,
      )
    ) {
      throw new Error(
        'Normalized study plan is missing years[].',
      );
    }

    years +=
      plan.years.length;

    for (
      const year
      of plan.years
    ) {
      if (
        !isRecord(
          year,
        ) ||
        !Array.isArray(
          year.periods,
        )
      ) {
        throw new Error(
          'Normalized study-plan year is missing periods[].',
        );
      }

      periods +=
        year.periods.length;

      for (
        const period
        of year.periods
      ) {
        if (
          !isRecord(
            period,
          ) ||
          !Array.isArray(
            period.items,
          )
        ) {
          throw new Error(
            'Normalized study-plan period is missing items[].',
          );
        }

        items +=
          period.items.length;
      }
    }
  }

  return {
    years,
    periods,
    items,
  };
}

function freezeCount(
  freeze:
    unknown,
  key:
    string,
): number {
  if (
    !isRecord(
      freeze,
    ) ||
    !isRecord(
      freeze.counts,
    )
  ) {
    throw new Error(
      'Requisite freeze artifact is missing counts.',
    );
  }

  const value =
    freeze.counts[
      key
    ];

  if (
    typeof value !==
      'number'
  ) {
    throw new Error(
      `Requisite freeze count ${key} is missing.`,
    );
  }

  return value;
}

const REQUIRED_STUDY_PLAN_SUBJECT_CODES =
  [
    'ATHK1001',
    'WRIT1001',
    'INLI1001',
    'INLI1002',
    'MATH1100',
    'MATH1200',
    'OLES1602',
  ] as const;

/**
 * Validates the targeted unit-detail supplement produced from official USYD
 * unit pages. These units appear in official sample study plans but were not
 * discovered through the component-table inventory used by Stage 1.
 */
function requireStudyPlanSubjectSupplement(
  value:
    unknown,
): UsydUnit[] {
  if (
    !isRecord(
      value,
    ) ||
    !Array.isArray(
      value['units'],
    )
  ) {
    throw new Error(
      'Study-plan subject supplement must contain units[]. Run usyd.study-plan-subject-supplement.run.ts first.',
    );
  }

  const units =
    value['units'] as
      UsydUnit[];

  const actualCodes =
    units
      .map(
        (
          unit,
        ) =>
          unit.code,
      )
      .sort();

  const expectedCodes =
    [
      ...REQUIRED_STUDY_PLAN_SUBJECT_CODES,
    ].sort();

  if (
    actualCodes.length !==
      expectedCodes.length ||
    actualCodes.some(
      (
        code,
        index,
      ) =>
        code !==
          expectedCodes[
            index
          ],
    )
  ) {
    throw new Error(
      [
        'Study-plan subject supplement has the wrong unit set.',
        `expected=${expectedCodes.join(',')}`,
        `actual=${actualCodes.join(',')}`,
      ].join(
        ' ',
      ),
    );
  }

  for (
    const unit
    of units
  ) {
    if (
      !unit ||
      typeof unit.code !==
        'string' ||
      typeof unit.name !==
        'string' ||
      !isRecord(
        unit.accessConditions,
      ) ||
      typeof unit.sourceUrl !==
        'string'
    ) {
      throw new Error(
        `Study-plan subject supplement contains an invalid unit record for ${String(unit?.code)}.`,
      );
    }
  }

  return units;
}

function accessConditionRecord(
  unit:
    UsydUnit,
): UnknownRecord | null {
  const conditions =
    unit.accessConditions;

  if (
    !conditions.prerequisite &&
    !conditions.corequisite &&
    !conditions.prohibition &&
    !conditions.assumedKnowledge
  ) {
    return null;
  }

  return {
    unitCode:
      unit.code,

    prerequisite:
      conditions.prerequisite,

    corequisite:
      conditions.corequisite,

    prohibition:
      conditions.prohibition,

    assumedKnowledge:
      conditions.assumedKnowledge,
  };
}

export async function buildUsydFinalMasterV1():
Promise<UsydFinalMaster> {
  const [
    baseMasterRaw,
    componentsComplete,
    degreeComponentsArtifact,
    degreeRequirementsArtifact,
    degreeRootsArtifact,
    degreeRawAuditArtifact,
    requisiteFreezeArtifact,
    studyPlansArtifact,
    studyPlanSubjectsArtifact,
  ] =
    await Promise.all(
      [
        readJson(
          BASE_MASTER_FILE,
        ),
        readJson(
          COMPONENTS_COMPLETE_FILE,
        ),
        readJson(
          DEGREE_COMPONENTS_FILE,
        ),
        readJson(
          DEGREE_REQUIREMENTS_FILE,
        ),
        readJson(
          DEGREE_ROOTS_FILE,
        ),
        readJson(
          DEGREE_RAW_AUDIT_FILE,
        ),
        readJson(
          REQUISITE_FREEZE_FILE,
        ),
        readJson(
          STUDY_PLANS_FILE,
        ),
        readJson(
          STUDY_PLAN_SUBJECTS_FILE,
        ),
      ],
    );

  if (
    !isRecord(
      baseMasterRaw,
    )
  ) {
    throw new Error(
      'usyd-master-global.json is not an object.',
    );
  }

  const baseMaster =
    baseMasterRaw as
      unknown as
      BaseMaster;

  if (
    baseMaster
      .handbookYear !==
      2026
  ) {
    throw new Error(
      `Expected base master handbook year 2026, got ${baseMaster.handbookYear}.`,
    );
  }

  if (
    baseMaster
      .degrees
      .length !==
      109
  ) {
    throw new Error(
      `Expected 109 degrees in base master, got ${baseMaster.degrees.length}.`,
    );
  }

  if (
    baseMaster
      .components
      .length !==
      358
  ) {
    throw new Error(
      `Expected 358 canonical/source-scoped components in Stage 1 master, got ${baseMaster.components.length}.`,
    );
  }

  if (
    baseMaster
      .componentSources
      .length !==
      358
  ) {
    throw new Error(
      `Expected 358 parsed component source records, got ${baseMaster.componentSources.length}.`,
    );
  }


  const componentRequirementObjects =
    buildStage1RequirementBearingComponents(
      baseMaster
        .componentSources,
    );

  if (
    componentRequirementObjects
      .length !==
      132
  ) {
    throw new Error(
      `Expected 132 requirement-bearing component objects rebuilt from Stage 1 componentSources, got ${componentRequirementObjects.length}.`,
    );
  }

  if (
    baseMaster
      .subjects
      .length !==
      3011
  ) {
    throw new Error(
      `Expected 3011 resolved subjects, got ${baseMaster.subjects.length}.`,
    );
  }

  if (
    baseMaster
      .unresolvedSubjectDetails
      .length !==
      111
  ) {
    throw new Error(
      `Expected 111 unresolved subjects, got ${baseMaster.unresolvedSubjectDetails.length}.`,
    );
  }

  if (
    baseMaster
      .subjectAccessConditions
      .length !==
      2468
  ) {
    throw new Error(
      `Expected 2468 access-condition records, got ${baseMaster.subjectAccessConditions.length}.`,
    );
  }

  const supplementalSubjects =
    requireStudyPlanSubjectSupplement(
      studyPlanSubjectsArtifact,
    );

  const baseSubjectCodes =
    new Set(
      baseMaster
        .subjects
        .map(
          (
            unit,
          ) =>
            unit.code,
        ),
    );

  for (
    const unit
    of supplementalSubjects
  ) {
    if (
      baseSubjectCodes.has(
        unit.code,
      )
    ) {
      throw new Error(
        `Study-plan subject supplement duplicates base subject ${unit.code}.`,
      );
    }
  }

  const subjects =
    [
      ...baseMaster.subjects,
      ...supplementalSubjects,
    ].sort(
      (
        left,
        right,
      ) =>
        left.code.localeCompare(
          right.code,
        ),
    );

  const supplementalAccessConditions =
    supplementalSubjects
      .map(
        accessConditionRecord,
      )
      .filter(
        (
          record,
        ): record is UnknownRecord =>
          record !==
            null,
      );

  const subjectAccessConditions =
    [
      ...baseMaster.subjectAccessConditions,
      ...supplementalAccessConditions,
    ];

  const canonicalComponents =
    requireArrayWithLength(
      componentsComplete,
      367,
      [
        'components',
        'mergedComponents',
        'completeComponents',
        'items',
      ],
      'complete canonical components',
    );

  const explicitRelationships =
    requireArrayWithLength(
      degreeComponentsArtifact,
      18,
      [
        'explicitNamedRelationships',
        'explicitRelationships',
        'relationships',
      ],
      'explicit named degree-component relationships',
    );

  const choicePools =
    requireDegreeComponentChoicePools(
      degreeComponentsArtifact,
      97,
    );

  const requirementClauses =
    requireArrayWithLength(
      degreeRequirementsArtifact,
      1085,
      [
        'clauses',
        'requirements',
        'records',
        'items',
      ],
      'enriched degree requirement clauses',
    );

  const requirementRoots =
    requireArrayWithLength(
      degreeRootsArtifact,
      109,
      [
        'degrees',
        'roots',
        'records',
        'items',
      ],
      'degree requirement roots',
    );

  const studyPlans =
    requireArrayWithLength(
      studyPlansArtifact,
      6,
      [
        'studyPlans',
        'plans',
        'items',
      ],
      'normalized study plans',
    );

  const baseSubjectRequisites =
    rebuildRequisiteRules(
      baseMaster
        .subjects,
    );

  const supplementalSubjectRequisites =
    rebuildRequisiteRules(
      supplementalSubjects,
    );

  const subjectRequisites =
    [
      ...baseSubjectRequisites,
      ...supplementalSubjectRequisites,
    ];

  const supplementalAuthoritativeRequisiteRules =
    supplementalSubjectRequisites.filter(
      (
        rule,
      ) =>
        rule.authoritative,
    ).length;

  const supplementalRawFallbackRequisiteRules =
    supplementalSubjectRequisites.length -
    supplementalAuthoritativeRequisiteRules;

  const authoritativeRequisiteRules =
    subjectRequisites.filter(
      (
        rule,
      ) =>
        rule.authoritative,
    ).length;

  const rawFallbackRequisiteRules =
    subjectRequisites.length -
    authoritativeRequisiteRules;

  /**
   * Freeze artifact and current parser must agree exactly.
   */
  if (
    freezeCount(
      requisiteFreezeArtifact,
      'rules',
    ) !==
      3189 ||
    freezeCount(
      requisiteFreezeArtifact,
      'authoritativeStructured',
    ) !==
      3148 ||
    freezeCount(
      requisiteFreezeArtifact,
      'safeRawFallback',
    ) !==
      41 ||
    freezeCount(
      requisiteFreezeArtifact,
      'mustFix',
    ) !==
      0
  ) {
    throw new Error(
      'Requisite freeze artifact does not match the frozen V6.3 baseline.',
    );
  }

  if (
    baseSubjectRequisites.length !==
      3189 ||
    baseSubjectRequisites.filter(
      (
        rule,
      ) =>
        rule.authoritative,
    ).length !==
      3148 ||
    baseSubjectRequisites.filter(
      (
        rule,
      ) =>
        !rule.authoritative,
    ).length !==
      41
  ) {
    throw new Error(
      [
        'Current parser does not match requisite freeze.',
        `baseRules=${baseSubjectRequisites.length}`,
        `baseAuthoritative=${baseSubjectRequisites.filter((rule) => rule.authoritative).length}`,
        `baseRawFallback=${baseSubjectRequisites.filter((rule) => !rule.authoritative).length}`,
      ].join(' '),
    );
  }

  const degreeComponents:
    TaggedDegreeComponentRelationship[] =
    [
      ...explicitRelationships.map(
        (
          relationship,
        ) => ({
          relationshipKind:
            'EXPLICIT_NAMED' as const,

          data:
            relationship,
        }),
      ),

      ...choicePools.map(
        (
          pool,
        ) => ({
          relationshipKind:
            'CHOICE_POOL' as const,

          data:
            pool,
        }),
      ),
    ];

  const planCounts =
    studyPlanCounts(
      studyPlans,
    );

  if (
    planCounts.years !==
      20 ||
    planCounts.periods !==
      40 ||
    planCounts.items !==
      152
  ) {
    throw new Error(
      [
        'Study plan totals changed unexpectedly.',
        `years=${planCounts.years}`,
        `periods=${planCounts.periods}`,
        `items=${planCounts.items}`,
      ].join(' '),
    );
  }

  return {
    university:
      baseMaster
        .university,

    handbookYear:
      2026,

    degrees:
      baseMaster
        .degrees,

    components:
      canonicalComponents,

    componentRequirementObjects,

    componentSources:
      baseMaster
        .componentSources,

    degreeSpecificTables:
      baseMaster
        .degreeSpecificTables,

    degreeTableOwnership:
      baseMaster
        .degreeTableOwnership,

    subjects:
      subjects,

    unresolvedSubjectDetails:
      baseMaster
        .unresolvedSubjectDetails,

    subjectAccessConditions:
      subjectAccessConditions,

    subjectRequisites,

    requisiteFreeze:
      requisiteFreezeArtifact,

    degreeComponents,

    degreeRequirements:
      requirementClauses,

    degreeRequirementRoots:
      requirementRoots,

    degreeRequirementRawAudit:
      degreeRawAuditArtifact,

    studyPlans,

    metadata: {
      generatedAt:
        new Date()
          .toISOString(),

      status:
        'FINAL_INTEGRATED_PRE_PRISMA',

      coverage: {
        globalDegreeDiscovery:
          true,

        globalDegreeParsing:
          true,

        globalComponentDiscovery:
          true,

        globalComponentParsing:
          true,

        completeComponentRoleCatalog:
          true,

        degreeSpecificTableOwnership:
          true,

        unitDetails:
          true,

        unresolvedUnitDetails:
          true,

        requisites:
          true,

        requisiteSemanticsFrozen:
          true,

        degreeComponentRelationships:
          true,

        degreeRequirementSemantics:
          true,

        recommendedStudyPlans:
          true,
      },

      counts: {
        degrees:
          baseMaster
            .degrees
            .length,

        canonicalComponents:
          canonicalComponents
            .length,

        componentRequirementObjects:
          componentRequirementObjects
            .length,

        componentSourceRecords:
          baseMaster
            .componentSources
            .length,

        degreeSpecificTables:
          baseMaster
            .degreeSpecificTables
            .length,

        degreeTableOwnershipRows:
          baseMaster
            .degreeTableOwnership
            .length,

        subjects:
          subjects
            .length,

        supplementalStudyPlanSubjects:
          supplementalSubjects
            .length,

        unresolvedSubjects:
          baseMaster
            .unresolvedSubjectDetails
            .length,

        accessConditions:
          subjectAccessConditions
            .length,

        supplementalAccessConditionRecords:
          supplementalAccessConditions
            .length,

        requisiteRules:
          subjectRequisites
            .length,

        baseFrozenRequisiteRules:
          baseSubjectRequisites
            .length,

        supplementalRequisiteRules:
          supplementalSubjectRequisites
            .length,

        authoritativeRequisiteRules,

        supplementalAuthoritativeRequisiteRules,

        rawFallbackRequisiteRules,

        supplementalRawFallbackRequisiteRules,

        explicitNamedDegreeComponentRelationships:
          explicitRelationships
            .length,

        degreeComponentChoicePools:
          choicePools
            .length,

        totalDegreeComponentRelationshipRecords:
          degreeComponents
            .length,

        degreeRequirementClauses:
          requirementClauses
            .length,

        degreeRequirementRoots:
          requirementRoots
            .length,

        studyPlans:
          studyPlans
            .length,

        studyPlanYears:
          planCounts
            .years,

        studyPlanPeriods:
          planCounts
            .periods,

        studyPlanItems:
          planCounts
            .items,
      },
    },
  };
}

export async function writeUsydFinalMasterV1():
Promise<void> {
  const result =
    await buildUsydFinalMasterV1();

  const temporary =
    `${OUTPUT_FILE}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      result,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    OUTPUT_FILE,
  );

  console.log(
    '[USYD final master V1.1] PASS',
  );

  console.log(
    `Degrees: ${result.metadata.counts.degrees}`,
  );

  console.log(
    `Canonical components: ${result.metadata.counts.canonicalComponents}`,
  );

  console.log(
    `Subjects: ${result.metadata.counts.subjects}`,
  );

  console.log(
    `P/C/N: ${result.metadata.counts.requisiteRules}`,
  );

  console.log(
    `Degree-component relationship records: ${result.metadata.counts.totalDegreeComponentRelationshipRecords}`,
  );

  console.log(
    `Degree requirement clauses: ${result.metadata.counts.degreeRequirementClauses}`,
  );

  console.log(
    `Study plans: ${result.metadata.counts.studyPlans}`,
  );

  console.log(
    `Output: ${OUTPUT_FILE}`,
  );
}
