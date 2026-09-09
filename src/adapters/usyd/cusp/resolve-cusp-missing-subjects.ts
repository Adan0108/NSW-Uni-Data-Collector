import fs from 'node:fs';
import path from 'node:path';

interface CuspSubjectRef {
  code?: string | null;
  name?: string | null;
  sourceUrl?: string | null;
}

interface CuspPlanItem {
  subjects?: CuspSubjectRef[];
}

interface CuspPlanPeriod {
  items?: CuspPlanItem[];
}

interface CuspStudyPlan {
  source?: string;
  periods?: CuspPlanPeriod[];
}

interface HandbookDegree {
  studyPlans?: CuspStudyPlan[];
  [key: string]: unknown;
}

interface ExistingSubject {
  code: string;
  [key: string]: unknown;
}

interface UsydMaster {
  degrees: HandbookDegree[];
  subjects?: ExistingSubject[];
  [key: string]: unknown;
}

interface MergeReport {
  unresolvedSubjectCodes?: string[];
}

interface SubjectCandidate {
  code: string;
  name: string | null;
  sourceUrl: string | null;
}

interface SubjectObservation {
  code: string;
  names: Set<string>;
  sourceUrls: Set<string>;
}

interface MetadataConflict {
  code: string;
  names: string[];
  sourceUrls: string[];
}

const ROOT = process.cwd();

const INPUT_MASTER_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-master-final.with-cusp.json',
);

const REPORT_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-cusp-database-merge-report.json',
);

const OUTPUT_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-master-final.with-cusp.subjects-resolved.json',
);

const RESOLUTION_REPORT_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-cusp-subject-resolution-report.json',
);

function readJson<T>(
  filePath: string,
): T {
  return JSON.parse(
    fs.readFileSync(
      filePath,
      'utf8',
    ),
  ) as T;
}

function writeJson(
  filePath: string,
  value: unknown,
): void {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    filePath,
    JSON.stringify(
      value,
      null,
      2,
    ),
    'utf8',
  );
}

