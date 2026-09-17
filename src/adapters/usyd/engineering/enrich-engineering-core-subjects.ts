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

import {
  fetchUsydUnit,
} from '../usyd.unit-parser';

import {
  parseUsydRequisite,
  type UsydParsedRequisite,
} from '../usyd.requisite-parser';

import type {
  UsydUnit,
} from '../usyd.types';

type JsonObject =
  Record<string, unknown>;

type RequisiteType =
  | 'PREREQUISITE'
  | 'COREQUISITE'
  | 'PROHIBITION';

interface MasterAccessCondition {
  unitCode: string;

  prerequisite:
    string | null;

  corequisite:
    string | null;

  prohibition:
    string | null;

  assumedKnowledge:
    string | null;

  [key: string]:
    unknown;
}

interface MasterRequisiteRule {
  unitCode: string;

  type:
    RequisiteType;

  rawText:
    string;

  authoritative:
    boolean;

  containsUnparsedText:
    boolean;

  parsed:
    UsydParsedRequisite;

  [key: string]:
    unknown;
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

  subjects:
    JsonObject[];

  subjectAccessConditions:
    MasterAccessCondition[];

  subjectRequisites:
    MasterRequisiteRule[];

  unresolvedSubjectDetails?:
    JsonObject[];

  [key: string]:
    unknown;
}

interface EnrichmentFailure {
  code:
    string;

  unitUrl:
    string;

  tableTitle:
    string;

  tableCreditPoints:
    number | null;

  error:
    string;
}

interface EnrichmentReport {
  generatedAt:
    string;

  sourceUrl:
    string;

  discoveredCoreCodes:
    number;

  candidatesForEnrichment:
    number;

  enriched:
    string[];

  partialTableBacked:
    string[];

  alreadyComplete:
    string[];

  failures:
    EnrichmentFailure[];
}

const INPUT_FILE =
  resolve(
    process.cwd(),

    'data/normalized/usyd/2026/' +
      'usyd-master-final.engineering-repaired.subjects-resolved.json',
  );

/*
 * This stage enriches the existing canonical Engineering master
 * in place.
 *
 * The following stage:
 *
 * repair:usyd:engineering-course-structure
 *
 * already reads the same filename.
 */
const OUTPUT_FILE =
  INPUT_FILE;

const BACKUP_FILE =
  resolve(
    process.cwd(),

    'data/normalized/usyd/2026/' +
      'usyd-master-final.engineering-repaired.subjects-resolved.before-core-enrichment.json',
  );

const REPORT_FILE =
  resolve(
    process.cwd(),

    'data/normalized/usyd/2026/' +
      'usyd-engineering-core-subject-enrichment-report.json',
  );

const ENGINEERING_CORE_URL =
  'https://www.sydney.edu.au/handbooks/engineering/engineering-honours/core-unit-of-study-table.html';

const HANDBOOK_YEAR =
  2026;

/*
 * Small concurrency keeps the request load conservative.
 */
const CONCURRENCY =
  4;

