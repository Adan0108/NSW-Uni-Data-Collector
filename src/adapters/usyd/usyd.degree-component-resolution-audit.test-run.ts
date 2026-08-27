import {
  auditUsydDegreeComponentResolution,
  type UsydComponentCandidateDiagnostic,
} from './usyd.degree-component-resolution-audit';

function divider():
void {
  console.log(
    '================================',
  );
}

function printCandidate(
  candidate:
    UsydComponentCandidateDiagnostic,
): void {
  console.log(
    `    [${candidate.index}] ${candidate.type ?? 'UNKNOWN'} — ${candidate.name ?? 'UNKNOWN'}`,
  );

  console.log(
    `      handbook: ${candidate.handbook ?? 'NULL'}`,
  );

  console.log(
    `      sourceUrl: ${candidate.sourceUrl ?? 'NULL'}`,
  );

  console.log(
    `      overviewUrl: ${candidate.overviewUrl ?? 'NULL'}`,
  );

  console.log(
    `      tableUrl: ${candidate.tableUrl ?? 'NULL'}`,
  );

  if (
    candidate.score !==
    null
  ) {
    console.log(
      `      fuzzyScore: ${candidate.score.toFixed(3)}`,
    );
  }
}

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD DEGREE-COMPONENT RESOLUTION DIAGNOSTIC',
  );

  divider();

  const result =
    await auditUsydDegreeComponentResolution();

  console.log(
    `Ambiguous named evidence: ${result.ambiguousCount}`,
  );

  console.log(
    `Unresolved named evidence: ${result.unresolvedCount}`,
  );

  divider();

  console.log(
    'AMBIGUOUS CANDIDATE DETAILS',
  );

  divider();

  for (
    const issue
    of result.ambiguous
  ) {
    const evidence =
      issue.evidence;

    console.log(
      `${evidence.degreeCode} — ${evidence.degreeTitle}`,
    );

    console.log(
      `  wanted: ${evidence.componentType} / ${evidence.componentName}`,
    );

    console.log(
      `  degree handbook: ${evidence.handbookCategory ?? 'NULL'}`,
    );

    console.log(
      `  candidates: ${issue.candidates.length}`,
    );

    for (
      const candidate
      of issue.candidates
    ) {
      printCandidate(
        candidate,
      );
    }

    console.log('');
  }

  divider();

  console.log(
    'UNRESOLVED FUZZY CANDIDATES',
  );

  divider();

  for (
    const issue
    of result.unresolved
  ) {
    const evidence =
      issue.evidence;

    console.log(
      `${evidence.degreeCode} — ${evidence.degreeTitle}`,
    );

    console.log(
      `  wanted: ${evidence.componentType} / ${evidence.componentName}`,
    );

    console.log(
      `  degree handbook: ${evidence.handbookCategory ?? 'NULL'}`,
    );

    console.log(
      `  raw: ${evidence.rawText}`,
    );

    console.log(
      `  fuzzy candidates: ${issue.candidates.length}`,
    );

    for (
      const candidate
      of issue.candidates
    ) {
      printCandidate(
        candidate,
      );
    }

    console.log('');
  }

  divider();

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'STATUS: DIAGNOSTIC ONLY',
  );

  console.log(
    'NEXT: use candidate handbook/source context to define narrow resolution rules. Do not create authoritative degree-component relationships yet.',
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
