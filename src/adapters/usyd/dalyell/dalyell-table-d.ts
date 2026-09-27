export type JsonObject =
  Record<string, unknown>;

export interface CandidateSource
  extends JsonObject {
  id: string;
  degreeCode: string;
  requirementKey: string;
  sourceType:
    'TABLE_SUBJECT_POOL';
  title: string;
  tableName: string;
  authoritative: boolean;
  subjectCodes: string[];
  sourceUrls: string[];
}

interface SubjectRecord
  extends JsonObject {
  code?: string;
}

interface ParsedComponentTable
  extends JsonObject {
  url?: string;
  units?: JsonObject[];
}

interface ComponentSource
  extends JsonObject {
  parsedTables?:
    ParsedComponentTable[];
}

export interface DalyellMaster
  extends JsonObject {
  university?: {
    code?: string;
  };
  handbookYear?: number;
  subjects: SubjectRecord[];
  componentSources: ComponentSource[];
  degreeRequirements: JsonObject[];
  requirementCandidateSources?:
    JsonObject[];
  metadata: JsonObject & {
    counts?: Record<string, number>;
  };
}

export interface DalyellRequirementSummary {
  degreeCode: string;
  sourcePath: string;
  sourceIndex: number;
  requiredCreditPoints: number;
  candidateSourceKey: string;
}

export interface DalyellTableDResult {
  sourceUrl: string;
  sourceTableCount: number;
  subjectCodes: string[];
  canonicalSubjectCount: number;
  missingSubjectCodes: string[];
  unresolvedSubjectCodes: string[];
  authoritativeRequirementCount: number;
  requirements: DalyellRequirementSummary[];
  creditPointCounts:
    Record<string, number>;
  candidateSourceCount: number;
  candidateMembershipCount: number;
  totalCandidateSourceCount: number;
  engineeringUndergraduateSubjectCount:
    number;
  tableSSubjectCount: number;
}

export const TABLE_D_SOURCE_URL =
  'https://www.sydney.edu.au/handbooks/interdisciplinary-studies/dalyell-stream/unit-of-study-table.html';

export const TABLE_D_TITLE =
  'Table D Dalyell units';

const TABLE_D_UNIT_PATH =
  '/handbooks/interdisciplinary-studies/dalyell-stream/unit-of-study-table.html';

const ENGINEERING_SOURCE_KEY =
  'USYD:2026:BHENGINE-04:FREE-ELECTIVES:ENGINEERING-UG';

const TABLE_S_SOURCE_KEY =
  'USYD:2026:BHENGINE-04:FREE-ELECTIVES:TABLE-S';

const EXPECTED_TABLE_D_CODES = [
  'BUDL2901',
  'BUDL2902',
  'BUDL3901',
  'BUDL3902',
  'ENGD2001',
  'ENGD3001',
  'ENGD3002',
  'ENGD3003',
  'ENGD3004',
  'FASS2100',
  'FASS2200',
  'FASS2300',
  'SCDL1991',
  'SCDL2991',
  'SCDL2992',
  'SCDL3991',
  'SCDL3992',
];

const EXPECTED_DALYELL_DEGREES = [
  'BHENGART-05',
  'BHENGCOM-05',
  'BHENGINE-04',
  'BHENGSCI-05',
  'BPADVCMP-01',
  'BPARTAVS-01',
  'BPARTSAR-09',
  'BPAVTBSC-01',
  'BPCOMART-03',
  'BPCOMAVS-01',
  'BPCOMLAW-05',
  'BPCOMMER-06',
  'BPCOMSCI-03',
  'BPDSNAVS-01',
  'BPECNART-01',
  'BPECNAVS-01',
  'BPECONOM-05',
  'BPINTSTD-02',
  'BPLANGUA-01',
  'BPMATHSC-01',
  'BPMEDCOM-01',
  'BPPLPHEC-01',
  'BPSCIART-03',
  'BPSCIAVS-01',
  'BPSCIDMD-01',
  'BPSCIENC-05',
  'BPSCILAW-02',
  'BPSCIMED-01',
  'BPSCINUD-02',
  'BPSCINUR-02',
  'BPWLCTRG-01',
];

