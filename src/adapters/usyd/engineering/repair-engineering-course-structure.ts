import {
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

import {
  fetchUsydGlobalUnitTable,
  type UsydGlobalTableStructureRow,
  type UsydGlobalTableUnit,
} from '../usyd.global-unit-table-parser';

type JsonObject =
  Record<string, unknown>;

interface ComponentRecord
  extends JsonObject {
  handbookCategory?: string;
  handbook?: string;

  name?: string;
  type?: string;

  overviewUrl?: string;
  unitTableUrl?: string;
  sourceUrl?: string;

  tableUrls?: string[];
}

interface ParsedTable
  extends JsonObject {
  url?: string;

  units?: Array<
    UsydGlobalTableUnit & JsonObject
  >;

  structure?: JsonObject;
}

interface ComponentSource
  extends JsonObject {
  component:
    ComponentRecord;

  parsedTables:
    ParsedTable[];
}

interface DegreeComponentRelationship {
  relationshipKind:
    | 'EXPLICIT_NAMED'
    | 'CHOICE_POOL';

  data:
    JsonObject;
}

interface MasterFile {
  university: {
    code: string;
    name: string;
  };

  handbookYear:
    number;

  metadata:
    JsonObject & {
      counts?: Record<
        string,
        number
      >;
    };

  degrees:
    JsonObject[];

  subjects:
    JsonObject[];

  components:
    ComponentRecord[];

  componentSources:
    ComponentSource[];

  componentRequirementObjects:
    JsonObject[];

  degreeComponents:
    DegreeComponentRelationship[];

  degreeRequirements:
    JsonObject[];

  [key: string]:
    unknown;
}

type EngineeringCoreGroupKey =
  | 'FOUNDATION'
  | 'PROJECTS'
  | 'PEP';

type FoundationSubgroupKey =
  | 'COMPUTING'
  | 'MATHEMATICS';

type ProjectSubgroupKey =
  | 'PROJECT_1'
  | 'PROJECT_2_3'
  | 'THESIS';

interface EngineeringCoreSubgroup {
  key:
    string;

  name:
    string;

  logic:
    'ALL' |
    'ONE_OF' |
    'UNKNOWN';

  requiredCreditPoints:
    number | null;

  units:
    UsydGlobalTableUnit[];

  narratives:
    string[];
}

interface EngineeringCoreGroup {
  key:
    EngineeringCoreGroupKey;

  name:
    string;

  logic:
    'ALL' |
    'ONE_OF' |
    'UNKNOWN';

  requiredCreditPoints:
    number | null;

  subgroups:
    EngineeringCoreSubgroup[];

  directUnits:
    UsydGlobalTableUnit[];

  narratives:
    string[];
}

interface SpecialisationRelationship {
  streamSlug:
    string;

  streamName:
    string;

  specialisationName:
    string;

  sourceUrl:
    string;

  handbookCategory:
    string;
}

interface RepairReport {
  generatedAt:
    string;

  engineeringCore: {
    sourceUrl:
      string;

    fetchedUnits:
      number;

    actualCoreUnits:
      number;

    groups:
      Array<{
        key:
          string;

        name:
          string;

        logic:
          string;

        requiredCreditPoints:
          number | null;

        directSubjectCodes:
          string[];

        subgroups:
          Array<{
            key:
              string;

            name:
              string;

            logic:
              string;

            requiredCreditPoints:
              number | null;

            subjectCodes:
              string[];

            narratives:
              string[];
          }>;

        narratives:
          string[];
      }>;
  };

  specialisations: {
    relationships:
      number;

    streams:
      Array<{
        streamSlug:
          string;

        streamName:
          string;

        specialisations:
          string[];
      }>;
  };

  unresolvedCoreSubjectCodes:
    string[];

  degreeRequirementsUpdated:
    string[];

  streamSourcesUpdated:
    string[];
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
      'usyd-master-final.engineering-repaired.subjects-resolved.before-course-structure.json',
  );

const REPORT_FILE =
  resolve(
    process.cwd(),

    'data/normalized/usyd/2026/' +
      'usyd-engineering-course-structure-repair-report.json',
  );

const UNIVERSITY_CODE =
  'USYD';

const HANDBOOK_YEAR =
  2026;

const ENGINEERING_DEGREE_CODE =
  'BHENGINE-04';

const ENGINEERING_HANDBOOK =
  'ENGINEERING';

const ENGINEERING_CORE_URL =
  'https://www.sydney.edu.au/handbooks/engineering/engineering-honours/core-unit-of-study-table.html';

const CANONICAL_ENGINEERING_STREAM_PREFIX =
  '/handbooks/engineering/engineering-honours/streams/';

const ENGINEERING_STREAM_NAMES:
Record<string, string> = {
  aeronautical:
    'Aeronautical Engineering',

  'aeronautical-with-space':
    'Aeronautical Engineering with Space',

  biomedical:
    'Biomedical Engineering',

  'chemical-biomolecular':
    'Chemical and Biomolecular Engineering',

  civil:
    'Civil Engineering',

  electrical:
    'Electrical Engineering',

  environmental:
    'Environmental Engineering',

  mechanical:
    'Mechanical Engineering',

  'mechanical-with-space':
    'Mechanical Engineering with Space',

  mechatronic:
    'Mechatronic Engineering',

  'mechatronic-with-space':
    'Mechatronic Engineering with Space',

  software:
    'Software Engineering',
};

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

  /*
   * Always keep a pre-repair backup.
   */
  await writeFile(
    BACKUP_FILE,

    JSON.stringify(
      master,
      null,
      2,
    ) + '\n',

    'utf8',
  );

  const subjectByCode =
    buildSubjectMap(
      master.subjects,
    );

  /*
   * ==========================================================
   * PART A
   * ENGINEERING CORE
   * ==========================================================
   */

  console.log(
    'Fetching official Engineering Core unit table...',
  );

  const coreTable =
    await fetchUsydGlobalUnitTable(
      ENGINEERING_CORE_URL,
    );

  console.log(
    'Engineering Core explicit headings:',
    coreTable
      .structureRows
      .filter(
        (
          row,
        ) =>
          row.kind ===
          'HEADING',
      )
      .map(
        (
          row,
        ) =>
          row.kind ===
          'HEADING'
            ? `h${row.level}: ${row.text}`
            : '',
      ),
  );

  const coreGroups =
    buildEngineeringCoreGroups(
      coreTable
        .structureRows,
    );

  const unresolvedCoreSubjectCodes =
    findMissingSubjects(
      coreGroups,
      subjectByCode,
    );

  if (
    unresolvedCoreSubjectCodes.length >
    0
  ) {
    throw new Error(
      [
        'Engineering Core contains subject codes that are not present',
        'in the canonical subject collection:',
        unresolvedCoreSubjectCodes.join(
          ', ',
        ),
      ].join(
        ' ',
      ),
    );
  }

  const degreeRequirementsUpdated =
    attachCoreGroupsToDegreeRequirements(
      master,
      coreGroups,
    );

  /*
   * ==========================================================
   * PART B
   * STREAM -> SPECIALISATION
   * ==========================================================
   */

  const relationships =
    discoverEngineeringSpecialisationRelationships(
      master.componentSources,
    );

  if (
    relationships.length ===
    0
  ) {
    throw new Error(
      'No canonical Engineering stream -> specialisation relationships were discovered.',
    );
  }

  const relationshipsByStream =
    groupSpecialisationsByStream(
      relationships,
    );

  const streamSourcesUpdated:
    string[] =
    [];

  for (
    const [
      streamSlug,
      streamRelationships,
    ]
    of relationshipsByStream
  ) {
    const streamSource =
      findCanonicalStreamSource(
        master.componentSources,
        streamSlug,
      );

    if (
      !streamSource
    ) {
      throw new Error(
        `Missing canonical stream source for ${streamSlug}.`,
      );
    }

    attachSpecialisationChoiceGroup({
      source:
        streamSource,

      streamSlug,

      relationships:
        streamRelationships,
    });

    streamSourcesUpdated.push(
      requiredString(
        streamSource.component.name,
        `stream ${streamSlug} name`,
      ),
    );
  }

  /*
   * ==========================================================
   * METADATA
   * ==========================================================
   */

  const counts =
    master.metadata.counts ??
    {};

  counts.degreeRequirementClauses =
    master.degreeRequirements.length;

  counts.canonicalComponents =
    master.components.length;

  counts.componentSourceRecords =
    master.componentSources.length;

  counts.componentRequirementObjects =
    master
      .componentRequirementObjects
      .length;

  counts.totalDegreeComponentRelationshipRecords =
    master.degreeComponents.length;

  counts.subjects =
    master.subjects.length;

  master.metadata.counts =
    counts;

  /*
   * ==========================================================
   * VALIDATION
   * ==========================================================
   */

  validateEngineeringCoreRepair(
    master,
    coreGroups,
  );

  validateSpecialisationRepair(
    master,
    relationshipsByStream,
  );

  const allCoreUnits =
    collectAllCoreUnits(
      coreGroups,
    );

  const report:
  RepairReport = {
    generatedAt:
      new Date()
        .toISOString(),

    engineeringCore: {
      sourceUrl:
        coreTable.url,

      fetchedUnits:
        coreTable.units.length,

      actualCoreUnits:
        allCoreUnits.length,

      groups:
        coreGroups.map(
          (
            group,
          ) => ({
            key:
              group.key,

            name:
              group.name,

            logic:
              group.logic,

            requiredCreditPoints:
              group.requiredCreditPoints,

            directSubjectCodes:
              group
                .directUnits
                .map(
                  (
                    unit,
                  ) =>
                    unit.code,
                ),

            subgroups:
              group
                .subgroups
                .map(
                  (
                    subgroup,
                  ) => ({
                    key:
                      subgroup.key,

                    name:
                      subgroup.name,

                    logic:
                      subgroup.logic,

                    requiredCreditPoints:
                      subgroup
                        .requiredCreditPoints,

                    subjectCodes:
                      subgroup
                        .units
                        .map(
                          (
                            unit,
                          ) =>
                            unit.code,
                        ),

                    narratives:
                      subgroup
                        .narratives,
                  }),
                ),

            narratives:
              group.narratives,
          }),
        ),
    },

    specialisations: {
      relationships:
        relationships.length,

      streams:
        [
          ...relationshipsByStream
            .entries(),
        ].map(
          ([
            streamSlug,
            entries,
          ]) => ({
            streamSlug,

            streamName:
              entries[0]
                ?.streamName ??
              streamSlug,

            specialisations:
              entries.map(
                (
                  entry,
                ) =>
                  entry
                    .specialisationName,
              ),
          }),
        ),
    },

    unresolvedCoreSubjectCodes,

    degreeRequirementsUpdated,

    streamSourcesUpdated,
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
    '================================',
  );

  console.log(
    'USYD ENGINEERING COURSE STRUCTURE REPAIR',
  );

  console.log(
    '================================',
  );

  console.log(
    `Core table rows parsed as units: ${coreTable.units.length}`,
  );

  console.log(
    `Actual Core subjects: ${allCoreUnits.length}`,
  );

  for (
    const group
    of coreGroups
  ) {
    console.log(
      `${group.name}:`,
    );

    if (
      group.directUnits.length >
      0
    ) {
      console.log(
        `  Direct subjects: ${group.directUnits.length}`,
      );
    }

    for (
      const subgroup
      of group.subgroups
    ) {
      console.log(
        `  ${subgroup.name}: ${subgroup.units.length} subjects`,
      );
    }
  }

  console.log(
    `Stream -> Specialisation relationships: ${relationships.length}`,
  );

  console.log(
    `Streams with Specialisation choices: ${relationshipsByStream.size}`,
  );

  console.log(
    `Core requirements updated: ${degreeRequirementsUpdated.length}`,
  );

  console.log(
    `Stream sources updated: ${streamSourcesUpdated.length}`,
  );

  console.log(
    `Unresolved core subjects: ${unresolvedCoreSubjectCodes.length}`,
  );

  console.log(
    `Saved repaired master: ${OUTPUT_FILE}`,
  );

  console.log(
    `Saved report: ${REPORT_FILE}`,
  );

  console.log(
    `Backup: ${BACKUP_FILE}`,
  );
}