async function main():
Promise<void> {
  console.log(
    '========================================',
  );

  console.log(
    'USYD ENGINEERING CORE SUBJECT ENRICHMENT',
  );

  console.log(
    '========================================',
  );

  const master =
    await readJson<MasterFile>(
      INPUT_FILE,
    );

  validateMaster(
    master,
  );

  /*
   * Preserve the exact pre-enrichment state.
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

  console.log(
    'Fetching official Engineering Core table...',
  );

  const coreTable =
    await fetchUsydGlobalUnitTable(
      ENGINEERING_CORE_URL,
    );

  /*
   * The same subject can occur multiple times in an official
   * table. Collapse by code while preserving the best table
   * metadata available.
   */
  const tableUnitByCode =
    buildCoreUnitMap(
      coreTable.units,
    );

  const subjectByCode =
    buildSubjectMap(
      master.subjects,
    );

  const missingCanonicalCodes:
    string[] =
    [];

  for (
    const code
    of tableUnitByCode.keys()
  ) {
    if (
      !subjectByCode.has(
        code,
      )
    ) {
      missingCanonicalCodes.push(
        code,
      );
    }
  }

  /*
   * Course Structure must never silently manufacture a new
   * canonical Subject.
   *
   * Missing identity belongs to the earlier missing-subject
   * resolution stages.
   */
  if (
    missingCanonicalCodes.length >
    0
  ) {
    throw new Error(
      [
        'Engineering Core contains subjects missing from',
        'the canonical subject collection:',
        missingCanonicalCodes
          .sort()
          .join(', '),
      ].join(
        ' ',
      ),
    );
  }

  const candidates:
    Array<{
      code: string;
      subject: JsonObject;
      tableUnit: UsydGlobalTableUnit;
    }> =
    [];

  const alreadyComplete:
    string[] =
    [];

  for (
    const [
      code,
      tableUnit,
    ] of tableUnitByCode
  ) {
    const subject =
      subjectByCode.get(
        code,
      );

    if (
      !subject
    ) {
      continue;
    }

    if (
      needsOfficialEnrichment(
        subject,
        tableUnit,
      )
    ) {
      candidates.push({
        code,
        subject,
        tableUnit,
      });
    } else {
      alreadyComplete.push(
        code,
      );
    }
  }

  console.log(
    `Unique Engineering Core codes: ${tableUnitByCode.size}`,
  );

  console.log(
    `Subjects requiring enrichment: ${candidates.length}`,
  );

  console.log(
    `Already complete: ${alreadyComplete.length}`,
  );

  const enrichedUnits =
    new Map<
      string,
      UsydUnit
    >();

  const failures:
    EnrichmentFailure[] =
    [];

  /*
   * Fetch only the incomplete canonical subjects.
   *
   * We deliberately do NOT rerun the full ~3000 subject
   * collector.
   */
  for (
    let start = 0;
    start <
    candidates.length;
    start +=
    CONCURRENCY
  ) {
    const batch =
      candidates.slice(
        start,
        start +
          CONCURRENCY,
      );

    console.log(
      `Fetching ${start + 1}-` +
      `${Math.min(
        start +
          batch.length,
        candidates.length,
      )}/${candidates.length}`,
    );

    const results =
      await Promise.all(
        batch.map(
          async (
            candidate,
          ) => {
            try {
              const unit =
                await fetchUsydUnit(
                  candidate.code,
                );

              if (
                unit.code !==
                candidate.code
              ) {
                throw new Error(
                  `Requested ${candidate.code}, received ${unit.code}`,
                );
              }

              return {
                ok:
                  true as const,

                candidate,

                unit,
              };
            } catch (
              error
            ) {
              return {
                ok:
                  false as const,

                candidate,

                error:
                  errorMessage(
                    error,
                  ),
              };
            }
          },
        ),
      );

    for (
      const result
      of results
    ) {
      if (
        result.ok
      ) {
        enrichedUnits.set(
          result.candidate.code,
          result.unit,
        );

        continue;
      }

      failures.push({
        code:
          result.candidate.code,

        unitUrl:
          buildUnitUrl(
            result.candidate.code,
          ),

        tableTitle:
          result.candidate
            .tableUnit
            .title,

        tableCreditPoints:
          result.candidate
            .tableUnit
            .creditPoints,

        error:
          result.error,
      });
    }
  }

  /*
   * ----------------------------------------------------------
   * CANONICAL SUBJECTS
   * ----------------------------------------------------------
   */

  const partialTableBacked:
    string[] =
    [];

  const enriched:
    string[] =
    [];

  for (
    const candidate
    of candidates
  ) {
    const official =
      enrichedUnits.get(
        candidate.code,
      );

    if (
      official
    ) {
      replaceSubjectWithOfficialDetail(
        candidate.subject,
        official,
      );

      enriched.push(
        candidate.code,
      );

      continue;
    }

    /*
     * If the official /units/CODE detail page is currently
     * unavailable, retain the canonical Subject and enrich only
     * fields directly supported by the official Engineering
     * Core table.
     *
     * This is particularly important for units such as
     * ENVE4811 / ENVE4812 when their detail pages are unavailable.
     */
    applyOfficialTableFallback(
      candidate.subject,
      candidate.tableUnit,
    );

    partialTableBacked.push(
      candidate.code,
    );
  }

  /*
   * ----------------------------------------------------------
   * ACCESS CONDITIONS + REQUISITES
   * ----------------------------------------------------------
   *
   * The importer reads these global arrays separately from the
   * Subject object, so enriching subject.accessConditions alone
   * is not sufficient.
   */

  replaceAccessConditions(
    master,
    enrichedUnits,
  );

  replaceRequisiteRules(
    master,
    enrichedUnits,
  );

  /*
   * Any successfully enriched subject should no longer remain
   * in unresolvedSubjectDetails.
   */
  if (
    Array.isArray(
      master.unresolvedSubjectDetails,
    )
  ) {
    const enrichedCodes =
      new Set(
        enriched,
      );

    master.unresolvedSubjectDetails =
      master
        .unresolvedSubjectDetails
        .filter(
          (
            value,
          ) => {
            const code =
              getCode(
                value,
              );

            return (
              !code ||
              !enrichedCodes.has(
                code,
              )
            );
          },
        );
  }

  /*
   * ----------------------------------------------------------
   * METADATA
   * ----------------------------------------------------------
   */

  const counts =
    master.metadata.counts ??
    {};

  counts.subjects =
    master.subjects.length;

  counts.accessConditions =
    master
      .subjectAccessConditions
      .length;

  counts.requisiteRules =
    master
      .subjectRequisites
      .length;

  counts.authoritativeRequisiteRules =
    master
      .subjectRequisites
      .filter(
        (
          rule,
        ) =>
          rule.authoritative,
      )
      .length;

  counts.rawFallbackRequisiteRules =
    master
      .subjectRequisites
      .filter(
        (
          rule,
        ) =>
          !rule.authoritative,
      )
      .length;

  if (
    Array.isArray(
      master.unresolvedSubjectDetails,
    )
  ) {
    counts.unresolvedUnits =
      master
        .unresolvedSubjectDetails
        .length;
  }

  master.metadata.counts =
    counts;

  /*
   * ----------------------------------------------------------
   * VALIDATION
   * ----------------------------------------------------------
   */

  validateCoreSubjects(
    master,
    tableUnitByCode,
    enrichedUnits,
  );

  const report:
    EnrichmentReport = {
    generatedAt:
      new Date()
        .toISOString(),

    sourceUrl:
      ENGINEERING_CORE_URL,

    discoveredCoreCodes:
      tableUnitByCode.size,

    candidatesForEnrichment:
      candidates.length,

    enriched:
      [...enriched]
        .sort(),

    partialTableBacked:
      [
        ...partialTableBacked,
      ].sort(),

    alreadyComplete:
      [
        ...alreadyComplete,
      ].sort(),

    failures:
      [...failures]
        .sort(
          (
            left,
            right,
          ) =>
            left.code.localeCompare(
              right.code,
            ),
        ),
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
    `Official Core codes: ${tableUnitByCode.size}`,
  );

  console.log(
    `Enriched from unit pages: ${enriched.length}`,
  );

  console.log(
    `Partial table-backed: ${partialTableBacked.length}`,
  );

  console.log(
    `Already complete: ${alreadyComplete.length}`,
  );

  console.log(
    `Unit detail failures: ${failures.length}`,
  );

  if (
    failures.length >
    0
  ) {
    console.log(
      'Failed unit pages:',
    );

    for (
      const failure
      of failures
    ) {
      console.log(
        `- ${failure.code}: ${failure.error}`,
      );
    }
  }

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
 * SUBJECT DISCOVERY
 * ============================================================
 */

function buildCoreUnitMap(
  units:
    UsydGlobalTableUnit[],
):
Map<
  string,
  UsydGlobalTableUnit
> {
  const result =
    new Map<
      string,
      UsydGlobalTableUnit
    >();

  for (
    const unit
    of units
  ) {
    const code =
      normalizeCode(
        unit.code,
      );

    if (
      !/^[A-Z]{4}\d{4}$/.test(
        code,
      )
    ) {
      continue;
    }

    const existing =
      result.get(
        code,
      );

    if (
      !existing
    ) {
      result.set(
        code,
        {
          ...unit,

          code,
        },
      );

      continue;
    }

    /*
     * Prefer non-empty table metadata without destroying
     * previously discovered values.
     */
    result.set(
      code,
      {
        ...existing,

        title:
          normalizeText(
            existing.title,
          ) ||
          normalizeText(
            unit.title,
          ),

        creditPoints:
          existing.creditPoints ??
          unit.creditPoints,

        accessConditionsRaw:
          existing
            .accessConditionsRaw ??
          unit.accessConditionsRaw,

        section:
          existing.section ??
          unit.section,

        sourceUrl:
          existing.sourceUrl ||
          unit.sourceUrl,
      },
    );
  }

  return result;
}

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
      getCode(
        subject,
      );

    if (
      !code
    ) {
      continue;
    }

    if (
      result.has(
        code,
      )
    ) {
      throw new Error(
        `Duplicate canonical subject ${code}`,
      );
    }

    result.set(
      code,
      subject,
    );
  }

  return result;
}

