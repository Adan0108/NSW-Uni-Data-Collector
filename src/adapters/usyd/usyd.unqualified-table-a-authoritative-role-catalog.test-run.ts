import {
  collectUsydUnqualifiedTableAAuthoritativeRoles,
} from './usyd.unqualified-table-a-authoritative-role-catalog';

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
    'USYD UNQUALIFIED TABLE A AUTHORITATIVE ROLE CATALOG V4',
  );

  divider();

  const result =
    await collectUsydUnqualifiedTableAAuthoritativeRoles();

  for (
    const pool
    of result.pools
  ) {
    console.log(
      `${pool.scope} / ${pool.role}: ${pool.names.length}`,
    );

    console.log(
      `  ${pool.names.join(' | ')}`,
    );
  }

  const expected:
    Record<string, number> =
    {
      'ARTS/MAJOR':
        47,

      'ARTS/MINOR':
        50,

      'BUSINESS/MAJOR':
        11,

      'BUSINESS/MINOR':
        9,

      'COMPUTING/MINOR':
        4,

      'CONSERVATORIUM/MINOR':
        7,

      'CONSERVATORIUM/PROGRAM':
        3,

      'ENGINEERING/MAJOR':
        2,

      'SCIENCE/MAJOR':
        38,

      'SCIENCE/MINOR':
        37,

      'SCIENCE/PROGRAM':
        6,
    };

  const failures:
    string[] = [];

  if (
    result.counts.pools !==
    11
  ) {
    failures.push(
      `Expected 11 authoritative scope/role pools, got ${result.counts.pools}.`,
    );
  }

  for (
    const [
      key,
      count,
    ]
    of Object.entries(
      expected,
    )
  ) {
    const [
      scope,
      role,
    ] =
      key.split('/');

    const pool =
      result.pools.find(
        (item) =>
          item.scope ===
            scope &&
          item.role ===
            role,
      );

    if (!pool) {
      failures.push(
        `Missing ${key}.`,
      );

      continue;
    }

    if (
      pool.names.length !==
      count
    ) {
      failures.push(
        `${key} expected ${count}, got ${pool.names.length}.`,
      );
    }
  }

  const computingMinor =
    result.pools.find(
      (pool) =>
        pool.scope ===
          'COMPUTING' &&
        pool.role ===
          'MINOR',
    );

  const expectedComputing =
    [
      'Computational Data Science',
      'Computer Science',
      'Cybersecurity',
      'Software Development',
    ].sort();

  if (
    !computingMinor ||
    computingMinor.names.join('|') !==
      expectedComputing.join('|')
  ) {
    failures.push(
      'COMPUTING/MINOR membership is incorrect.',
    );
  }

  const projectManagementMajors =
    result.pools.find(
      (pool) =>
        pool.scope ===
          'ENGINEERING' &&
        pool.role ===
          'MAJOR',
    );

  const expectedPmMajors =
    [
      'Built Environment',
      'Construction',
    ].sort();

  if (
    !projectManagementMajors ||
    projectManagementMajors.names.join('|') !==
      expectedPmMajors.join('|')
  ) {
    failures.push(
      'ENGINEERING/MAJOR must be Built Environment + Construction.',
    );
  }

  const musicPrograms =
    result.pools.find(
      (pool) =>
        pool.scope ===
          'CONSERVATORIUM' &&
        pool.role ===
          'PROGRAM',
    );

  const expectedMusicPrograms =
    [
      'Composition for Creative Industries',
      'Contemporary Music Practice',
      'Digital Music Composition',
    ].sort();

  if (
    !musicPrograms ||
    musicPrograms.names.join('|') !==
      expectedMusicPrograms.join('|')
  ) {
    failures.push(
      'Conservatorium PROGRAM names must be canonical names without CCI/CMP/DMC suffixes.',
    );
  }

  const musicMinors =
    result.pools.find(
      (pool) =>
        pool.scope ===
          'CONSERVATORIUM' &&
        pool.role ===
          'MINOR',
    );

  if (
    musicMinors &&
    musicMinors.names.some(
      (name) =>
        /^BMus/i.test(
          name,
        )
    )
  ) {
    failures.push(
      'Conservatorium minor pool still contains eligible-course names.',
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
    'AUTHORITATIVE TABLE A ROLE MEMBERSHIP V4: CLEAN',
  );

  console.log(
    'NEXT: write this catalog, then reconcile qualified BUSINESS/MAJOR and build unqualified Table A pools.',
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode =
      1;
  },
);
