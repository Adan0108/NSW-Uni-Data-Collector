import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

interface UnitRow {
  code?: string;
  title?: string;
  creditPoints?: number | null;
  accessConditionsRaw?: string | null;
  section?: string | null;
  sourceUrl?: string | null;
}

interface ParsedTable {
  url?: string;
  structure?: JsonObject;
  units?: UnitRow[];
}

interface ComponentRecord extends JsonObject {
  handbookCategory?: string;
  name?: string;
  type?: string;
  overviewUrl?: string;
  unitTableUrl?: string;
  tableUrls?: string[];
  learningOutcomesUrl?: string;
  sourceUrl?: string;
}

interface ComponentSource extends JsonObject {
  component: ComponentRecord;
  parsedTables: ParsedTable[];
}

interface MasterFile {
  university: {
    code: string;
    name: string;
  };

  handbookYear: number;

  degrees: JsonObject[];
  components: ComponentRecord[];
  componentRequirementObjects: JsonObject[];
  componentSources: ComponentSource[];
  subjects: JsonObject[];

  degreeComponents: Array<{
    relationshipKind: 'EXPLICIT_NAMED' | 'CHOICE_POOL';
    data: JsonObject;
  }>;

  metadata: JsonObject & {
    counts?: Record<string, number>;
  };

  [key: string]: unknown;
}

interface RepairReport {
  generatedAt: string;

  renamedStreams: Array<{
    oldName: string;
    newName: string;
    sourceUrl: string;
  }>;

  repairedSources: Array<{
    componentName: string;
    componentType: string;
    sourceUrl: string;
    groups: number;
    units: number;
  }>;

  addedDegreeRelationships: number;

  streamCandidates: Array<{
    name: string;
    sourceUrl: string;
  }>;

  skippedSections: Array<{
    sourceUrl: string;
    section: string;
  }>;

  unresolvedSubjectCodes: string[];
}

const INPUT_FILE = resolve(
  process.cwd(),
  'data/normalized/usyd/2026/usyd-master-final.with-cusp.subjects-resolved.json',
);

const OUTPUT_FILE = resolve(
  process.cwd(),
  'data/normalized/usyd/2026/usyd-master-final.engineering-repaired.json',
);

const REPORT_FILE = resolve(
  process.cwd(),
  'data/normalized/usyd/2026/usyd-engineering-repair-report.json',
);

const HANDBOOK_CATEGORY = 'ENGINEERING';
const ENGINEERING_DEGREE_CODE = 'BHENGINE-04';

/**
 * These names are derived from the official Engineering stream URLs that
 * already exist in the collected dataset.
 *
 * We are NOT guessing streams from CUSP titles.
 */
