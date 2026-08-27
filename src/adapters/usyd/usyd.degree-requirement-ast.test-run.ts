import {
  buildUsydDegreeRequirementAstV2,
} from './usyd.degree-requirement-ast';

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
    'USYD DEGREE REQUIREMENT AST V2',
  );

  divider();

  const result =
    await buildUsydDegreeRequirementAstV2();

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Source clauses: ${result.counts.sourceClauses}`,
  );

  console.log(
    `Authoritative clauses: ${result.counts.authoritativeClauses}`,
  );

  console.log(
    `Raw fallback clauses: ${result.counts.rawFallbackClauses}`,
  );

  console.log(
    `Non-requirement clauses: ${result.counts.nonRequirementClauses}`,
  );

  console.log(
    `Authoritative component clauses: ${result.counts.authoritativeComponentClauses}`,
  );

  console.log(
    `Authoritative credit-point clauses: ${result.counts.authoritativeCreditPointClauses}`,
  );

  console.log(
    `Authoritative subject clauses: ${result.counts.authoritativeSubjectClauses}`,
  );

  console.log(
    `Authoritative table clauses: ${result.counts.authoritativeTableClauses}`,
  );

  console.log(
    `Known-risk raw fallbacks: ${result.counts.knownRiskRawFallbacks}`,
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
    result.counts.sourceClauses !==
    1085
  ) {
    failures.push(
      `Expected 1085 source clauses, got ${result.counts.sourceClauses}.`,
    );
  }

  if (
    result.counts
      .missingClauseMappings !==
      0 ||
    result.counts
      .duplicateClauseMappings !==
      0
  ) {
    failures.push(
      'Every source clause must map exactly once.',
    );
  }

  if (
    result.counts.nonRequirementClauses ===
    0
  ) {
    failures.push(
      'Expected handbook source URL strings to be classified as NON_REQUIREMENT.',
    );
  }

  const unsafeAuthoritative =
    result.clauses.filter(
      (clause) =>
        clause.parseStatus ===
          'AUTHORITATIVE' &&
        (
          /\bplacement\b|\bpracticum\b|\bclinical\b/i.test(
            clause.raw,
          ) ||
          /\bmake up\b.*\b(?:total|credit points?)\b/i.test(
            clause.raw,
          ) ||
          /\bbring the total\b/i.test(
            clause.raw,
          )
        ),
    );

  if (
    unsafeAuthoritative.length >
    0
  ) {
    failures.push(
      `Found ${unsafeAuthoritative.length} placement/residual-total clauses incorrectly marked authoritative.`,
    );
  }

  const urlAuthoritative =
    result.clauses.filter(
      (clause) =>
        clause.parseStatus ===
          'AUTHORITATIVE' &&
        /^https?:\/\//i.test(
          clause.raw,
        ),
    );

  if (
    urlAuthoritative.length >
    0
  ) {
    failures.push(
      `Found ${urlAuthoritative.length} URL strings incorrectly marked authoritative.`,
    );
  }

  const cognateMajor =
    result.clauses.find(
      (clause) =>
        clause.degreeCode ===
          'BHAGRSCI-01' &&
        /48 credit points of cognate major/i.test(
          clause.raw,
        ),
    );

  if (
    cognateMajor?.parseStatus ===
      'AUTHORITATIVE' &&
    (
      cognateMajor.ast?.nodeType !==
        'COMPONENT' ||
      cognateMajor.ast.creditPoints !==
        48
    )
  ) {
    failures.push(
      'BHAGRSCI-01 cognate major must preserve 48 credit points when parsed authoritatively.',
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
    'SAFE CLAUSE AST V2: CLEAN',
  );

  console.log(
    'NEXT: write AST V2, then build the source hierarchy/dedup layer before degree-level ALL/ANY roots.',
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