/*
 * ============================================================
 * ENGINEERING CORE STRUCTURAL PARSING
 * ============================================================
 */

function buildEngineeringCoreGroups(
  rows:
    UsydGlobalTableStructureRow[],
):
EngineeringCoreGroup[] {
  const foundation:
  EngineeringCoreGroup = {
    key:
      'FOUNDATION',

    name:
      'Foundation',

    logic:
      'ALL',

    requiredCreditPoints:
      18,

    subgroups:
      [
        {
          key:
            'COMPUTING',

          name:
            'Computing Units',

          logic:
            'ONE_OF',

          requiredCreditPoints:
            6,

          units:
            [],

          narratives:
            [],
        },

        {
          key:
            'MATHEMATICS',

          name:
            'Mathematics Units',

          logic:
            'ALL',

          requiredCreditPoints:
            12,

          units:
            [],

          narratives:
            [],
        },
      ],

    directUnits:
      [],

    narratives:
      [],
  };

  const projects:
  EngineeringCoreGroup = {
    key:
      'PROJECTS',

    name:
      'Engineering Projects',

    logic:
      'ALL',

    requiredCreditPoints:
      30,

    subgroups:
      [
        {
          key:
            'PROJECT_1',

          name:
            'Project 1',

          logic:
            'ONE_OF',

          requiredCreditPoints:
            6,

          units:
            [],

          narratives:
            [],
        },

        {
          key:
            'PROJECT_2_3',

          name:
            'Project 2 & 3',

          logic:
            'ALL',

          requiredCreditPoints:
            12,

          units:
            [],

          narratives:
            [],
        },

        {
          key:
            'THESIS',

          name:
            'Thesis Units',

          /*
           * The source has stream-dependent thesis pairs
           * plus Faculty-approved 24 CP MIP alternatives.
           *
           * Do not reduce this to a false ONE_OF / ALL rule.
           */
          logic:
            'UNKNOWN',

          requiredCreditPoints:
            12,

          units:
            [],

          narratives:
            [],
        },
      ],

    directUnits:
      [],

    narratives:
      [],
  };

  const pep:
  EngineeringCoreGroup = {
    key:
      'PEP',

    name:
      'Professional Engagement Program',

    logic:
      'ALL',

    requiredCreditPoints:
      null,

    subgroups:
      [],

    directUnits:
      [],

    narratives:
      [],
  };

  const groups =
    [
      foundation,
      projects,
      pep,
    ];

  let activeGroup:
    EngineeringCoreGroup |
    null =
    null;

  let activeSubgroup:
    EngineeringCoreSubgroup |
    null =
    null;

  for (
    const row
    of rows
  ) {
    /*
     * --------------------------------------------------------
     * EXPLICIT HEADING
     * --------------------------------------------------------
     */

    if (
      row.kind ===
      'HEADING'
    ) {
      const heading =
        normalizeText(
          row.text,
        );

      const key =
        heading
          .toLowerCase();

      /*
       * Ignore the overall page/table heading.
       */
      if (
        key.includes(
          'bachelor of engineering honours core',
        )
      ) {
        activeGroup =
          null;

        activeSubgroup =
          null;

        continue;
      }

      if (
        key ===
          'foundations' ||
        key ===
          'foundation'
      ) {
        activeGroup =
          foundation;

        activeSubgroup =
          null;

        continue;
      }

      if (
        key ===
        'computing units'
      ) {
        activeGroup =
          foundation;

        activeSubgroup =
          findSubgroup(
            foundation,
            'COMPUTING',
          );

        continue;
      }

      if (
        key ===
        'mathematics units'
      ) {
        activeGroup =
          foundation;

        activeSubgroup =
          findSubgroup(
            foundation,
            'MATHEMATICS',
          );

        continue;
      }

      if (
        key.includes(
          'professional engagement program',
        )
      ) {
        activeGroup =
          pep;

        activeSubgroup =
          null;

        continue;
      }

      if (
        key ===
          'projects table' ||
        key ===
          'engineering projects' ||
        key ===
          'engineering projects table'
      ) {
        activeGroup =
          projects;

        activeSubgroup =
          null;

        continue;
      }

      if (
        key ===
        'project 1'
      ) {
        activeGroup =
          projects;

        activeSubgroup =
          findSubgroup(
            projects,
            'PROJECT_1',
          );

        continue;
      }

      if (
        key ===
          'project 2 & 3' ||
        key ===
          'project 2 and 3'
      ) {
        activeGroup =
          projects;

        activeSubgroup =
          findSubgroup(
            projects,
            'PROJECT_2_3',
          );

        continue;
      }

      if (
        key ===
          'thesis units' ||
        key ===
          'thesis'
      ) {
        activeGroup =
          projects;

        activeSubgroup =
          findSubgroup(
            projects,
            'THESIS',
          );

        continue;
      }

      /*
       * Unknown heading:
       *
       * do not accidentally move a unit into a different
       * semantic group. Preserve it only as narrative context
       * when currently inside a known Core group.
       */
      if (
        activeSubgroup
      ) {
        activeSubgroup
          .narratives
          .push(
            heading,
          );
      } else if (
        activeGroup
      ) {
        activeGroup
          .narratives
          .push(
            heading,
          );
      }

      continue;
    }

    /*
     * --------------------------------------------------------
     * NARRATIVE / GENERIC SECTION
     * --------------------------------------------------------
     */

    if (
      row.kind ===
        'NARRATIVE' ||
      row.kind ===
        'SECTION'
    ) {
      const text =
        normalizeText(
          row.text,
        );

      if (
        !text
      ) {
        continue;
      }

      /*
       * Ignore standard column headings.
       */
      if (
        /unit of study/i.test(
          text,
        ) &&
        /credit points/i.test(
          text,
        )
      ) {
        continue;
      }

      if (
        activeSubgroup
      ) {
        activeSubgroup
          .narratives
          .push(
            text,
          );
      } else if (
        activeGroup
      ) {
        activeGroup
          .narratives
          .push(
            text,
          );
      }

      continue;
    }

    /*
     * --------------------------------------------------------
     * UNIT
     * --------------------------------------------------------
     */

    const unit =
      structureRowToUnit(
        row,
      );

    if (
      !unit
    ) {
      continue;
    }

    const section =
      normalizeText(
        unit.section ??
        '',
      );

    if (
      isNonSubjectCoreRow(
        unit,
        section,
      )
    ) {
      continue;
    }

    if (
      !activeGroup
    ) {
      /*
       * We deliberately do not guess membership before the
       * first recognised official Core heading.
       */
      continue;
    }

    if (
      activeSubgroup
    ) {
      activeSubgroup
        .units
        .push(
          unit,
        );
    } else {
      activeGroup
        .directUnits
        .push(
          unit,
        );
    }
  }

  /*
   * Deduplicate safely while preserving official source order.
   */
  for (
    const group
    of groups
  ) {
    group.directUnits =
      dedupeUnits(
        group.directUnits,
      );

    group.narratives =
      dedupeStrings(
        group.narratives,
      );

    for (
      const subgroup
      of group.subgroups
    ) {
      subgroup.units =
        dedupeUnits(
          subgroup.units,
        );

      subgroup.narratives =
        dedupeStrings(
          subgroup.narratives,
        );
    }
  }

  validateParsedCoreStructure(
    groups,
  );

  return groups;
}

