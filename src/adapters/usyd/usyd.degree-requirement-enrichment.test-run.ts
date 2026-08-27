import {
  buildUsydDegreeRequirementEnrichmentV2,
} from './usyd.degree-requirement-enrichment';

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
    'USYD DEGREE REQUIREMENT ENRICHMENT V2',
  );

  divider();

  const result =
    await buildUsydDegreeRequirementEnrichmentV2();

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Clauses: ${result.counts.clauses}`,
  );

  console.log(
    `Inherited authoritative: ${result.counts.inheritedAuthoritative}`,
  );

  console.log(
    `Newly authoritative: ${result.counts.newlyAuthoritative}`,
  );

  console.log(
    `Raw fallback: ${result.counts.rawFallback}`,
  );

  console.log(
    `Non-requirement: ${result.counts.nonRequirement}`,
  );

  console.log(
    `Major OR program enriched: ${result.counts.enrichedMajorOrProgram}`,
  );

  console.log(
    `Minor OR second major enriched: ${result.counts.enrichedMinorOrSecondMajor}`,
  );

  console.log(
    `Table A OR Table S enriched: ${result.counts.enrichedTableAOrTableS}`,
  );

  console.log(
    `Dalyell conditions enriched: ${result.counts.enrichedDalyellConditions}`,
  );

  console.log(
    `Stream conditions enriched: ${result.counts.enrichedStreamConditions}`,
  );

  console.log(
    `Rejected ambiguous Dalyell clauses: ${result.counts.rejectedAmbiguousDalyellClauses}`,
  );

  console.log(
    `Missing clause mappings: ${result.counts.missingClauseMappings}`,
  );

  console.log(
    `Duplicate clause mappings: ${result.counts.duplicateClauseMappings}`,
  );

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
    result.counts.clauses !==
    1085
  ) {
    failures.push(
      `Expected 1085 clauses, got ${result.counts.clauses}.`,
    );
  }

  if (
    result.counts.inheritedAuthoritative !==
    258
  ) {
    failures.push(
      `Expected 258 inherited AST V2 authoritative clauses, got ${result.counts.inheritedAuthoritative}.`,
    );
  }

  if (
    result.counts.nonRequirement !==
    109
  ) {
    failures.push(
      `Expected 109 non-requirement URL clauses, got ${result.counts.nonRequirement}.`,
    );
  }

  if (
    result.counts.newlyAuthoritative ===
    0
  ) {
    failures.push(
      'Expected V2 to safely enrich at least some clauses.',
    );
  }

  if (
    result.counts.missingClauseMappings !==
      0 ||
    result.counts.duplicateClauseMappings !==
      0
  ) {
    failures.push(
      'Every source clause must map exactly once.',
    );
  }

  /**
   * Regression 1:
   * Do NOT turn the whole mixed elective clause into a Dalyell-only 36cp rule.
   */
  const badElective =
    result.clauses.find(
      (item) =>
        item.degreeCode ===
          'BPARTLAW-04' &&
        /Minimum of 36 credit points of elective units from Table A, Table S, Table O or, for students enrolled in the Dalyell stream, Table D/i.test(
          item.raw,
        ),
    );

  if (
    badElective?.source ===
    'ENRICHMENT_V2'
  ) {
    failures.push(
      'BPARTLAW-04 mixed elective/Dalyell clause must remain RAW in V2.',
    );
  }

  /**
   * Regression 2:
   * Do NOT attach the overall 240cp degree total to the Dalyell condition.
   */
  const bad240 =
    result.clauses.find(
      (item) =>
        item.degreeCode ===
          'BPARTLAW-04' &&
        /For students enrolled in the Dalyell stream, Table D.*To qualify for the award.*240 credit points/i.test(
          item.raw,
        ),
    );

  if (
    bad240?.source ===
    'ENRICHMENT_V2'
  ) {
    failures.push(
      'BPARTLAW-04 cross-boundary Dalyell/240cp clause must remain RAW in V2.',
    );
  }

  /**
   * Positive regression:
   * A clean atomic Dalyell clause should still enrich.
   */
  const cleanDalyell =
    result.clauses.find(
      (item) =>
        item.degreeCode ===
          'BHENGART-05' &&
        /^for students enrolled in the Dalyell stream: a minimum of 12 credit points from Table D/i.test(
          item.raw,
        ),
    );

  if (
    cleanDalyell?.source !==
    'ENRICHMENT_V2'
  ) {
    failures.push(
      'Expected clean BHENGART-05 Dalyell clause to remain safely enriched.',
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
    'SAFE COMPLEX-CLAUSE ENRICHMENT V2: CLEAN',
  );

  console.log(
    'V1 FALSE-POSITIVE DALYELL BINDINGS: FIXED',
  );

  console.log(
    'NEXT: write V2, then audit the remaining RAW fallbacks by reason. If they are predominantly genuinely nested/qualified clauses, freeze semantics and move to recommended study plans.',
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