const ENGINEERING_STREAM_NAMES: Record<string, string> = {
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

async function main(): Promise<void> {
  const master =
    await readJson<MasterFile>(
      INPUT_FILE,
    );

  validateMaster(master);

  const subjectByCode =
    new Map<string, JsonObject>();

  for (const subject of master.subjects) {
    const code =
      stringOrNull(subject.code);

    if (code) {
      subjectByCode.set(
        code,
        subject,
      );
    }
  }

  const report: RepairReport = {
    generatedAt:
      new Date().toISOString(),

    renamedStreams: [],

    repairedSources: [],

    addedDegreeRelationships: 0,

    streamCandidates: [],

    skippedSections: [],

    unresolvedSubjectCodes: [],
  };

  /*
   * ------------------------------------------------------------
   * STEP 1
   * Fix canonical Engineering stream component names.
   * ------------------------------------------------------------
   *
   * Current broken records look like:
   *
   * type: STREAM
   * name: Bachelor of Engineering Honours
   * unitTableUrl:
   *   .../streams/software/unit-of-study-table.html
   *
   * The URL already gives us the official stream identity.
   */
  for (const component of master.components) {
    repairStreamName(
      component,
      report,
    );
  }

  /*
   * componentSources has its own embedded component identity,
   * therefore it must be repaired as well.
   */
  for (
    const source of
    master.componentSources
  ) {
    repairStreamName(
      source.component,
      report,
    );
  }

  /*
   * ------------------------------------------------------------
   * STEP 2
   * Convert already-collected Engineering unit rows into the same
   * structured component format used successfully by Advanced
   * Computing.
   * ------------------------------------------------------------
   */
  const generatedRequirementObjects:
    JsonObject[] = [];

  for (
    const source of
    master.componentSources
  ) {
    if (
      !isEngineeringHonoursComponentSource(
        source,
      )
    ) {
      continue;
    }

    const componentName =
      requiredString(
        source.component.name,
        'Engineering component name',
      );

    const componentType =
      requiredString(
        source.component.type,
        `${componentName}.type`,
      );

    let sourceGroupCount = 0;
    let sourceUnitCount = 0;

    for (
      const parsedTable of
      source.parsedTables ?? []
    ) {
      const sourceUrl =
        firstString(
          parsedTable.url,
          source.component.unitTableUrl,
        );

      if (!sourceUrl) {
        continue;
      }

      /*
       * Do not overwrite tables that were already correctly parsed.
       */
      const existingStructure =
        objectOrEmpty(
          parsedTable.structure,
        );

      const existingComponents =
        arrayOfObjects(
          existingStructure.components,
        );

      if (
        existingComponents.length > 0
      ) {
        continue;
      }

      const groups =
        buildRequirementGroups({
          units:
            parsedTable.units ?? [],

          subjectByCode,

          sourceUrl,

          report,
        });

      if (groups.length === 0) {
        continue;
      }

      const requiredCreditPoints =
        componentType === 'STREAM'
          ? 120
          : inferComponentCreditPoints(
              groups,
            );

      const formalRequirements =
        groups.map(
          (group, index) => {
            const requiredCp =
              numberOrNull(
                group.requiredCreditPoints,
              );

            const name =
              requiredString(
                group.name,
                'generated group name',
              );

            return {
              order: index + 1,

              rawText:
                requiredCp !== null
                  ? `${requiredCp} credit points from ${name}`
                  : name,

              requiredCreditPoints:
                requiredCp,

              level:
                inferLevelFromName(
                  name,
                ),

              groupKind:
                inferGroupKind(name),

              componentReferenceRule:
                null,

              conditionalRule:
                null,

              subrules: [],

              notes: [],
            };
          },
        );

      const generatedComponent = {
        name:
          componentType === 'STREAM'
            ? `${componentName} stream`
            : `${componentName} specialisation`,

        type:
          componentType,

        requiredCreditPoints,

        summary:
          buildComponentSummary(
            componentName,
            componentType,
            requiredCreditPoints,
          ),

        formalRequirements,

        requirementGroups:
          groups,

        sourceUrl,
      };

      parsedTable.structure = {
        ...existingStructure,

        name:
          componentName,

        tableName:
          firstString(
            existingStructure.tableName,
            'Unit of study table',
          ),

        year:
          master.handbookYear,

        components: [
          generatedComponent,
        ],

        sourceUrl,
      };

      generatedRequirementObjects.push(
        generatedComponent,
      );

      sourceGroupCount +=
        groups.length;

      sourceUnitCount +=
        groups.reduce(
          (total, group) =>
            total +
            arrayOfObjects(
              group.units,
            ).length,

          0,
        );
    }

    if (sourceGroupCount > 0) {
      report.repairedSources.push({
        componentName,
        componentType,

        sourceUrl:
          firstString(
            source.component
              .unitTableUrl,
            source.component
              .overviewUrl,
          ) ?? '',

        groups:
          sourceGroupCount,

        units:
          sourceUnitCount,
      });
    }
  }

  /*
   * ------------------------------------------------------------
   * STEP 3
   * Keep componentRequirementObjects consistent with the repaired
   * componentSources.
   *
   * The current DB importer primarily reads componentSources, but
   * this array is also part of the normalized master and should not
   * remain stale.
   * ------------------------------------------------------------
   */
  const generatedUrls =
    new Set(
      generatedRequirementObjects
        .map((row) =>
          stringOrNull(
            row.sourceUrl,
          ),
        )
        .filter(
          (
            value,
          ): value is string =>
            value !== null,
        ),
    );

  master.componentRequirementObjects =
    master.componentRequirementObjects.filter(
      (row) => {
        const sourceUrl =
          stringOrNull(
            row.sourceUrl,
          );

        return (
          !sourceUrl ||
          !generatedUrls.has(
            sourceUrl,
          )
        );
      },
    );

  master.componentRequirementObjects.push(
    ...generatedRequirementObjects,
  );

  /*
   * ------------------------------------------------------------
   * STEP 4
   * Materialise the verified BHENGINE-04 → STREAM choice pool.
   *
   * This relationship is supported by:
   *
   * - BHENGINE-04's formal 120 CP stream requirement;
   * - official stream pages already collected below
   *   /engineering-honours/streams/...;
   *
   * We do NOT infer these from CUSP semester position.
   * ------------------------------------------------------------
   */
  const streamCandidates =
    collectEngineeringStreamCandidates(
      master.componentSources,
    );

  report.streamCandidates =
    streamCandidates.map(
      (candidate) => ({
        name:
          requiredString(
            candidate.componentName,
            'stream candidate name',
          ),

        sourceUrl:
          requiredString(
            candidate.evidenceUrl,
            'stream evidence URL',
          ),
      }),
    );

  const alreadyHasStreamPool =
    master.degreeComponents.some(
      (relationship) => {
        if (
          relationship
            .relationshipKind !==
          'CHOICE_POOL'
        ) {
          return false;
        }

        const data =
          relationship.data;

        return (
          data.degreeCode ===
            ENGINEERING_DEGREE_CODE &&
          data.requestedComponentType ===
            'STREAM'
        );
      },
    );

  if (
    !alreadyHasStreamPool &&
    streamCandidates.length > 0
  ) {
    const degree =
      master.degrees.find(
        (candidate) =>
          candidate.code ===
          ENGINEERING_DEGREE_CODE,
      );

    if (!degree) {
      throw new Error(
        `Missing degree ${ENGINEERING_DEGREE_CODE}.`,
      );
    }

    master.degreeComponents.push({
      relationshipKind:
        'CHOICE_POOL',

      data: {
        degreeCode:
          ENGINEERING_DEGREE_CODE,

        degreeTitle:
          firstString(
            degree.title,
            degree.name,
          ),

        degreeHandbook:
          HANDBOOK_CATEGORY,

        tableName:
          'Engineering Streams',

        requestedComponentType:
          'STREAM',

        relationshipSemantics:
          'CHOICE_POOL',

        compulsoryCandidateRelationships:
          false,

        authoritative:
          true,

        candidates:
          streamCandidates,

        evidence: [
          {
            rawText:
              '120 credit points of Stream units of study from the relevant Bachelor of Engineering Honours stream table.',

            source:
              'USYD 2026 Engineering course resolution',
          },
        ],
      },
    });

    report.addedDegreeRelationships +=
      1;
  }

  /*
   * ------------------------------------------------------------
   * STEP 5
   * Update metadata counts that this repair changes.
   * ------------------------------------------------------------
   */
  const counts =
    master.metadata.counts ?? {};

  counts.canonicalComponents =
    master.components.length;

  counts.componentRequirementObjects =
    master.componentRequirementObjects.length;

  counts.componentSourceRecords =
    master.componentSources.length;

  counts.explicitNamedDegreeComponentRelationships =
    master.degreeComponents.filter(
      (relationship) =>
        relationship
          .relationshipKind ===
        'EXPLICIT_NAMED',
    ).length;

  counts.degreeComponentChoicePools =
    master.degreeComponents.filter(
      (relationship) =>
        relationship
          .relationshipKind ===
        'CHOICE_POOL',
    ).length;

  counts.totalDegreeComponentRelationshipRecords =
    master.degreeComponents.length;

  master.metadata.counts =
    counts;

  /*
   * ------------------------------------------------------------
   * STEP 6
   * Final integrity validation.
   * ------------------------------------------------------------
   */
  validateRepair(
    master,
    report,
  );

  report.unresolvedSubjectCodes =
    [...new Set(
      report.unresolvedSubjectCodes,
    )].sort();

  await writeFile(
    OUTPUT_FILE,

    JSON.stringify(
      master,
      null,
      2,
    ) + '\n',

    'utf8',
  );

  await writeFile(
    REPORT_FILE,

    JSON.stringify(
      report,
      null,
      2,
    ) + '\n',

    'utf8',
  );

  console.log(
    '================================',
  );

  console.log(
    'USYD ENGINEERING COMPONENT REPAIR',
  );

  console.log(
    '================================',
  );

  console.log(
    `Renamed streams: ${report.renamedStreams.length}`,
  );

  console.log(
    `Repaired component sources: ${report.repairedSources.length}`,
  );

  console.log(
    `Generated requirement objects: ${generatedRequirementObjects.length}`,
  );

  console.log(
    `Engineering stream candidates: ${streamCandidates.length}`,
  );

  console.log(
    `Degree relationship records added: ${report.addedDegreeRelationships}`,
  );

  console.log(
    `Unresolved subject codes: ${report.unresolvedSubjectCodes.length}`,
  );

  console.log(
    `Saved repaired master: ${OUTPUT_FILE}`,
  );

  console.log(
    `Saved report: ${REPORT_FILE}`,
  );
}

function repairStreamName(
  component: ComponentRecord,
  report: RepairReport,
): void {
  if (
    component.type !== 'STREAM'
  ) {
    return;
  }

  const unitTableUrl =
    stringOrNull(
      component.unitTableUrl,
    );

  if (!unitTableUrl) {
    return;
  }

  const slug =
    extractEngineeringStreamSlug(
      unitTableUrl,
    );

  if (!slug) {
    return;
  }

  const correctName =
    ENGINEERING_STREAM_NAMES[slug];

  if (!correctName) {
    throw new Error(
      `Unknown Engineering stream slug: ${slug}`,
    );
  }

  const oldName =
    stringOrNull(
      component.name,
    ) ?? '';

  if (
    oldName === correctName
  ) {
    return;
  }

  component.name =
    correctName;

  report.renamedStreams.push({
    oldName,
    newName:
      correctName,

    sourceUrl:
      unitTableUrl,
  });
}

function isEngineeringHonoursComponentSource(
  source: ComponentSource,
): boolean {
  const component =
    source.component;

  if (
    component.handbookCategory !==
    HANDBOOK_CATEGORY
  ) {
    return false;
  }

  if (
    component.type !== 'STREAM' &&
    component.type !==
      'SPECIALISATION'
  ) {
    return false;
  }

  const url =
    firstString(
      component.unitTableUrl,
      component.overviewUrl,
    );

  if (!url) {
    return false;
  }

  return url.includes(
    '/engineering/engineering-honours/streams/',
  );
}

function buildRequirementGroups(params: {
  units: UnitRow[];
  subjectByCode: Map<string, JsonObject>;
  sourceUrl: string;
  report: RepairReport;
}): JsonObject[] {
  const grouped =
    new Map<
      string,
      UnitRow[]
    >();

  for (const unit of params.units) {
    const code =
      stringOrNull(
        unit.code,
      );

    const section =
      stringOrNull(
        unit.section,
      );

    if (
      !code ||
      !section
    ) {
      continue;
    }

    /*
     * The collector also captured the handbook's amendment/history table.
     * Those rows are NOT curriculum units.
     */
    if (
      isNonCurriculumSection(
        section,
      ) ||
      isNonCurriculumUnit(unit)
    ) {
      params.report
        .skippedSections
        .push({
          sourceUrl:
            params.sourceUrl,

          section,
        });

      continue;
    }

    const rows =
      grouped.get(section) ??
      [];

    rows.push(unit);

    grouped.set(
      section,
      rows,
    );
  }

  const groups: JsonObject[] =
    [];

  for (
    const [
      section,
      rows,
    ] of grouped
  ) {
    const units =
      dedupeUnits(
        rows,
        params.subjectByCode,
        params.report,
      );

    if (units.length === 0) {
      continue;
    }

    groups.push({
      name:
        normalizeSectionName(
          section,
        ),

      level:
        inferLevelFromName(
          section,
        ),

      logic:
        inferGroupLogic(
          section,
        ),

      requiredCreditPoints:
        parseRequiredCreditPoints(
          section,
        ),

      units,
    });
  }

  return groups.sort(
    (a, b) =>
      groupSortKey(
        requiredString(
          a.name,
          'group name',
        ),
      ) -
      groupSortKey(
        requiredString(
          b.name,
          'group name',
        ),
      ),
  );
}

function dedupeUnits(
  rows: UnitRow[],
  subjectByCode: Map<string, JsonObject>,
  report: RepairReport,
): JsonObject[] {
  const result =
    new Map<
      string,
      JsonObject
    >();

  for (const row of rows) {
    const code =
      stringOrNull(
        row.code,
      );

    if (!code) {
      continue;
    }

    if (result.has(code)) {
      continue;
    }

    const subject =
      subjectByCode.get(code);

    if (!subject) {
      report
        .unresolvedSubjectCodes
        .push(code);
    }

    result.set(
      code,
      {
        code,

        name:
          firstString(
            subject?.name,
            row.title,
            code,
          ),

        creditPoints:
          numberOrNull(
            subject?.creditPoints,
          ) ??
          numberOrNull(
            row.creditPoints,
          ),

        assumedKnowledge:
          accessText(
            subject?.accessConditions,
            'assumedKnowledge',
          ),

        prerequisite:
          accessText(
            subject?.accessConditions,
            'prerequisite',
          ),

        corequisite:
          accessText(
            subject?.accessConditions,
            'corequisite',
          ),

        prohibition:
          accessText(
            subject?.accessConditions,
            'prohibition',
          ),

        sourceUrl:
          firstString(
            subject?.sourceUrl,
            row.sourceUrl,
          ),
      },
    );
  }

  return [
    ...result.values(),
  ];
}

function collectEngineeringStreamCandidates(
  sources: ComponentSource[],
): JsonObject[] {
  const candidates =
    new Map<
      string,
      JsonObject
    >();

  for (const source of sources) {
    const component =
      source.component;

    if (
      component.type !==
      'STREAM'
    ) {
      continue;
    }

    const url =
      stringOrNull(
        component.unitTableUrl,
      );

    if (!url) {
      continue;
    }

    if (
      !url.includes(
        '/engineering/engineering-honours/streams/',
      )
    ) {
      continue;
    }

    /*
     * Specialisation URLs also contain /streams/.
     * Only accept the direct stream unit-table pattern.
     */
    if (
      url.includes(
        '/specialisations/',
      )
    ) {
      continue;
    }

    const name =
      requiredString(
        component.name,
        'Engineering stream name',
      );

    candidates.set(
      url,
      {
        componentName:
          name,

        componentType:
          'STREAM',

        componentHandbook:
          HANDBOOK_CATEGORY,

        evidenceUrl:
          firstString(
            component.overviewUrl,
            component.unitTableUrl,
          ),

        sourceProven:
          true,
      },
    );
  }

  return [
    ...candidates.values(),
  ].sort((a, b) =>
    requiredString(
      a.componentName,
      'candidate name',
    ).localeCompare(
      requiredString(
        b.componentName,
        'candidate name',
      ),
    ),
  );
}

function inferComponentCreditPoints(
  groups: JsonObject[],
): number | null {
  const values =
    groups
      .map((group) =>
        numberOrNull(
          group.requiredCreditPoints,
        ),
      )
      .filter(
        (
          value,
        ): value is number =>
          value !== null,
      );

  if (
    values.length !==
    groups.length
  ) {
    return null;
  }

  return values.reduce(
    (total, value) =>
      total + value,
    0,
  );
}

function buildComponentSummary(
  name: string,
  type: string,
  requiredCreditPoints:
    number | null,
): string {
  const typeLabel =
    type === 'STREAM'
      ? 'stream'
      : 'specialisation';

  if (
    requiredCreditPoints !==
    null
  ) {
    return (
      `${name} ${typeLabel} contains ` +
      `${requiredCreditPoints} credit points ` +
      'of requirements from this official unit table.'
    );
  }

  return (
    `${name} ${typeLabel} requirements ` +
    'from the official unit of study table.'
  );
}

function extractEngineeringStreamSlug(
  url: string,
): string | null {
  const match =
    url.match(
      /\/engineering-honours\/streams\/([^/]+)\//,
    );

  return (
    match?.[1] ??
    null
  );
}

function isNonCurriculumSection(
  section: string,
): boolean {
  const normalized =
    section.toLowerCase();

  return (
    normalized.includes(
      'original publication',
    ) ||
    normalized.includes(
      'post-publication amendment',
    ) ||
    normalized.startsWith(
      'date original publication',
    )
  );
}

function isNonCurriculumUnit(
  unit: UnitRow,
): boolean {
  const title =
    stringOrNull(
      unit.title,
    )?.toLowerCase() ??
    '';

  if (
    title.startsWith(
      'published and available',
    )
  ) {
    return true;
  }

  if (
    title.startsWith(
      'missing from:',
    )
  ) {
    return true;
  }

  if (
    title.includes(
      'published as:',
    )
  ) {
    return true;
  }

  /*
   * Real curriculum units should have a normal title and usually CP.
   * We do not reject null CP globally because some genuine units can
   * carry 0 CP, but amendment-history rows are already excluded above.
   */
  return false;
}

function normalizeSectionName(
  value: string,
): string {
  const trimmed =
    value.trim();

  const completeMatch =
    trimmed.match(
      /^Students (?:must )?complete (\d+) credit points from the following:?$/i,
    );

  if (completeMatch) {
    return (
      `${completeMatch[1]} CP units`
    );
  }

  return trimmed;
}

function parseRequiredCreditPoints(
  value: string,
): number | null {
  const match =
    value.match(
      /(?:complete|required to complete)\s+(\d+)\s+credit points/i,
    ) ??
    value.match(
      /^(\d+)\s*(?:CP|credit points)/i,
    );

  if (!match) {
    return null;
  }

  const parsed =
    Number(match[1]);

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function inferGroupLogic(
  name: string,
): 'ALL' | 'ANY' | 'UNKNOWN' {
  const normalized =
    name.toLowerCase();

  if (
    normalized.includes(
      'elective',
    ) ||
    normalized.includes(
      'selective',
    ) ||
    normalized.includes(
      'choose',
    )
  ) {
    return 'ANY';
  }

  /*
   * Do not mark Stream Core as ALL automatically.
   * Some tables contain advanced/standard alternatives.
   */
  return 'UNKNOWN';
}

function inferGroupKind(
  name: string,
): string {
  const normalized =
    name.toLowerCase();

  if (
    normalized.includes(
      'elective',
    )
  ) {
    return 'ELECTIVE';
  }

  if (
    normalized.includes(
      'selective',
    )
  ) {
    return 'SELECTIVE';
  }

  if (
    normalized.includes(
      'core',
    )
  ) {
    return 'CORE';
  }

  return 'OTHER';
}

function inferLevelFromName(
  name: string,
): number | null {
  const match =
    name.match(
      /\b([1-5])000\b/,
    );

  if (!match) {
    return null;
  }

  return Number(
    match[1],
  ) * 1000;
}

function groupSortKey(
  name: string,
): number {
  const normalized =
    name.toLowerCase();

  if (
    normalized.includes(
      'core',
    )
  ) {
    return 10;
  }

  if (
    normalized.includes(
      '1000',
    ) ||
    normalized.includes(
      '2000',
    )
  ) {
    return 20;
  }

  if (
    normalized.includes(
      '3000',
    )
  ) {
    return 30;
  }

  if (
    normalized.includes(
      'elective',
    )
  ) {
    return 40;
  }

  return 100;
}

function validateMaster(
  master: MasterFile,
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
      master.componentSources,
    )
  ) {
    throw new Error(
      'componentSources is missing.',
    );
  }

  if (
    !Array.isArray(
      master.components,
    )
  ) {
    throw new Error(
      'components is missing.',
    );
  }
}

