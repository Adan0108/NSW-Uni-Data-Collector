import {
  auditUsydDegreeRequirementSemantics,
} from './usyd.degree-requirement-semantic-audit';

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
    'USYD DEGREE REQUIREMENT SEMANTIC AUDIT V1',
  );

  divider();

  const result =
    await auditUsydDegreeRequirementSemantics();

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Clauses: ${result.counts.clauses}`,
  );

  console.log(
    `Component-only clauses: ${result.counts.componentChoiceClauses}`,
  );

  console.log(
    `Unit-only clauses: ${result.counts.unitRequirementClauses}`,
  );

  console.log(
    `Credit-point-only clauses: ${result.counts.creditPointRequirementClauses}`,
  );

  console.log(
    `Table-only clauses: ${result.counts.tableReferenceClauses}`,
  );

  console.log(
    `Mixed clauses: ${result.counts.mixedRequirementClauses}`,
  );

  console.log(
    `Clauses with AND: ${result.counts.clausesWithAnd}`,
  );

  console.log(
    `Clauses with OR: ${result.counts.clausesWithOr}`,
  );

  console.log(
    `Nested-numbering clauses: ${result.counts.clausesWithNestedNumbering}`,
  );

  console.log(
    `Conditional clauses: ${result.counts.conditionalClauses}`,
  );

  console.log(
    `Known semantic-risk clauses: ${result.counts.knownSemanticRiskClauses}`,
  );

  console.log(
    `Degrees without extracted clauses: ${result.counts.degreesWithoutExtractedClauses}`,
  );

  divider();

  console.log(
    'KNOWN SEMANTIC RISKS',
  );

  divider();

  const risky =
    result.clauses.filter(
      (clause) =>
        clause.flags
          .hasKnownSemanticRisk,
    );

  for (
    const clause
    of risky.slice(
      0,
      80,
    )
  ) {
    console.log(
      `${clause.degreeCode} — ${clause.knownRiskReasons.join(', ')}`,
    );

    console.log(
      `  ${clause.raw}`,
    );

    console.log('');
  }

  if (
    risky.length >
    80
  ) {
    console.log(
      `... ${risky.length - 80} more risk clauses omitted from console; all are preserved in the JSON writer output.`,
    );
  }

  const failures:
    string[] = [];

  if (
    result.counts.degrees <
    100
  ) {
    failures.push(
      `Expected at least 100 standalone USYD degree records, got ${result.counts.degrees}.`,
    );
  }

  if (
    result.counts.clauses ===
    0
  ) {
    failures.push(
      'No degree requirement source clauses were extracted.',
    );
  }

  if (
    !result.counts
      .relationshipLayerPresent
  ) {
    failures.push(
      'Final degree-component relationship artifact is missing. Run the final relationship writer first.',
    );
  }

  if (
    result.counts
      .degreesWithoutExtractedClauses >
    5
  ) {
    failures.push(
      `Too many degrees have no extracted requirement clauses: ${result.counts.degreesWithoutExtractedClauses}.`,
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
    'DEGREE REQUIREMENT SOURCE INVENTORY: CLEAN',
  );

  console.log(
    'IMPORTANT: classifications are diagnostic only. Formal AST generation comes next and must preserve raw text for every unsafe clause.',
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
