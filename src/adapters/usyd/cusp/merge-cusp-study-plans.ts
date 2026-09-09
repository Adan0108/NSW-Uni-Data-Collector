import fs from 'node:fs';
import path from 'node:path';

type DegreeLevel =
  | 'UNDERGRADUATE'
  | 'POSTGRADUATE'
  | 'HONOURS'
  | 'COMBINED'
  | 'DIPLOMA'
  | string;

interface HandbookStudyPlan {
  [key: string]: unknown;
}

interface HandbookDegree {
  code: string;
  title: string;
  level: DegreeLevel;
  totalCreditPoints?: number;
  studyPlans?: HandbookStudyPlan[];
  [key: string]: unknown;
}

interface HandbookSubject {
  code: string;
  [key: string]: unknown;
}

interface UsydMaster {
  degrees: HandbookDegree[];
  subjects?: HandbookSubject[];
  [key: string]: unknown;
}

interface CuspSubjectReference {
  code?: string | null;
  name?: string | null;
  sourceUrl?: string | null;
  [key: string]: unknown;
}

interface CuspStudyPlanItem {
  subjects?: CuspSubjectReference[];
  [key: string]: unknown;
}

interface CuspStudyPlanPeriod {
  items?: CuspStudyPlanItem[];
  [key: string]: unknown;
}

interface CuspStudyPlan {
  dvid?: string;
  degreeId?: string;
  cuspDegreeId?: string;

  degreeName?: string;
  cuspDegreeName?: string;

  title?: string;
  sourceUrl?: string;

  streamId?: string | null;
  streamName?: string | null;

  periods?: CuspStudyPlanPeriod[];

  [key: string]: unknown;
}

type DegreeFamily =
  | 'ADVANCED_COMPUTING'
  | 'ENGINEERING'
  | 'PROJECT_MANAGEMENT'
  | 'POSTGRADUATE'
  | 'NON_DEGREE_PATHWAY'
  | 'EXACT'
  | 'UNKNOWN';

interface DegreeResolution {
  canonicalTitle: string | null;

  family: DegreeFamily;

  discipline?: string | null;
  combinedPartner?: string | null;
  major?: string | null;

  isMidYear: boolean;

  originalName: string;
  normalizedName: string;
}

type UnmatchedReason =
  | 'NO_CUSP_DEGREE_NAME'
  | 'NO_CANONICAL_TITLE'
  | 'NO_HANDBOOK_DEGREE'
  | 'AMBIGUOUS_HANDBOOK_DEGREE';

interface UnmatchedPlan {
  dvid?: string;
  cuspDegreeId?: string;

  cuspDegreeName: string;

  title?: string;
  sourceUrl?: string;

  reason: UnmatchedReason;

  canonicalTitle?: string | null;
  family?: DegreeFamily;
}

interface OutOfScopePlan {
  dvid?: string;
  cuspDegreeId?: string;

  cuspDegreeName: string;

  title?: string;
  sourceUrl?: string;

  family:
    | 'POSTGRADUATE'
    | 'NON_DEGREE_PATHWAY';

  reason:
    | 'OUT_OF_HANDBOOK_SCOPE'
    | 'NON_DEGREE_PATHWAY';
}

interface MergeReport {
  generatedAt: string;

  cuspPlans: number;

  matchedPlans: number;
  unmatchedPlans: number;
  outOfScopePlans: number;

  matchedHandbookDegrees: number;

  handbookDegreesWithCuspPlans: Array<{
    code: string;
    title: string;
    planCount: number;
  }>;

  handbookDegreesWithoutCuspPlans: Array<{
    code: string;
    title: string;
    level: string;
  }>;

  preservedExistingPlans: number;

  unresolvedSubjectCodes: string[];

  unmatched: UnmatchedPlan[];

  outOfScope: OutOfScopePlan[];
}

const ROOT = process.cwd();

const MASTER_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-master-final.json',
);

const CUSP_PLANS_PATH = path.join(
  ROOT,
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-cusp-study-plans.v1.json',
);

