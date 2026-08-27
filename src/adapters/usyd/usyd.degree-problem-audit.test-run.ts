import {
  discoverUsydUndergraduateDegrees,
} from './usyd.global-degree-discovery';

import {
  parseUsydGlobalCourse,
} from './usyd.global-degree-parser';

const PROBLEM_CODES =
  new Set<string>([
    /*
     * Semantic CP problems.
     */
    'BPCOMAVS-01',
    'BPSCIAVS-01',
    'BPACMCOM-01',

    /*
     * Missing CP.
     */
    'BHARTSAH-01',
    'BPECONOM-05',
    'BPECNAVS-01',
    'BHVISARH-02',
  ]);

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'USYD PROBLEM AWARD AUDIT',
  );

  console.log(
    '================================',
  );

  const discovered =
    await discoverUsydUndergraduateDegrees();

  let foundCount = 0;

  const foundCodes =
    new Set<string>();

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
     * Law Honours is an embedded pathway rather
     * than a standalone course-code award.
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

    const parsed =
      await parseUsydGlobalCourse(
        course,
      );

    const relevantAwards =
      parsed.awards.filter(
        (award) =>
          PROBLEM_CODES.has(
            award.code,
          ),
      );

    if (
      relevantAwards.length ===
      0
    ) {
      continue;
    }

    console.log('');

    console.log(
      '================================',
    );

    console.log(
      `PAGE: ${course.name}`,
    );

    console.log(
      '================================',
    );

    console.log(
      `Category: ${course.handbookCategory}`,
    );

    console.log(
      `Source URL: ${parsed.sourceUrl}`,
    );

    console.log(
      `Resolutions URL: ${
        parsed.resolutionsUrl ??
        'NONE'
      }`,
    );

    console.log('');

    console.log(
      'COURSE CODES ON PAGE',
    );

    for (
      const courseCode
      of parsed.courseCodes
    ) {
      console.log(
        `- ${courseCode.code} — ${courseCode.title}`,
      );
    }

    console.log('');

    console.log(
      'PAGE-LEVEL TOTAL',
    );

    console.log(
      parsed.totalCreditPoints ??
        'NONE',
    );

    console.log('');

    console.log(
      'PAGE RAW REQUIREMENTS',
    );

    console.log(
      parsed.rawAwardRequirements ??
        'NONE',
    );

    for (
      const award
      of relevantAwards
    ) {
      foundCount +=
        1;

      foundCodes.add(
        award.code,
      );

      console.log('');

      console.log(
        '--------------------------------',
      );

      console.log(
        `${award.code} — ${award.title}`,
      );

      console.log(
        '--------------------------------',
      );

      console.log(
        `CP: ${
          award.totalCreditPoints ??
          'NONE'
        }`,
      );

      console.log(
        `Matched: ${
          award.matchedAwardSection
            ? 'YES'
            : 'NO'
        }`,
      );

      console.log(
        `Match method: ${award.matchMethod}`,
      );

      console.log(
        `Requirement count: ${award.awardRequirements.length}`,
      );

      console.log('');

      console.log(
        'AWARD RAW REQUIREMENTS',
      );

      console.log(
        award.rawAwardRequirements ??
          'NONE',
      );

      console.log('');

      console.log(
        'PARSED REQUIREMENTS',
      );

      for (
        let requirementIndex = 0;
        requirementIndex <
        award.awardRequirements.length;
        requirementIndex += 1
      ) {
        const requirement =
          award.awardRequirements[
            requirementIndex
          ];

        console.log(
          `${
            requirementIndex +
            1
          }. CP=${
            requirement.requiredCreditPoints ??
            'NONE'
          }`,
        );

        console.log(
          `   ${requirement.rawText}`,
        );
      }
    }
  }

  console.log('');

  console.log(
    '================================',
  );

  console.log(
    'AUDIT SUMMARY',
  );

  console.log(
    '================================',
  );

  console.log(
    `Problem award occurrences found: ${foundCount}`,
  );

  console.log(
    `Unique problem codes found: ${foundCodes.size}`,
  );

  console.log(
    `Problem codes requested: ${PROBLEM_CODES.size}`,
  );

  console.log('');

  console.log(
    'FOUND',
  );

  for (
    const code
    of foundCodes
  ) {
    console.log(
      `- ${code}`,
    );
  }

  const missingCodes =
    [...PROBLEM_CODES].filter(
      (code) =>
        !foundCodes.has(
          code,
        ),
    );

  if (
    missingCodes.length >
    0
  ) {
    console.log('');

    console.log(
      'NOT FOUND',
    );

    for (
      const code
      of missingCodes
    ) {
      console.log(
        `- ${code}`,
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