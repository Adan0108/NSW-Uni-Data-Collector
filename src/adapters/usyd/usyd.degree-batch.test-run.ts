import {
  discoverUsydUndergraduateDegrees,
} from './usyd.global-degree-discovery';

import {
  parseUsydGlobalCourse,
} from './usyd.global-degree-parser';

interface AuditRow {
  name: string;

  faculty: string;

  courseCodes: number;

  awards: number;

  unmatchedAwards: number;

  status:
    | 'PASS'
    | 'REVIEW'
    | 'SKIP'
    | 'FAIL';

  issues: string[];
}

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'USYD GLOBAL DEGREE PARSER BATCH',
  );

  console.log(
    '================================',
  );

  const discovered =
    await discoverUsydUndergraduateDegrees();

  console.log(
    `Discovered course pages: ${discovered.length}`,
  );

  const rows:
    AuditRow[] =
    [];

  const uniqueCourseCodes =
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

    console.log('');

    console.log(
      `[${index + 1}/${discovered.length}] ${course.name}`,
    );

    /*
     * Law Honours is an embedded pathway rather
     * than a separate award/course code.
     */
    if (
      course.handbookCategory ===
        'LAW' &&
      /^Honours in the Bachelor of Laws$/i.test(
        course.name,
      )
    ) {
      rows.push({
        name:
          course.name,

        faculty:
          course.handbookCategory,

        courseCodes:
          0,

        awards:
          0,

        unmatchedAwards:
          0,

        status:
          'SKIP',

        issues:
          [
            'Embedded Honours pathway in Bachelor of Laws',
          ],
      });

      console.log(
        '  Status: SKIP',
      );

      console.log(
        '  Embedded Honours pathway in Bachelor of Laws',
      );

      continue;
    }

    try {
      const parsed =
        await parseUsydGlobalCourse(
          course,
        );

      const issues:
        string[] =
        [];

      if (
        !parsed.resolutionsUrl
      ) {
        issues.push(
          'No resolutions page',
        );
      }

      if (
        parsed.courseCodes.length ===
        0
      ) {
        issues.push(
          'No course codes parsed',
        );
      }

      if (
        parsed.awards.length ===
        0
      ) {
        issues.push(
          'No awards parsed',
        );
      }

      if (
        parsed.courseCodes.length !==
        parsed.awards.length
      ) {
        issues.push(
          `Course-code/award mismatch: ${parsed.courseCodes.length}/${parsed.awards.length}`,
        );
      }

      for (
        const award
        of parsed.awards
      ) {
        uniqueCourseCodes.add(
          award.code,
        );

        if (
          award.totalCreditPoints ===
          null
        ) {
          issues.push(
            `${award.code}: no total credit points`,
          );
        }

        if (
          award.awardRequirements.length ===
          0
        ) {
          issues.push(
            `${award.code}: no award requirements`,
          );
        }
      }

      const unmatchedAwards =
        parsed.awards.filter(
          (award) =>
            !award.matchedAwardSection,
        );

      /*
       * An unmatched award is not automatically an
       * error.
       *
       * Some codes genuinely share one combined
       * resolution block.
       *
       * We print them for semantic auditing.
       */
      let status:
        AuditRow['status'] =
        'PASS';

      if (
        !parsed.resolutionsUrl
      ) {
        status =
          'FAIL';
      } else if (
        issues.length >
        0
      ) {
        status =
          'REVIEW';
      }

      rows.push({
        name:
          course.name,

        faculty:
          course.handbookCategory,

        courseCodes:
          parsed.courseCodes.length,

        awards:
          parsed.awards.length,

        unmatchedAwards:
          unmatchedAwards.length,

        status,

        issues,
      });

      console.log(
        `  Status: ${status}`,
      );

      console.log(
        `  Faculty: ${course.handbookCategory}`,
      );

      console.log(
        `  Course codes: ${parsed.courseCodes.length}`,
      );

      console.log(
        `  Awards: ${parsed.awards.length}`,
      );

      for (
        const award
        of parsed.awards
      ) {
        console.log(
          `    ${award.code} — ${award.title}`,
        );

        console.log(
          `      CP: ${award.totalCreditPoints ?? 'NONE'}`,
        );

        console.log(
          `      Requirements: ${award.awardRequirements.length}`,
        );

        console.log(
          `      Award section: ${
            award.matchedAwardSection
              ? 'MATCHED'
              : 'FALLBACK'
          }`,
        );
      }

      for (
        const issue
        of issues
      ) {
        console.log(
          `  REVIEW: ${issue}`,
        );
      }
    } catch (
      error
    ) {
      const message =
        error instanceof Error
          ? error.message
          : String(
              error,
            );

      rows.push({
        name:
          course.name,

        faculty:
          course.handbookCategory,

        courseCodes:
          0,

        awards:
          0,

        unmatchedAwards:
          0,

        status:
          'FAIL',

        issues:
          [
            message,
          ],
      });

      console.log(
        '  Status: FAIL',
      );

      console.log(
        `  ${message}`,
      );
    }
  }

  const passes =
    rows.filter(
      (row) =>
        row.status ===
        'PASS',
    );

  const reviews =
    rows.filter(
      (row) =>
        row.status ===
        'REVIEW',
    );

  const skipped =
    rows.filter(
      (row) =>
        row.status ===
        'SKIP',
    );

  const failures =
    rows.filter(
      (row) =>
        row.status ===
        'FAIL',
    );

  const fallbackPages =
    rows.filter(
      (row) =>
        row.unmatchedAwards >
        0 &&
        row.status !==
        'SKIP',
    );

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
    `Course pages: ${rows.length}`,
  );

  console.log(
    `Unique course codes: ${uniqueCourseCodes.size}`,
  );

  console.log(
    `PASS: ${passes.length}`,
  );

  console.log(
    `REVIEW: ${reviews.length}`,
  );

  console.log(
    `SKIP: ${skipped.length}`,
  );

  console.log(
    `FAIL: ${failures.length}`,
  );

  console.log(
    `Pages with fallback award matching: ${fallbackPages.length}`,
  );

  if (
    reviews.length >
    0
  ) {
    console.log('');

    console.log(
      'REVIEW REQUIRED',
    );

    for (
      const row
      of reviews
    ) {
      console.log(
        `- ${row.name} [${row.faculty}]`,
      );

      for (
        const issue
        of row.issues
      ) {
        console.log(
          `    ${issue}`,
        );
      }
    }
  }

  if (
    fallbackPages.length >
    0
  ) {
    console.log('');

    console.log(
      'FALLBACK AWARD MATCHING',
    );

    for (
      const row
      of fallbackPages
    ) {
      console.log(
        `- ${row.name} [${row.faculty}]`,
      );

      console.log(
        `    Fallback awards: ${row.unmatchedAwards}`,
      );
    }
  }

  if (
    skipped.length >
    0
  ) {
    console.log('');

    console.log(
      'SKIPPED NON-SEPARATE AWARDS',
    );

    for (
      const row
      of skipped
    ) {
      console.log(
        `- ${row.name} [${row.faculty}]`,
      );

      for (
        const issue
        of row.issues
      ) {
        console.log(
          `    ${issue}`,
        );
      }
    }
  }

  if (
    failures.length >
    0
  ) {
    console.log('');

    console.log(
      'FAILED',
    );

    for (
      const row
      of failures
    ) {
      console.log(
        `- ${row.name} [${row.faculty}]`,
      );

      for (
        const issue
        of row.issues
      ) {
        console.log(
          `    ${issue}`,
        );
      }
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