import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

interface UnitRow {
  code?: string;
  title?: string;
  creditPoints?: number | null;
  sourceUrl?: string | null;
  section?: string | null;
}

interface ParsedTable {
  url?: string;
  units?: UnitRow[];
}

interface ComponentSource {
  component?: JsonObject;
  parsedTables?: ParsedTable[];
}

interface MasterFile {
  university: {
    code: string;
    name: string;
  };

  handbookYear: number;

  subjects: JsonObject[];
  componentSources: ComponentSource[];

  metadata: JsonObject & {
    counts?: Record<string, number>;
  };

  [key: string]: unknown;
}

interface SubjectEvidence {
  code: string;
  name: string;
  creditPoints: number | null;
  sourceUrl: string | null;

  sources: Array<{
    componentName: string | null;
    componentType: string | null;
    section: string | null;
    tableUrl: string | null;
  }>;
}

interface ResolutionReport {
  generatedAt: string;

  requestedCodes: string[];

  alreadyPresent: string[];

  addedSubjects: Array<{
    code: string;
    name: string;
    creditPoints: number | null;
    sourceUrl: string | null;
    evidenceCount: number;
  }>;

  remainingUnresolved: string[];

  conflicts: Array<{
    code: string;
    field: string;
    values: unknown[];
  }>;
}

const INPUT_FILE = resolve(
  process.cwd(),
  'data/normalized/usyd/2026/usyd-master-final.engineering-repaired.json',
);

const OUTPUT_FILE = resolve(
  process.cwd(),
  'data/normalized/usyd/2026/usyd-master-final.engineering-repaired.subjects-resolved.json',
);

const REPORT_FILE = resolve(
  process.cwd(),
  'data/normalized/usyd/2026/usyd-engineering-subject-resolution-report.json',
);

const REQUIRED_CODES = [
  'AERO5500',
  'AMME4912',
  'BMET4790',
  'BMET5996',
  'CHNG5607',
  'ELEC5760',
] as const;

