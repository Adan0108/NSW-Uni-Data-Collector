import {
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

import {
  fetchUsydGlobalUnitTable,
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
  component: ComponentRecord;

  parsedTables: ParsedTable[];
}

interface DegreeComponentRelationship {
  relationshipKind:
    | 'EXPLICIT_NAMED'
    | 'CHOICE_POOL';

  data: JsonObject;
}

interface MasterFile {
  university: {
    code: string;
    name: string;
  };

  handbookYear: number;

  metadata: JsonObject & {
    counts?: Record<
      string,
      number
    >;
  };

  degrees: JsonObject[];

  subjects: JsonObject[];

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

  [key: string]: unknown;
}

interface EngineeringCoreGroup {
  key:
    | 'FOUNDATION'
    | 'PROJECTS'
    | 'PEP';

  name: string;

  requiredCreditPoints:
    number | null;

  sections: string[];

  units: UsydGlobalTableUnit[];
}

interface SpecialisationRelationship {
  streamSlug: string;

  streamName: string;

  specialisationName: string;

  sourceUrl: string;

  handbookCategory: string;
}

interface RepairReport {
  generatedAt: string;

  engineeringCore: {
    sourceUrl: string;

    fetchedUnits: number;

    groups: Array<{
      key: string;

      name: string;

      requiredCreditPoints:
        number | null;

      sections: string[];

      subjectCodes: string[];
    }>;
  };

  specialisations: {
    relationships: number;

    streams: Array<{
      streamSlug: string;

      streamName: string;

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

/*
 * Deliberately overwrite the existing resolved Engineering master.
 *
 * The next existing pipeline step:
 *
 * prepare:usyd:database-master
 *
 * already reads this filename, so we do not need to change the
 * CUSP/database preparation pipeline again.
 *
 * A backup is written before replacement.
 */
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

/*
 * These are only used to map the official stream URL slug back
 * to the already-normalised canonical stream component name.
 *
 * Specialisation names are NOT hard-coded.
 */
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

async function main():
  Promise<void> {
  const master =
    await readJson<MasterFile>(
      INPUT_FILE,
    );

  validateMaster(
    master,
  );

  const originalJson =
    JSON.stringify(
      master,
      null,
      2,
    ) + '\n';

  /*
   * Always preserve the pre-repair state so this script is
   * easy to audit/reverse locally.
   */
  await writeFile(
    BACKUP_FILE,
    originalJson,
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

  const coreGroups =
    buildEngineeringCoreGroups(
      coreTable.units,
    );

  const unresolvedCoreSubjectCodes =
    findMissingSubjects(
      coreGroups,
      subjectByCode,
    );

  /*
   * Do not silently create subjects here.
   *
   * All Course Structure RequirementItems must resolve to the
   * canonical subject catalogue. If a new official core unit
   * is missing, stop and resolve it deliberately before import.
   */
  if (
    unresolvedCoreSubjectCodes
      .length > 0
  ) {
    throw new Error(
      [
        'Engineering Core contains subject codes that are not present',
        'in the canonical subject collection:',
        unresolvedCoreSubjectCodes.join(
          ', ',
        ),
      ].join(' '),
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
   * ALL STREAM -> SPECIALISATION RELATIONSHIPS
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
    string[] = [];

  for (
    const [
      streamSlug,
      streamRelationships,
    ] of relationshipsByStream
  ) {
    const streamSource =
      findCanonicalStreamSource(
        master.componentSources,
        streamSlug,
      );

    if (!streamSource) {
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
    master.metadata.counts ?? {};

  counts.degreeRequirementClauses =
  master.degreeRequirements.length;

  console.log(
    'DEBUG degreeRequirementClauses:',
    {
      actual:
        master.degreeRequirements.length,

      metadata:
        counts.degreeRequirementClauses,
    },
  );

  counts.canonicalComponents =
    master.components.length;

  counts.componentSourceRecords =
    master.componentSources.length;

  counts.componentRequirementObjects =
    master.componentRequirementObjects.length;

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

      groups:
        coreGroups.map(
          (group) => ({
            key:
              group.key,

            name:
              group.name,

            requiredCreditPoints:
              group.requiredCreditPoints,

            sections:
              group.sections,

            subjectCodes:
              group.units.map(
                (unit) =>
                  unit.code,
              ),
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
                (entry) =>
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
    `Core table units collected: ${coreTable.units.length}`,
  );

  for (
    const group of
    coreGroups
  ) {
    console.log(
      `${group.name}: ${group.units.length} subjects`,
    );
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
 * ENGINEERING CORE
 * ============================================================
 */

function buildEngineeringCoreGroups(
  units: UsydGlobalTableUnit[],
): EngineeringCoreGroup[] {
  console.log(
    'Engineering Core parsed sections:',
    [
      ...new Set(
        units.map((unit) =>
          normalizeText(
            unit.section ?? '',
          ),
        ),
      ),
    ],
  );

  console.log(
    'Engineering Core parsed units:',
    units.map((unit) => ({
      code: unit.code,
      title: unit.title,
      section: normalizeText(
        unit.section ?? '',
      ),
    })),
  );

  const foundation:
    UsydGlobalTableUnit[] =
    [];

  const projects:
    UsydGlobalTableUnit[] =
    [];

  const pep:
    UsydGlobalTableUnit[] =
    [];

  const foundationSections =
    new Set<string>();

  const projectSections =
    new Set<string>();

  const pepSections =
    new Set<string>();

  for (const unit of units) {
    const section =
      normalizeText(
        unit.section ?? '',
      );

    if (!section) {
      continue;
    }

    /*
     * Ignore rows that are not real subject table entries.
     *
     * The generic parser can pick up narrative text or
     * amendment-history rows whenever they contain something
     * that looks like a valid unit code.
     */
    if (
      isNonSubjectCoreRow(
        unit,
        section,
      )
    ) {
      continue;
    }

    const classification =
      classifyCoreSection(
        section,
      );

    if (
      classification ===
      'FOUNDATION'
    ) {
      foundation.push(
        unit,
      );

      foundationSections.add(
        section,
      );

      continue;
    }

    if (
      classification ===
      'PROJECTS'
    ) {
      projects.push(
        unit,
      );

      projectSections.add(
        section,
      );

      continue;
    }

    if (
      classification ===
      'PEP'
    ) {
      pep.push(
        unit,
      );

      pepSections.add(
        section,
      );
    }
  }

  const result:
    EngineeringCoreGroup[] =
    [
      {
        key:
          'FOUNDATION',

        name:
          'Foundation',

        requiredCreditPoints:
          18,

        sections:
          [
            ...foundationSections,
          ],

        units:
          dedupeUnits(
            foundation,
          ),
      },

      {
        key:
          'PROJECTS',

        name:
          'Engineering Projects',

        requiredCreditPoints:
          30,

        sections:
          [
            ...projectSections,
          ],

        units:
          dedupeUnits(
            projects,
          ),
      },

      {
        key:
          'PEP',

        name:
          'Professional Engagement Program',

        requiredCreditPoints:
          null,

        sections:
          [
            ...pepSections,
          ],

        units:
          dedupeUnits(
            pep,
          ),
      },
    ];

  console.log(
    'Engineering Core classified groups:',
    result.map((group) => ({
      key: group.key,
      name: group.name,
      sections: group.sections,
      units: group.units.map(
        (unit) => unit.code,
      ),
    })),
  );

  for (const group of result) {
    if (
      group.units.length ===
      0
    ) {
      throw new Error(
        [
          `Engineering Core parser found zero units for ${group.name}.`,
          'Inspect the official table headings before continuing.',
        ].join(
          ' ',
        ),
      );
    }
  }

  return result;
}

function classifyCoreSection(
  section: string,
):
  | 'FOUNDATION'
  | 'PROJECTS'
  | 'PEP'
  | null {
  const normalized =
    normalizeText(section)
      .toLowerCase();

  /*
   * Foundation
   */
  if (
    normalized ===
      'computing units' ||
    normalized ===
      'mathematics units'
  ) {
    return 'FOUNDATION';
  }

  /*
   * Professional Engagement Program
   */
  if (
    normalized.includes(
      'professional engagement program',
    )
  ) {
    return 'PEP';
  }

  /*
   * Engineering Projects
   *
   * The generic table parser loses the higher-level headings
   * such as Project 1 / Project 2 & 3 / Thesis Units and keeps
   * the immediate requirement sentence instead.
   */
  if (
    normalized ===
      'students must complete 6 credit points from the following:' ||
    normalized ===
      'students must complete 12 credit points from the following:'
  ) {
    return 'PROJECTS';
  }

  return null;
}
function attachCoreGroupsToDegreeRequirements(
  master: MasterFile,
  groups: EngineeringCoreGroup[],
): string[] {
  const updated:
    string[] = [];

  /*
   * Remove only requirements previously generated by this repair.
   *
   * The original BHENGINE-04 handbook requirement clauses are preserved
   * unchanged as provenance. We create three dedicated authoritative
   * requirement clauses instead of overwriting an existing broad clause.
   *
   * This is important because one original handbook clause can mention
   * Foundation, Engineering Projects and PEP together. Reusing that same
   * clause for all three groups causes the later group to overwrite the
   * earlier one.
   */
  master.degreeRequirements =
    master.degreeRequirements.filter(
      (requirement) =>
        requirement.generatedRelationshipKind !==
        'ENGINEERING_CORE_TABLE',
    );

  const sourceTextByGroup =
    new Map<
      EngineeringCoreGroup['key'],
      string | null
    >();

  for (const group of groups) {
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
    (group, groupIndex) => {
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

        node: {
          nodeType:
            'GROUP',

          title:
            group.name,

          logic:
            'UNKNOWN',

          requiredCreditPoints:
            group.requiredCreditPoints,

          sourceUrl:
            ENGINEERING_CORE_URL,

          sourceSections:
            group.sections,

          children:
            group.units.map(
              (
                unit,
                index,
              ) => ({
                nodeType:
                  'SUBJECT',

                code:
                  unit.code,

                name:
                  unit.title,

                creditPoints:
                  unit.creditPoints,

                sourceUrl:
                  unit.sourceUrl,

                sortOrder:
                  index,
              }),
            ),
        },
      };

      master.degreeRequirements.push(
        generatedClause,
      );

      updated.push(
        group.name,
      );
    },
  );

  return updated;
}

function findDegreeRequirementSourceText(
  requirements: JsonObject[],
  key:
    EngineeringCoreGroup['key'],
): string | null {
  const degreeRequirements =
    requirements.filter(
      (requirement) =>
        requirement.degreeCode ===
        ENGINEERING_DEGREE_CODE &&
        requirement.generatedRelationshipKind !==
        'ENGINEERING_CORE_TABLE',
    );

  for (const requirement of degreeRequirements) {
    const raw =
      normalizeText(
        stringOrNull(
          requirement.raw,
        ) ??
        '',
      );

    const lower =
      raw.toLowerCase();

    if (!lower) {
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
  requirements: JsonObject[],
): number {
  const indexes =
    requirements
      .filter(
        (requirement) =>
          requirement.degreeCode ===
          ENGINEERING_DEGREE_CODE,
      )
      .map(
        (requirement) =>
          typeof requirement.sourceIndex ===
            'number'
            ? requirement.sourceIndex
            : null,
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null &&
          Number.isFinite(
            value,
          ),
      );

  return indexes.length > 0
    ? Math.max(
        ...indexes,
      ) + 1
    : 0;
}

function findGeneratedEngineeringCoreRequirement(
  requirements: JsonObject[],
  key:
    EngineeringCoreGroup['key'],
): JsonObject | null {
  const matches =
    requirements.filter(
      (requirement) =>
        requirement.degreeCode ===
          ENGINEERING_DEGREE_CODE &&
        requirement.generatedRelationshipKind ===
          'ENGINEERING_CORE_TABLE' &&
        requirement.generatedCoreGroupKey ===
          key,
    );

  if (
    matches.length !==
    1
  ) {
    return null;
  }

  return matches[0];
}

function findMissingSubjects(
  groups: EngineeringCoreGroup[],
  subjectByCode:
    Map<string, JsonObject>,
): string[] {
  const missing =
    new Set<string>();

  for (
    const group of groups
  ) {
    for (
      const unit of
      group.units
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
  }

  return [
    ...missing,
  ].sort();
}

/*
 * ============================================================
 * STREAM -> SPECIALISATION
 * ============================================================
 */

function discoverEngineeringSpecialisationRelationships(
  sources: ComponentSource[],
): SpecialisationRelationship[] {
  const found =
    new Map<
      string,
      SpecialisationRelationship
    >();

  for (
    const source of
    sources
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

    if (!url) {
      continue;
    }

    /*
     * Only use the canonical Engineering handbook path.
     *
     * Do not duplicate relationships from the mirrored
     * business-school/coursework engineering-commerce pages.
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

    if (!identity) {
      continue;
    }

    const streamName =
      ENGINEERING_STREAM_NAMES[
        identity.streamSlug
      ];

    if (!streamName) {
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
    (a, b) => {
      const streamCompare =
        a.streamName.localeCompare(
          b.streamName,
        );

      if (
        streamCompare !==
        0
      ) {
        return streamCompare;
      }

      return a.specialisationName
        .localeCompare(
          b.specialisationName,
        );
    },
  );
}

function parseSpecialisationUrl(
  url: string,
): {
  streamSlug: string;
  specialisationSlug: string;
} | null {
  const match =
    url.match(
      /\/engineering\/engineering-honours\/streams\/([^/]+)\/specialisations\/([^/]+?)(?:-unit-of-study-table)?\.html$/i,
    );

  if (!match) {
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
    const relationship of
    relationships
  ) {
    const current =
      result.get(
        relationship.streamSlug,
      ) ?? [];

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
  sources: ComponentSource[],
  streamSlug: string,
): ComponentSource | null {
  const suffix =
    `/engineering/engineering-honours/streams/${streamSlug}/unit-of-study-table.html`;

  const matches =
    sources.filter(
      (source) => {
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

  if (
    matches.length !==
    1
  ) {
    return null;
  }

  return matches[0];
}

function attachSpecialisationChoiceGroup(
  params: {
    source: ComponentSource;

    streamSlug: string;

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

  /*
   * The canonical direct stream table is expected to be the
   * one containing the actual stream requirement structure.
   */
  const table =
    tables.find(
      (candidate) => {
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
      (group) =>
        group.generatedRelationshipKind !==
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
      params.source.component
        .unitTableUrl ??
      null,

    components:
      params.relationships.map(
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
  master: MasterFile,
  groups: EngineeringCoreGroup[],
): void {
  for (const group of groups) {
    const clause =
      findGeneratedEngineeringCoreRequirement(
        master.degreeRequirements,
        group.key,
      );

    if (!clause) {
      throw new Error(
        `Post-repair validation cannot find exactly one generated ${group.name} requirement.`,
      );
    }

    const node =
      objectOrEmpty(
        clause.node,
      );

    const children =
      arrayOfObjects(
        node.children,
      );

    const subjectChildren =
      children.filter(
        (child) =>
          child.nodeType ===
          'SUBJECT',
      );

    if (
      subjectChildren.length !==
      group.units.length
    ) {
      throw new Error(
        `${group.name}: expected ${group.units.length} subject references, found ${subjectChildren.length}.`,
      );
    }

    const actualCodes =
      subjectChildren
        .map(
          (child) =>
            stringOrNull(
              child.code,
            ),
        )
        .filter(
          (
            code,
          ): code is string =>
            code !== null,
        );

    const expectedCodes =
      group.units.map(
        (unit) =>
          unit.code,
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
        `${group.name}: generated subject references do not match the classified Engineering Core units.`,
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
  }
}

function validateSpecialisationRepair(
  master: MasterFile,
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

  for (
    const [
      streamSlug,
      expected,
    ] of
    relationshipsByStream
  ) {
    const source =
      findCanonicalStreamSource(
        master.componentSources,
        streamSlug,
      );

    if (!source) {
      throw new Error(
        `Missing repaired stream source ${streamSlug}.`,
      );
    }

    const groups =
      source.parsedTables
        .flatMap(
          (table) =>
            arrayOfObjects(
              objectOrEmpty(
                table.structure,
              ).components,
            ),
        )
        .flatMap(
          (component) =>
            arrayOfObjects(
              component
                .requirementGroups,
            ),
        );

    const choiceGroup =
      groups.find(
        (group) =>
          group
            .generatedRelationshipKind ===
          'STREAM_SPECIALISATION_CHOICE',
      );

    if (!choiceGroup) {
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
  }
}

/*
 * ============================================================
 * GENERIC HELPERS
 * ============================================================
 */

function buildSubjectMap(
  subjects: JsonObject[],
):
  Map<string, JsonObject> {
  const result =
    new Map<
      string,
      JsonObject
    >();

  for (
    const subject of
    subjects
  ) {
    const code =
      stringOrNull(
        subject.code,
      );

    if (code) {
      result.set(
        code.toUpperCase(),
        subject,
      );
    }
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
    const unit of units
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

function normalizeText(
  value: string,
): string {
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
  value: unknown,
): JsonObject {
  return isObject(
    value,
  )
    ? value
    : {};
}

function isObject(
  value: unknown,
): value is JsonObject {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value,
    )
  );
}

function arrayOfObjects(
  value: unknown,
): JsonObject[] {
  return Array.isArray(
    value,
  )
    ? value.filter(
        isObject,
      )
    : [];
}

function stringOrNull(
  value: unknown,
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
  ...values: unknown[]
): string | null {
  for (
    const value of values
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
  value: unknown,
  label: string,
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

function validateMaster(
  master: MasterFile,
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
  path: string,
): Promise<T> {
  return JSON.parse(
    await readFile(
      path,
      'utf8',
    ),
  ) as T;
}

async function writeJson(
  path: string,
  value: unknown,
): Promise<void> {
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
    error: unknown,
  ) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);

function isNonSubjectCoreRow(
  unit: UsydGlobalTableUnit,
  section: string,
): boolean {
  const normalizedSection =
    normalizeText(
      section,
    ).toLowerCase();

  const normalizedTitle =
    normalizeText(
      unit.title ?? '',
    ).toLowerCase();

  /*
   * ------------------------------------------------
   * Amendment / publication history
   * ------------------------------------------------
   */
  if (
    normalizedSection.startsWith(
      'date original publication',
    )
  ) {
    return true;
  }

  /*
   * ------------------------------------------------
   * Narrative recommendation rows
   *
   * Examples seen from the parser:
   *
   * INFO1110
   * "Students in the Electrical and Software streams..."
   *
   * ENGG1810
   * "Students in other streams are recommended..."
   * ------------------------------------------------
   */
  if (
    normalizedTitle.startsWith(
      'students in the ',
    )
  ) {
    return true;
  }

  /*
   * ------------------------------------------------
   * PEP explanatory note
   *
   * Example:
   * ENGP1001
   * "Note: Students must enrol..."
   * ------------------------------------------------
   */
  if (
    normalizedTitle.startsWith(
      'note:',
    )
  ) {
    return true;
  }

  /*
   * ------------------------------------------------
   * Amendment-history prose that contains unit codes
   * ------------------------------------------------
   */
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