export function applyDalyellTableDPools(
  master:
    DalyellMaster,
): DalyellTableDResult {
  validateMasterShape(
    master,
  );

  const pool =
    buildTableDSubjectPool(
      master.componentSources,
    );

  const canonicalCodes =
    new Set(
      master.subjects.map(
        (subject) =>
          requiredString(
            subject.code,
            'subject.code',
          ).toUpperCase(),
      ),
    );

  const missingSubjectCodes =
    pool.subjectCodes.filter(
      (code) =>
        !canonicalCodes.has(
          code,
        ),
    );

  if (
    missingSubjectCodes.length >
    0
  ) {
    throw new Error(
      `Table D contains non-canonical subjects: ${missingSubjectCodes.join(', ')}.`,
    );
  }

  const requirements =
    findAuthoritativeDalyellRequirements(
      master.degreeRequirements,
    );

  const sources =
    requirements.map(
      (requirement) =>
        attachTableDSource(
          requirement,
          pool.subjectCodes,
          pool.sourceUrls,
        ),
    );

  master.requirementCandidateSources = [
    ...(master.requirementCandidateSources ??
      []).filter(
      (source) =>
        !isGeneratedTableDSource(
          source,
        ),
    ),
    ...sources,
  ];

  const counts =
    master.metadata.counts ??
    {};

  counts.requirementCandidateSources =
    master.requirementCandidateSources.length;

  counts.tableDSubjects =
    pool.subjectCodes.length;

  counts.dalyellRequirementCandidateSources =
    sources.length;

  master.metadata.counts =
    counts;

  return validateDalyellTableD(
    master,
  );
}