function structureRowToUnit(
  row:
    UsydGlobalTableStructureRow,
):
UsydGlobalTableUnit |
null {
  if (
    row.kind !==
    'UNIT'
  ) {
    return null;
  }

  return {
    code:
      row.code,

    title:
      row.title,

    creditPoints:
      row.creditPoints,

    accessConditionsRaw:
      row.accessConditionsRaw,

    section:
      row.section,

    headingPath:
      row.headingPath,

    sourceUrl:
      ENGINEERING_CORE_URL,
  };
}

function findSubgroup(
  group:
    EngineeringCoreGroup,

  key:
    string,
):
EngineeringCoreSubgroup {
  const subgroup =
    group
      .subgroups
      .find(
        (
          candidate,
        ) =>
          candidate.key ===
          key,
      );

  if (
    !subgroup
  ) {
    throw new Error(
      `Missing Engineering Core subgroup ${group.key}.${key}`,
    );
  }

  return subgroup;
}

function validateParsedCoreStructure(
  groups:
    EngineeringCoreGroup[],
): void {
  const foundation =
    getCoreGroup(
      groups,
      'FOUNDATION',
    );

  const projects =
    getCoreGroup(
      groups,
      'PROJECTS',
    );

  const pep =
    getCoreGroup(
      groups,
      'PEP',
    );

  const computing =
    findSubgroup(
      foundation,
      'COMPUTING',
    );

  const mathematics =
    findSubgroup(
      foundation,
      'MATHEMATICS',
    );

  const project1 =
    findSubgroup(
      projects,
      'PROJECT_1',
    );

  const project23 =
    findSubgroup(
      projects,
      'PROJECT_2_3',
    );

  const thesis =
    findSubgroup(
      projects,
      'THESIS',
    );

  assertCodes(
    'Foundation / Computing Units',
    computing.units,
    [
      'INFO1110',
      'INFO1910',
      'ENGG1810',
    ],
  );

  assertCodes(
    'Foundation / Mathematics Units',
    mathematics.units,
    [
      'MATH1061',
      'MATH1062',
    ],
  );

  assertCodes(
    'Engineering Projects / Project 1',
    project1.units,
    [
      'AERO1560',
      'BMET1960',
      'CHNG1108',
      'CIVL1900',
      'ELEC1004',
      'ELEC1005',
      'ENVE1001',
      'MECH1560',
      'MTRX1701',
    ],
  );

  assertCodes(
    'Engineering Projects / Project 2 & 3',
    project23.units,
    [
      'ENGG2112',
      'ENGG3112',
    ],
  );

  assertCodes(
    'Engineering Projects / Thesis Units',
    thesis.units,
    [
      'AMME4111',
      'AMME4112',
      'BMET4111',
      'BMET4112',
      'CHNG4811',
      'CHNG4812',
      'CIVL4022',
      'CIVL4023',
      'ELEC4712',
      'ELEC4713',
      'ENVE4811',
      'ENVE4812',
      'AMME4010',
      'BMET4010',
      'CHNG4203',
      'CIVL4203',
      'ELEC4714',
    ],
  );

  assertCodes(
    'Professional Engagement Program',
    pep.directUnits,
    [
      'ENGP1001',
      'ENGP1002',
      'ENGP1003',
      'ENGP2001',
      'ENGP2002',
      'ENGP2003',
      'ENGP3001',
      'ENGP3002',
    ],
  );

  if (
    foundation.directUnits.length !==
    0
  ) {
    throw new Error(
      'Foundation unexpectedly contains direct subjects outside its official subgroups.',
    );
  }

  if (
    projects.directUnits.length !==
    0
  ) {
    throw new Error(
      'Engineering Projects unexpectedly contains direct subjects outside its official subgroups.',
    );
  }

  const all =
    collectAllCoreUnits(
      groups,
    );

  if (
    all.length !==
    41
  ) {
    throw new Error(
      `Expected exactly 41 Engineering Core subjects, found ${all.length}.`,
    );
  }

  const unique =
    new Set(
      all.map(
        (
          unit,
        ) =>
          unit.code,
      ),
    );

  if (
    unique.size !==
    41
  ) {
    throw new Error(
      `Engineering Core contains duplicate subject membership: 41 expected, ${unique.size} unique.`,
    );
  }
}