const OUTPUT_PATH = path.join(
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

function readJson<T>(filePath: string): T {
  return JSON.parse(
    fs.readFileSync(filePath, 'utf8'),
  ) as T;
}

function writeJson(
  filePath: string,
  value: unknown,
): void {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });

  fs.writeFileSync(
    filePath,
    JSON.stringify(value, null, 2),
    'utf8',
  );
}

function normalizeWhitespace(
  value: string,
): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeComparable(
  value: string,
): string {
  return normalizeWhitespace(
    value
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[–—]/g, '-')
      .replace(/[(),]/g, ' ')
      .replace(/\s+/g, ' '),
  );
}

/**
 * Removes CUSP-specific naming that is not part of the
 * canonical handbook award identity.
 */
function removeCuspVersionNoise(
  value: string,
): string {
  return normalizeWhitespace(
    value
      .replace(
        /\s*-\s*mid[\s-]?year\s*$/i,
        '',
      )
      .replace(
        /\s*\(mid[\s-]?year\)\s*$/i,
        '',
      )
      .replace(
        /\s+mid[\s-]?year\s*$/i,
        '',
      )
      .replace(
        /\s+20\d{2}\+\s*$/i,
        '',
      )
      .replace(
        /\s+\(from\s+20\d{2}\)\s*$/i,
        '',
      )
      .replace(
        /\s+from\s+20\d{2}\s*$/i,
        '',
      )
      .replace(
        /\s+pre\s+20\d{2}\s*$/i,
        '',
      ),
  );
}

function getCuspDegreeName(
  plan: CuspStudyPlan,
): string {
  return normalizeWhitespace(
    plan.cuspDegreeName ??
      plan.degreeName ??
      '',
  );
}

function extractCuspPlans(
  raw: unknown,
): CuspStudyPlan[] {
  if (Array.isArray(raw)) {
    return raw as CuspStudyPlan[];
  }

  if (
    typeof raw !== 'object' ||
    raw === null
  ) {
    throw new Error(
      'usyd-cusp-study-plans.v1.json has an invalid root structure',
    );
  }

  const container =
    raw as Record<string, unknown>;

  const possibleArrays = [
    container.plans,
    container.studyPlans,
    container.items,
    container.data,
  ];

  for (const value of possibleArrays) {
    if (Array.isArray(value)) {
      return value as CuspStudyPlan[];
    }
  }

  throw new Error(
    `Cannot find CUSP plan array. Root keys: ${Object.keys(
      container,
    ).join(', ')}`,
  );
}

function engineeringCombinedTitle(
  partner: string,
): string | null {
  const normalizedPartner =
    normalizeComparable(partner);

  const partners: Array<
    [RegExp, string]
  > = [
    [
      /^arts$/,
      'Bachelor of Engineering Honours and Bachelor of Arts',
    ],
    [
      /^commerce$/,
      'Bachelor of Engineering Honours and Bachelor of Commerce',
    ],
    [
      /^science$/,
      'Bachelor of Engineering Honours and Bachelor of Science',
    ],
    [
      /^(law|laws)$/,
      'Bachelor of Engineering Honours and Bachelor of Laws',
    ],
    [
      /^project management$/,
      'Bachelor of Engineering Honours and Bachelor of Project Management',
    ],
    [
      /^design in architecture$/,
      'Bachelor of Engineering Honours and Bachelor of Design in Architecture',
    ],
  ];

  for (const [pattern, title] of partners) {
    if (pattern.test(normalizedPartner)) {
      return title;
    }
  }

  return null;
}

function advancedComputingCombinedTitle(
  partner: string,
): string | null {
  const normalizedPartner =
    normalizeComparable(partner);

  if (normalizedPartner === 'commerce') {
    return 'Bachelor of Advanced Computing and Bachelor of Commerce';
  }

  if (
    normalizedPartner === 'science' ||
    normalizedPartner ===
      'science medical science'
  ) {
    return 'Bachelor of Advanced Computing and Bachelor of Science';
  }

  return null;
}

function normalizeEngineeringCombinedPartner(
  partner: string,
): string {
  return normalizeWhitespace(
    partner
      .replace(
        /\s*\(from\s+20\d{2}\)\s*$/i,
        '',
      )
      .replace(
        /\s*-\s*mid[\s-]?year\s*$/i,
        '',
      )
      .replace(
        /\s*\(medical science(?: stream)?\)\s*$/i,
        '',
      )
      .replace(
        /\s*\(health\)\s*$/i,
        '',
      ),
  );
}