function needsOfficialEnrichment(
  subject:
    JsonObject,

  tableUnit:
    UsydGlobalTableUnit,
): boolean {
  const metadata =
    objectOrEmpty(
      subject.metadata,
    );

  if (
    metadata
      .requiresMetadataEnrichment ===
    true
  ) {
    return true;
  }

  if (
    normalizeText(
      stringOrNull(
        subject.source,
      ) ??
      '',
    ).toUpperCase() ===
    'CUSP'
  ) {
    return true;
  }

  const sourceUrl =
    stringOrNull(
      subject.sourceUrl,
    );

  if (
    !sourceUrl ||
    !/sydney\.edu\.au\/units\/[A-Z]{4}\d{4}/i.test(
      sourceUrl,
    )
  ) {
    return true;
  }

  if (
    subject.creditPoints ===
      null ||
    subject.creditPoints ===
      undefined
  ) {
    /*
     * A table value of 0 is valid.
     */
    if (
      tableUnit.creditPoints !==
      null
    ) {
      return true;
    }
  }

  if (
    !stringOrNull(
      subject.studyLevel,
    )
  ) {
    return true;
  }

  if (
    !stringOrNull(
      subject.managingFaculty,
    )
  ) {
    return true;
  }

  return false;
}

/*
 * ============================================================
 * SUBJECT ENRICHMENT
 * ============================================================
 */