function assertCodes(
  label:
    string,

  units:
    UsydGlobalTableUnit[],

  expected:
    string[],
): void {
  const actual =
    units.map(
      (
        unit,
      ) =>
        unit.code,
    );

  if (
    actual.length !==
    expected.length ||
    actual.some(
      (
        code,
        index,
      ) =>
        code !==
        expected[index],
    )
  ) {
    throw new Error(
      [
        `${label} does not match the audited official source.`,
        `Expected: ${expected.join(', ')}`,
        `Actual: ${actual.join(', ')}`,
      ].join(
        ' ',
      ),
    );
  }
}

function getCoreGroup(
  groups:
    EngineeringCoreGroup[],

  key:
    EngineeringCoreGroupKey,
):
EngineeringCoreGroup {
  const result =
    groups.find(
      (
        group,
      ) =>
        group.key ===
        key,
    );

  if (
    !result
  ) {
    throw new Error(
      `Missing Engineering Core group ${key}`,
    );
  }

  return result;
}

/*
 * ============================================================
 * NORMALIZED DEGREE REQUIREMENT AST
 * ============================================================
 */

function attachCoreGroupsToDegreeRequirements(
  master:
    MasterFile,

  groups:
    EngineeringCoreGroup[],
):
string[] {
  const updated:
    string[] =
    [];

  /*
   * Rerun safety.
   *
   * Remove only clauses generated by this dedicated repair.
   * Original handbook requirement clauses remain untouched.
   */
  master.degreeRequirements =
    master
      .degreeRequirements
      .filter(
        (
          requirement,
        ) =>
          requirement
            .generatedRelationshipKind !==
          'ENGINEERING_CORE_TABLE',
      );

  const sourceTextByGroup =
    new Map<
      EngineeringCoreGroupKey,
      string | null
    >();

  for (
    const group
    of groups
  ) {
    sourceTextByGroup.set(
      group.key,

      findDegreeRequirementSourceText(
        master.degreeRequirements,
        group.key,
      ),
    );
  }

  const nextSourceIndex =
    getNextEngineeringCoreSourceIndex(
      master.degreeRequirements,
    );

  groups.forEach(
    (
      group,
      groupIndex,
    ) => {
      const raw =
        sourceTextByGroup.get(
          group.key,
        ) ??
        `${group.name} requirement from the official Engineering Core unit-of-study table.`;

      const generatedClause:
      JsonObject = {
        degreeCode:
          ENGINEERING_DEGREE_CODE,

        sourcePath:
          `engineeringCore.${group.key.toLowerCase()}`,

        sourceIndex:
          nextSourceIndex +
          groupIndex,

        raw,

        status:
          'AUTHORITATIVE',

        sourceUrl:
          ENGINEERING_CORE_URL,

        generatedRelationshipKind:
          'ENGINEERING_CORE_TABLE',

        generatedCoreGroupKey:
          group.key,

        node:
          buildGroupNode(
            group,
          ),
      };

      master
        .degreeRequirements
        .push(
          generatedClause,
        );

      updated.push(
        group.name,
      );
    },
  );

  return updated;
}

