import {
  collectUsydGlobalMaster,
  type UsydGlobalMaster,
} from './usyd.master.collector';

const EXPECTED_DEGREE_SOURCE_PAGES =
  86;

const EXPECTED_DEGREES =
  109;

const EXPECTED_COMPONENT_FAMILIES =
  358;

const EXPECTED_COMPONENTS =
  358;

const EXPECTED_DEGREE_TABLES =
  37;

const EXPECTED_OWNER_GROUPS =
  21;

const EXPECTED_UNITS =
  3011;

const EXPECTED_UNRESOLVED_UNITS =
  111;

const EXPECTED_REQUISITE_RULES =
  3189;

const EXPECTED_RAW_FALLBACK_RULES =
  45;

function divider():
void {
  console.log(
    '================================',
  );
}

function duplicateCount(
  values:
    string[],
): number {
  return (
    values.length -
    new Set(
      values,
    ).size
  );
}

function validate(
  master:
    UsydGlobalMaster,
): string[] {
  const failures:
    string[] =
    [];

  const counts =
    master
      .metadata
      .counts;

  if (
    counts.degreeSourcePages !==
    EXPECTED_DEGREE_SOURCE_PAGES
  ) {
    failures.push(
      `Degree source pages expected ${EXPECTED_DEGREE_SOURCE_PAGES}, got ${counts.degreeSourcePages}.`,
    );
  }

  if (
    counts.degrees !==
    EXPECTED_DEGREES
  ) {
    failures.push(
      `Standalone degrees expected ${EXPECTED_DEGREES}, got ${counts.degrees}.`,
    );
  }

  if (
    counts.components !==
    EXPECTED_COMPONENTS
  ) {
    failures.push(
      `Canonical components expected ${EXPECTED_COMPONENTS}, got ${counts.components}.`,
    );
  }

  if (
    counts.componentSourceRecords !==
    EXPECTED_COMPONENT_FAMILIES
  ) {
    failures.push(
      `Component source families expected ${EXPECTED_COMPONENT_FAMILIES}, got ${counts.componentSourceRecords}.`,
    );
  }

  if (
    counts.degreeSpecificTables !==
    EXPECTED_DEGREE_TABLES
  ) {
    failures.push(
      `Degree-specific tables expected ${EXPECTED_DEGREE_TABLES}, got ${counts.degreeSpecificTables}.`,
    );
  }

  if (
    counts.degreeTableOwnerGroups !==
    EXPECTED_OWNER_GROUPS
  ) {
    failures.push(
      `Degree-table owner groups expected ${EXPECTED_OWNER_GROUPS}, got ${counts.degreeTableOwnerGroups}.`,
    );
  }

  if (
    counts.units !==
    EXPECTED_UNITS
  ) {
    failures.push(
      `Resolved units expected ${EXPECTED_UNITS}, got ${counts.units}.`,
    );
  }

  if (
    counts.unresolvedUnits !==
    EXPECTED_UNRESOLVED_UNITS
  ) {
    failures.push(
      `Unresolved units expected ${EXPECTED_UNRESOLVED_UNITS}, got ${counts.unresolvedUnits}.`,
    );
  }

  if (
    counts.requisiteRules !==
    EXPECTED_REQUISITE_RULES
  ) {
    failures.push(
      `P/C/N rules expected ${EXPECTED_REQUISITE_RULES}, got ${counts.requisiteRules}.`,
    );
  }

  if (
    counts.rawFallbackRequisiteRules !==
    EXPECTED_RAW_FALLBACK_RULES
  ) {
    failures.push(
      `Raw fallback requisite rules expected ${EXPECTED_RAW_FALLBACK_RULES}, got ${counts.rawFallbackRequisiteRules}.`,
    );
  }

  const duplicateDegreeCodes =
    duplicateCount(
      master.degrees.map(
        (
          degree,
        ) =>
          degree.code,
      ),
    );

  if (
    duplicateDegreeCodes !==
    0
  ) {
    failures.push(
      `Duplicate degree codes: ${duplicateDegreeCodes}.`,
    );
  }

  const duplicateUnitCodes =
    duplicateCount(
      master.subjects.map(
        (
          unit,
        ) =>
          unit.code,
      ),
    );

  if (
    duplicateUnitCodes !==
    0
  ) {
    failures.push(
      `Duplicate unit codes: ${duplicateUnitCodes}.`,
    );
  }

  const duplicateRequisiteKeys =
    duplicateCount(
      master
        .subjectRequisites
        .map(
          (
            rule,
          ) =>
            `${rule.unitCode}|${rule.type}`,
        ),
    );

  if (
    duplicateRequisiteKeys !==
    0
  ) {
    failures.push(
      `Duplicate unit/requisite-type records: ${duplicateRequisiteKeys}.`,
    );
  }

  const unresolvedOwnership =
    master
      .degreeTableOwnership
      .filter(
        (
          item,
        ) =>
          typeof item ===
            'object' &&
          item !==
            null &&
          'status' in
            item &&
          (
            item as {
              status?: unknown;
            }
          ).status ===
            'UNRESOLVED',
      )
      .length;

  if (
    unresolvedOwnership !==
    0
  ) {
    failures.push(
      `Unresolved degree-table ownership records: ${unresolvedOwnership}.`,
    );
  }

  const incorrectlyAuthoritativeFallback =
    master
      .subjectRequisites
      .filter(
        (
          rule,
        ) =>
          rule
            .containsUnparsedText &&
          rule
            .authoritative,
      )
      .length;

  if (
    incorrectlyAuthoritativeFallback !==
    0
  ) {
    failures.push(
      `Raw-fallback rules incorrectly marked authoritative: ${incorrectlyAuthoritativeFallback}.`,
    );
  }

  return failures;
}

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD GLOBAL MASTER COLLECTOR AUDIT',
  );

  divider();

  const master =
    await collectUsydGlobalMaster();

  const counts =
    master
      .metadata
      .counts;

  divider();

  console.log(
    'MASTER COUNTS',
  );

  divider();

  console.log(
    `Degree source pages: ${counts.degreeSourcePages}`,
  );

  console.log(
    `Standalone degrees: ${counts.degrees}`,
  );

  console.log(
    `Canonical components: ${counts.components}`,
  );

  console.log(
    `Parsed component source records: ${counts.componentSourceRecords}`,
  );

  console.log(
    `Requirement-bearing component objects: ${counts.componentRequirementObjects}`,
  );

  console.log(
    `Degree-specific tables: ${counts.degreeSpecificTables}`,
  );

  console.log(
    `Degree-table owner groups: ${counts.degreeTableOwnerGroups}`,
  );

  console.log(
    `Resolved units: ${counts.units}`,
  );

  console.log(
    `Unresolved units: ${counts.unresolvedUnits}`,
  );

  console.log(
    `Access-condition records: ${counts.accessConditions}`,
  );

  console.log(
    `P/C/N rules: ${counts.requisiteRules}`,
  );

  console.log(
    `Authoritative parsed P/C/N: ${counts.authoritativeRequisiteRules}`,
  );

  console.log(
    `Raw-fallback P/C/N: ${counts.rawFallbackRequisiteRules}`,
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
      master
        .metadata
        .coverage,
    )
  ) {
    console.log(
      `${key}: ${value ? 'YES' : 'NO'}`,
    );
  }

  const failures =
    validate(
      master,
    );

  divider();

  console.log(
    'STRUCTURAL VALIDATION',
  );

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

    console.log(
      'NEXT: fix only the failing dataset/export compatibility issue. Do not change the frozen requisite parser.',
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'GLOBAL MASTER STAGE 1: CLEAN',
  );

  console.log(
    'IMPORTANT: USYD IS NOT COMPLETE YET.',
  );

  console.log(
    'NEXT: write the master JSON, then build the completeness stages for degree-component relationships, formal degree requirement semantics, and recommended study plans.',
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
