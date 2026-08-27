import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const DISCOVERY_FILE = path.join(
  DATA_DIR,
  'usyd-study-plan-discovery.v2.json',
);

interface Candidate {
  degreeCode: string;
  degreeTitle: string;
  handbookSourceUrl: string;
  candidateUrl: string;
  candidateText: string | null;
  discoverySource:
    | 'SOURCE_PAGE_LINK'
    | 'OVERVIEW_PAGE_LINK'
    | 'DIRECT_SOURCE_PAGE';
  sampleStudyPlanFound: boolean;
  heading: string | null;
  tableCount: number;
  tableRows: string[][];
  fetchStatus:
    | 'OK'
    | 'NO_SAMPLE_PLAN'
    | 'FETCH_FAILED';
  error: string | null;
}

interface DiscoveryDataset {
  counts: {
    degrees: number;
  };
  candidates: Candidate[];
}

export type RelevanceStatus =
  | 'AUTHORITATIVE_RECOMMENDATION_SOURCE'
  | 'REVIEW_DEGREE_SCOPE_MISMATCH'
  | 'NO_PLAN_FOUND'
  | 'FETCH_FAILED';

export interface AuditedCandidate extends Candidate {
  relevanceStatus: RelevanceStatus;

  sourceDirectory: string;
  candidateDirectory: string;

  sameDirectory: boolean;

  degreeScopeCompatible: boolean;

  reasons: string[];
}

export interface UsydStudyPlanRelevanceAudit {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    degrees: number;
    candidates: number;

    candidatesWithPlan: number;
    authoritativeRecommendationSources: number;
    degreeScopeReviewSources: number;
    noPlanCandidates: number;
    fetchFailedCandidates: number;

    degreesWithAuthoritativeRecommendationSource: number;
    degreesWithDegreeScopeReviewOnly: number;

    duplicateCandidateAssignments: number;
  };

  authoritativeDegreeCodes: string[];
  degreeScopeReviewDegreeCodes: string[];

  candidates: AuditedCandidate[];

  coverage: {
    studyPlanDiscovery: 'COMPLETE_DIAGNOSTIC';
    sourceRelevanceAudit: 'COMPLETE';
    recommendedStudyPlans: 'NOT_YET_NORMALIZED';
  };
}

function normalizeDirectory(
  urlValue: string,
): string {
  const url =
    new URL(
      urlValue,
    );

  const parts =
    url.pathname
      .split('/')
      .filter(Boolean);

  parts.pop();

  return `/${parts.join('/')}/`;
}