function buildGroupNode(
  group:
    EngineeringCoreGroup,
):
JsonObject {
  const children:
    JsonObject[] =
    [];

  /*
   * Nested subgroups first, preserving official structural
   * order defined in buildEngineeringCoreGroups().
   */
  group
    .subgroups
    .forEach(
      (
        subgroup,
        index,
      ) => {
        children.push(
          buildSubgroupNode(
            subgroup,
            index,
          ),
        );
      },
    );

  /*
   * PEP currently has direct subject children.
   */
  group
    .directUnits
    .forEach(
      (
        unit,
        index,
      ) => {
        children.push(
          buildSubjectNode(
            unit,
            group.subgroups.length +
              index,
          ),
        );
      },
    );

  return {
    nodeType:
      'GROUP',

    title:
      group.name,

    logic:
      group.logic,

    requiredCreditPoints:
      group.requiredCreditPoints,

    sourceUrl:
      ENGINEERING_CORE_URL,

    sourceNarratives:
      group.narratives,

    children,
  };
}

function buildSubgroupNode(
  subgroup:
    EngineeringCoreSubgroup,

  sortOrder:
    number,
):
JsonObject {
  const children =
    subgroup
      .units
      .map(
        (
          unit,
          index,
        ) =>
          buildSubjectNode(
            unit,
            index,
          ),
      );

  const node:
  JsonObject = {
    nodeType:
      'GROUP',

    title:
      subgroup.name,

    logic:
      subgroup.logic,

    requiredCreditPoints:
      subgroup.requiredCreditPoints,

    sourceUrl:
      ENGINEERING_CORE_URL,

    sourceNarratives:
      subgroup.narratives,

    sortOrder,

    children,
  };

  /*
   * Thesis semantics are intentionally not over-normalised.
   *
   * Preserve the known distinction between normal 6 CP thesis
   * subjects and 24 CP Major Industrial Project alternatives
   * as audit metadata without claiming a false logical operator.
   */
  if (
    subgroup.key ===
    'THESIS'
  ) {
    node.normalThesisSubjectCodes =
      subgroup.units
        .filter(
          (
            unit,
          ) =>
            unit.creditPoints ===
            6,
        )
        .map(
          (
            unit,
          ) =>
            unit.code,
        );

    node.majorIndustrialProjectAlternativeCodes =
      subgroup.units
        .filter(
          (
            unit,
          ) =>
            unit.creditPoints ===
            24,
        )
        .map(
          (
            unit,
          ) =>
            unit.code,
        );

    node.semanticNote =
      'Normally 12 credit points of stream-relevant thesis units. Faculty-approved 24 credit point Major Industrial Project alternatives are preserved as source-backed alternatives; exact stream-to-thesis pairing is not inferred here.';
  }

  return node;
}

function buildSubjectNode(
  unit:
    UsydGlobalTableUnit,

  sortOrder:
    number,
):
JsonObject {
  return {
    nodeType:
      'SUBJECT',

    code:
      unit.code,

    name:
      unit.title,

    /*
     * Contextual table CP, including valid 0 CP.
     */
    creditPoints:
      unit.creditPoints,

    sourceUrl:
      unit.sourceUrl,

    sortOrder,
  };
}

/*
 * ============================================================
 * DEGREE SOURCE TEXT
 * ============================================================
 */

function findDegreeRequirementSourceText(
  requirements:
    JsonObject[],

  key:
    EngineeringCoreGroupKey,
):
string | null {
  const degreeRequirements =
    requirements.filter(
      (
        requirement,
      ) =>
        requirement.degreeCode ===
          ENGINEERING_DEGREE_CODE &&
        requirement
          .generatedRelationshipKind !==
          'ENGINEERING_CORE_TABLE',
    );

  for (
    const requirement
    of degreeRequirements
  ) {
    const raw =
      normalizeText(
        stringOrNull(
          requirement.raw,
        ) ??
        '',
      );

    const lower =
      raw.toLowerCase();

    if (
      !lower
    ) {
      continue;
    }

    if (
      key ===
        'FOUNDATION' &&
      (
        /engineering foundations? table/i.test(
          raw,
        ) ||
        (
          /18 credit points/i.test(
            raw,
          ) &&
          /\bfoundations?\b/i.test(
            raw,
          )
        )
      )
    ) {
      return raw;
    }

    if (
      key ===
        'PROJECTS' &&
      (
        /engineering projects? table/i.test(
          raw,
        ) ||
        (
          /30 credit points/i.test(
            raw,
          ) &&
          /\bprojects?\b/i.test(
            raw,
          )
        )
      )
    ) {
      return raw;
    }

    if (
      key ===
        'PEP' &&
      (
        /professional engagement program/i.test(
          raw,
        ) ||
        /\bpep\b/i.test(
          lower,
        )
      )
    ) {
      return raw;
    }
  }

  return null;
}