export function validateDalyellTableD(
  master:
    DalyellMaster,
): DalyellTableDResult {
  validateMasterShape(
    master,
  );

  const pool =
    buildTableDSubjectPool(
      master.componentSources,
    );

  assertSameValues(
    'authoritative Table D membership',
    pool.subjectCodes,
    EXPECTED_TABLE_D_CODES,
  );

  if (
    pool.tablesUsed !==
      1 ||
    pool.sourceUrls.length !==
      1 ||
    pool.sourceUrls[0] !==
      TABLE_D_SOURCE_URL
  ) {
    throw new Error(
      'Expected exactly one authoritative core Table D unit table.',
    );
  }

  const canonicalCodes =
    new Set(
      master.subjects.map(
        (subject) =>
          requiredString(
            subject.code,
            'subject.code',
          ).toUpperCase(),
      ),
    );

  const missingSubjectCodes =
    pool.subjectCodes.filter(
      (code) =>
        !canonicalCodes.has(
          code,
        ),
    );

  if (
    missingSubjectCodes.length >
    0
  ) {
    throw new Error(
      `Unresolved Table D subjects: ${missingSubjectCodes.join(', ')}.`,
    );
  }

  const requirements =
    findAuthoritativeDalyellRequirements(
      master.degreeRequirements,
    );

  const degreeCodes =
    requirements.map(
      (requirement) =>
        requiredString(
          requirement.degreeCode,
          'Dalyell requirement degreeCode',
        ),
    );

  assertSameValues(
    'authoritative Dalyell degree coverage',
    degreeCodes,
    EXPECTED_DALYELL_DEGREES,
  );

  const candidateSources =
    master.requirementCandidateSources ??
    [];

  const tableDSources =
    candidateSources.filter(
      isGeneratedTableDSource,
    );

  if (
    tableDSources.length !==
    requirements.length
  ) {
    throw new Error(
      `Expected ${requirements.length} Table D candidate sources, found ${tableDSources.length}.`,
    );
  }

  const sourceById =
    new Map<string, JsonObject>();

  for (
    const source
    of candidateSources
  ) {
    const id =
      requiredString(
        source.id,
        'requirementCandidateSource.id',
      );

    if (
      sourceById.has(
        id,
      )
    ) {
      throw new Error(
        `Duplicate candidate source id: ${id}.`,
      );
    }

    sourceById.set(
      id,
      source,
    );
  }

  for (
    const source
    of tableDSources
  ) {
    if (
      source.sourceType !==
        'TABLE_SUBJECT_POOL' ||
      source.tableName !==
        'Table D' ||
      source.title !==
        TABLE_D_TITLE ||
      source.authoritative !==
        true
    ) {
      throw new Error(
        `Invalid Table D source metadata for ${String(source.id)}.`,
      );
    }

    const subjectCodes =
      stringArray(
        source.subjectCodes,
      );

    if (
      new Set(
        subjectCodes,
      ).size !==
      subjectCodes.length
    ) {
      throw new Error(
        `Duplicate Table D membership in ${String(source.id)}.`,
      );
    }

    assertSameValues(
      `${String(source.id)} membership`,
      subjectCodes,
      pool.subjectCodes,
    );
  }

  const summaries =
    requirements.map(
      (requirement) => {
        const sourceKey =
          tableDRequirementSourceKey(
            requirement,
          );

        const node =
          objectOrEmpty(
            requirement.node,
          );

        const linkedTableDSources =
          stringArray(
            node.candidateSourceIds,
          ).filter(
            (sourceId) =>
              isGeneratedTableDSource(
                sourceById.get(
                  sourceId,
                ) ??
                {},
              ),
          );

        if (
          linkedTableDSources.length !==
            1 ||
          linkedTableDSources[0] !==
            sourceKey
        ) {
          throw new Error(
            `${String(requirement.degreeCode)} Dalyell requirement does not link exactly one expected Table D source.`,
          );
        }

        return summarizeRequirement(
          requirement,
        );
      },
    );

  const creditPointCounts =
    countCreditPoints(
      summaries,
    );

  if (
    creditPointCounts['6'] !==
      1 ||
    creditPointCounts['12'] !==
      30
  ) {
    throw new Error(
      `Unexpected Dalyell CP distribution: ${JSON.stringify(creditPointCounts)}.`,
    );
  }

  const bhengine =
    summaries.find(
      (summary) =>
        summary.degreeCode ===
        'BHENGINE-04',
    );

  if (
    !bhengine ||
    bhengine.requiredCreditPoints !==
      12
  ) {
    throw new Error(
      'BHENGINE-04 Dalyell Table D linkage is missing or invalid.',
    );
  }

  const engineeringSource =
    sourceById.get(
      ENGINEERING_SOURCE_KEY,
    );

  const tableSSource =
    sourceById.get(
      TABLE_S_SOURCE_KEY,
    );

  const engineeringCount =
    stringArray(
      engineeringSource?.subjectCodes,
    ).length;

  const tableSCount =
    stringArray(
      tableSSource?.subjectCodes,
    ).length;

  if (
    engineeringCount !==
      271 ||
    tableSCount !==
      1472
  ) {
    throw new Error(
      `Existing candidate-pool regression: Engineering=${engineeringCount}, Table S=${tableSCount}.`,
    );
  }

  if (
    master.metadata.counts
      ?.requirementCandidateSources !==
    candidateSources.length
  ) {
    throw new Error(
      'Requirement candidate-source metadata count does not match the generated array.',
    );
  }

  return {
    sourceUrl:
      TABLE_D_SOURCE_URL,
    sourceTableCount:
      pool.tablesUsed,
    subjectCodes:
      pool.subjectCodes,
    canonicalSubjectCount:
      pool.subjectCodes.length,
    missingSubjectCodes,
    unresolvedSubjectCodes:
      missingSubjectCodes,
    authoritativeRequirementCount:
      requirements.length,
    requirements:
      summaries,
    creditPointCounts,
    candidateSourceCount:
      tableDSources.length,
    candidateMembershipCount:
      tableDSources.reduce(
        (total, source) =>
          total +
          stringArray(
            source.subjectCodes,
          ).length,
        0,
      ),
    totalCandidateSourceCount:
      candidateSources.length,
    engineeringUndergraduateSubjectCount:
      engineeringCount,
    tableSSubjectCount:
      tableSCount,
  };
}