/**
 * Resolve a CUSP degree/pathway name to the canonical award
 * title used by usyd-master-final.json.
 */
function resolveCuspDegree(
  rawName: string,
  handbookDegrees: HandbookDegree[],
): DegreeResolution {
  const originalName =
    normalizeWhitespace(rawName);

  const isMidYear =
    /mid[\s-]?year/i.test(originalName);

  const normalizedName =
    removeCuspVersionNoise(originalName);

  /*
   * ---------------------------------------------------------
   * 1. Exact handbook award
   * ---------------------------------------------------------
   */
  const exactDegree =
    handbookDegrees.find(
      (degree) =>
        normalizeComparable(
          degree.title,
        ) ===
        normalizeComparable(
          normalizedName,
        ),
    );

  if (exactDegree) {
    return {
      canonicalTitle:
        exactDegree.title,

      family: 'EXACT',

      discipline: null,
      combinedPartner: null,
      major: null,

      isMidYear,

      originalName,
      normalizedName,
    };
  }

  /*
   * ---------------------------------------------------------
   * 2. Advanced Computing
   * ---------------------------------------------------------
   */

  const advancedComputingMajorMatch =
    normalizedName.match(
      /^Bachelor of Advanced Computing\s*\((.+)\)$/i,
    );

  if (advancedComputingMajorMatch) {
    return {
      canonicalTitle:
        'Bachelor of Advanced Computing',

      family:
        'ADVANCED_COMPUTING',

      major: normalizeWhitespace(
        advancedComputingMajorMatch[1],
      ),

      discipline: null,
      combinedPartner: null,

      isMidYear,

      originalName,
      normalizedName,
    };
  }

  const advancedComputingCombinedMatch =
    normalizedName.match(
      /^(?:Bachelor of )?Advanced Computing\s*\/\s*(.+)$/i,
    );

  if (advancedComputingCombinedMatch) {
    const partner =
      normalizeWhitespace(
        advancedComputingCombinedMatch[1],
      );

    return {
      canonicalTitle:
        advancedComputingCombinedTitle(
          partner,
        ),

      family:
        'ADVANCED_COMPUTING',

      major: null,
      discipline: null,

      combinedPartner:
        partner,

      isMidYear,

      originalName,
      normalizedName,
    };
  }

  if (
    /^Bachelor of Advanced Computing$/i.test(
      normalizedName,
    )
  ) {
    return {
      canonicalTitle:
        'Bachelor of Advanced Computing',

      family:
        'ADVANCED_COMPUTING',

      major: null,
      discipline: null,
      combinedPartner: null,

      isMidYear,

      originalName,
      normalizedName,
    };
  }

  /*
   * ---------------------------------------------------------
   * 3. Undergraduate Engineering
   * ---------------------------------------------------------
   */

  const undergraduateEngineeringPatterns = [
    /^(Aeronautical Engineering(?: with Space)?)$/i,
    /^(Biomedical Engineering)$/i,
    /^(Chemical(?: & Biomolecular)? Engineering)$/i,
    /^(Civil Engineering)$/i,
    /^(Electrical Engineering)$/i,
    /^(Environmental Engineering)$/i,
    /^(Mechanical Engineering(?: with Space)?)$/i,
    /^(Mechatronic Engineering(?: with Space)?)$/i,
    /^(Software Engineering)$/i,
  ];

  for (
    const pattern of
    undergraduateEngineeringPatterns
  ) {
    const match =
      normalizedName.match(pattern);

    if (match) {
      return {
        canonicalTitle:
          'Bachelor of Engineering Honours',

        family:
          'ENGINEERING',

        discipline:
          normalizeWhitespace(
            match[1],
          ),

        major: null,
        combinedPartner: null,

        isMidYear,

        originalName,
        normalizedName,
      };
    }
  }

  /*
   * ---------------------------------------------------------
   * 4. Engineering combined awards
   * ---------------------------------------------------------
   */

  const slashMatch =
    normalizedName.match(
      /^(.+?)\s*\/\s*(.+)$/,
    );

  if (slashMatch) {
    const discipline =
      normalizeWhitespace(
        slashMatch[1],
      );

    const rawPartner =
      normalizeWhitespace(
        slashMatch[2],
      );

    const partner =
      normalizeEngineeringCombinedPartner(
        rawPartner,
      );

    const engineeringTitle =
      engineeringCombinedTitle(
        partner,
      );

    if (engineeringTitle) {
      return {
        canonicalTitle:
          engineeringTitle,

        family:
          'ENGINEERING',

        discipline,

        major: null,

        combinedPartner:
          rawPartner,

        isMidYear,

        originalName,
        normalizedName,
      };
    }
  }

  /*
   * ---------------------------------------------------------
   * 5. Bachelor of Project Management
   * ---------------------------------------------------------
   */

  const projectManagementMatch =
    normalizedName.match(
      /^Bachelor of Project Management(?:\s*\((.+)\))?$/i,
    );

  if (projectManagementMatch) {
    return {
      canonicalTitle:
        'Bachelor of Project Management',

      family:
        'PROJECT_MANAGEMENT',

      discipline: null,

      major:
        projectManagementMatch[1]
          ? normalizeWhitespace(
              projectManagementMatch[1],
            )
          : null,

      combinedPartner: null,

      isMidYear,

      originalName,
      normalizedName,
    };
  }

  /*
   * ---------------------------------------------------------
   * 6. Non-degree CUSP pathway
   * ---------------------------------------------------------
   */

  if (
    /^Flexible First Year$/i.test(
      normalizedName,
    )
  ) {
    return {
      canonicalTitle: null,

      family:
        'NON_DEGREE_PATHWAY',

      discipline: null,
      major: null,
      combinedPartner: null,

      isMidYear,

      originalName,
      normalizedName,
    };
  }

  /*
   * ---------------------------------------------------------
   * 7. Postgraduate
   * ---------------------------------------------------------
   *
   * These plans are valid CUSP data but are outside the
   * current 109-degree undergraduate handbook master.
   */
  if (
    /^(Master|Graduate Certificate|Graduate Diploma)\b/i.test(
      normalizedName,
    )
  ) {
    return {
      canonicalTitle: null,

      family:
        'POSTGRADUATE',

      discipline: null,
      major: null,
      combinedPartner: null,

      isMidYear,

      originalName,
      normalizedName,
    };
  }

  return {
    canonicalTitle: null,

    family: 'UNKNOWN',

    discipline: null,
    major: null,
    combinedPartner: null,

    isMidYear,

    originalName,
    normalizedName,
  };
}

