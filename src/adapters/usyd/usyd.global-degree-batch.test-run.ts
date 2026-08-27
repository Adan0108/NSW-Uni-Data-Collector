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

  totalCreditPoints:
    number | null;

  requirements: number;

  status:
    'PASS' |
    'REVIEW' |
    'SKIP' |
    'FAIL';

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
     * ------------------------------------------------
     * EMBEDDED LAW HONOURS
     * ------------------------------------------------
     *
     * This is not a separate award/course code.
     * It belongs to Bachelor of Laws.
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

        totalCreditPoints:
          null,

        requirements:
          1,

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
        parsed.totalCreditPoints ===
        null
      ) {
        issues.push(
          'No total credit points parsed',
        );
      }

      if (
        parsed.awardRequirements.length ===
        0
      ) {
        issues.push(
          'No award requirements parsed',
        );
      }

      for (
        const courseCode
        of parsed.courseCodes
      ) {
        uniqueCourseCodes.add(
          courseCode.code,
        );
      }

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

        totalCreditPoints:
          parsed.totalCreditPoints,

        requirements:
          parsed.awardRequirements.length,

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

      for (
        const code
        of parsed.courseCodes
      ) {
        console.log(
          `    ${code.code} — ${code.title}`,
        );
      }

      console.log(
        `  Total CP: ${parsed.totalCreditPoints ?? 'NONE'}`,
      );

      console.log(
        `  Requirements: ${parsed.awardRequirements.length}`,
      );

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

        totalCreditPoints:
          null,

        requirements:
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