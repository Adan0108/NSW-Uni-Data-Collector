import {
  auditUsydDegreeComponentTableSignals,
} from './usyd.degree-component-table-signal-audit';

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
    'USYD DEGREE-COMPONENT TABLE SIGNAL AUDIT',
  );

  divider();

  const result =
    await auditUsydDegreeComponentTableSignals();

  console.log(
    `Generic signals: ${result.counts.genericSignals}`,
  );

  console.log(
    `Linked component+table signals: ${result.counts.linkedComponentTableSignals}`,
  );

  console.log(
    `Component-only signals: ${result.counts.componentOnlySignals}`,
  );

  console.log(
    `Table-only signals: ${result.counts.tableOnlySignals}`,
  );

  console.log(
    `Grouped degree/table signals: ${result.counts.groupedTableSignals}`,
  );

  console.log(
    `Table S groups: ${result.counts.tableS}`,
  );

  console.log(
    `Table D groups: ${result.counts.tableD}`,
  );

  console.log(
    `Table O groups: ${result.counts.tableO}`,
  );

  console.log(
    `Qualified Table A groups: ${result.counts.qualifiedTableA}`,
  );

  console.log(
    `Unqualified Table A groups: ${result.counts.unqualifiedTableA}`,
  );

  console.log(
    `Other-table groups: ${result.counts.otherTable}`,
  );

  console.log(
    `No-table groups: ${result.counts.noTable}`,
  );

  divider();

  console.log(
    'QUALIFIED TABLE A CANDIDATE AUDIT',
  );

  divider();

  const qualified =
    result.groups.filter(
      (
        group,
      ) =>
        group.classification ===
        'QUALIFIED_TABLE_A',
    );

  for (
    const group
    of qualified
  ) {
    console.log(
      `${group.degreeCode} — ${group.degreeTitle}`,
    );

    console.log(
      `  Table: ${group.originalTableNames.join(' | ')}`,
    );

    console.log(
      `  Types: ${group.componentTypes.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Candidate components: ${group.candidateComponents.length}`,
    );

    for (
      const component
      of group.candidateComponents.slice(
        0,
        20,
      )
    ) {
      console.log(
        `    [${component.componentIndex}] ${component.handbook}/${component.type}/${component.name}`,
      );
    }

    console.log('');
  }

  divider();

  console.log(
    'UNQUALIFIED TABLE A SAMPLE',
  );

  divider();

  for (
    const group
    of result.groups
      .filter(
        (
          item,
        ) =>
          item.classification ===
          'UNQUALIFIED_TABLE_A',
      )
      .slice(
        0,
        20,
      )
  ) {
    console.log(
      `${group.degreeCode} — ${group.degreeTitle}`,
    );

    console.log(
      `  Handbook: ${group.degreeHandbook ?? 'NULL'}`,
    );

    console.log(
      `  Types: ${group.componentTypes.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Same-handbook candidates: ${group.candidateComponents.length}`,
    );
  }

  const malformedCombinedLabels =
    result.groups.filter(
      (
        group,
      ) =>
        /table\s+[ASOD].*table\s+[ASOD]/i.test(
          group.originalTableNames.join(
            ' ',
          ),
        ),
    );

  const qualifiedWithoutCandidates =
    result.groups.filter(
      (
        group,
      ) =>
        group.classification ===
          'QUALIFIED_TABLE_A' &&
        group.candidateComponents.length ===
          0,
    );

  divider();

  console.log(
    `Malformed combined table labels: ${malformedCombinedLabels.length}`,
  );

  console.log(
    `Qualified Table A groups with 0 candidates: ${qualifiedWithoutCandidates.length}`,
  );

  if (
    malformedCombinedLabels.length >
    0
  ) {
    console.log(
      'RESULT: FAIL',
    );

    console.log(
      'Table extraction still merges multiple table references into one label.',
    );

    process.exitCode =
      1;

    return;
  }

  divider();

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'STATUS: DIAGNOSTIC ONLY',
  );

  console.log(
    'NEXT: review qualified Table A candidate sets and unique table labels. Do not create generic relationships yet.',
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