function buildTableDSubjectPool(
  componentSources:
    ComponentSource[],
): {
  subjectCodes: string[];
  sourceUrls: string[];
  tablesUsed: number;
} {
  const codes =
    new Set<string>();
  const urls =
    new Set<string>();
  let tablesUsed =
    0;

  for (
    const source
    of componentSources
  ) {
    for (
      const table
      of source.parsedTables ??
        []
    ) {
      const url =
        stringOrNull(
          table.url,
        );

      if (
        !url ||
        !isCoreTableDUrl(
          url,
        )
      ) {
        continue;
      }

      const units =
        Array.isArray(
          table.units,
        )
          ? table.units.filter(
              isObject,
            )
          : [];

      if (
        units.length ===
        0
      ) {
        continue;
      }

      tablesUsed +=
        1;
      urls.add(
        url,
      );

      for (
        const unit
        of units
      ) {
        const code =
          firstString(
            unit.code,
            unit.subjectCode,
          );

        if (code) {
          codes.add(
            code.toUpperCase(),
          );
        }
      }
    }
  }

  return {
    subjectCodes:
      [...codes].sort(),
    sourceUrls:
      [...urls].sort(),
    tablesUsed,
  };
}

function isCoreTableDUrl(
  value:
    string,
): boolean {
  try {
    return new URL(
      value,
    ).pathname
      .toLowerCase() ===
      TABLE_D_UNIT_PATH;
  } catch {
    return false;
  }
}

function findAuthoritativeDalyellRequirements(
  requirements:
    JsonObject[],
): JsonObject[] {
  return requirements
    .filter(
      (requirement) => {
        const node =
          objectOrEmpty(
            requirement.node,
          );
        const nested =
          objectOrEmpty(
            node.requirement,
          );

        return (
          requirement.status ===
            'AUTHORITATIVE' &&
          node.nodeType ===
            'CONDITIONAL' &&
          node.condition ===
            'DALYELL_ENROLLED' &&
          nested.category ===
            'DALYELL' &&
          stringArray(
            nested.tables,
          ).includes(
            'D',
          ) &&
          numberOrNull(
            nested.creditPoints,
          ) !==
            null
        );
      },
    )
    .sort(
      (left, right) =>
        tableDRequirementSourceKey(
          left,
        ).localeCompare(
          tableDRequirementSourceKey(
            right,
          ),
        ),
    );
}

function attachTableDSource(
  requirement:
    JsonObject,
  subjectCodes:
    string[],
  sourceUrls:
    string[],
): CandidateSource {
  const sourceKey =
    tableDRequirementSourceKey(
      requirement,
    );
  const node =
    objectOrEmpty(
      requirement.node,
    );

  node.candidateSourceIds = [
    ...stringArray(
      node.candidateSourceIds,
    ).filter(
      (id) =>
        !id.endsWith(
          ':TABLE-D',
        ),
    ),
    sourceKey,
  ];
  node.candidateSemantics =
    'UNION';
  node.candidateSourceNote =
    'Eligible subjects are the authoritative 2026 Table D Dalyell units. The requirement credit-point threshold and Dalyell enrolment condition remain defined by this requirement group.';
  requirement.node =
    node;

  const degreeCode =
    requiredString(
      requirement.degreeCode,
      'Dalyell requirement degreeCode',
    );
  const sourcePath =
    requiredString(
      requirement.sourcePath,
      'Dalyell requirement sourcePath',
    );
  const sourceIndex =
    requiredInteger(
      requirement.sourceIndex,
      'Dalyell requirement sourceIndex',
    );

  return {
    id:
      sourceKey,
    degreeCode,
    requirementKey:
      `DALYELL:${sourcePath}:${sourceIndex}`,
    sourceType:
      'TABLE_SUBJECT_POOL',
    title:
      TABLE_D_TITLE,
    tableName:
      'Table D',
    authoritative:
      true,
    subjectCodes:
      [...subjectCodes],
    sourceUrls:
      [...sourceUrls],
  };
}

function tableDRequirementSourceKey(
  requirement:
    JsonObject,
): string {
  return [
    'USYD',
    '2026',
    requiredString(
      requirement.degreeCode,
      'Dalyell requirement degreeCode',
    ),
    'DALYELL',
    requiredString(
      requirement.sourcePath,
      'Dalyell requirement sourcePath',
    ),
    requiredInteger(
      requirement.sourceIndex,
      'Dalyell requirement sourceIndex',
    ),
    'TABLE-D',
  ].join(
    ':',
  );
}