/**
 * Only collect actual structured subject references.
 *
 * IMPORTANT:
 * Do not regex-scan the whole study-plan JSON.
 *
 * Notes can contain alternative subjects such as DATA1910,
 * INFO4911 or advisory subjects such as FASS1000. Those are
 * references, not fixed subjects in the study-plan slot.
 */
function getStructuredSubjectCodes(
  plan: CuspStudyPlan,
): string[] {
  const codes =
    new Set<string>();

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
          'string'
        ) {
          continue;
        }

        const code =
          subject.code
            .trim()
            .toUpperCase();

        if (
          /^[A-Z]{4}\d{4}$/.test(
            code,
          )
        ) {
          codes.add(code);
        }
      }
    }
  }

  return [...codes];
}

function createMergedStudyPlan(
  plan: CuspStudyPlan,
  resolution: DegreeResolution,
): HandbookStudyPlan {
  return {
    ...plan,

    source: 'CUSP',

    cusp: {
      dvid:
        plan.dvid ?? null,

      degreeId:
        plan.cuspDegreeId ??
        plan.degreeId ??
        null,

      originalDegreeName:
        resolution.originalName,

      normalizedDegreeName:
        resolution.normalizedName,

      canonicalDegreeTitle:
        resolution.canonicalTitle,

      family:
        resolution.family,

      discipline:
        resolution.discipline ??
        null,

      major:
        resolution.major ??
        null,

      combinedPartner:
        resolution.combinedPartner ??
        null,

      isMidYear:
        resolution.isMidYear,

      sourceUrl:
        plan.sourceUrl ??
        null,
    },
  };
}

