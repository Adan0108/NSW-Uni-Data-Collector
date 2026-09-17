import {
  readFile,
  writeFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

import {
  fetchUsydUnit,
} from '../usyd.unit-parser';

import {
  parseUsydRequisite,
} from '../usyd.requisite-parser';

type JsonObject =
  Record<string, unknown>;

interface SubjectRecord
  extends JsonObject {
  code?: string;

  name?: string;

  accessConditions?: JsonObject;

  sourceUrl?: string;
}

interface ComponentSource
  extends JsonObject {
  component?: JsonObject;

  parsedTables?: Array<
    JsonObject & {
      url?: string;

      units?: JsonObject[];
    }
  >;
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

  subjectAccessConditions:
    JsonObject[];

  subjectRequisites:
    JsonObject[];

  unresolvedSubjectDetails:
    JsonObject[];

  metadata:
    JsonObject & {
      counts?: Record<
        string,
        number
      >;
    };
}

interface PhysicalUnitFallback {
  code:
    string;

  name:
    string;

  creditPoints:
    number | null;

  sourceUrl:
    string;

  tableUrl:
    string;
}

interface ResolutionResult {
  code:
    string;

  mode:
    'UNIT_PAGE' |
    'TABLE_FALLBACK';

  sourceUrl:
    string;

  error?:
    string;
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
      'usyd-master-final.engineering-repaired.subjects-resolved.before-table-s-subject-resolution.json',
  );

const REPORT_FILE =
  resolve(
    process.cwd(),

    'data/normalized/usyd/2026/' +
      'usyd-table-s-missing-subject-resolution-report.json',
  );

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

  const canonicalCodes =
    new Set(
      master.subjects
        .map(
          (
            subject,
          ) =>
            stringOrNull(
              subject.code,
            )
              ?.toUpperCase(),
        )
        .filter(
          (
            code,
          ): code is string =>
            Boolean(
              code,
            ),
        ),
    );

  const tableSUnits =
    collectTableSPhysicalUnits(
      master.componentSources,
    );

  const missing =
    [
      ...tableSUnits.keys(),
    ]
      .filter(
        (
          code,
        ) =>
          !canonicalCodes.has(
            code,
          ),
      )
      .sort();

  console.log(
    '========================================',
  );

  console.log(
    'USYD TABLE S MISSING SUBJECT RESOLUTION',
  );

  console.log(
    '========================================',
  );

  console.log(
    `Table S physical subjects: ${tableSUnits.size}`,
  );

  console.log(
    `Missing canonical subjects: ${missing.length}`,
  );

  if (
    missing.length ===
    0
  ) {
    console.log(
      'Nothing to resolve.',
    );

    return;
  }

  console.log(
    missing.join(
      ', ',
    ),
  );

  const results:
    ResolutionResult[] =
    [];

  /*
   * Deliberately sequential / low pressure.
   *
   * We only have a small targeted supplement and do not need
   * to hammer the handbook server.
   */
  for (
    let index = 0;
    index <
    missing.length;
    index += 1
  ) {
    const code =
      missing[
        index
      ];

    console.log(
      `Resolving ${index + 1}/${missing.length}: ${code}`,
    );

    const fallback =
      tableSUnits.get(
        code,
      );

    if (
      !fallback
    ) {
      throw new Error(
        `Missing Table S physical fallback for ${code}.`,
      );
    }

    try {
      const unit =
        await fetchUsydUnit(
          code,
        );

      /*
       * Full official unit-page record.
       */
      master.subjects.push(
        unit as unknown as
          SubjectRecord,
      );

      addAccessCondition(
        master,
        code,
        unit.name,
        unit.accessConditions,
      );

      addRequisites(
        master,
        code,
        unit.accessConditions,
      );

      removeUnresolvedReference(
        master,
        code,
      );

      results.push({
        code,

        mode:
          'UNIT_PAGE',

        sourceUrl:
          unit.sourceUrl,
      });
    } catch (
      error
    ) {
      /*
       * Some 2026 Table S rows can point at units whose standalone
       * /units/<CODE> page is unavailable.
       *
       * The actual handbook Table S row is still authoritative
       * evidence that the unit belongs to the pool, so preserve a
       * minimal canonical record instead of silently dropping it.
       */
      const message =
        errorMessage(
          error,
        );

      const partial:
        SubjectRecord =
        {
          code:
            fallback.code,

          name:
            fallback.name,

          year:
            2026,

          studyLevel:
            inferStudyLevel(
              fallback.code,
            ),

          academicUnit:
            null,

          managingFaculty:
            null,

          creditPoints:
            fallback.creditPoints,

          description:
            null,

          accessConditions: {
            prerequisite:
              null,

            corequisite:
              null,

            prohibition:
              null,

            assumedKnowledge:
              null,
          },

          availabilities:
            [],

          learningOutcomes:
            [],

          sourceUrl:
            fallback.sourceUrl,

          detailStatus:
            'TABLE_BACKED_PARTIAL',

          detailFailure:
            message,

          membershipEvidence: {
            table:
              'Table S',

            tableUrl:
              fallback.tableUrl,

            authoritative:
              true,
          },
        };

      master.subjects.push(
        partial,
      );

      /*
       * Keep an unresolved-detail record because the canonical
       * identity/membership is known but full unit-page details
       * could not be obtained.
       */
      upsertUnresolvedReference(
        master,
        {
          code,

          url:
            `https://www.sydney.edu.au/units/${code}`,

          error:
            message,

          status:
            'TABLE_BACKED_PARTIAL',

          fallbackSourceUrl:
            fallback.sourceUrl,

          tableUrl:
            fallback.tableUrl,
        },
      );

      results.push({
        code,

        mode:
          'TABLE_FALLBACK',

        sourceUrl:
          fallback.sourceUrl,

        error:
          message,
      });
    }
  }

  /*
   * ----------------------------------------------------------
   * FINAL DEDUPE / SORT
   * ----------------------------------------------------------
   */

  master.subjects =
    dedupeSubjects(
      master.subjects,
    );

  master.subjectAccessConditions =
    dedupeByUnitCode(
      master.subjectAccessConditions,
    );

  master.subjectRequisites =
    dedupeRequisites(
      master.subjectRequisites,
    );

  master.unresolvedSubjectDetails =
    dedupeUnresolved(
      master.unresolvedSubjectDetails,
    );

  /*
   * ----------------------------------------------------------
   * VALIDATE ALL TABLE S CODES NOW EXIST
   * ----------------------------------------------------------
   */

  const finalCodes =
    new Set(
      master.subjects
        .map(
          (
            subject,
          ) =>
            stringOrNull(
              subject.code,
            )
              ?.toUpperCase(),
        )
        .filter(
          (
            code,
          ): code is string =>
            Boolean(
              code,
            ),
        ),
    );

  const stillMissing =
    [
      ...tableSUnits.keys(),
    ].filter(
      (
        code,
      ) =>
        !finalCodes.has(
          code,
        ),
    );

  if (
    stillMissing.length >
    0
  ) {
    throw new Error(
      `Table S subjects are still missing after resolution: ${stillMissing.join(', ')}`,
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
    master.subjectAccessConditions.length;

  counts.requisiteRules =
    master.subjectRequisites.length;

  counts.unresolvedSubjects =
    master.unresolvedSubjectDetails.length;

  master.metadata.counts =
    counts;

  const full =
    results.filter(
      (
        result,
      ) =>
        result.mode ===
        'UNIT_PAGE',
    );

  const fallback =
    results.filter(
      (
        result,
      ) =>
        result.mode ===
        'TABLE_FALLBACK',
    );

  await writeJson(
    OUTPUT_FILE,
    master,
  );

  await writeJson(
    REPORT_FILE,
    {
      generatedAt:
        new Date()
          .toISOString(),

      missingBefore:
        missing.length,

      resolvedFromUnitPages:
        full.length,

      tableBackedPartial:
        fallback.length,

      stillMissing:
        stillMissing.length,

      results,
    },
  );

  console.log(
    '----------------------------------------',
  );

  console.log(
    `Resolved from official unit pages: ${full.length}`,
  );

  console.log(
    `Table-backed partial records: ${fallback.length}`,
  );

  console.log(
    `Still missing: ${stillMissing.length}`,
  );

  console.log(
    `Canonical subjects now: ${master.subjects.length}`,
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
 * TABLE S PHYSICAL MEMBERSHIP
 * ============================================================
 */

function collectTableSPhysicalUnits(
  componentSources:
    ComponentSource[],
):
Map<
  string,
  PhysicalUnitFallback
> {
  const result =
    new Map<
      string,
      PhysicalUnitFallback
    >();

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

      if (
        !componentIsTableS &&
        !(
          tableUrl &&
          isTableSUrl(
            tableUrl,
          )
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

      for (
        const unit
        of units
      ) {
        const code =
          firstString(
            unit.code,
            unit.subjectCode,
          )
            ?.toUpperCase();

        const name =
          firstString(
            unit.title,
            unit.name,
          );

        if (
          !code ||
          !name
        ) {
          continue;
        }

        const sourceUrl =
          firstString(
            unit.sourceUrl,
            tableUrl,
          );

        if (
          !sourceUrl ||
          !tableUrl
        ) {
          continue;
        }

        if (
          !result.has(
            code,
          )
        ) {
          result.set(
            code,
            {
              code,

              name,

              creditPoints:
                numberOrNull(
                  unit.creditPoints,
                ),

              sourceUrl,

              tableUrl,
            },
          );
        }
      }
    }
  }

  return result;
}

function isTableSUrl(
  value:
    string,
):
boolean {
  return value
    .toLowerCase()
    .includes(
      TABLE_S_PATH,
    );
}

/*
 * ============================================================
 * ACCESS CONDITIONS / REQUISITES
 * ============================================================
 */

function addAccessCondition(
  master:
    MasterFile,

  code:
    string,

  name:
    string,

  conditions: {
    prerequisite:
      string | null;

    corequisite:
      string | null;

    prohibition:
      string | null;

    assumedKnowledge:
      string | null;
  },
): void {
  const hasAny =
    Boolean(
      stringOrNull(
        conditions.prerequisite,
      ) ||
      stringOrNull(
        conditions.corequisite,
      ) ||
      stringOrNull(
        conditions.prohibition,
      ) ||
      stringOrNull(
        conditions.assumedKnowledge,
      ),
    );

  if (
    !hasAny
  ) {
    return;
  }

  master.subjectAccessConditions =
    master.subjectAccessConditions
      .filter(
        (
          entry,
        ) =>
          stringOrNull(
            entry.unitCode,
          )
            ?.toUpperCase() !==
          code,
      );

  master.subjectAccessConditions.push({
    unitCode:
      code,

    unitName:
      name,

    prerequisite:
      stringOrNull(
        conditions.prerequisite,
      ),

    corequisite:
      stringOrNull(
        conditions.corequisite,
      ),

    prohibition:
      stringOrNull(
        conditions.prohibition,
      ),

    assumedKnowledge:
      stringOrNull(
        conditions.assumedKnowledge,
      ),
  });
}

function addRequisites(
  master:
    MasterFile,

  code:
    string,

  conditions: {
    prerequisite:
      string | null;

    corequisite:
      string | null;

    prohibition:
      string | null;

    assumedKnowledge:
      string | null;
  },
): void {
  master.subjectRequisites =
    master.subjectRequisites
      .filter(
        (
          entry,
        ) =>
          stringOrNull(
            entry.unitCode,
          )
            ?.toUpperCase() !==
          code,
      );

  const rules:
    Array<{
      type:
        'PREREQUISITE' |
        'COREQUISITE' |
        'PROHIBITION';

      rawText:
        string | null;
    }> =
    [
      {
        type:
          'PREREQUISITE',

        rawText:
          stringOrNull(
            conditions.prerequisite,
          ),
      },

      {
        type:
          'COREQUISITE',

        rawText:
          stringOrNull(
            conditions.corequisite,
          ),
      },

      {
        type:
          'PROHIBITION',

        rawText:
          stringOrNull(
            conditions.prohibition,
          ),
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
      continue;
    }

    master.subjectRequisites.push({
      unitCode:
        code,

      type:
        rule.type,

      rawText:
        rule.rawText,

      authoritative:
        !parsed.containsUnparsedText,

      containsUnparsedText:
        parsed.containsUnparsedText,

      parsed,
    });
  }
}

/*
 * ============================================================
 * UNRESOLVED DETAILS
 * ============================================================
 */

function removeUnresolvedReference(
  master:
    MasterFile,

  code:
    string,
): void {
  master.unresolvedSubjectDetails =
    master.unresolvedSubjectDetails
      .filter(
        (
          entry,
        ) =>
          stringOrNull(
            entry.code,
          )
            ?.toUpperCase() !==
          code,
      );
}

function upsertUnresolvedReference(
  master:
    MasterFile,

  value:
    JsonObject,
): void {
  const code =
    requiredString(
      value.code,
      'unresolved subject code',
    ).toUpperCase();

  master.unresolvedSubjectDetails =
    master.unresolvedSubjectDetails
      .filter(
        (
          entry,
        ) =>
          stringOrNull(
            entry.code,
          )
            ?.toUpperCase() !==
          code,
      );

  master.unresolvedSubjectDetails.push(
    value,
  );
}

/*
 * ============================================================
 * DEDUPE
 * ============================================================
 */

function dedupeSubjects(
  subjects:
    SubjectRecord[],
):
SubjectRecord[] {
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
      requiredString(
        subject.code,
        'subject code',
      ).toUpperCase();

    result.set(
      code,
      subject,
    );
  }

  return [
    ...result.values(),
  ].sort(
    (
      left,
      right,
    ) =>
      requiredString(
        left.code,
        'subject code',
      ).localeCompare(
        requiredString(
          right.code,
          'subject code',
        ),
      ),
  );
}

function dedupeByUnitCode(
  values:
    JsonObject[],
):
JsonObject[] {
  const result =
    new Map<
      string,
      JsonObject
    >();

  const withoutCode:
    JsonObject[] =
    [];

  for (
    const value
    of values
  ) {
    const code =
      stringOrNull(
        value.unitCode,
      )
        ?.toUpperCase();

    if (
      !code
    ) {
      withoutCode.push(
        value,
      );

      continue;
    }

    result.set(
      code,
      value,
    );
  }

  return [
    ...result.values(),
    ...withoutCode,
  ];
}

function dedupeRequisites(
  values:
    JsonObject[],
):
JsonObject[] {
  const result =
    new Map<
      string,
      JsonObject
    >();

  for (
    const value
    of values
  ) {
    const code =
      stringOrNull(
        value.unitCode,
      )
        ?.toUpperCase();

    const type =
      stringOrNull(
        value.type,
      );

    const raw =
      stringOrNull(
        value.rawText,
      );

    if (
      !code ||
      !type ||
      !raw
    ) {
      continue;
    }

    result.set(
      `${code}|${type}|${raw}`,
      value,
    );
  }

  return [
    ...result.values(),
  ];
}

function dedupeUnresolved(
  values:
    JsonObject[],
):
JsonObject[] {
  const result =
    new Map<
      string,
      JsonObject
    >();

  const withoutCode:
    JsonObject[] =
    [];

  for (
    const value
    of values
  ) {
    const code =
      stringOrNull(
        value.code,
      )
        ?.toUpperCase();

    if (
      !code
    ) {
      withoutCode.push(
        value,
      );

      continue;
    }

    result.set(
      code,
      value,
    );
  }

  return [
    ...result.values(),
    ...withoutCode,
  ];
}

/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function inferStudyLevel(
  code:
    string,
):
string | null {
  const match =
    code.match(
      /^[A-Z]{4}(\d)/,
    );

  if (
    !match
  ) {
    return null;
  }

  const level =
    Number(
      match[1],
    );

  if (
    level >=
      1 &&
    level <=
      4
  ) {
    return 'Undergraduate';
  }

  return null;
}

function validateMaster(
  master:
    MasterFile,
): void {
  if (
    master.university
      ?.code !==
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
      master.subjectAccessConditions,
    ) ||
    !Array.isArray(
      master.subjectRequisites,
    ) ||
    !Array.isArray(
      master.unresolvedSubjectDetails,
    )
  ) {
    throw new Error(
      'USYD master is missing required arrays.',
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

function errorMessage(
  error:
    unknown,
):
string {
  return error instanceof
    Error
    ? error.message
    : String(
        error,
      );
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