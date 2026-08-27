import {
  discoverUsydUndergraduateDegrees,
} from './usyd.global-degree-discovery';

import {
  parseUsydGlobalCourse,
} from './usyd.global-degree-parser';

import {
  normalizeUsydDegrees,
} from './usyd.degree-normalizer';

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'USYD DEGREE NORMALIZER',
  );

  console.log(
    '================================',
  );

  const discovered =
    await discoverUsydUndergraduateDegrees();

  console.log(
    `Course pages: ${discovered.length}`,
  );

  const parsedCourses =
    [];

  for (
    let index = 0;
    index <
    discovered.length;
    index += 1
  ) {
    const course =
      discovered[
        index
      ];

    /*
     * Law Honours is an embedded pathway.
     */
    if (
      course.handbookCategory ===
        'LAW' &&
      /^Honours in the Bachelor of Laws$/i.test(
        course.name,
      )
    ) {
      continue;
    }

    console.log(
      `Parsing ${index + 1}/${discovered.length}: ${course.name}`,
    );

    const parsed =
      await parseUsydGlobalCourse(
        course,
      );

    parsedCourses.push(
      parsed,
    );
  }

  const normalized =
    normalizeUsydDegrees(
      parsedCourses,
    );

  const standalone =
    normalized.filter(
      (degree) =>
        degree.isStandaloneDegree,
    );

  const constituents =
    normalized.filter(
      (degree) =>
        !degree.isStandaloneDegree,
    );

  console.log('');

  console.log(
    '================================',
  );

  console.log(
    'NORMALIZED DEGREES',
  );

  console.log(
    '================================',
  );

  for (
    let index = 0;
    index <
    standalone.length;
    index += 1
  ) {
    const degree =
      standalone[
        index
      ];

    console.log(
      `${index + 1}. ${degree.title}`,
    );

    console.log(
      `   Code: ${degree.code}`,
    );

    console.log(
      `   Level: ${degree.level}`,
    );

    console.log(
      `   CP: ${degree.totalCreditPoints ?? 'NONE'}`,
    );

    console.log(
      `   Requirements: ${degree.awardRequirements.length}`,
    );

    console.log(
      `   Sources: ${degree.sources.length}`,
    );

    console.log(
      `   Matched source: ${
        degree.sources.some(
          (source) =>
            source.matchedAwardSection,
        )
          ? 'YES'
          : 'NO'
      }`,
    );

    console.log('');
  }

  console.log(
    '================================',
  );

  console.log(
    'POSTGRADUATE CONSTITUENTS',
  );

  console.log(
    '================================',
  );

  for (
    const degree
    of constituents
  ) {
    console.log(
      `${degree.code} — ${degree.title}`,
    );

    console.log(
      `   CP: ${degree.totalCreditPoints ?? 'NONE'}`,
    );
  }

  const byLevel =
    new Map<
      string,
      number
    >();

  for (
    const degree
    of normalized
  ) {
    byLevel.set(
      degree.level,
      (
        byLevel.get(
          degree.level,
        ) ??
        0
      ) +
        1,
    );
  }

  const duplicateSourceDegrees =
    standalone.filter(
      (degree) =>
        degree.sources.length >
        1,
    );

  const missingCp =
    standalone.filter(
      (degree) =>
        degree.totalCreditPoints ===
        null,
    );

  const missingRequirements =
    standalone.filter(
      (degree) =>
        degree.awardRequirements.length ===
        0,
    );

  const fallbackOnly =
    standalone.filter(
      (degree) =>
        !degree.sources.some(
          (source) =>
            source.matchedAwardSection,
        ),
    );

  /*
   * ------------------------------------------------
   * IMPORTANT SEMANTIC CHECKS
   * ------------------------------------------------
   */

  const expectedCp =
    new Map<
      string,
      number
    >([
      [
        'BPCOMMER-06',
        144,
      ],

      [
        'BPCOMAVS-01',
        192,
      ],

      [
        'BPSCIENC-05',
        144,
      ],

      [
        'BPSCIAVS-01',
        192,
      ],

      [
        'BPACMCOM-01',
        240,
      ],

      [
        'BHSCIENH-02',
        48,
      ],

      [
        'BHENGART-05',
        264,
      ],
    ]);

  const semanticProblems:
    string[] =
    [];

  for (
    const [
      code,
      expected,
    ]
    of expectedCp
  ) {
    const degree =
      normalized.find(
        (item) =>
          item.code ===
          code,
      );

    if (!degree) {
      semanticProblems.push(
        `${code}: missing`,
      );

      continue;
    }

    if (
      degree.totalCreditPoints !==
      expected
    ) {
      semanticProblems.push(
        `${code}: expected ${expected} CP, got ${degree.totalCreditPoints ?? 'NONE'}`,
      );
    }
  }

  console.log('');

  console.log(
    '================================',
  );

  console.log(
    'SUMMARY',
  );

  console.log(
    '================================',
  );

  console.log(
    `Raw normalized course codes: ${normalized.length}`,
  );

  console.log(
    `Standalone degree records: ${standalone.length}`,
  );

  console.log(
    `Postgraduate constituents: ${constituents.length}`,
  );

  console.log(
    `Degrees with multiple source pages: ${duplicateSourceDegrees.length}`,
  );

  console.log(
    `Missing CP: ${missingCp.length}`,
  );

  console.log(
    `Missing requirements: ${missingRequirements.length}`,
  );

  console.log(
    `Fallback-only degree records: ${fallbackOnly.length}`,
  );

  console.log(
    `Semantic CP problems: ${semanticProblems.length}`,
  );

  console.log('');

  console.log(
    'BY LEVEL',
  );

  for (
    const [
      level,
      count,
    ]
    of byLevel
  ) {
    console.log(
      `${level}: ${count}`,
    );
  }

  if (
    semanticProblems.length >
    0
  ) {
    console.log('');

    console.log(
      'SEMANTIC CP PROBLEMS',
    );

    for (
      const problem
      of semanticProblems
    ) {
      console.log(
        `- ${problem}`,
      );
    }
  }

  if (
    fallbackOnly.length >
    0
  ) {
    console.log('');

    console.log(
      'FALLBACK-ONLY AWARDS',
    );

    for (
      const degree
      of fallbackOnly
    ) {
      console.log(
        `${degree.code} — ${degree.title}`,
      );

      console.log(
        `  CP: ${degree.totalCreditPoints ?? 'NONE'}`,
      );
    }
  }

  if (
    duplicateSourceDegrees.length >
    0
  ) {
    console.log('');

    console.log(
      'MULTIPLE SOURCE PAGES',
    );

    for (
      const degree
      of duplicateSourceDegrees
    ) {
      console.log(
        `${degree.code} — ${degree.title}`,
      );

      for (
        const source
        of degree.sources
      ) {
        console.log(
          `  ${source.handbookCategory}: ${source.sourceUrl}`,
        );

        console.log(
          `    Award section: ${
            source.matchedAwardSection
              ? 'MATCHED'
              : 'FALLBACK'
          }`,
        );
      }
    }
  }

  if (
    missingCp.length >
    0
  ) {
    console.log('');

    console.log(
      'MISSING CP',
    );

    for (
      const degree
      of missingCp
    ) {
      console.log(
        `${degree.code} — ${degree.title}`,
      );
    }
  }

  if (
    missingRequirements.length >
    0
  ) {
    console.log('');

    console.log(
      'MISSING REQUIREMENTS',
    );

    for (
      const degree
      of missingRequirements
    ) {
      console.log(
        `${degree.code} — ${degree.title}`,
      );
    }
  }
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