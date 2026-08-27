import {
  discoverUsydUndergraduateDegrees,
} from './usyd.global-degree-discovery';

import {
  parseUsydGlobalCourse,
} from './usyd.global-degree-parser';

/**
 * These are the remaining fallback/shared-Honours cases
 * that still need manual semantic verification.
 *
 * The goal is NOT to force every award to become
 * "MATCHED".
 *
 * We only want to determine whether:
 *
 * 1. the Honours code legitimately shares the same
 *    curriculum / total CP as the pass degree, or
 *
 * 2. there is a separate Honours rule that our parser
 *    is currently missing.
 */
const AUDIT_CODES =
  new Set<string>([
    /*
     * Architecture and Environments
     */
    'BPARCENV-01',
    'BHARCENV-01',

    /*
     * Design in Architecture
     */
    'BUDARCHI-01',
    'BHDARCHH-01',

    /*
     * Project Management
     */
    'BPPRJMGT-02',
    'BHPRJMGT-01',

    /*
     * Liberal Arts and Science
     */
    'BPLIARSC-02',
    'BHLIARSH-01',

    /*
     * Science Honours variants
     */
    'BHSCIFGB-01',
    'BHSCITWC-01',
  ]);

/**
 * Compact record used for the summary at the end.
 */
interface AuditRecord {
  code: string;

  title: string;

  handbookCategory: string;

  sourceUrl: string;

  resolutionsUrl: string | null;

  totalCreditPoints: number | null;

  matchedAwardSection: boolean;

  matchMethod: string;

  requirementCount: number;

  rawAwardRequirements: string | null;
}

function divider(): void {
  console.log(
    '================================',
  );
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD SHARED / HONOURS AUDIT',
  );

  divider();

  const discovered =
    await discoverUsydUndergraduateDegrees();

  const records:
    AuditRecord[] = [];

  const foundCodes =
    new Set<string>();

  for (
    const course
    of discovered
  ) {
    /*
     * Same temporary Law exception used in the other
     * global degree audit runners.
     *
     * Law discovery will be reviewed separately.
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
          AUDIT_CODES.has(
            award.code,
          ),
      );

    if (
      relevantAwards.length ===
      0
    ) {
      continue;
    }

    divider();

    console.log(
      `PAGE: ${course.name}`,
    );

    divider();

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

    /*
     * Show every course code on the page.
     *
     * This is important because we need to see whether
     * the pass and Honours codes are genuinely declared
     * together by USYD.
     */
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

    for (
      const award
      of relevantAwards
    ) {
      foundCodes.add(
        award.code,
      );

      records.push({
        code:
          award.code,

        title:
          award.title,

        handbookCategory:
          course.handbookCategory,

        sourceUrl:
          parsed.sourceUrl,

        resolutionsUrl:
          parsed.resolutionsUrl,

        totalCreditPoints:
          award.totalCreditPoints,

        matchedAwardSection:
          award.matchedAwardSection,

        matchMethod:
          award.matchMethod,

        requirementCount:
          award.awardRequirements.length,

        rawAwardRequirements:
          award.rawAwardRequirements,
      });

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
        `Method: ${award.matchMethod}`,
      );

      console.log(
        `Requirement count: ${award.awardRequirements.length}`,
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
    }

    console.log('');
  }

  /*
   * ------------------------------------------------
   * SUMMARY
   * ------------------------------------------------
   */

  divider();

  console.log(
    'SHARED / HONOURS AUDIT SUMMARY',
  );

  divider();

  console.log(
    `Expected codes: ${AUDIT_CODES.size}`,
  );

  console.log(
    `Unique codes found: ${foundCodes.size}`,
  );

  console.log(
    `Occurrences found: ${records.length}`,
  );

  const missing =
    [...AUDIT_CODES].filter(
      (code) =>
        !foundCodes.has(
          code,
        ),
    );

  console.log(
    `Missing codes: ${missing.length}`,
  );

  if (
    missing.length >
    0
  ) {
    console.log('');

    console.log(
      'MISSING CODES',
    );

    for (
      const code
      of missing
    ) {
      console.log(
        `- ${code}`,
      );
    }
  }

  console.log('');

  console.log(
    'COMPACT REVIEW',
  );

  for (
    const record
    of records
  ) {
    console.log(
      [
        record.code,
        `CP=${
          record.totalCreditPoints ??
          'NONE'
        }`,
        `matched=${
          record.matchedAwardSection
            ? 'YES'
            : 'NO'
        }`,
        `method=${record.matchMethod}`,
        `requirements=${record.requirementCount}`,
        `category=${record.handbookCategory}`,
      ].join(
        ' | ',
      ),
    );
  }

  /*
   * ------------------------------------------------
   * AUTOMATIC HINTS
   * ------------------------------------------------
   *
   * These are only hints for manual review.
   *
   * They DO NOT automatically decide that a record
   * is correct or incorrect.
   */

  console.log('');

  console.log(
    'REVIEW HINTS',
  );

  for (
    const record
    of records
  ) {
    const raw =
      record.rawAwardRequirements ??
      '';

    const mentionsPassDegree =
      /pass degree/i.test(
        raw,
      );

    const mentionsHonours =
      /honours/i.test(
        raw,
      );

    const explicitlyMentionsTitle =
      raw
        .toLowerCase()
        .includes(
          record.title.toLowerCase(),
        );

    const hints:
      string[] = [];

    if (
      mentionsPassDegree
    ) {
      hints.push(
        'contains pass-degree wording',
      );
    }

    if (
      mentionsHonours
    ) {
      hints.push(
        'contains Honours wording',
      );
    }

    if (
      explicitlyMentionsTitle
    ) {
      hints.push(
        'raw text explicitly mentions award title',
      );
    }

    if (
      hints.length ===
      0
    ) {
      hints.push(
        'no obvious classification hint',
      );
    }

    console.log(
      `${record.code}: ${hints.join(
        '; ',
      )}`,
    );
  }

  /*
   * This audit only fails if we fail to discover one
   * of the expected records.
   *
   * Semantic classification remains manual because
   * we do not want to infer Honours structure from
   * naming alone.
   */
  const passed =
    missing.length ===
    0;

  console.log('');

  console.log(
    `RESULT: ${
      passed
        ? 'PASS'
        : 'FAIL'
    }`,
  );

  if (!passed) {
    process.exitCode =
      1;
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