function summarizeRequirement(
  requirement:
    JsonObject,
): DalyellRequirementSummary {
  const nested =
    objectOrEmpty(
      objectOrEmpty(
        requirement.node,
      ).requirement,
    );

  return {
    degreeCode:
      requiredString(
        requirement.degreeCode,
        'Dalyell requirement degreeCode',
      ),
    sourcePath:
      requiredString(
        requirement.sourcePath,
        'Dalyell requirement sourcePath',
      ),
    sourceIndex:
      requiredInteger(
        requirement.sourceIndex,
        'Dalyell requirement sourceIndex',
      ),
    requiredCreditPoints:
      requiredInteger(
        nested.creditPoints,
        'Dalyell requirement creditPoints',
      ),
    candidateSourceKey:
      tableDRequirementSourceKey(
        requirement,
      ),
  };
}

function countCreditPoints(
  requirements:
    DalyellRequirementSummary[],
): Record<string, number> {
  return requirements.reduce<
    Record<string, number>
  >(
    (result, requirement) => {
      const key =
        String(
          requirement.requiredCreditPoints,
        );
      result[key] =
        (result[key] ?? 0) +
        1;
      return result;
    },
    {},
  );
}

function isGeneratedTableDSource(
  source:
    JsonObject,
): boolean {
  return (
    source.tableName ===
      'Table D' &&
    typeof source.id ===
      'string' &&
    source.id.endsWith(
      ':TABLE-D',
    )
  );
}

function validateMasterShape(
  master:
    DalyellMaster,
): void {
  if (
    master.university?.code !==
      'USYD' ||
    master.handbookYear !==
      2026
  ) {
    throw new Error(
      'Expected USYD 2026 master.',
    );
  }

  if (
    !Array.isArray(
      master.subjects,
    ) ||
    !Array.isArray(
      master.componentSources,
    ) ||
    !Array.isArray(
      master.degreeRequirements,
    )
  ) {
    throw new Error(
      'USYD master is missing Dalyell source arrays.',
    );
  }
}

function assertSameValues(
  label:
    string,
  actual:
    string[],
  expected:
    string[],
): void {
  const left =
    [...actual].sort();
  const right =
    [...expected].sort();

  if (
    JSON.stringify(
      left,
    ) !==
    JSON.stringify(
      right,
    )
  ) {
    throw new Error(
      `${label} mismatch. Expected ${right.length}, found ${left.length}.`,
    );
  }
}

function isObject(
  value:
    unknown,
): value is JsonObject {
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

function objectOrEmpty(
  value:
    unknown,
): JsonObject {
  return isObject(
    value,
  )
    ? value
    : {};
}

function stringOrNull(
  value:
    unknown,
): string | null {
  return (
    typeof value ===
      'string' &&
    value.trim()
  )
    ? value.trim()
    : null;
}

function firstString(
  ...values:
    unknown[]
): string | null {
  for (
    const value
    of values
  ) {
    const result =
      stringOrNull(
        value,
      );
    if (result) {
      return result;
    }
  }
  return null;
}

function requiredString(
  value:
    unknown,
  label:
    string,
): string {
  const result =
    stringOrNull(
      value,
    );
  if (!result) {
    throw new Error(
      `Missing ${label}.`,
    );
  }
  return result;
}

function requiredInteger(
  value:
    unknown,
  label:
    string,
): number {
  if (
    typeof value !==
      'number' ||
    !Number.isInteger(
      value,
    )
  ) {
    throw new Error(
      `Missing ${label}.`,
    );
  }
  return value;
}

function numberOrNull(
  value:
    unknown,
): number | null {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(
      value,
    )
  )
    ? value
    : null;
}

function stringArray(
  value:
    unknown,
): string[] {
  return Array.isArray(
    value,
  )
    ? value.filter(
        (
          item,
        ): item is string =>
          typeof item ===
          'string',
      )
    : [];
}