async function main(): Promise<void> {
  const master =
    await readJson<MasterFile>(
      INPUT_FILE,
    );

  validateMaster(master);

  const requested =
    new Set<string>(
      REQUIRED_CODES,
    );

  const existingSubjects =
    new Map<string, JsonObject>();

  for (const subject of master.subjects) {
    const code =
      stringOrNull(
        subject.code,
      );

    if (code) {
      existingSubjects.set(
        code,
        subject,
      );
    }
  }

  const evidenceByCode =
    collectEvidence(
      master.componentSources,
      requested,
    );

  const report: ResolutionReport = {
    generatedAt:
      new Date().toISOString(),

    requestedCodes: [
      ...requested,
    ],

    alreadyPresent: [],

    addedSubjects: [],

    remainingUnresolved: [],

    conflicts: [],
  };

  /*
   * Validate all duplicate source appearances first.
   *
   * The same subject can legitimately appear in several stream /
   * specialisation tables, but its canonical title and CP should agree.
   */
  for (const code of requested) {
    const evidence =
      evidenceByCode.get(code);

    if (!evidence) {
      continue;
    }

    const names =
      unique(
        evidence.sources
          .map(() => evidence.name)
          .filter(Boolean),
      );

    if (names.length > 1) {
      report.conflicts.push({
        code,
        field: 'name',
        values: names,
      });
    }

    /*
     * creditPoints is already canonicalised while evidence is collected,
     * but retain the explicit validation boundary here so conflicts become
     * hard failures if the collector changes later.
     */
    if (
      evidence.creditPoints !== null &&
      (
        !Number.isFinite(
          evidence.creditPoints,
        ) ||
        evidence.creditPoints < 0
      )
    ) {
      report.conflicts.push({
        code,
        field: 'creditPoints',
        values: [
          evidence.creditPoints,
        ],
      });
    }
  }

  if (report.conflicts.length > 0) {
    throw new Error(
      `Engineering subject metadata conflicts found: ${JSON.stringify(
        report.conflicts,
        null,
        2,
      )}`,
    );
  }

  for (const code of requested) {
    if (existingSubjects.has(code)) {
      report.alreadyPresent.push(
        code,
      );

      continue;
    }

    const evidence =
      evidenceByCode.get(code);

    if (!evidence) {
      report.remainingUnresolved.push(
        code,
      );

      continue;
    }

    master.subjects.push({
      code:
        evidence.code,

      name:
        evidence.name,

      creditPoints:
        evidence.creditPoints,

      description:
        null,

      year:
        2026,

      studyLevel:
        'Undergraduate',

      academicUnit:
        null,

      managingFaculty:
        null,

      sourceUrl:
        evidence.sourceUrl,

      accessConditions:
        {},

      learningOutcomes:
        [],

      availabilities:
        [],

      source:
        'USYD_ENGINEERING_COMPONENT_TABLE',

      metadata: {
        resolution:
          'ENGINEERING_COMPONENT_TABLE_REFERENCE',

        isMinimalRecord:
          true,

        requiresMetadataEnrichment:
          true,

        evidenceCount:
          evidence.sources.length,

        evidence:
          evidence.sources,
      },
    });

    existingSubjects.set(
      code,
      master.subjects[
        master.subjects.length - 1
      ],
    );

    report.addedSubjects.push({
      code:
        evidence.code,

      name:
        evidence.name,

      creditPoints:
        evidence.creditPoints,

      sourceUrl:
        evidence.sourceUrl,

      evidenceCount:
        evidence.sources.length,
    });
  }

  /*
   * Final check: every requested code must now exist in canonical subjects.
   */
  report.remainingUnresolved =
    REQUIRED_CODES.filter(
      (code) =>
        !existingSubjects.has(code),
    );

  if (
    report.remainingUnresolved.length >
    0
  ) {
    throw new Error(
      `Engineering subject references remain unresolved: ${report.remainingUnresolved.join(
        ', ',
      )}`,
    );
  }

  /*
   * Update only metadata counts that this step actually changes.
   */
  master.metadata.counts = {
    ...(master.metadata.counts ?? {}),

    subjects:
      master.subjects.length,
  };

  validateResolvedSubjects(
    master,
  );

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
    'USYD ENGINEERING SUBJECT RESOLUTION',
  );

  console.log(
    '================================',
  );

  console.log(
    `Requested codes: ${REQUIRED_CODES.length}`,
  );

  console.log(
    `Already present: ${report.alreadyPresent.length}`,
  );

  console.log(
    `Added minimal subjects: ${report.addedSubjects.length}`,
  );

  console.log(
    `Remaining unresolved: ${report.remainingUnresolved.length}`,
  );

  console.log(
    `Metadata conflicts: ${report.conflicts.length}`,
  );

  console.log(
    `Canonical subjects: ${master.subjects.length}`,
  );

  console.log(
    `Saved resolved master: ${OUTPUT_FILE}`,
  );

  console.log(
    `Saved report: ${REPORT_FILE}`,
  );
}