function replaceSubjectWithOfficialDetail(
  target:
    JsonObject,

  official:
    UsydUnit,
): void {
  target.code =
    official.code;

  target.name =
    official.name;

  target.year =
    official.year;

  target.studyLevel =
    official.studyLevel;

  target.academicUnit =
    official.academicUnit;

  target.managingFaculty =
    official.managingFaculty;

  /*
   * IMPORTANT:
   *
   * 0 is a valid USYD credit-point value.
   *
   * Do not use:
   *
   * official.creditPoints || ...
   */
  target.creditPoints =
    official.creditPoints;

  target.description =
    official.description;

  target.accessConditions =
    official.accessConditions;

  target.availabilities =
    official.availabilities;

  target.learningOutcomes =
    official.learningOutcomes;

  target.sourceUrl =
    official.sourceUrl;

  target.source =
    'USYD_UNIT_DETAIL';

  const previousMetadata =
    objectOrEmpty(
      target.metadata,
    );

  target.metadata = {
    ...previousMetadata,

    resolution:
      'OFFICIAL_UNIT_DETAIL',

    isMinimalRecord:
      false,

    requiresMetadataEnrichment:
      false,

    enrichedAt:
      new Date()
        .toISOString(),

    enrichmentSourceUrl:
      official.sourceUrl,
  };
}

function applyOfficialTableFallback(
  target:
    JsonObject,

  tableUnit:
    UsydGlobalTableUnit,
): void {
  const title =
    normalizeText(
      tableUnit.title,
    );

  if (
    title
  ) {
    target.name =
      title;
  }

  /*
   * Preserve canonical CP from the official table.
   *
   * Null means the table did not provide enough evidence.
   * Zero remains zero.
   */
  if (
    tableUnit.creditPoints !==
    null
  ) {
    target.creditPoints =
      tableUnit.creditPoints;
  }

  const previousMetadata =
    objectOrEmpty(
      target.metadata,
    );

  target.metadata = {
    ...previousMetadata,

    requiresMetadataEnrichment:
      true,

    isMinimalRecord:
      true,

    partialOfficialTableRecord:
      true,

    engineeringCoreTableSourceUrl:
      tableUnit.sourceUrl,

    engineeringCoreTableSection:
      tableUnit.section,

    unitDetailUrl:
      buildUnitUrl(
        tableUnit.code,
      ),

    lastEnrichmentAttemptAt:
      new Date()
        .toISOString(),
  };
}

/*
 * ============================================================
 * ACCESS CONDITIONS
 * ============================================================
 */