function getNextEngineeringCoreSourceIndex(
  requirements:
    JsonObject[],
):
number {
  const indexes =
    requirements
      .filter(
        (
          requirement,
        ) =>
          requirement.degreeCode ===
          ENGINEERING_DEGREE_CODE,
      )
      .map(
        (
          requirement,
        ) =>
          typeof requirement.sourceIndex ===
            'number'
            ? requirement.sourceIndex
            : null,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !==
            null &&
          Number.isFinite(
            value,
          ),
      );

  return indexes.length >
    0
    ? Math.max(
        ...indexes,
      ) + 1
    : 0;
}

function findGeneratedEngineeringCoreRequirement(
  requirements:
    JsonObject[],

  key:
    EngineeringCoreGroupKey,
):
JsonObject | null {
  const matches =
    requirements.filter(
      (
        requirement,
      ) =>
        requirement.degreeCode ===
          ENGINEERING_DEGREE_CODE &&
        requirement
          .generatedRelationshipKind ===
          'ENGINEERING_CORE_TABLE' &&
        requirement
          .generatedCoreGroupKey ===
          key,
    );

  return matches.length ===
    1
    ? matches[0]
    : null;
}

function findMissingSubjects(
  groups:
    EngineeringCoreGroup[],

  subjectByCode:
    Map<
      string,
      JsonObject
    >,
):
string[] {
  const missing =
    new Set<string>();

  for (
    const unit
    of collectAllCoreUnits(
      groups,
    )
  ) {
    if (
      !subjectByCode.has(
        unit.code,
      )
    ) {
      missing.add(
        unit.code,
      );
    }
  }

  return [
    ...missing,
  ].sort();
}

function collectAllCoreUnits(
  groups:
    EngineeringCoreGroup[],
):
UsydGlobalTableUnit[] {
  const units:
    UsydGlobalTableUnit[] =
    [];

  for (
    const group
    of groups
  ) {
    units.push(
      ...group.directUnits,
    );

    for (
      const subgroup
      of group.subgroups
    ) {
      units.push(
        ...subgroup.units,
      );
    }
  }

  return dedupeUnits(
    units,
  );
}

/*
 * ============================================================
 * STREAM -> SPECIALISATION
 * ============================================================
 */

function discoverEngineeringSpecialisationRelationships(
  sources:
    ComponentSource[],
):
SpecialisationRelationship[] {
  const found =
    new Map<
      string,
      SpecialisationRelationship
    >();

  for (
    const source
    of sources
  ) {
    const component =
      source.component;

    if (
      component.type !==
      'SPECIALISATION'
    ) {
      continue;
    }

    if (
      firstString(
        component.handbookCategory,
        component.handbook,
      ) !==
      ENGINEERING_HANDBOOK
    ) {
      continue;
    }

    const url =
      firstString(
        component.unitTableUrl,
        component.sourceUrl,
        component.overviewUrl,
      );

    if (
      !url
    ) {
      continue;
    }

    /*
     * Only canonical Engineering pages.
     */
    if (
      !url.includes(
        CANONICAL_ENGINEERING_STREAM_PREFIX,
      )
    ) {
      continue;
    }

    const identity =
      parseSpecialisationUrl(
        url,
      );

    if (
      !identity
    ) {
      continue;
    }

    const streamName =
      ENGINEERING_STREAM_NAMES[
        identity.streamSlug
      ];

    if (
      !streamName
    ) {
      throw new Error(
        `Unknown Engineering stream slug in specialisation URL: ${identity.streamSlug}`,
      );
    }

    const specialisationName =
      requiredString(
        component.name,
        `specialisation name for ${url}`,
      );

    const key =
      [
        identity.streamSlug,

        normalizeText(
          specialisationName,
        ).toLowerCase(),
      ].join(
        '::',
      );

    found.set(
      key,
      {
        streamSlug:
          identity.streamSlug,

        streamName,

        specialisationName,

        sourceUrl:
          url,

        handbookCategory:
          ENGINEERING_HANDBOOK,
      },
    );
  }

  return [
    ...found.values(),
  ].sort(
    (
      left,
      right,
    ) => {
      const streamCompare =
        left.streamName
          .localeCompare(
            right.streamName,
          );

      if (
        streamCompare !==
        0
      ) {
        return streamCompare;
      }

      return left
        .specialisationName
        .localeCompare(
          right
            .specialisationName,
        );
    },
  );
}

function parseSpecialisationUrl(
  url:
    string,
): {
  streamSlug:
    string;

  specialisationSlug:
    string;
} | null {
  const match =
    url.match(
      /\/engineering\/engineering-honours\/streams\/([^/]+)\/specialisations\/([^/]+?)(?:-unit-of-study-table)?\.html$/i,
    );

  if (
    !match
  ) {
    return null;
  }

  return {
    streamSlug:
      match[1]
        .toLowerCase(),

    specialisationSlug:
      match[2]
        .toLowerCase(),
  };
}

function groupSpecialisationsByStream(
  relationships:
    SpecialisationRelationship[],
):
Map<
  string,
  SpecialisationRelationship[]
> {
  const result =
    new Map<
      string,
      SpecialisationRelationship[]
    >();

  for (
    const relationship
    of relationships
  ) {
    const current =
      result.get(
        relationship.streamSlug,
      ) ??
      [];

    current.push(
      relationship,
    );

    result.set(
      relationship.streamSlug,
      current,
    );
  }

  return result;
}

function findCanonicalStreamSource(
  sources:
    ComponentSource[],

  streamSlug:
    string,
):
ComponentSource | null {
  const suffix =
    `/engineering/engineering-honours/streams/${streamSlug}/unit-of-study-table.html`;

  const matches =
    sources.filter(
      (
        source,
      ) => {
        if (
          source.component.type !==
          'STREAM'
        ) {
          return false;
        }

        const url =
          firstString(
            source.component.unitTableUrl,
            source.component.sourceUrl,
          );

        return Boolean(
          url &&
          url.endsWith(
            suffix,
          ),
        );
      },
    );

  return matches.length ===
    1
    ? matches[0]
    : null;
}

