import {
  collectUsydDegreeComponentRelationshipsStage1,
} from './usyd.degree-component-relationship-collector';

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
    'USYD DEGREE-COMPONENT RELATIONSHIP STAGE 1 AUDIT',
  );

  divider();

  const result =
    await collectUsydDegreeComponentRelationshipsStage1();

  console.log(
    `Named evidence records: ${result.counts.namedEvidenceRecords}`,
  );

  console.log(
    `Authoritative explicit relationships: ${result.counts.authoritativeRelationships}`,
  );

  console.log(
    `Generic signals retained: ${result.counts.genericSignals}`,
  );

  console.log(
    `Unresolved named evidence: ${result.counts.unresolvedNamedEvidence}`,
  );

  divider();

  console.log(
    'AUTHORITATIVE EXPLICIT RELATIONSHIPS',
  );

  divider();

  for (
    const relationship
    of result.relationships
  ) {
    console.log(
      `${relationship.degreeCode} -> ${relationship.componentHandbook}/${relationship.componentType}/${relationship.componentName}`,
    );

    console.log(
      `  Evidence records: ${relationship.evidence.length}`,
    );
  }

  divider();

  const failures:
    string[] =
    [];

  if (
    result.counts.namedEvidenceRecords !==
    36
  ) {
    failures.push(
      `Expected 36 named evidence records, got ${result.counts.namedEvidenceRecords}.`,
    );
  }

  if (
    result.counts.unresolvedNamedEvidence !==
    0
  ) {
    failures.push(
      `Expected 0 unresolved named evidence, got ${result.counts.unresolvedNamedEvidence}.`,
    );
  }

  if (
    result.relationships.length ===
    0
  ) {
    failures.push(
      'No authoritative explicit relationships were created.',
    );
  }

  const duplicateKeys =
    new Set<string>();

  const seen =
    new Set<string>();

  for (
    const relationship
    of result.relationships
  ) {
    const key =
      `${relationship.degreeCode}|${relationship.componentKey}`;

    if (
      seen.has(
        key,
      )
    ) {
      duplicateKeys.add(
        key,
      );
    }

    seen.add(
      key,
    );
  }

  if (
    duplicateKeys.size >
    0
  ) {
    failures.push(
      `Duplicate degree/component relationships: ${[
        ...duplicateKeys,
      ].join(', ')}`,
    );
  }

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
    'EXPLICIT NAMED RELATIONSHIPS: CLEAN',
  );

  console.log(
    'IMPORTANT: generic Table A/S/D/O relationship signals are still intentionally unresolved.',
  );

  console.log(
    'NEXT: write Stage 1 relationships, then build the table/pool relationship resolver.',
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
