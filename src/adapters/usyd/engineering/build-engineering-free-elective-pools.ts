import {
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

type JsonObject =
  Record<string, unknown>;

interface SubjectRecord
  extends JsonObject {
  code?: string;

  name?: string;

  studyLevel?:
    string | null;

  managingFaculty?:
    string | null;

  sourceUrl?:
    string | null;
}

interface ParsedComponentTable
  extends JsonObject {
  url?: string;

  units?: JsonObject[];
}

interface ComponentSource
  extends JsonObject {
  component?:
    JsonObject;

  parsedTables?:
    ParsedComponentTable[];
}

interface CandidateSource
  extends JsonObject {
  id: string;

  degreeCode:
    string;

  requirementKey:
    string;

  sourceType:
    'SUBJECT_FILTER' |
    'TABLE_SUBJECT_POOL';

  title:
    string;

  authoritative:
    boolean;

  subjectCodes:
    string[];

  sourceUrls:
    string[];

  predicate?:
    JsonObject;

  tableName?:
    string;
}

interface MasterFile
  extends JsonObject {
  university?: {
    code?: string;
  };

  handbookYear?:
    number;

  subjects:
    SubjectRecord[];

  componentSources:
    ComponentSource[];

  degreeRequirements:
    JsonObject[];

  requirementCandidateSources?:
    CandidateSource[];

  metadata:
    JsonObject & {
      counts?: Record<
        string,
        number
      >;
    };
}

interface FreeElectiveReport {
  generatedAt:
    string;

  degreeCode:
    string;

  freeElectiveRequirement: {
    found:
      boolean;

    sourcePath:
      string | null;

    raw:
      string | null;

    maximumCreditPoints:
      number | null;
  };

  engineeringUndergraduatePool: {
    subjectCount:
      number;

    subjectCodes:
      string[];
  };

  tableSPool: {
    subjectCount:
      number;

    subjectCodes:
      string[];

    sourceUrls:
      string[];

    tablesUsed:
      number;
  };

  overlap: {
    subjectCount:
      number;

    subjectCodes:
      string[];
  };

  combinedUniqueEligibleSubjects:
    number;
}

const INPUT_FILE =
  resolve(
    process.cwd(),

    'data/normalized/usyd/2026/' +
      'usyd-master-final.engineering-repaired.subjects-resolved.json',
  );

const OUTPUT_FILE =
  INPUT_FILE;

const BACKUP_FILE =
  resolve(
    process.cwd(),

    'data/normalized/usyd/2026/' +
      'usyd-master-final.engineering-repaired.subjects-resolved.before-free-electives.json',
  );

const REPORT_FILE =
  resolve(
    process.cwd(),

    'data/normalized/usyd/2026/' +
      'usyd-engineering-free-elective-pools-report.json',
  );

const UNIVERSITY_CODE =
  'USYD';

const HANDBOOK_YEAR =
  2026;

const DEGREE_CODE =
  'BHENGINE-04';

const REQUIREMENT_KEY =
  'FREE_ELECTIVES';

const TABLE_S_PATH =
  '/handbooks/interdisciplinary-studies/table-s/subject-areas/';

/*
 * ============================================================
 * MAIN
 * ============================================================
 */

async function main():
Promise<void> {
  const master =
    await readJson<MasterFile>(
      INPUT_FILE,
    );

  validateMaster(
    master,
  );

  await writeJson(
    BACKUP_FILE,
    master,
  );

  const subjectByCode =
    buildSubjectMap(
      master.subjects,
    );

  /*
   * ----------------------------------------------------------
   * ENGINEERING UNDERGRADUATE POOL
   * ----------------------------------------------------------
   */

  const engineeringCodes =
    buildEngineeringUndergraduatePool(
      master.subjects,
    );

  validateSubjectCodesExist(
    engineeringCodes,
    subjectByCode,
    'Engineering undergraduate pool',
  );

  /*
   * ----------------------------------------------------------
   * TABLE S SUBJECT POOL
   * ----------------------------------------------------------
   */

  const tableS =
    buildTableSSubjectPool(
      master.componentSources,
    );

  if (
    tableS.subjectCodes.length ===
    0
  ) {
    throw new Error(
      'Table S subject pool is empty. No authoritative Table S physical unit rows were found.',
    );
  }

  validateSubjectCodesExist(
    tableS.subjectCodes,
    subjectByCode,
    'Table S pool',
  );

  /*
   * ----------------------------------------------------------
   * FREE ELECTIVES REQUIREMENT
   * ----------------------------------------------------------
   */

  const freeElectiveRequirement =
    findFreeElectiveRequirement(
      master.degreeRequirements,
    );

  if (
    !freeElectiveRequirement
  ) {
    throw new Error(
      `Could not find the ${DEGREE_CODE} Free Electives degree requirement.`,
    );
  }

  repairFreeElectiveRequirement(
    freeElectiveRequirement,
  );

  /*
   * ----------------------------------------------------------
   * CANDIDATE SOURCES
   * ----------------------------------------------------------
   */

  const candidateSources:
    CandidateSource[] =
    [
      {
        id:
          'USYD:2026:BHENGINE-04:FREE-ELECTIVES:ENGINEERING-UG',

        degreeCode:
          DEGREE_CODE,

        requirementKey:
          REQUIREMENT_KEY,

        sourceType:
          'SUBJECT_FILTER',

        title:
          'Engineering undergraduate units',

        authoritative:
          true,

        predicate: {
          managingFaculty:
            'Engineering',

          studyLevel:
            'Undergraduate',
        },

        subjectCodes:
          engineeringCodes,

        sourceUrls:
          [],
      },

      {
        id:
          'USYD:2026:BHENGINE-04:FREE-ELECTIVES:TABLE-S',

        degreeCode:
          DEGREE_CODE,

        requirementKey:
          REQUIREMENT_KEY,

        sourceType:
          'TABLE_SUBJECT_POOL',

        title:
          'Table S units',

        tableName:
          'Table S',

        authoritative:
          true,

        subjectCodes:
          tableS.subjectCodes,

        sourceUrls:
          tableS.sourceUrls,
      },
    ];

  master.requirementCandidateSources =
    replaceEngineeringFreeElectiveCandidateSources(
      master.requirementCandidateSources ??
        [],
      candidateSources,
    );

  /*
   * ----------------------------------------------------------
   * METADATA
   * ----------------------------------------------------------
   */

  const counts =
    master.metadata.counts ??
    {};

  counts.requirementCandidateSources =
    master.requirementCandidateSources.length;

  counts.engineeringFreeElectiveEngineeringSubjects =
    engineeringCodes.length;

  counts.engineeringFreeElectiveTableSSubjects =
    tableS.subjectCodes.length;

  master.metadata.counts =
    counts;

  /*
   * ----------------------------------------------------------
   * VALIDATION
   * ----------------------------------------------------------
   */

  validateCandidateSources(
    master,
    engineeringCodes,
    tableS.subjectCodes,
  );

  const overlap =
    engineeringCodes.filter(
      (
        code,
      ) =>
        tableS
          .subjectCodeSet
          .has(
            code,
          ),
    );

  const combined =
    new Set([
      ...engineeringCodes,
      ...tableS.subjectCodes,
    ]);

  const report:
    FreeElectiveReport =
    {
      generatedAt:
        new Date()
          .toISOString(),

      degreeCode:
        DEGREE_CODE,

      freeElectiveRequirement: {
        found:
          true,

        sourcePath:
          stringOrNull(
            freeElectiveRequirement.sourcePath,
          ),

        raw:
          stringOrNull(
            freeElectiveRequirement.raw,
          ),

        maximumCreditPoints:
          findMaximumCreditPoints(
            objectOrEmpty(
              freeElectiveRequirement.node,
            ),
          ),
      },

      engineeringUndergraduatePool: {
        subjectCount:
          engineeringCodes.length,

        subjectCodes:
          engineeringCodes,
      },

      tableSPool: {
        subjectCount:
          tableS.subjectCodes.length,

        subjectCodes:
          tableS.subjectCodes,

        sourceUrls:
          tableS.sourceUrls,

        tablesUsed:
          tableS.tablesUsed,
      },

      overlap: {
        subjectCount:
          overlap.length,

        subjectCodes:
          overlap,
      },

      combinedUniqueEligibleSubjects:
        combined.size,
    };

  await writeJson(
    OUTPUT_FILE,
    master,
  );

  await writeJson(
    REPORT_FILE,
    report,
  );

  console.log(
    '========================================',
  );

  console.log(
    'USYD ENGINEERING FREE ELECTIVE POOLS',
  );

  console.log(
    '========================================',
  );

  console.log(
    `Engineering undergraduate subjects: ${engineeringCodes.length}`,
  );

  console.log(
    `Table S subjects: ${tableS.subjectCodes.length}`,
  );

  console.log(
    `Table S physical tables used: ${tableS.tablesUsed}`,
  );

  console.log(
    `Overlap: ${overlap.length}`,
  );

  console.log(
    `Combined unique eligible subjects: ${combined.size}`,
  );

  console.log(
    'Free Electives maximumCreditPoints: 24',
  );

  console.log(
    `Candidate sources: ${candidateSources.length}`,
  );

  console.log(
    `Saved: ${OUTPUT_FILE}`,
  );

  console.log(
    `Report: ${REPORT_FILE}`,
  );

  console.log(
    `Backup: ${BACKUP_FILE}`,
  );
}

/*
 * ============================================================
 * ENGINEERING UNDERGRADUATE POOL
 * ============================================================
 */

function buildEngineeringUndergraduatePool(
  subjects:
    SubjectRecord[],
):
string[] {
  return subjects
    .filter(
      (
        subject,
      ) =>
        normalize(
          subject.managingFaculty,
        ) ===
          'engineering' &&
        normalize(
          subject.studyLevel,
        ) ===
          'undergraduate',
    )
    .map(
      (
        subject,
      ) =>
        requiredString(
          subject.code,
          'Engineering undergraduate subject code',
        ).toUpperCase(),
    )
    .filter(
      (
        code,
        index,
        values,
      ) =>
        values.indexOf(
          code,
        ) ===
        index,
    )
    .sort();
}

/*
 * ============================================================
 * TABLE S SUBJECT POOL
 * ============================================================
 */

function buildTableSSubjectPool(
  componentSources:
    ComponentSource[],
): {
  subjectCodes:
    string[];

  subjectCodeSet:
    Set<string>;

  sourceUrls:
    string[];

  tablesUsed:
    number;
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
    const component =
      objectOrEmpty(
        source.component,
      );

    const componentUrls =
      [
        stringOrNull(
          component.sourceUrl,
        ),

        stringOrNull(
          component.overviewUrl,
        ),

        stringOrNull(
          component.unitTableUrl,
        ),

        stringOrNull(
          component.tableUrl,
        ),
      ]
        .filter(
          (
            value,
          ): value is string =>
            value !==
            null,
        );

    const componentIsTableS =
      componentUrls.some(
        isTableSUrl,
      );

    const tables =
      Array.isArray(
        source.parsedTables,
      )
        ? source.parsedTables
        : [];

    for (
      const table
      of tables
    ) {
      const tableUrl =
        stringOrNull(
          table.url,
        );

      const tableIsTableS =
        tableUrl
          ? isTableSUrl(
              tableUrl,
            )
          : false;

      /*
       * Require either:
       *
       * - the parsed physical table itself to be a Table S
       *   subject-area URL; or
       * - its owning canonical component to be a Table S
       *   subject-area component.
       */
      if (
        !tableIsTableS &&
        !componentIsTableS
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

      if (
        tableUrl
      ) {
        urls.add(
          tableUrl,
        );
      }

      for (
        const unit
        of units
      ) {
        const code =
          firstString(
            unit.code,
            unit.subjectCode,
          );

        if (
          !code
        ) {
          continue;
        }

        codes.add(
          code.toUpperCase(),
        );
      }
    }
  }

  const subjectCodes =
    [
      ...codes,
    ].sort();

  return {
    subjectCodes,

    subjectCodeSet:
      new Set(
        subjectCodes,
      ),

    sourceUrls:
      [
        ...urls,
      ].sort(),

    tablesUsed,
  };
}

function isTableSUrl(
  url:
    string,
):
boolean {
  return url
    .toLowerCase()
    .includes(
      TABLE_S_PATH,
    );
}

/*
 * ============================================================
 * FREE ELECTIVES REQUIREMENT
 * ============================================================
 */

function findFreeElectiveRequirement(
  requirements:
    JsonObject[],
):
JsonObject | null {
  const candidates =
    requirements.filter(
      (
        requirement,
      ) => {
        if (
          stringOrNull(
            requirement.degreeCode,
          ) !==
          DEGREE_CODE
        ) {
          return false;
        }

        const sourcePath =
          stringOrNull(
            requirement.sourcePath,
          );

        const raw =
          firstString(
            requirement.raw,
            objectOrEmpty(
              requirement.node,
            ).raw,
          )
            ?.toLowerCase() ??
          '';

        /*
         * Official BHENGINE-04 rule:
         *
         * "a maximum of 24 credit points from Table S or any unit
         * from within the Faculty of Engineering which are available
         * to undergraduate students"
         *
         * Match source semantics, not a frontend label such as
         * "Free Electives".
         */
        const matchesOfficialRule =
          raw.includes(
            'maximum of 24 credit points',
          ) &&
          raw.includes(
            'table s',
          ) &&
          raw.includes(
            'faculty of engineering',
          ) &&
          raw.includes(
            'undergraduate students',
          );

        /*
         * requirements.13.rawText is the canonical parsed clause.
         * Do not accidentally match the giant rawRequirements blob
         * or the generated Engineering Core clauses that repeat the
         * full degree-resolution text.
         */
        const isCanonicalRequirementClause =
          sourcePath ===
          'requirements.13.rawText';

        return (
          matchesOfficialRule &&
          isCanonicalRequirementClause
        );
      },
    );

  if (
    candidates.length !==
    1
  ) {
    throw new Error(
      `Expected exactly one ${DEGREE_CODE} official maximum-24-CP Table S / Engineering undergraduate elective requirement, found ${candidates.length}.`,
    );
  }

  return candidates[0];
}

function repairFreeElectiveRequirement(
  requirement:
    JsonObject,
): void {
  const node =
    objectOrEmpty(
      requirement.node,
    );

  /*
   * "Maximum 24 CP" is an upper bound.
   *
   * It must not be represented as:
   *
   * requiredCreditPoints = 24
   *
   * because that incorrectly turns the maximum into a minimum /
   * completion requirement.
   */
  node.maximumCreditPoints =
    24;

  const required =
    numberOrNull(
      node.requiredCreditPoints,
    );

  /*
   * Only clear an obviously mis-parsed 24 CP value.
   *
   * Leave any unrelated source-backed required CP untouched.
   */
  if (
    required ===
    24
  ) {
    node.requiredCreditPoints =
      null;
  }

  node.candidateSourceIds =
    [
      'USYD:2026:BHENGINE-04:FREE-ELECTIVES:ENGINEERING-UG',

      'USYD:2026:BHENGINE-04:FREE-ELECTIVES:TABLE-S',
    ];

  node.candidateSemantics =
    'UNION';

  node.candidateSourceNote =
    'Eligible subjects are the union of verified Engineering undergraduate units and authoritative Table S unit-table membership. Subject-level prerequisites, prohibitions, quotas and permissions remain separately enforceable.';

  requirement.node =
    node;
}

/*
 * ============================================================
 * CANDIDATE SOURCE REPLACEMENT
 * ============================================================
 */

function replaceEngineeringFreeElectiveCandidateSources(
  existing:
    CandidateSource[],

  replacements:
    CandidateSource[],
):
CandidateSource[] {
  const retained =
    existing.filter(
      (
        source,
      ) =>
        !(
          source.degreeCode ===
            DEGREE_CODE &&
          source.requirementKey ===
            REQUIREMENT_KEY
        ),
    );

  return [
    ...retained,
    ...replacements,
  ];
}

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function validateCandidateSources(
  master:
    MasterFile,

  expectedEngineering:
    string[],

  expectedTableS:
    string[],
): void {
  const sources =
    master.requirementCandidateSources ??
    [];

  const engineering =
    sources.find(
      (
        source,
      ) =>
        source.id ===
        'USYD:2026:BHENGINE-04:FREE-ELECTIVES:ENGINEERING-UG',
    );

  const tableS =
    sources.find(
      (
        source,
      ) =>
        source.id ===
        'USYD:2026:BHENGINE-04:FREE-ELECTIVES:TABLE-S',
    );

  if (
    !engineering ||
    !tableS
  ) {
    throw new Error(
      'Free Electives candidate sources were not persisted correctly.',
    );
  }

  assertSameCodes(
    'Engineering undergraduate candidate source',
    engineering.subjectCodes,
    expectedEngineering,
  );

  assertSameCodes(
    'Table S candidate source',
    tableS.subjectCodes,
    expectedTableS,
  );

  const freeElective =
    findFreeElectiveRequirement(
      master.degreeRequirements,
    );

  if (
    !freeElective
  ) {
    throw new Error(
      'Free Electives requirement disappeared after repair.',
    );
  }

  const node =
    objectOrEmpty(
      freeElective.node,
    );

  if (
    numberOrNull(
      node.maximumCreditPoints,
    ) !==
    24
  ) {
    throw new Error(
      'Free Electives maximumCreditPoints must be 24.',
    );
  }

  if (
    numberOrNull(
      node.requiredCreditPoints,
    ) ===
    24
  ) {
    throw new Error(
      'Free Electives still incorrectly treats maximum 24 CP as required 24 CP.',
    );
  }
}

function validateSubjectCodesExist(
  codes:
    string[],

  subjectByCode:
    Map<
      string,
      SubjectRecord
    >,

  label:
    string,
): void {
  const missing =
    codes.filter(
      (
        code,
      ) =>
        !subjectByCode.has(
          code,
        ),
    );

  if (
    missing.length >
    0
  ) {
    throw new Error(
      `${label} contains ${missing.length} subject code(s) absent from canonical subjects: ${missing.join(', ')}`,
    );
  }
}

function assertSameCodes(
  label:
    string,

  actual:
    string[],

  expected:
    string[],
): void {
  const actualSorted =
    [
      ...actual,
    ].sort();

  const expectedSorted =
    [
      ...expected,
    ].sort();

  if (
    actualSorted.length !==
      expectedSorted.length ||
    actualSorted.some(
      (
        code,
        index,
      ) =>
        code !==
        expectedSorted[
          index
        ],
    )
  ) {
    throw new Error(
      `${label} subject membership mismatch.`,
    );
  }
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function buildSubjectMap(
  subjects:
    SubjectRecord[],
):
Map<
  string,
  SubjectRecord
> {
  const result =
    new Map<
      string,
      SubjectRecord
    >();

  for (
    const subject
    of subjects
  ) {
    const code =
      stringOrNull(
        subject.code,
      );

    if (
      !code
    ) {
      continue;
    }

    const normalized =
      code.toUpperCase();

    if (
      result.has(
        normalized,
      )
    ) {
      throw new Error(
        `Duplicate canonical subject ${normalized}.`,
      );
    }

    result.set(
      normalized,
      subject,
    );
  }

  return result;
}

function findMaximumCreditPoints(
  node:
    JsonObject,
):
number | null {
  return numberOrNull(
    node.maximumCreditPoints,
  );
}

function normalize(
  value:
    unknown,
):
string {
  return typeof value ===
    'string'
    ? value
        .trim()
        .toLowerCase()
    : '';
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
):
JsonObject {
  return isObject(
    value,
  )
    ? value
    : {};
}

function stringOrNull(
  value:
    unknown,
):
string | null {
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
):
string | null {
  for (
    const value
    of values
  ) {
    const result =
      stringOrNull(
        value,
      );

    if (
      result
    ) {
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
):
string {
  const result =
    stringOrNull(
      value,
    );

  if (
    !result
  ) {
    throw new Error(
      `Missing ${label}.`,
    );
  }

  return result;
}

function numberOrNull(
  value:
    unknown,
):
number | null {
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

function validateMaster(
  master:
    MasterFile,
): void {
  if (
    master.university
      ?.code !==
      UNIVERSITY_CODE ||
    master.handbookYear !==
      HANDBOOK_YEAR
  ) {
    throw new Error(
      'Expected USYD 2026 master.',
    );
  }

  if (
    !Array.isArray(
      master.subjects,
    )
  ) {
    throw new Error(
      'Master subjects[] is missing.',
    );
  }

  if (
    !Array.isArray(
      master.componentSources,
    )
  ) {
    throw new Error(
      'Master componentSources[] is missing.',
    );
  }

  if (
    !Array.isArray(
      master.degreeRequirements,
    )
  ) {
    throw new Error(
      'Master degreeRequirements[] is missing.',
    );
  }

  if (
    !master.metadata ||
    typeof master.metadata !==
      'object'
  ) {
    throw new Error(
      'Master metadata is missing.',
    );
  }
}

async function readJson<T>(
  path:
    string,
):
Promise<T> {
  return JSON.parse(
    await readFile(
      path,
      'utf8',
    ),
  ) as T;
}

async function writeJson(
  path:
    string,

  value:
    unknown,
):
Promise<void> {
  await writeFile(
    path,

    JSON.stringify(
      value,
      null,
      2,
    ) + '\n',

    'utf8',
  );
}

main().catch(
  (
    error:
      unknown,
  ) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);