function attachSpecialisationChoiceGroup(
  params: {
    source:
      ComponentSource;

    streamSlug:
      string;

    relationships:
      SpecialisationRelationship[];
  },
): void {
  const streamName =
    requiredString(
      params.source.component.name,
      `stream ${params.streamSlug} name`,
    );

  const tables =
    params.source.parsedTables ??
    [];

  if (
    tables.length ===
    0
  ) {
    throw new Error(
      `${streamName} has no parsed table.`,
    );
  }

  const table =
    tables.find(
      (
        candidate,
      ) => {
        const url =
          stringOrNull(
            candidate.url,
          );

        return Boolean(
          url &&
          !url.includes(
            '/specialisations/',
          ),
        );
      },
    ) ??
    tables[0];

  const structure =
    objectOrEmpty(
      table.structure,
    );

  const components =
    arrayOfObjects(
      structure.components,
    );

  if (
    components.length ===
    0
  ) {
    throw new Error(
      `${streamName} has no repaired component structure.`,
    );
  }

  const streamRequirement =
    components[0];

  const groups =
    arrayOfObjects(
      streamRequirement
        .requirementGroups,
    );

  /*
   * Rerun safety.
   */
  const filtered =
    groups.filter(
      (
        group,
      ) =>
        group
          .generatedRelationshipKind !==
        'STREAM_SPECIALISATION_CHOICE',
    );

  filtered.push({
    name:
      'Specialisation',

    logic:
      'ONE_OF',

    nodeType:
      'COMPONENT',

    requiredCreditPoints:
      null,

    generatedRelationshipKind:
      'STREAM_SPECIALISATION_CHOICE',

    parentStream:
      streamName,

    sourceUrl:
      table.url ??
      params
        .source
        .component
        .unitTableUrl ??
      null,

    components:
      params
        .relationships
        .map(
          (
            relationship,
            index,
          ) => ({
            name:
              relationship
                .specialisationName,

            type:
              'SPECIALISATION',

            handbookCategory:
              relationship
                .handbookCategory,

            evidenceUrl:
              relationship
                .sourceUrl,

            sourceUrl:
              relationship
                .sourceUrl,

            sortOrder:
              index,

            authoritative:
              true,
          }),
        ),
  });

  streamRequirement
    .requirementGroups =
    filtered;

  structure.components =
    components;

  table.structure =
    structure;
}

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function validateEngineeringCoreRepair(
  master:
    MasterFile,

  groups:
    EngineeringCoreGroup[],
): void {
  for (
    const group
    of groups
  ) {
    const clause =
      findGeneratedEngineeringCoreRequirement(
        master.degreeRequirements,
        group.key,
      );

    if (
      !clause
    ) {
      throw new Error(
        `Post-repair validation cannot find exactly one generated ${group.name} requirement.`,
      );
    }

    if (
      stringOrNull(
        clause.sourceUrl,
      ) !==
      ENGINEERING_CORE_URL
    ) {
      throw new Error(
        `${group.name}: generated requirement is missing the official Engineering Core source URL.`,
      );
    }

    const node =
      objectOrEmpty(
        clause.node,
      );

    if (
      stringOrNull(
        node.nodeType,
      ) !==
      'GROUP'
    ) {
      throw new Error(
        `${group.name}: root node must be GROUP.`,
      );
    }

    if (
      stringOrNull(
        node.title,
      ) !==
      group.name
    ) {
      throw new Error(
        `${group.name}: generated root title mismatch.`,
      );
    }

    const expectedCodes =
      [
        ...group.directUnits,

        ...group
          .subgroups
          .flatMap(
            (
              subgroup,
            ) =>
              subgroup.units,
          ),
      ].map(
        (
          unit,
        ) =>
          unit.code,
      );

    const actualCodes =
      collectSubjectCodesFromNode(
        node,
      );

    if (
      actualCodes.length !==
      expectedCodes.length ||
      actualCodes.some(
        (
          code,
          index,
        ) =>
          code !==
          expectedCodes[index],
      )
    ) {
      throw new Error(
        [
          `${group.name}: nested requirement subject membership mismatch.`,
          `Expected: ${expectedCodes.join(', ')}`,
          `Actual: ${actualCodes.join(', ')}`,
        ].join(
          ' ',
        ),
      );
    }

    /*
     * Validate subgroup AST itself.
     */
    const rootChildren =
      arrayOfObjects(
        node.children,
      );

    for (
      const subgroup
      of group.subgroups
    ) {
      const subgroupNode =
        rootChildren.find(
          (
            child,
          ) =>
            child.nodeType ===
              'GROUP' &&
            child.title ===
              subgroup.name,
        );

      if (
        !subgroupNode
      ) {
        throw new Error(
          `${group.name}: missing nested subgroup ${subgroup.name}.`,
        );
      }

      if (
        stringOrNull(
          subgroupNode.logic,
        ) !==
        subgroup.logic
      ) {
        throw new Error(
          `${group.name}/${subgroup.name}: logic mismatch.`,
        );
      }

      if (
        numberOrNull(
          subgroupNode
            .requiredCreditPoints,
        ) !==
        subgroup
          .requiredCreditPoints
      ) {
        throw new Error(
          `${group.name}/${subgroup.name}: required CP mismatch.`,
        );
      }
    }
  }

  /*
   * Explicit regression checks.
   */
  const foundation =
    findGeneratedEngineeringCoreRequirement(
      master.degreeRequirements,
      'FOUNDATION',
    );

  const projects =
    findGeneratedEngineeringCoreRequirement(
      master.degreeRequirements,
      'PROJECTS',
    );

  const pep =
    findGeneratedEngineeringCoreRequirement(
      master.degreeRequirements,
      'PEP',
    );

  if (
    !foundation ||
    !projects ||
    !pep
  ) {
    throw new Error(
      'Engineering Core validation could not resolve all three generated clauses.',
    );
  }

  const foundationNode =
    objectOrEmpty(
      foundation.node,
    );

  const foundationChildren =
    arrayOfObjects(
      foundationNode.children,
    );

  if (
    foundationChildren.length !==
    2
  ) {
    throw new Error(
      `Foundation must contain exactly 2 nested groups, found ${foundationChildren.length}.`,
    );
  }

  const projectNode =
    objectOrEmpty(
      projects.node,
    );

  const projectChildren =
    arrayOfObjects(
      projectNode.children,
    );

  if (
    projectChildren.length !==
    3
  ) {
    throw new Error(
      `Engineering Projects must contain exactly 3 nested groups, found ${projectChildren.length}.`,
    );
  }

  const pepNode =
    objectOrEmpty(
      pep.node,
    );

  const pepCodes =
    collectSubjectCodesFromNode(
      pepNode,
    );

  if (
    pepCodes.length !==
    8
  ) {
    throw new Error(
      `PEP must contain exactly 8 units, found ${pepCodes.length}.`,
    );
  }
}