function replaceAccessConditions(
  master:
    MasterFile,

  officialUnits:
    Map<
      string,
      UsydUnit
    >,
): void {
  const codes =
    new Set(
      officialUnits.keys(),
    );

  /*
   * Remove stale/minimal records for successfully enriched units.
   */
  master.subjectAccessConditions =
    master
      .subjectAccessConditions
      .filter(
        (
          condition,
        ) =>
          !codes.has(
            normalizeCode(
              condition.unitCode,
            ),
          ),
      );

  for (
    const unit
    of officialUnits.values()
  ) {
    const access =
      unit.accessConditions;

    /*
     * Match existing master behaviour:
     *
     * only subjects with at least one access-condition field
     * need an entry here.
     */
    if (
      !access.prerequisite &&
      !access.corequisite &&
      !access.prohibition &&
      !access.assumedKnowledge
    ) {
      continue;
    }

    master
      .subjectAccessConditions
      .push({
        unitCode:
          unit.code,

        prerequisite:
          access.prerequisite,

        corequisite:
          access.corequisite,

        prohibition:
          access.prohibition,

        assumedKnowledge:
          access.assumedKnowledge,
      });
  }

  master
    .subjectAccessConditions
    .sort(
      (
        left,
        right,
      ) =>
        left.unitCode.localeCompare(
          right.unitCode,
        ),
    );
}

/*
 * ============================================================
 * REQUISITES
 * ============================================================
 */

