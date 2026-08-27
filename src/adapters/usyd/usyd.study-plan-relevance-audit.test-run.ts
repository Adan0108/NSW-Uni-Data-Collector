import {
  buildUsydStudyPlanRelevanceAuditV2,
} from './usyd.study-plan-relevance-audit';

function divider():
void {
  console.log(
    '================================',
  );
}

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD STUDY PLAN RELEVANCE AUDIT V2',
  );

  divider();

  const result =
    await buildUsydStudyPlanRelevanceAuditV2();

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Candidates: ${result.counts.candidates}`,
  );

  console.log(
    `Candidates with plan: ${result.counts.candidatesWithPlan}`,
  );

  console.log(
    `Authoritative recommendation sources: ${result.counts.authoritativeRecommendationSources}`,
  );

  console.log(
    `Degree-scope review sources: ${result.counts.degreeScopeReviewSources}`,
  );

  console.log(
    `No-plan candidates: ${result.counts.noPlanCandidates}`,
  );

  console.log(
    `Fetch-failed candidates: ${result.counts.fetchFailedCandidates}`,
  );

  console.log(
    `Degrees with authoritative recommendation source: ${result.counts.degreesWithAuthoritativeRecommendationSource}`,
  );

  console.log(
    `Degrees with degree-scope review only: ${result.counts.degreesWithDegreeScopeReviewOnly}`,
  );

  console.log(
    `Duplicate authoritative assignments: ${result.counts.duplicateCandidateAssignments}`,
  );

  divider();

  console.log(
    'AUTHORITATIVE PLAN SOURCES',
  );

  divider();

  for (
    const candidate
    of result.candidates.filter(
      (item) =>
        item.relevanceStatus ===
        'AUTHORITATIVE_RECOMMENDATION_SOURCE',
    )
  ) {
    console.log(
      `${candidate.degreeCode} — ${candidate.degreeTitle}`,
    );

    console.log(
      `  URL: ${candidate.candidateUrl}`,
    );

    console.log(
      `  Tables: ${candidate.tableCount}`,
    );

    console.log(
      `  Rows: ${candidate.tableRows.length}`,
    );

    console.log('');
  }

  divider();

  console.log(
    'DEGREE-SCOPE REVIEW',
  );

  divider();

  for (
    const candidate
    of result.candidates.filter(
      (item) =>
        item.relevanceStatus ===
        'REVIEW_DEGREE_SCOPE_MISMATCH',
    )
  ) {
    console.log(
      `${candidate.degreeCode} — ${candidate.degreeTitle}`,
    );

    console.log(
      `  URL: ${candidate.candidateUrl}`,
    );

    console.log(
      `  Reasons: ${candidate.reasons.join(', ')}`,
    );

    console.log('');
  }

  const failures:
    string[] = [];

  if (
    result.counts.degrees !==
    109
  ) {
    failures.push(
      `Expected 109 degrees, got ${result.counts.degrees}.`,
    );
  }

  if (
    result.counts.candidatesWithPlan !==
    6
  ) {
    failures.push(
      `Expected 6 discovered plan-bearing candidates, got ${result.counts.candidatesWithPlan}.`,
    );
  }

  if (
    result.counts.authoritativeRecommendationSources !==
    4
  ) {
    failures.push(
      `Expected 4 authoritative pass/extended Liberal Arts and Science plan sources, got ${result.counts.authoritativeRecommendationSources}.`,
    );
  }

  if (
    result.counts.degreeScopeReviewSources !==
    2
  ) {
    failures.push(
      `Expected 2 BHLIARSH-01 review sources, got ${result.counts.degreeScopeReviewSources}.`,
    );
  }

  if (
    result.counts.degreesWithAuthoritativeRecommendationSource !==
    2
  ) {
    failures.push(
      `Expected authoritative study plans for exactly 2 degrees, got ${result.counts.degreesWithAuthoritativeRecommendationSource}.`,
    );
  }

  if (
    result.counts.duplicateCandidateAssignments !==
    0
  ) {
    failures.push(
      `Expected 0 duplicate authoritative assignments, got ${result.counts.duplicateCandidateAssignments}.`,
    );
  }

  const honoursCandidates =
    result.candidates.filter(
      (candidate) =>
        candidate.degreeCode ===
        'BHLIARSH-01' &&
        candidate.sampleStudyPlanFound,
    );

  if (
    honoursCandidates.length !==
    2 ||
    honoursCandidates.some(
      (candidate) =>
        candidate.relevanceStatus !==
        'REVIEW_DEGREE_SCOPE_MISMATCH',
    )
  ) {
    failures.push(
      'Both BHLIARSH-01 sample-plan links must remain REVIEW_DEGREE_SCOPE_MISMATCH.',
    );
  }

  divider();

  if (
    failures.length >
    0
  ) {
    console.log(
      'RESULT: FAIL',
    );

    for (
      const failure
      of failures
    ) {
      console.log(
        `- ${failure}`,
      );
    }

    process.exitCode =
      1;

    return;
  }

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'STUDY PLAN SOURCE RELEVANCE V2: CLEAN',
  );

  console.log(
    'BHLIARSH-01 NON-HONOURS PLAN INHERITANCE: BLOCKED',
  );

  console.log(
    'NEXT: write V2, then normalize the 4 authoritative recommendation sources for BPLIARSC-02 and BPLASXTD-01 into StudyPlan -> Year -> Period -> Item records.',
  );
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