function main(): void {
  const master =
    readJson<UsydMaster>(
      MASTER_PATH,
    );

  const cuspPlansRaw =
    readJson<unknown>(
      CUSP_PLANS_PATH,
    );

  if (
    !Array.isArray(
      master.degrees,
    )
  ) {
    throw new Error(
      'usyd-master-final.json does not contain a degrees array',
    );
  }

  const cuspPlans =
    extractCuspPlans(
      cuspPlansRaw,
    );

  /*
   * Never mutate the original master object.
   */
  const output =
    JSON.parse(
      JSON.stringify(master),
    ) as UsydMaster;

  const existingSubjectCodes =
    new Set(
      (
        master.subjects ?? []
      ).map((subject) =>
        subject.code
          .trim()
          .toUpperCase(),
      ),
    );

  /*
   * Preserve handbook study plans already collected.
   */
  const preservedExistingPlans =
    output.degrees.reduce(
      (
        total,
        degree,
      ) =>
        total +
        (
          Array.isArray(
            degree.studyPlans,
          )
            ? degree.studyPlans
                .length
            : 0
        ),
      0,
    );

  const unmatched:
    UnmatchedPlan[] = [];

  const outOfScope:
    OutOfScopePlan[] = [];

  const unresolvedSubjectCodes =
    new Set<string>();

  let matchedPlans = 0;

  const planCountByDegreeCode =
    new Map<string, number>();

  for (const plan of cuspPlans) {
    const cuspDegreeName =
      getCuspDegreeName(plan);

    if (!cuspDegreeName) {
      unmatched.push({
        dvid:
          plan.dvid,

        cuspDegreeId:
          plan.cuspDegreeId ??
          plan.degreeId,

        cuspDegreeName: '',

        title:
          plan.title,

        sourceUrl:
          plan.sourceUrl,

        reason:
          'NO_CUSP_DEGREE_NAME',
      });

      continue;
    }

    const resolution =
      resolveCuspDegree(
        cuspDegreeName,
        output.degrees,
      );

    if (
      resolution.family ===
      'POSTGRADUATE'
    ) {
      outOfScope.push({
        dvid:
          plan.dvid,

        cuspDegreeId:
          plan.cuspDegreeId ??
          plan.degreeId,

        cuspDegreeName,

        title:
          plan.title,

        sourceUrl:
          plan.sourceUrl,

        family:
          'POSTGRADUATE',

        reason:
          'OUT_OF_HANDBOOK_SCOPE',
      });

      continue;
    }

    if (
      resolution.family ===
      'NON_DEGREE_PATHWAY'
    ) {
      outOfScope.push({
        dvid:
          plan.dvid,

        cuspDegreeId:
          plan.cuspDegreeId ??
          plan.degreeId,

        cuspDegreeName,

        title:
          plan.title,

        sourceUrl:
          plan.sourceUrl,

        family:
          'NON_DEGREE_PATHWAY',

        reason:
          'NON_DEGREE_PATHWAY',
      });

      continue;
    }

    if (
      !resolution.canonicalTitle
    ) {
      unmatched.push({
        dvid:
          plan.dvid,

        cuspDegreeId:
          plan.cuspDegreeId ??
          plan.degreeId,

        cuspDegreeName,

        title:
          plan.title,

        sourceUrl:
          plan.sourceUrl,

        reason:
          'NO_CANONICAL_TITLE',

        canonicalTitle:
          null,

        family:
          resolution.family,
      });

      continue;
    }

    const candidates =
      output.degrees.filter(
        (degree) =>
          normalizeComparable(
            degree.title,
          ) ===
          normalizeComparable(
            resolution.canonicalTitle!,
          ),
      );

    if (candidates.length === 0) {
      unmatched.push({
        dvid:
          plan.dvid,

        cuspDegreeId:
          plan.cuspDegreeId ??
          plan.degreeId,

        cuspDegreeName,

        title:
          plan.title,

        sourceUrl:
          plan.sourceUrl,

        reason:
          'NO_HANDBOOK_DEGREE',

        canonicalTitle:
          resolution.canonicalTitle,

        family:
          resolution.family,
      });

      continue;
    }

    if (candidates.length > 1) {
      unmatched.push({
        dvid:
          plan.dvid,

        cuspDegreeId:
          plan.cuspDegreeId ??
          plan.degreeId,

        cuspDegreeName,

        title:
          plan.title,

        sourceUrl:
          plan.sourceUrl,

        reason:
          'AMBIGUOUS_HANDBOOK_DEGREE',

        canonicalTitle:
          resolution.canonicalTitle,

        family:
          resolution.family,
      });

      continue;
    }

    const handbookDegree =
      candidates[0];

    if (
      !Array.isArray(
        handbookDegree.studyPlans,
      )
    ) {
      handbookDegree.studyPlans =
        [];
    }

    handbookDegree.studyPlans.push(
      createMergedStudyPlan(
        plan,
        resolution,
      ),
    );

    matchedPlans += 1;

    planCountByDegreeCode.set(
      handbookDegree.code,
      (
        planCountByDegreeCode.get(
          handbookDegree.code,
        ) ?? 0
      ) + 1,
    );

    /*
     * Only actual subjects parsed into item.subjects count
     * towards referential-integrity validation.
     */
    for (
      const subjectCode of
      getStructuredSubjectCodes(
        plan,
      )
    ) {
      if (
        existingSubjectCodes.size >
          0 &&
        !existingSubjectCodes.has(
          subjectCode,
        )
      ) {
        unresolvedSubjectCodes.add(
          subjectCode,
        );
      }
    }
  }

  const handbookDegreesWithCuspPlans =
    output.degrees
      .filter((degree) =>
        planCountByDegreeCode.has(
          degree.code,
        ),
      )
      .map((degree) => ({
        code:
          degree.code,

        title:
          degree.title,

        planCount:
          planCountByDegreeCode.get(
            degree.code,
          ) ?? 0,
      }))
      .sort((a, b) =>
        a.title.localeCompare(
          b.title,
        ),
      );

  const handbookDegreesWithoutCuspPlans =
    output.degrees
      .filter(
        (degree) =>
          !planCountByDegreeCode.has(
            degree.code,
          ),
      )
      .map((degree) => ({
        code:
          degree.code,

        title:
          degree.title,

        level:
          String(
            degree.level ?? '',
          ),
      }))
      .sort((a, b) =>
        a.title.localeCompare(
          b.title,
        ),
      );

  const report:
    MergeReport = {
    generatedAt:
      new Date().toISOString(),

    cuspPlans:
      cuspPlans.length,

    matchedPlans,

    unmatchedPlans:
      unmatched.length,

    outOfScopePlans:
      outOfScope.length,

    matchedHandbookDegrees:
      handbookDegreesWithCuspPlans.length,

    handbookDegreesWithCuspPlans,

    handbookDegreesWithoutCuspPlans,

    preservedExistingPlans,

    unresolvedSubjectCodes:
      [
        ...unresolvedSubjectCodes,
      ].sort(),

    unmatched,

    outOfScope,
  };

  writeJson(
    OUTPUT_PATH,
    output,
  );

  writeJson(
    REPORT_PATH,
    report,
  );

  console.log(
    `CUSP plans: ${cuspPlans.length}`,
  );

  console.log(
    `Matched plans: ${matchedPlans}`,
  );

  console.log(
    `Out-of-scope plans: ${outOfScope.length}`,
  );

  console.log(
    `True unmatched plans: ${unmatched.length}`,
  );

  console.log(
    `Matched handbook degrees: ${handbookDegreesWithCuspPlans.length}/${output.degrees.length}`,
  );

  console.log(
    `Handbook degrees without CUSP plans: ${handbookDegreesWithoutCuspPlans.length}`,
  );

  console.log(
    `Unresolved structured subject codes: ${unresolvedSubjectCodes.size}`,
  );

  console.log(
    `Saved database-ready master to ${OUTPUT_PATH}`,
  );

  console.log(
    `Saved validation report to ${REPORT_PATH}`,
  );
}

main();