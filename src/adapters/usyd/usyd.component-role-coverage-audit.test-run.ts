import {
  auditUsydComponentRoleCoverage,
  type UsydComponentRoleCoverageRecord,
} from './usyd.component-role-coverage-audit';

function divider():
void {
  console.log(
    '================================',
  );
}

function printRecord(
  record:
    UsydComponentRoleCoverageRecord,
): void {
  console.log(
    `${record.degreeCode} — ${record.degreeTitle}`,
  );

  console.log(
    `  wanted: ${record.requestedType} / ${record.requestedName}`,
  );

  console.log(
    `  handbook: ${record.degreeHandbook ?? 'NULL'}`,
  );

  console.log(
    `  status: ${record.status}`,
  );

  console.log(
    `  raw: ${record.rawText}`,
  );

  if (
    record
      .sameHandbookExactType
      .length >
    0
  ) {
    console.log(
      '  same-handbook exact-type candidates:',
    );

    for (
      const candidate
      of record
        .sameHandbookExactType
    ) {
      console.log(
        `    [${candidate.index}] ${candidate.type} — ${candidate.name}`,
      );

      console.log(
        `      ${candidate.overviewUrl ?? candidate.tableUrl ?? candidate.sourceUrl ?? 'NO URL'}`,
      );
    }
  }

  if (
    record
      .sameHandbookSameNameOtherType
      .length >
    0
  ) {
    console.log(
      '  same-handbook same-name OTHER-TYPE candidates:',
    );

    for (
      const candidate
      of record
        .sameHandbookSameNameOtherType
    ) {
      console.log(
        `    [${candidate.index}] ${candidate.type} — ${candidate.name}`,
      );

      console.log(
        `      ${candidate.overviewUrl ?? candidate.tableUrl ?? candidate.sourceUrl ?? 'NO URL'}`,
      );
    }
  }

  if (
    record
      .otherHandbookExactType
      .length >
    0
  ) {
    console.log(
      '  other-handbook exact-type candidates:',
    );

    for (
      const candidate
      of record
        .otherHandbookExactType
    ) {
      console.log(
        `    [${candidate.index}] ${candidate.handbook} / ${candidate.type} — ${candidate.name}`,
      );
    }
  }

  console.log('');
}

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD COMPONENT ROLE COVERAGE AUDIT',
  );

  divider();

  const result =
    await auditUsydComponentRoleCoverage();

  console.log(
    `Named evidence: ${result.namedEvidenceCount}`,
  );

  console.log(
    `Resolved same-handbook: ${result.resolvedSameHandbookCount}`,
  );

  console.log(
    `Missing role, same family exists: ${result.missingRoleCount}`,
  );

  console.log(
    `Missing component family: ${result.missingFamilyCount}`,
  );

  console.log(
    `Only other-handbook match: ${result.onlyOtherHandbookCount}`,
  );

  divider();

  console.log(
    'MISSING ROLE — SAME FAMILY EXISTS',
  );

  divider();

  const missingRole =
    result.records.filter(
      (
        record,
      ) =>
        record.status ===
        'MISSING_ROLE_SAME_NAME_EXISTS',
    );

  if (
    missingRole.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const record
      of missingRole
    ) {
      printRecord(
        record,
      );
    }
  }

  divider();

  console.log(
    'MISSING COMPONENT FAMILY',
  );

  divider();

  const missingFamily =
    result.records.filter(
      (
        record,
      ) =>
        record.status ===
        'MISSING_COMPONENT_FAMILY',
    );

  if (
    missingFamily.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const record
      of missingFamily
    ) {
      printRecord(
        record,
      );
    }
  }

  divider();

  console.log(
    'ONLY OTHER-HANDBOOK MATCH',
  );

  divider();

  const onlyOther =
    result.records.filter(
      (
        record,
      ) =>
        record.status ===
        'ONLY_OTHER_HANDBOOK',
    );

  if (
    onlyOther.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const record
      of onlyOther
    ) {
      printRecord(
        record,
      );
    }
  }

  divider();

  console.log(
    'RESULT: PASS',
  );

  if (
    result.missingRoleCount >
      0 ||
    result.missingFamilyCount >
      0 ||
    result.onlyOtherHandbookCount >
      0
  ) {
    console.log(
      'SEMANTIC STATUS: SUPPLEMENTAL COMPONENTS REQUIRED',
    );

    console.log(
      'NEXT: create explicit supplemental component records only from named handbook evidence. Do not silently reuse a MAJOR as a MINOR/PROGRAM, and do not invent Medicine/Conservatorium component families.',
    );

    return;
  }

  console.log(
    'SEMANTIC STATUS: CLEAN',
  );

  console.log(
    'NEXT: degree-component relationships can be resolved from the canonical component catalogue.',
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