function normalizeCode(
  value: string,
): string {
  return value
    .trim()
    .toUpperCase();
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function addObservation(
  observations: Map<
    string,
    SubjectObservation
  >,
  code: string,
  name:
    | string
    | null
    | undefined,
  sourceUrl:
    | string
    | null
    | undefined,
): void {
  const normalizedCode =
    normalizeCode(code);

  let observation =
    observations.get(
      normalizedCode,
    );

  if (!observation) {
    observation = {
      code:
        normalizedCode,

      names:
        new Set<string>(),

      sourceUrls:
        new Set<string>(),
    };

    observations.set(
      normalizedCode,
      observation,
    );
  }

  if (
    typeof name ===
    'string' &&
    normalizeText(name)
  ) {
    observation.names.add(
      normalizeText(name),
    );
  }

  if (
    typeof sourceUrl ===
    'string' &&
    normalizeText(sourceUrl)
  ) {
    observation.sourceUrls.add(
      normalizeText(
        sourceUrl,
      ),
    );
  }
}

/**
 * Only read real structured CUSP subject references.
 *
 * We intentionally do not inspect:
 *
 * - rawText
 * - notes
 * - arbitrary JSON text
 *
 * because those may mention alternative or advisory units
 * which are not actual fixed study-plan subjects.
 */
function collectCuspSubjectObservations(
  master: UsydMaster,
  unresolvedCodes: Set<string>,
): Map<
  string,
  SubjectObservation
> {
  const observations =
    new Map<
      string,
      SubjectObservation
    >();

  for (
    const degree of
    master.degrees
  ) {
    for (
      const plan of
      degree.studyPlans ?? []
    ) {
      if (
        plan.source !==
        'CUSP'
      ) {
        continue;
      }

      for (
        const period of
        plan.periods ?? []
      ) {
        for (
          const item of
          period.items ?? []
        ) {
          for (
            const subject of
            item.subjects ?? []
          ) {
            if (
              typeof subject.code !==
              'string' ||
              !subject.code.trim()
            ) {
              continue;
            }

            const code =
              normalizeCode(
                subject.code,
              );

            if (
              !unresolvedCodes.has(
                code,
              )
            ) {
              continue;
            }

            addObservation(
              observations,
              code,
              subject.name,
              subject.sourceUrl,
            );
          }
        }
      }
    }
  }

  return observations;
}

function chooseSingleValue(
  values: Set<string>,
): string | null {
  if (values.size === 0) {
    return null;
  }

  return [...values][0];
}

function main(): void {
  const master =
    readJson<UsydMaster>(
      INPUT_MASTER_PATH,
    );

  const report =
    readJson<MergeReport>(
      REPORT_PATH,
    );

  if (
    !Array.isArray(
      master.degrees,
    )
  ) {
    throw new Error(
      'Input master does not contain a degrees array',
    );
  }

  if (
    !Array.isArray(
      report.unresolvedSubjectCodes,
    )
  ) {
    throw new Error(
      'Merge report does not contain unresolvedSubjectCodes',
    );
  }

  if (
    !Array.isArray(
      master.subjects,
    )
  ) {
    master.subjects = [];
  }

  const unresolvedCodes =
    new Set(
      report
        .unresolvedSubjectCodes
        .map(normalizeCode),
    );

  const existingCodes =
    new Set(
      master.subjects.map(
        (subject) =>
          normalizeCode(
            subject.code,
          ),
      ),
    );

  const observations =
    collectCuspSubjectObservations(
      master,
      unresolvedCodes,
    );

  const addedSubjects:
    SubjectCandidate[] = [];

  const unresolvedAfterScan:
    string[] = [];

  const conflicts:
    MetadataConflict[] = [];

  for (
    const code of
    [...unresolvedCodes].sort()
  ) {
    /*
     * Never overwrite an existing handbook subject.
     */
    if (
      existingCodes.has(code)
    ) {
      continue;
    }

    const observation =
      observations.get(code);

    if (!observation) {
      unresolvedAfterScan.push(
        code,
      );

      continue;
    }

    /*
     * Different names or URLs for the same code should be
     * reviewed instead of silently choosing one.
     */
    if (
      observation.names.size >
      1 ||
      observation.sourceUrls.size >
      1
    ) {
      conflicts.push({
        code,

        names:
          [
            ...observation.names,
          ],

        sourceUrls:
          [
            ...observation.sourceUrls,
          ],
      });
    }

    const subject:
      SubjectCandidate = {
      code,

      name:
        chooseSingleValue(
          observation.names,
        ),

      sourceUrl:
        chooseSingleValue(
          observation.sourceUrls,
        ),
    };

    /*
     * Create only a minimal record.
     *
     * IMPORTANT:
     *
     * creditPoints is intentionally null.
     *
     * CUSP study-plan item credit points represent the slot or
     * requirement allocation. They are not authoritative subject
     * metadata.
     */
    master.subjects.push({
      code: subject.code,

      name:
        subject.name ??
        subject.code,

      creditPoints:
        null,

      description:
        null,

      sourceUrl:
        subject.sourceUrl,

      source:
        'CUSP',

      metadata: {
        resolution:
          'CUSP_STUDY_PLAN_REFERENCE',

        isMinimalRecord:
          true,

        requiresMetadataEnrichment:
          true,
      },
    });

    existingCodes.add(
      code,
    );

    addedSubjects.push(
      subject,
    );
  }

  const resolutionReport = {
    generatedAt:
      new Date().toISOString(),

    requestedUnresolvedCodes:
      unresolvedCodes.size,

    foundInCuspPlans:
      observations.size,

    addedSubjects:
      addedSubjects.length,

    unresolvedAfterScan:
      unresolvedAfterScan.length,

    conflictCount:
      conflicts.length,

    subjects:
      addedSubjects,

    conflicts,

    unresolvedCodes:
      unresolvedAfterScan,
  };

  writeJson(
    OUTPUT_PATH,
    master,
  );

  writeJson(
    RESOLUTION_REPORT_PATH,
    resolutionReport,
  );

  console.log(
    `Requested unresolved codes: ${unresolvedCodes.size}`,
  );

  console.log(
    `Found in structured CUSP subjects: ${observations.size}`,
  );

  console.log(
    `Added minimal subject records: ${addedSubjects.length}`,
  );

  console.log(
    `Unresolved after scan: ${unresolvedAfterScan.length}`,
  );

  console.log(
    `Metadata conflicts: ${conflicts.length}`,
  );

  console.log(
    `Saved resolved master to ${OUTPUT_PATH}`,
  );

  console.log(
    `Saved resolution report to ${RESOLUTION_REPORT_PATH}`,
  );
}

main();