function collectSubjectCodesFromNode(
  value:
    unknown,
):
string[] {
  const result:
    string[] =
    [];

  function visit(
    current:
      unknown,
  ): void {
    if (
      Array.isArray(
        current,
      )
    ) {
      for (
        const item
        of current
      ) {
        visit(
          item,
        );
      }

      return;
    }

    if (
      !isObject(
        current,
      )
    ) {
      return;
    }

    if (
      current.nodeType ===
      'SUBJECT'
    ) {
      const code =
        stringOrNull(
          current.code,
        );

      if (
        code
      ) {
        result.push(
          code,
        );
      }

      return;
    }

    const children =
      current.children;

    if (
      Array.isArray(
        children,
      )
    ) {
      visit(
        children,
      );
    }
  }

  visit(
    value,
  );

  return result;
}

function validateSpecialisationRepair(
  master:
    MasterFile,

  relationshipsByStream:
    Map<
      string,
      SpecialisationRelationship[]
    >,
): void {
  if (
    relationshipsByStream.size !==
    12
  ) {
    throw new Error(
      `Expected Specialisation mappings for 12 Engineering streams, found ${relationshipsByStream.size}.`,
    );
  }

  let totalRelationships =
    0;

  for (
    const [
      streamSlug,
      expected,
    ]
    of relationshipsByStream
  ) {
    totalRelationships +=
      expected.length;

    const source =
      findCanonicalStreamSource(
        master.componentSources,
        streamSlug,
      );

    if (
      !source
    ) {
      throw new Error(
        `Missing repaired stream source ${streamSlug}.`,
      );
    }

    const groups =
      source
        .parsedTables
        .flatMap(
          (
            table,
          ) =>
            arrayOfObjects(
              objectOrEmpty(
                table.structure,
              ).components,
            ),
        )
        .flatMap(
          (
            component,
          ) =>
            arrayOfObjects(
              component
                .requirementGroups,
            ),
        );

    const choiceGroup =
      groups.find(
        (
          group,
        ) =>
          group
            .generatedRelationshipKind ===
          'STREAM_SPECIALISATION_CHOICE',
      );

    if (
      !choiceGroup
    ) {
      throw new Error(
        `${streamSlug}: missing Specialisation choice group.`,
      );
    }

    const candidates =
      arrayOfObjects(
        choiceGroup.components,
      );

    if (
      candidates.length !==
      expected.length
    ) {
      throw new Error(
        `${streamSlug}: expected ${expected.length} Specialisations, found ${candidates.length}.`,
      );
    }

    const actualNames =
      candidates.map(
        (
          candidate,
        ) =>
          requiredString(
            candidate.name,
            `${streamSlug} specialisation candidate name`,
          ),
      );

    const expectedNames =
      expected.map(
        (
          relationship,
        ) =>
          relationship
            .specialisationName,
      );

    if (
      actualNames.some(
        (
          name,
          index,
        ) =>
          name !==
          expectedNames[index],
      )
    ) {
      throw new Error(
        `${streamSlug}: Specialisation candidates do not match canonical relationships.`,
      );
    }
  }

  if (
    totalRelationships !==
    45
  ) {
    throw new Error(
      `Expected 45 Stream -> Specialisation relationships, found ${totalRelationships}.`,
    );
  }
}

/*
 * ============================================================
 * GENERIC HELPERS
 * ============================================================
 */

function buildSubjectMap(
  subjects:
    JsonObject[],
):
Map<
  string,
  JsonObject
> {
  const result =
    new Map<
      string,
      JsonObject
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
        `Duplicate canonical subject ${normalized}`,
      );
    }

    result.set(
      normalized,
      subject,
    );
  }

  return result;
}

function dedupeUnits(
  units:
    UsydGlobalTableUnit[],
):
UsydGlobalTableUnit[] {
  const result =
    new Map<
      string,
      UsydGlobalTableUnit
    >();

  for (
    const unit
    of units
  ) {
    if (
      !result.has(
        unit.code,
      )
    ) {
      result.set(
        unit.code,
        unit,
      );
    }
  }

  return [
    ...result.values(),
  ];
}

function dedupeStrings(
  values:
    string[],
):
string[] {
  const result:
    string[] =
    [];

  const seen =
    new Set<string>();

  for (
    const value
    of values
  ) {
    const normalized =
      normalizeText(
        value,
      );

    if (
      !normalized ||
      seen.has(
        normalized,
      )
    ) {
      continue;
    }

    seen.add(
      normalized,
    );

    result.push(
      normalized,
    );
  }

  return result;
}

function normalizeText(
  value:
    string,
):
string {
  return value
    .replace(
      /[\u200B-\u200D\uFEFF]/g,
      '',
    )
    .replace(
      /\u00A0/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
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

function arrayOfObjects(
  value:
    unknown,
):
JsonObject[] {
  return Array.isArray(
    value,
  )
    ? value.filter(
        isObject,
      )
    : [];
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
      master.degreeRequirements,
    )
  ) {
    throw new Error(
      'degreeRequirements is missing.',
    );
  }

  if (
    !Array.isArray(
      master.componentSources,
    )
  ) {
    throw new Error(
      'componentSources is missing.',
    );
  }

  if (
    !Array.isArray(
      master.subjects,
    )
  ) {
    throw new Error(
      'subjects is missing.',
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

/*
 * ============================================================
 * FILTER FALSE UNIT ROWS
 * ============================================================
 */

function isNonSubjectCoreRow(
  unit:
    UsydGlobalTableUnit,

  section:
    string,
):
boolean {
  const normalizedSection =
    normalizeText(
      section,
    ).toLowerCase();

  const normalizedTitle =
    normalizeText(
      unit.title ??
      '',
    ).toLowerCase();

  /*
   * Amendment/publication history.
   */
  if (
    normalizedSection.startsWith(
      'date original publication',
    )
  ) {
    return true;
  }

  /*
   * Narrative recommendations that contain a unit code and can
   * therefore be mistaken for unit rows by a generic parser.
   */
  if (
    normalizedTitle.startsWith(
      'students in the ',
    )
  ) {
    return true;
  }

  if (
    normalizedTitle.startsWith(
      'note:',
    )
  ) {
    return true;
  }

  if (
    normalizedTitle.startsWith(
      'prerequisites (p) for published as:',
    )
  ) {
    return true;
  }

  if (
    normalizedTitle.startsWith(
      'prohibition (n) for published as:',
    )
  ) {
    return true;
  }

  return false;
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