function normalizeText(
  value: string,
): string {
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readDiscovery():
Promise<DiscoveryDataset> {
  const raw =
    await fs.readFile(
      DISCOVERY_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as DiscoveryDataset;

  if (
    !Array.isArray(
      parsed.candidates,
    )
  ) {
    throw new Error(
      'Study-plan discovery V2 is missing candidates[]. Run the V2 writer first.',
    );
  }

  return parsed;
}

function isHonoursDegree(
  candidate: Candidate,
): boolean {
  return (
    /\bhonours\b/i.test(
      candidate.degreeTitle,
    ) ||
    /^BH/i.test(
      candidate.degreeCode,
    )
  );
}

function candidateLooksHonoursSpecific(
  candidate: Candidate,
): boolean {
  const haystack =
    normalizeText(
      [
        candidate.candidateUrl,
        candidate.candidateText ?? '',
        candidate.heading ?? '',
      ].join(' '),
    );

  return /\bhonours\b/i.test(
    haystack,
  );
}

/**
 * V2 course-scope guard:
 *
 * A same-directory link is NOT enough to prove that the plan belongs to the
 * current award. Some honours records share a handbook directory with the
 * underlying pass degree and therefore inherit its enrolment-guide links.
 *
 * We only auto-accept an honours degree's plan when the candidate itself is
 * honours-specific. Otherwise it remains review evidence.
 */
function degreeScopeCompatible(
  candidate: Candidate,
): boolean {
  if (
    !candidate.sampleStudyPlanFound
  ) {
    return false;
  }

  if (
    !isHonoursDegree(
      candidate,
    )
  ) {
    return true;
  }

  return candidateLooksHonoursSpecific(
    candidate,
  );
}

function auditCandidate(
  candidate: Candidate,
): AuditedCandidate {
  const sourceDirectory =
    normalizeDirectory(
      candidate.handbookSourceUrl,
    );

  const candidateDirectory =
    normalizeDirectory(
      candidate.candidateUrl,
    );

  const sameDirectory =
    sourceDirectory ===
    candidateDirectory;

  const scopeCompatible =
    degreeScopeCompatible(
      candidate,
    );

  const reasons:
    string[] =
    [];

  let relevanceStatus:
    RelevanceStatus;

  if (
    candidate.fetchStatus ===
    'FETCH_FAILED'
  ) {
    relevanceStatus =
      'FETCH_FAILED';

    reasons.push(
      'CANDIDATE_FETCH_FAILED',
    );
  } else if (
    !candidate.sampleStudyPlanFound
  ) {
    relevanceStatus =
      'NO_PLAN_FOUND';

    reasons.push(
      'NO_SAMPLE_PLAN_TABLE_FOUND',
    );
  } else if (
    !sameDirectory
  ) {
    relevanceStatus =
      'REVIEW_DEGREE_SCOPE_MISMATCH';

    reasons.push(
      'PLAN_PAGE_OUTSIDE_DEGREE_SOURCE_DIRECTORY',
    );
  } else if (
    !scopeCompatible
  ) {
    relevanceStatus =
      'REVIEW_DEGREE_SCOPE_MISMATCH';

    if (
      isHonoursDegree(
        candidate,
      ) &&
      !candidateLooksHonoursSpecific(
        candidate,
      )
    ) {
      reasons.push(
        'HONOURS_DEGREE_USING_NON_HONOURS_PLAN',
      );
    } else {
      reasons.push(
        'DEGREE_SCOPE_NOT_PROVEN',
      );
    }
  } else {
    relevanceStatus =
      'AUTHORITATIVE_RECOMMENDATION_SOURCE';

    reasons.push(
      'SAME_HANDBOOK_COURSE_DIRECTORY',
    );

    reasons.push(
      'DEGREE_SCOPE_COMPATIBLE',
    );
  }

  return {
    ...candidate,

    relevanceStatus,

    sourceDirectory,

    candidateDirectory,

    sameDirectory,

    degreeScopeCompatible:
      scopeCompatible,

    reasons,
  };
}

export async function buildUsydStudyPlanRelevanceAuditV2():
Promise<UsydStudyPlanRelevanceAudit> {
  const discovery =
    await readDiscovery();

  const candidates =
    discovery.candidates.map(
      auditCandidate,
    );

  const authoritative =
    candidates.filter(
      (candidate) =>
        candidate.relevanceStatus ===
        'AUTHORITATIVE_RECOMMENDATION_SOURCE',
    );

  const degreeScopeReview =
    candidates.filter(
      (candidate) =>
        candidate.relevanceStatus ===
        'REVIEW_DEGREE_SCOPE_MISMATCH',
    );

  const authoritativeDegreeCodes =
    [
      ...new Set(
        authoritative.map(
          (candidate) =>
            candidate.degreeCode,
        ),
      ),
    ].sort();

  const degreeScopeReviewDegreeCodes =
    [
      ...new Set(
        degreeScopeReview.map(
          (candidate) =>
            candidate.degreeCode,
        ),
      ),
    ].sort();

  const reviewOnlyDegrees =
    degreeScopeReviewDegreeCodes.filter(
      (degreeCode) =>
        !authoritativeDegreeCodes.includes(
          degreeCode,
        ),
    );

  const assignmentKeys =
    authoritative.map(
      (candidate) =>
        [
          candidate.degreeCode,
          candidate.candidateUrl,
        ].join('|'),
    );

  const duplicateCandidateAssignments =
    assignmentKeys.length -
    new Set(
      assignmentKeys,
    ).size;

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      degrees:
        discovery.counts.degrees,

      candidates:
        candidates.length,

      candidatesWithPlan:
        candidates.filter(
          (candidate) =>
            candidate.sampleStudyPlanFound,
        ).length,

      authoritativeRecommendationSources:
        authoritative.length,

      degreeScopeReviewSources:
        degreeScopeReview.length,

      noPlanCandidates:
        candidates.filter(
          (candidate) =>
            candidate.relevanceStatus ===
            'NO_PLAN_FOUND',
        ).length,

      fetchFailedCandidates:
        candidates.filter(
          (candidate) =>
            candidate.relevanceStatus ===
            'FETCH_FAILED',
        ).length,

      degreesWithAuthoritativeRecommendationSource:
        authoritativeDegreeCodes.length,

      degreesWithDegreeScopeReviewOnly:
        reviewOnlyDegrees.length,

      duplicateCandidateAssignments,
    },

    authoritativeDegreeCodes,

    degreeScopeReviewDegreeCodes,

    candidates,

    coverage: {
      studyPlanDiscovery:
        'COMPLETE_DIAGNOSTIC',

      sourceRelevanceAudit:
        'COMPLETE',

      recommendedStudyPlans:
        'NOT_YET_NORMALIZED',
    },
  };
}

export async function writeUsydStudyPlanRelevanceAuditV2():
Promise<void> {
  const result =
    await buildUsydStudyPlanRelevanceAuditV2();

  if (
    result.counts
      .duplicateCandidateAssignments !==
    0
  ) {
    throw new Error(
      `Refusing to write study-plan relevance audit V2: ${result.counts.duplicateCandidateAssignments} duplicate authoritative assignments.`,
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-study-plan-relevance-audit.v2.json',
    );

  const temporary =
    `${outputFile}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      result,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    outputFile,
  );

  console.log(
    '[USYD study plan relevance audit V2] PASS',
  );

  console.log(
    `Authoritative recommendation sources: ${result.counts.authoritativeRecommendationSources}`,
  );

  console.log(
    `Degree-scope review sources: ${result.counts.degreeScopeReviewSources}`,
  );

  console.log(
    `Degrees with authoritative recommendation source: ${result.counts.degreesWithAuthoritativeRecommendationSource}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
