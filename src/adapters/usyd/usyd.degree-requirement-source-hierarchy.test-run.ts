import {
  buildUsydDegreeRequirementSourceHierarchyV1,
} from './usyd.degree-requirement-source-hierarchy';

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
    'USYD DEGREE REQUIREMENT SOURCE HIERARCHY V1',
  );

  divider();

  const result =
    await buildUsydDegreeRequirementSourceHierarchyV1();

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Source clauses: ${result.counts.sourceClauses}`,
  );

  console.log(
    `Active requirement nodes: ${result.counts.activeRequirementNodes}`,
  );

  console.log(
    `Exact duplicate nodes: ${result.counts.exactDuplicateNodes}`,
  );

  console.log(
    `Non-requirement nodes: ${result.counts.nonRequirementNodes}`,
  );

  console.log(
    `Roots: ${result.counts.roots}`,
  );

  console.log(
    `Containers: ${result.counts.containers}`,
  );

  console.log(
    `Leaves: ${result.counts.leaves}`,
  );

  console.log(
    `Parent links: ${result.counts.parentLinks}`,
  );

  console.log(
    `Degrees with single root: ${result.counts.degreesWithSingleRoot}`,
  );

  console.log(
    `Degrees with multiple roots: ${result.counts.degreesWithMultipleRoots}`,
  );

  console.log(
    `Degrees with no requirement root: ${result.counts.degreesWithNoRequirementRoot}`,
  );

  console.log(
    `Orphan active nodes: ${result.counts.orphanActiveNodes}`,
  );

  console.log(
    `Missing node mappings: ${result.counts.missingNodeMappings}`,
  );

  console.log(
    `Duplicate node IDs: ${result.counts.duplicateNodeIds}`,
  );

  divider();

  console.log(
    'MULTI-ROOT DEGREE SAMPLE',
  );

  divider();

  for (
    const degree
    of result.degrees
      .filter(
        (item) =>
          item.rootIds.length >
          1,
      )
      .slice(
        0,
        20,
      )
  ) {
    console.log(
      `${degree.degreeCode}: ${degree.rootIds.length} roots`,
    );
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
    result.counts.sourceClauses !==
    1085
  ) {
    failures.push(
      `Expected 1085 AST V2 source clauses, got ${result.counts.sourceClauses}.`,
    );
  }

  if (
    result.counts.nonRequirementNodes !==
    109
  ) {
    failures.push(
      `Expected 109 source URL NON_REQUIREMENT nodes, got ${result.counts.nonRequirementNodes}.`,
    );
  }

  if (
    result.counts.exactDuplicateNodes ===
    0
  ) {
    failures.push(
      'Expected at least some exact duplicate requirement clauses to be deduplicated.',
    );
  }

  if (
    result.counts.parentLinks ===
    0
  ) {
    failures.push(
      'Expected source-containment parent/child links.',
    );
  }

  if (
    result.counts.degreesWithNoRequirementRoot !==
      0 ||
    result.counts.orphanActiveNodes !==
      0 ||
    result.counts.missingNodeMappings !==
      0 ||
    result.counts.duplicateNodeIds !==
      0
  ) {
    failures.push(
      'Hierarchy integrity failure: root/orphan/mapping/node-id checks must all be clean.',
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
    'SOURCE HIERARCHY / EXACT DEDUP V1: CLEAN',
  );

  console.log(
    'IMPORTANT: multiple roots are allowed here. This stage only reconstructs source containment and exact duplicates; it does not invent ALL/ANY semantics between independent roots.',
  );

  console.log(
    'NEXT: inspect root counts and then build semantic degree roots only where source structure is sufficient; unsafe roots remain RAW groups.',
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
