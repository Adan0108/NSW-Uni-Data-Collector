import {
  collectUsydDegreeTableOwnership,
  type UsydDegreeTableOwnership,
} from './usyd.degree-table-mapper';

const EXPECTED_TABLE_COUNT =
  37;

const EXPECTED_ARCHITECTURE =
  12;

const EXPECTED_MEDICINE_HEALTH =
  22;

const EXPECTED_LAW =
  3;

function divider():
void {
  console.log(
    '================================',
  );
}

function countByHandbook(
  rows:
    UsydDegreeTableOwnership[],
  handbook:
    UsydDegreeTableOwnership['handbook'],
): number {
  return rows.filter(
    (
      row,
    ) =>
      row.handbook ===
      handbook,
  ).length;
}

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD DEGREE TABLE OWNERSHIP AUDIT',
  );

  divider();

  const result =
    await collectUsydDegreeTableOwnership();

  const rows =
    result.ownership;

  const architectureCount =
    countByHandbook(
      rows,
      'ARCHITECTURE',
    );

  const medicineHealthCount =
    countByHandbook(
      rows,
      'MEDICINE_HEALTH',
    );

  const lawCount =
    countByHandbook(
      rows,
      'LAW',
    );

  const duplicateTableUrls =
    rows.length -
    new Set(
      rows.map(
        (
          row,
        ) =>
          row.tableUrl,
      ),
    ).size;

  const unresolved =
    rows.filter(
      (
        row,
      ) =>
        row.status ===
        'UNRESOLVED',
    );

  const direct =
    rows.filter(
      (
        row,
      ) =>
        row.status ===
        'DIRECT',
    );

  const shared =
    rows.filter(
      (
        row,
      ) =>
        row.status ===
        'SHARED',
    );

  const ownerGroups =
    new Map<
      string,
      UsydDegreeTableOwnership[]
    >();

  for (
    const row
    of rows
  ) {
    if (
      !row.ownerKey
    ) {
      continue;
    }

    const group =
      ownerGroups.get(
        row.ownerKey,
      ) ??
      [];

    group.push(
      row,
    );

    ownerGroups.set(
      row.ownerKey,
      group,
    );
  }

  divider();

  console.log(
    'COUNTS',
  );

  divider();

  console.log(
    `Expected tables: ${EXPECTED_TABLE_COUNT}`,
  );

  console.log(
    `Actual tables: ${rows.length}`,
  );

  console.log(
    `ARCHITECTURE: ${architectureCount}`,
  );

  console.log(
    `MEDICINE_HEALTH: ${medicineHealthCount}`,
  );

  console.log(
    `LAW: ${lawCount}`,
  );

  console.log(
    `DIRECT: ${direct.length}`,
  );

  console.log(
    `SHARED: ${shared.length}`,
  );

  console.log(
    `UNRESOLVED: ${unresolved.length}`,
  );

  console.log(
    `Owner groups: ${ownerGroups.size}`,
  );

  console.log(
    `Duplicate table URLs: ${duplicateTableUrls}`,
  );

  divider();

  console.log(
    'OWNERSHIP GROUPS',
  );

  divider();

  for (
    const [
      ownerKey,
      ownerRows,
    ]
    of [
      ...ownerGroups.entries(),
    ].sort(
      (
        left,
        right,
      ) =>
        left[0]
          .localeCompare(
            right[0],
          ),
    )
  ) {
    console.log(
      ownerKey,
    );

    console.log(
      `  status: ${
        [
          ...new Set(
            ownerRows.map(
              (
                row,
              ) =>
                row.status,
            ),
          ),
        ].join(
          ', ',
        )
      }`,
    );

    console.log(
      `  tables: ${ownerRows.length}`,
    );

    console.log(
      `  owner: ${ownerRows[0]?.ownerPageUrl ?? 'NULL'}`,
    );

    for (
      const row
      of ownerRows
    ) {
      console.log(
        `    - ${row.degreeTitle}`,
      );

      console.log(
        `      ${row.tableUrl}`,
      );
    }
  }

  if (
    unresolved.length >
    0
  ) {
    divider();

    console.log(
      'UNRESOLVED',
    );

    divider();

    for (
      const row
      of unresolved
    ) {
      console.log(
        `${row.handbook} / ${row.degreeTitle}`,
      );

      console.log(
        `  table: ${row.tableUrl}`,
      );

      console.log(
        `  source: ${row.sourceUrl}`,
      );

      console.log(
        `  reason: ${row.reason}`,
      );
    }
  }

  divider();

  console.log(
    'STRUCTURAL VALIDATION',
  );

  divider();

  const failures:
    string[] =
    [];

  if (
    rows.length !==
    EXPECTED_TABLE_COUNT
  ) {
    failures.push(
      `Expected ${EXPECTED_TABLE_COUNT} tables, got ${rows.length}.`,
    );
  }

  if (
    architectureCount !==
    EXPECTED_ARCHITECTURE
  ) {
    failures.push(
      `Expected ${EXPECTED_ARCHITECTURE} Architecture tables, got ${architectureCount}.`,
    );
  }

  if (
    medicineHealthCount !==
    EXPECTED_MEDICINE_HEALTH
  ) {
    failures.push(
      `Expected ${EXPECTED_MEDICINE_HEALTH} Medicine & Health tables, got ${medicineHealthCount}.`,
    );
  }

  if (
    lawCount !==
    EXPECTED_LAW
  ) {
    failures.push(
      `Expected ${EXPECTED_LAW} Law tables, got ${lawCount}.`,
    );
  }

  if (
    duplicateTableUrls !==
    0
  ) {
    failures.push(
      `Duplicate table URLs: ${duplicateTableUrls}.`,
    );
  }

  if (
    unresolved.length !==
    0
  ) {
    failures.push(
      `Unresolved ownership rows: ${unresolved.length}.`,
    );
  }

  if (
    result.mappedTableCount !==
    rows.length
  ) {
    failures.push(
      `Mapped count ${result.mappedTableCount} does not equal table count ${rows.length}.`,
    );
  }

  console.log(
    `Expected table count: ${EXPECTED_TABLE_COUNT}`,
  );

  console.log(
    `Actual table count: ${rows.length}`,
  );

  console.log(
    `Mapped tables: ${result.mappedTableCount}`,
  );

  console.log(
    `UNRESOLVED: ${unresolved.length}`,
  );

  console.log(
    `Duplicate table URLs: ${duplicateTableUrls}`,
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
      'NEXT: fix only the ownership rows shown above. Do not start the master collector yet.',
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'DEGREE TABLE OWNERSHIP STATUS: CLEAN',
  );

  console.log(
    'NEXT: run usyd.degree-table-mapper.run.ts, then build the global USYD master collector.',
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
