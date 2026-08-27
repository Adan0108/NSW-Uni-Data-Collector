import {
  discoverUsydUndergraduateDegrees,
} from './usyd.global-degree-discovery';

import {
  parseUsydGlobalCourse,
} from './usyd.global-degree-parser';

async function main(): Promise<void> {
  const TARGET_CODE =
    'BPARTNUR-02';

  const discovered =
    await discoverUsydUndergraduateDegrees();

  for (
    const course
    of discovered
  ) {
    const parsed =
      await parseUsydGlobalCourse(
        course,
      );

    const award =
      parsed.awards.find(
        (item) =>
          item.code ===
          TARGET_CODE,
      );

    if (!award) {
      continue;
    }

    console.log(
      '================================',
    );

    console.log(
      `PAGE: ${course.name}`,
    );

    console.log(
      `Category: ${course.handbookCategory}`,
    );

    console.log(
      `Source: ${parsed.sourceUrl}`,
    );

    console.log(
      `Resolutions: ${
        parsed.resolutionsUrl ??
        'NONE'
      }`,
    );

    console.log('');

    console.log(
      `Code: ${award.code}`,
    );

    console.log(
      `Title: ${award.title}`,
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
      `Method: ${award.matchMethod}`,
    );

    console.log('');

    console.log(
      'RAW AWARD REQUIREMENTS',
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
      let index = 0;
      index <
      award.awardRequirements.length;
      index += 1
    ) {
      const requirement =
        award.awardRequirements[
          index
        ];

      console.log(
        `${
          index + 1
        }. CP=${
          requirement.requiredCreditPoints ??
          'NONE'
        }`,
      );

      console.log(
        `   ${requirement.rawText}`,
      );
    }

    console.log('');
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