function collectEvidence(
  sources: ComponentSource[],
  wanted: Set<string>,
): Map<string, SubjectEvidence> {
  const rows =
    new Map<
      string,
      {
        names: Set<string>;
        creditPoints: Set<number>;
        sourceUrls: Set<string>;
        sources: SubjectEvidence['sources'];
      }
    >();

  for (const source of sources) {
    const component =
      objectOrEmpty(
        source.component,
      );

    const componentName =
      stringOrNull(
        component.name,
      );

    const componentType =
      stringOrNull(
        component.type,
      );

    for (
      const table of
      source.parsedTables ?? []
    ) {
      const tableUrl =
        stringOrNull(
          table.url,
        );

      for (
        const unit of
        table.units ?? []
      ) {
        const code =
          stringOrNull(
            unit.code,
          );

        if (
          !code ||
          !wanted.has(code)
        ) {
          continue;
        }

        const title =
          stringOrNull(
            unit.title,
          );

        if (!title) {
          throw new Error(
            `Engineering subject ${code} has no title.`,
          );
        }

        const current =
          rows.get(code) ?? {
            names:
              new Set<string>(),

            creditPoints:
              new Set<number>(),

            sourceUrls:
              new Set<string>(),

            sources: [],
          };

        current.names.add(
          title,
        );

        const cp =
          numberOrNull(
            unit.creditPoints,
          );

        if (cp !== null) {
          current.creditPoints.add(
            cp,
          );
        }

        const sourceUrl =
          firstString(
            unit.sourceUrl,
            tableUrl,
          );

        if (sourceUrl) {
          current.sourceUrls.add(
            sourceUrl,
          );
        }

        current.sources.push({
          componentName,
          componentType,

          section:
            stringOrNull(
              unit.section,
            ),

          tableUrl,
        });

        rows.set(
          code,
          current,
        );
      }
    }
  }

  const result =
    new Map<
      string,
      SubjectEvidence
    >();

  for (
    const [
      code,
      record,
    ] of rows
  ) {
    if (
      record.names.size !== 1
    ) {
      throw new Error(
        `Subject ${code} has conflicting titles: ${[
          ...record.names,
        ].join(' | ')}`,
      );
    }

    if (
      record.creditPoints.size > 1
    ) {
      throw new Error(
        `Subject ${code} has conflicting credit points: ${[
          ...record.creditPoints,
        ].join(', ')}`,
      );
    }

    result.set(
      code,
      {
        code,

        name:
          [...record.names][0],

        creditPoints:
          record.creditPoints.size === 1
            ? [...record.creditPoints][0]
            : null,

        sourceUrl:
          [...record.sourceUrls][0] ??
          null,

        sources:
          dedupeEvidenceSources(
            record.sources,
          ),
      },
    );
  }

  return result;
}

function dedupeEvidenceSources(
  sources:
    SubjectEvidence['sources'],
): SubjectEvidence['sources'] {
  const result =
    new Map<
      string,
      SubjectEvidence['sources'][number]
    >();

  for (const source of sources) {
    const key =
      JSON.stringify([
        source.componentName,
        source.componentType,
        source.section,
        source.tableUrl,
      ]);

    if (!result.has(key)) {
      result.set(
        key,
        source,
      );
    }
  }

  return [
    ...result.values(),
  ];
}

function validateMaster(master: MasterFile): void {
  if (master.university?.code !== 'USYD') {
    throw new Error(
      `Expected USYD master, found ${master.university?.code ?? 'unknown'}`,
    );
  }

  if (master.handbookYear !== 2026) {
    throw new Error(
      `Expected handbook year 2026, found ${master.handbookYear}`,
    );
  }

  if (!Array.isArray(master.subjects)) {
    throw new Error('subjects is missing or is not an array.');
  }

  if (!Array.isArray(master.componentSources)) {
    throw new Error('componentSources is missing or is not an array.');
  }
}

function validateResolvedSubjects(
  master: MasterFile,
): void {
  const byCode =
    new Map<string, JsonObject>();

  for (const subject of master.subjects) {
    const code =
      requiredString(
        subject.code,
        'subject.code',
      );

    const name =
      requiredString(
        subject.name,
        `${code}.name`,
      );

    if (!name) {
      throw new Error(
        `${code} has no name.`,
      );
    }

    if (byCode.has(code)) {
      throw new Error(
        `Duplicate canonical subject code: ${code}`,
      );
    }

    byCode.set(
      code,
      subject,
    );
  }

  for (
    const code of
    REQUIRED_CODES
  ) {
    const subject =
      byCode.get(code);

    if (!subject) {
      throw new Error(
        `Missing resolved Engineering subject: ${code}`,
      );
    }

    const cp =
      numberOrNull(
        subject.creditPoints,
      );

    /*
     * All six rows in the current Engineering tables explicitly carry 6 CP.
     * This protects us from accidentally inserting contextual group CP.
     */
    if (cp !== 6) {
      throw new Error(
        `${code}: expected canonical 6 CP from collected unit row, found ${String(
          subject.creditPoints,
        )}.`,
      );
    }
  }
}

function unique<T>(
  values: T[],
): T[] {
  return [
    ...new Set(values),
  ];
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