function validateRepair(
  master: MasterFile,
  report: RepairReport,
): void {
  const softwareSource =
    master.componentSources.find(
      (source) => {
        const url =
          stringOrNull(
            source.component
              .unitTableUrl,
          );

        return (
          source.component.name ===
            'Software Engineering' &&
          source.component.type ===
            'STREAM' &&
          url?.includes(
            '/streams/software/unit-of-study-table.html',
          )
        );
      },
    );

  if (!softwareSource) {
    throw new Error(
      'Software Engineering stream source was not repaired.',
    );
  }

  const softwareGroups =
    softwareSource.parsedTables.flatMap(
      (table) =>
        arrayOfObjects(
          objectOrEmpty(
            table.structure,
          ).components,
        ).flatMap(
          (component) =>
            arrayOfObjects(
              component
                .requirementGroups,
            ),
        ),
    );

  if (
    softwareGroups.length ===
    0
  ) {
    throw new Error(
      'Software Engineering has no repaired requirement groups.',
    );
  }

  const softwareUnits =
    softwareGroups.flatMap(
      (group) =>
        arrayOfObjects(
          group.units,
        ),
    );

  if (
    softwareUnits.length === 0
  ) {
    throw new Error(
      'Software Engineering has no repaired subject rows.',
    );
  }

  const streamPool =
    master.degreeComponents.find(
      (relationship) =>
        relationship
          .relationshipKind ===
          'CHOICE_POOL' &&
        relationship.data
          .degreeCode ===
          ENGINEERING_DEGREE_CODE &&
        relationship.data
          .requestedComponentType ===
          'STREAM',
    );

  if (!streamPool) {
    throw new Error(
      'BHENGINE-04 stream choice pool was not created.',
    );
  }

  const candidates =
    arrayOfObjects(
      streamPool.data
        .candidates,
    );

  if (
    candidates.length !==
    12
  ) {
    throw new Error(
      `Expected 12 BHENGINE-04 streams, found ${candidates.length}.`,
    );
  }

  console.log(
    `Software Engineering groups: ${softwareGroups.length}`,
  );

  console.log(
    `Software Engineering subject rows: ${softwareUnits.length}`,
  );

  console.log(
    `Verified Engineering streams: ${candidates.length}`,
  );

  if (
    report.unresolvedSubjectCodes
      .length > 0
  ) {
    console.warn(
      'Some Engineering table subjects are not present in the canonical Subject collection.',
    );
  }
}

function accessText(
  value: unknown,
  key: string,
): string | null {
  return stringOrNull(
    objectOrEmpty(value)[key],
  );
}

function objectOrEmpty(
  value: unknown,
): JsonObject {
  return isObject(value)
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
    !Array.isArray(value)
  );
}

function arrayOfObjects(
  value: unknown,
): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(isObject)
    : [];
}

function requiredString(
  value: unknown,
  label: string,
): string {
  const result =
    stringOrNull(value);

  if (!result) {
    throw new Error(
      `Missing ${label}.`,
    );
  }

  return result;
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
  for (const value of values) {
    const result =
      stringOrNull(value);

    if (result) {
      return result;
    }
  }

  return null;
}

function numberOrNull(
  value: unknown,
): number | null {
  return (
    typeof value ===
      'number' &&
    Number.isFinite(value)
  )
    ? value
    : null;
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

main().catch(
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);