function replaceRequisiteRules(
  master:
    MasterFile,

  officialUnits:
    Map<
      string,
      UsydUnit
    >,
): void {
  const codes =
    new Set(
      officialUnits.keys(),
    );

  master.subjectRequisites =
    master
      .subjectRequisites
      .filter(
        (
          rule,
        ) =>
          !codes.has(
            normalizeCode(
              rule.unitCode,
            ),
          ),
      );

  for (
    const unit
    of officialUnits.values()
  ) {
    const rules:
      Array<{
        type:
          RequisiteType;

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

      /*
       * Same behaviour as current master collector:
       * if the parser genuinely cannot return a normalized
       * requisite record, preserve the raw access condition on
       * the Subject but do not manufacture an AST.
       */
      if (
        !parsed
      ) {
        continue;
      }

      master
        .subjectRequisites
        .push({
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

  master
    .subjectRequisites
    .sort(
      (
        left,
        right,
      ) => {
        const codeCompare =
          left.unitCode.localeCompare(
            right.unitCode,
          );

        if (
          codeCompare !==
          0
        ) {
          return codeCompare;
        }

        return left.type.localeCompare(
          right.type,
        );
      },
    );
}

/*
 * ============================================================
 * VALIDATION
 * ============================================================
 */

function validateCoreSubjects(
  master:
    MasterFile,

  tableUnitByCode:
    Map<
      string,
      UsydGlobalTableUnit
    >,

  enrichedUnits:
    Map<
      string,
      UsydUnit
    >,
): void {
  const subjectByCode =
    buildSubjectMap(
      master.subjects,
    );

  for (
    const [
      code,
      tableUnit,
    ] of tableUnitByCode
  ) {
    const subject =
      subjectByCode.get(
        code,
      );

    if (
      !subject
    ) {
      throw new Error(
        `Validation: missing canonical Engineering Core subject ${code}`,
      );
    }

    /*
     * If the official table explicitly gives CP, the canonical
     * subject must no longer have null CP after this stage.
     */
    if (
      tableUnit.creditPoints !==
        null &&
      (
        subject.creditPoints ===
          null ||
        subject.creditPoints ===
          undefined
      )
    ) {
      throw new Error(
        `Validation: ${code} still has null canonical creditPoints.`,
      );
    }
  }

  /*
   * PEP is a particularly important regression case because all
   * these official subjects are zero-credit-point units.
   */
  const pepCodes =
    [
      'ENGP1001',
      'ENGP1002',
      'ENGP1003',
      'ENGP2001',
      'ENGP2002',
      'ENGP2003',
      'ENGP3001',
      'ENGP3002',
    ];

  for (
    const code
    of pepCodes
  ) {
    const subject =
      subjectByCode.get(
        code,
      );

    if (
      !subject
    ) {
      throw new Error(
        `Validation: missing PEP subject ${code}`,
      );
    }

    if (
      subject.creditPoints !==
      0
    ) {
      throw new Error(
        `Validation: ${code} must preserve official 0 CP, found ${String(
          subject.creditPoints,
        )}.`,
      );
    }
  }

  /*
   * Any subject successfully fetched from /units/CODE must now
   * point to that official detail page and must not remain marked
   * as requiring enrichment.
   */
  for (
    const [
      code,
      official,
    ] of enrichedUnits
  ) {
    const subject =
      subjectByCode.get(
        code,
      );

    if (
      !subject
    ) {
      throw new Error(
        `Validation: enriched subject ${code} disappeared.`,
      );
    }

    if (
      stringOrNull(
        subject.sourceUrl,
      ) !==
      official.sourceUrl
    ) {
      throw new Error(
        `Validation: ${code} does not use its official unit-detail source URL.`,
      );
    }

    const metadata =
      objectOrEmpty(
        subject.metadata,
      );

    if (
      metadata
        .requiresMetadataEnrichment ===
      true
    ) {
      throw new Error(
        `Validation: ${code} is still marked requiresMetadataEnrichment.`,
      );
    }
  }

  assertNoDuplicateAccessConditions(
    master
      .subjectAccessConditions,
  );

  assertNoDuplicateRequisites(
    master
      .subjectRequisites,
  );
}

function assertNoDuplicateAccessConditions(
  conditions:
    MasterAccessCondition[],
): void {
  const seen =
    new Set<string>();

  for (
    const condition
    of conditions
  ) {
    const code =
      normalizeCode(
        condition.unitCode,
      );

    if (
      seen.has(
        code,
      )
    ) {
      throw new Error(
        `Duplicate subjectAccessConditions record for ${code}`,
      );
    }

    seen.add(
      code,
    );
  }
}

function assertNoDuplicateRequisites(
  rules:
    MasterRequisiteRule[],
): void {
  const seen =
    new Set<string>();

  for (
    const rule
    of rules
  ) {
    const key =
      [
        normalizeCode(
          rule.unitCode,
        ),

        rule.type,

        normalizeText(
          rule.rawText,
        ),
      ].join(
        '::',
      );

    if (
      seen.has(
        key,
      )
    ) {
      throw new Error(
        `Duplicate subject requisite: ${key}`,
      );
    }

    seen.add(
      key,
    );
  }
}

function validateMaster(
  master:
    MasterFile,
): void {
  if (
    master.university
      ?.code !==
    'USYD'
  ) {
    throw new Error(
      'Expected USYD master file.',
    );
  }

  if (
    master.handbookYear !==
    HANDBOOK_YEAR
  ) {
    throw new Error(
      `Expected USYD ${HANDBOOK_YEAR} master file.`,
    );
  }

  if (
    !Array.isArray(
      master.subjects,
    )
  ) {
    throw new Error(
      'Master subjects array is missing.',
    );
  }

  if (
    !Array.isArray(
      master.subjectAccessConditions,
    )
  ) {
    throw new Error(
      'Master subjectAccessConditions array is missing.',
    );
  }

  if (
    !Array.isArray(
      master.subjectRequisites,
    )
  ) {
    throw new Error(
      'Master subjectRequisites array is missing.',
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

/*
 * ============================================================
 * GENERAL HELPERS
 * ============================================================
 */

function getCode(
  value:
    JsonObject,
): string | null {
  const code =
    stringOrNull(
      value.code,
    ) ??
    stringOrNull(
      value.unitCode,
    );

  if (
    !code
  ) {
    return null;
  }

  return normalizeCode(
    code,
  );
}

function buildUnitUrl(
  code:
    string,
): string {
  return (
    'https://www.sydney.edu.au/units/' +
    encodeURIComponent(
      normalizeCode(
        code,
      ),
    )
  );
}

function normalizeCode(
  value:
    string,
): string {
  return value
    .trim()
    .toUpperCase();
}

function normalizeText(
  value:
    string,
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

function stringOrNull(
  value:
    unknown,
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null;
  }

  const normalized =
    normalizeText(
      value,
    );

  return normalized ||
    null;
}

function objectOrEmpty(
  value:
    unknown,
): JsonObject {
  if (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  ) {
    return value as
      JsonObject;
  }

  return {};
}

function errorMessage(
  error:
    unknown,
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return String(
    error,
  );
}

async function readJson<T>(
  filePath:
    string,
): Promise<T> {
  const raw =
    await readFile(
      filePath,
      'utf8',
    );

  return JSON.parse(
    raw,
  ) as T;
}

async function writeJson(
  filePath:
    string,

  value:
    unknown,
): Promise<void> {
  await writeFile(
    filePath,

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
    error,
  ) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);