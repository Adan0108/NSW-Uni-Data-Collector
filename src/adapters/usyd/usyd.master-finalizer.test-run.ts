import {
  buildUsydFinalMasterV1,
} from './usyd.master-finalizer';

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
    'USYD FINAL MASTER INTEGRATION V1.1',
  );

  divider();

  const result =
    await buildUsydFinalMasterV1();

  const counts =
    result.metadata
      .counts;

  console.log(
    `Degrees: ${counts.degrees}`,
  );

  console.log(
    `Canonical components: ${counts.canonicalComponents}`,
  );

  console.log(
    `Requirement-bearing component objects: ${counts.componentRequirementObjects}`,
  );

  console.log(
    `Component source records: ${counts.componentSourceRecords}`,
  );

  console.log(
    `Degree-specific tables: ${counts.degreeSpecificTables}`,
  );

  console.log(
    `Degree-table ownership rows: ${counts.degreeTableOwnershipRows}`,
  );

  console.log(
    `Resolved subjects: ${counts.subjects}`,
  );

  console.log(
    `Study-plan subject supplements: ${counts.supplementalStudyPlanSubjects}`,
  );

  console.log(
    `Unresolved subjects: ${counts.unresolvedSubjects}`,
  );

  console.log(
    `Access-condition records: ${counts.accessConditions}`,
  );

  console.log(
    `P/C/N rules: ${counts.requisiteRules}`,
  );

  console.log(
    `Authoritative P/C/N: ${counts.authoritativeRequisiteRules}`,
  );

  console.log(
    `Raw-fallback P/C/N: ${counts.rawFallbackRequisiteRules}`,
  );

  console.log(
    `Explicit named degree-component relationships: ${counts.explicitNamedDegreeComponentRelationships}`,
  );

  console.log(
    `Degree-component choice pools: ${counts.degreeComponentChoicePools}`,
  );

  console.log(
    `Total relationship records: ${counts.totalDegreeComponentRelationshipRecords}`,
  );

  console.log(
    `Degree requirement clauses: ${counts.degreeRequirementClauses}`,
  );

  console.log(
    `Degree requirement roots: ${counts.degreeRequirementRoots}`,
  );

  console.log(
    `Study plans: ${counts.studyPlans}`,
  );

  console.log(
    `Study-plan years: ${counts.studyPlanYears}`,
  );

  console.log(
    `Study-plan periods: ${counts.studyPlanPeriods}`,
  );

  console.log(
    `Study-plan items: ${counts.studyPlanItems}`,
  );

  divider();

  console.log(
    'COVERAGE',
  );

  divider();

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      result.metadata
        .coverage,
    )
  ) {
    console.log(
      `${key}: ${value ? 'YES' : 'NO'}`,
    );
  }

  const failures:
    string[] =
    [];

  const expected:
    Record<
      string,
      number
    > = {
      degrees:
        109,

      canonicalComponents:
        367,

      componentRequirementObjects:
        132,

      componentSourceRecords:
        358,

      degreeSpecificTables:
        37,

      degreeTableOwnershipRows:
        37,

      subjects:
        3018,

      supplementalStudyPlanSubjects:
        7,

      unresolvedSubjects:
        111,

      baseFrozenRequisiteRules:
        3189,

      explicitNamedDegreeComponentRelationships:
        18,

      degreeComponentChoicePools:
        97,

      totalDegreeComponentRelationshipRecords:
        115,

      degreeRequirementClauses:
        1085,

      degreeRequirementRoots:
        109,

      studyPlans:
        6,

      studyPlanYears:
        20,

      studyPlanPeriods:
        40,

      studyPlanItems:
        152,
    };

  for (
    const [
      key,
      expectedValue,
    ]
    of Object.entries(
      expected,
    )
  ) {
    const actual =
      counts[
        key as
          keyof typeof counts
      ];

    if (
      actual !==
      expectedValue
    ) {
      failures.push(
        `${key}: expected ${expectedValue}, got ${String(actual)}.`,
      );
    }
  }

  if (
    counts.accessConditions !==
      2468 +
        counts.supplementalAccessConditionRecords
  ) {
    failures.push(
      'Access-condition total does not equal the frozen base plus supplemental records.',
    );
  }

  if (
    counts.requisiteRules !==
      counts.baseFrozenRequisiteRules +
        counts.supplementalRequisiteRules
  ) {
    failures.push(
      'Requisite-rule total does not equal the frozen base plus supplemental rules.',
    );
  }

  if (
    counts.authoritativeRequisiteRules !==
      3148 +
        counts.supplementalAuthoritativeRequisiteRules ||
    counts.rawFallbackRequisiteRules !==
      41 +
        counts.supplementalRawFallbackRequisiteRules
  ) {
    failures.push(
      'Supplemental requisite authority totals do not reconcile with the frozen base.',
    );
  }

  const incompleteCoverage =
    Object.entries(
      result.metadata
        .coverage,
    )
      .filter(
        (
          [
            _key,
            value,
          ],
        ) =>
          value !==
          true,
      )
      .map(
        (
          [
            key,
          ],
        ) =>
          key,
      );

  if (
    incompleteCoverage.length >
    0
  ) {
    failures.push(
      `Incomplete coverage flags: ${incompleteCoverage.join(', ')}.`,
    );
  }

  if (
    result.degreeComponents.length !==
    115
  ) {
    failures.push(
      `degreeComponents[] must contain 115 relationship records, got ${result.degreeComponents.length}.`,
    );
  }

  if (
    result.degreeRequirements.length !==
    1085
  ) {
    failures.push(
      `degreeRequirements[] must contain 1085 clauses, got ${result.degreeRequirements.length}.`,
    );
  }

  if (
    result.degreeRequirementRoots.length !==
    109
  ) {
    failures.push(
      `degreeRequirementRoots[] must contain 109 canonical roots, got ${result.degreeRequirementRoots.length}.`,
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
    'USYD FINAL MASTER INTEGRATION V1.1: STRUCTURALLY CLEAN',
  );

  console.log(
    'ALL COMPLETENESS STAGES ARE PRESENT IN ONE LOSSLESS MASTER.',
  );

  console.log(
    'NEXT: write usyd-master-final.json, then run the final cross-reference/integrity audit before Prisma mapping.',
  );
}

main().catch(
  (
    error,
  ) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
