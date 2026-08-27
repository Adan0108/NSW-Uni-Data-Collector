import {
  discoverUsydStudyPlansV2,
} from './usyd.study-plan-discovery';

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
    'USYD STUDY PLAN DISCOVERY V2',
  );

  divider();

  const result =
    await discoverUsydStudyPlansV2();

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Source pages fetched: ${result.counts.sourcePagesFetched}`,
  );

  console.log(
    `Source fetch failures: ${result.counts.sourceFetchFailures}`,
  );

  console.log(
    `Overview pages fetched: ${result.counts.overviewPagesFetched}`,
  );

  console.log(
    `Overview fetch failures: ${result.counts.overviewFetchFailures}`,
  );

  console.log(
    `Degrees with candidate links: ${result.counts.degreesWithCandidateLinks}`,
  );

  console.log(
    `Candidate links: ${result.counts.candidateLinks}`,
  );

  console.log(
    `Candidate pages fetched: ${result.counts.candidatePagesFetched}`,
  );

  console.log(
    `Candidate fetch failures: ${result.counts.candidateFetchFailures}`,
  );

  console.log(
    `Degrees with sample study plan: ${result.counts.degreesWithSampleStudyPlan}`,
  );

  console.log(
    `Sample study-plan pages: ${result.counts.sampleStudyPlanPages}`,
  );

  console.log(
    `Plan tables: ${result.counts.totalPlanTables}`,
  );

  console.log(
    `Plan rows: ${result.counts.totalPlanRows}`,
  );

  console.log(
    `Duplicate candidate URLs: ${result.counts.duplicateCandidateUrls}`,
  );

  divider();

  console.log(
    'DISCOVERED SAMPLE PLANS',
  );

  divider();

  for (
    const candidate
    of result.candidates.filter(
      (item) =>
        item.sampleStudyPlanFound,
    )
  ) {
    console.log(
      `${candidate.degreeCode} — ${candidate.degreeTitle}`,
    );

    console.log(
      `  Discovery: ${candidate.discoverySource}`,
    );

    console.log(
      `  URL: ${candidate.candidateUrl}`,
    );

    console.log(
      `  Heading: ${candidate.heading ?? '(none)'}`,
    );

    console.log(
      `  Tables: ${candidate.tableCount}`,
    );

    console.log(
      `  Rows: ${candidate.tableRows.length}`,
    );

    if (
      candidate.tableRows[0]
    ) {
      console.log(
        `  First row: ${candidate.tableRows[0].join(' | ')}`,
      );
    }

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
    result.counts.sourceFetchFailures >
    5
  ) {
    failures.push(
      `Too many source fetch failures: ${result.counts.sourceFetchFailures}.`,
    );
  }

  if (
    result.counts.duplicateCandidateUrls !==
    0
  ) {
    failures.push(
      `Expected 0 duplicate per-degree candidate URLs, got ${result.counts.duplicateCandidateUrls}.`,
    );
  }

  /**
   * V1 returning zero candidates was not a useful PASS. Current 2026 handbook
   * content is known to expose sample-enrolment pages, so V2 requires at least
   * some handbook-local discovery.
   */
  if (
    result.counts.degreesWithCandidateLinks ===
      0 &&
    result.counts.degreesWithSampleStudyPlan ===
      0
  ) {
    failures.push(
      'Zero study-plan discovery coverage. Handbook-local discovery is still not working.',
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
    'STUDY PLAN DISCOVERY V2: HANDBOOK-LOCAL COVERAGE FOUND',
  );

  console.log(
    'NEXT: inspect discovered URL patterns and coverage, then normalize only proven sample-enrolment/pathway tables.',
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
