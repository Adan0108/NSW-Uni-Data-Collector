import {
  discoverUsydUndergraduateDegrees,
} from './usyd.global-degree-discovery';

import {
  parseUsydGlobalCourse,
} from './usyd.global-degree-parser';

/**
 * These are the 16 awards currently reported by the
 * normalizer as FALLBACK-only.
 *
 * A FALLBACK result does NOT automatically mean that
 * the parser is wrong.
 *
 * Some USYD resolutions use:
 *
 * - generic "pass degree" wording
 * - shared Honours resolutions
 * - shared curriculum rules
 * - stream-specific course codes
 *
 * In those cases there may be no award-title-specific
 * clause for our parser to match.
 *
 * The purpose of this audit is therefore to classify
 * each fallback manually before changing production
 * parsing behaviour.
 */
const FALLBACK_CODES =
  new Set<string>([
    /*
     * Advanced Studies Honours variants.
     */
    'BHADVFGB-01',
    'BHADVMDC-03',
    'BHADVTWC-01',

    /*
     * Architecture shared pass/Honours resolutions.
     */
    'BPARCENV-01',
    'BHARCENV-01',

    'BUDARCHI-01',
    'BHDARCHH-01',

    /*
     * Liberal Arts and Science shared resolution.
     */
    'BPLIARSC-02',
    'BHLIARSH-01',

    /*
     * Nursing post-registration variants.
     */
    'BUNUPORE-01',
    'BUNUPORE-02',

    /*
     * Project Management shared resolution.
     */
    'BPPRJMGT-02',
    'BHPRJMGT-01',

    /*
     * Science Honours variants.
     */
    'BHSCIFGB-01',
    'BHSCITWC-01',

    /*
     * Combined Bachelor + Master.
     */
    'BPSCINUD-02',
  ]);

/**
 * Result collected for each fallback occurrence.
 *
 * One course code can potentially occur on more than
 * one handbook page, so we retain the source page.
 */
interface FallbackOccurrence {
  code: string;

  title: string;

  handbookCategory: string;

  sourceUrl: string;

  resolutionsUrl: string | null;

  totalCreditPoints: number | null;

  matchedAwardSection: boolean;

  matchMethod: string;

  requirementCount: number;
}

function printDivider(): void {
  console.log(
    '================================',
  );
}

async function main(): Promise<void> {
  printDivider();

  console.log(
    'USYD FALLBACK AWARD AUDIT',
  );

  printDivider();

  const discovered =
    await discoverUsydUndergraduateDegrees();

  const foundCodes =
    new Set<string>();

  const occurrences:
    FallbackOccurrence[] = [];

  /*
   * Parse every discovered course page.
   */
  for (
    const course
    of discovered
  ) {
    /*
     * Keep the current Law Honours exception aligned
     * with the other USYD degree audit runners.
     *
     * Law discovery will be audited separately later.
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

    const fallbackAwards =
      parsed.awards.filter(
        (award) =>
          FALLBACK_CODES.has(
            award.code,
          ),
      );

    if (
      fallbackAwards.length ===
      0
    ) {
      continue;
    }

    printDivider();

    console.log(
      `PAGE: ${course.name}`,
    );

    printDivider();

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

    for (
      const award
      of fallbackAwards
    ) {
      foundCodes.add(
        award.code,
      );

      occurrences.push({
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

      /*
       * This is the most important part of this audit.
       *
       * We want to see whether the raw resolution
       * genuinely contains a separate award rule or
       * whether the course code intentionally shares
       * another generic rule.
       */
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

  /*
   * ------------------------------------------------
   * SUMMARY
   * ------------------------------------------------
   */

  printDivider();

  console.log(
    'FALLBACK AUDIT SUMMARY',
  );

  printDivider();

  console.log(
    `Fallback codes expected: ${FALLBACK_CODES.size}`,
  );

  console.log(
    `Unique fallback codes found: ${foundCodes.size}`,
  );

  console.log(
    `Fallback occurrences found: ${occurrences.length}`,
  );

  /*
   * Verify that discovery still finds every fallback
   * award we intend to inspect.
   */
  const missingCodes =
    [...FALLBACK_CODES].filter(
      (code) =>
        !foundCodes.has(
          code,
        ),
    );

  console.log(
    `Missing fallback codes: ${missingCodes.length}`,
  );

  if (
    missingCodes.length >
    0
  ) {
    console.log('');

    console.log(
      'MISSING FALLBACK CODES',
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

  console.log('');

  console.log(
    'FALLBACK OVERVIEW',
  );

  /*
   * Compact overview after the large raw output.
   *
   * This makes it easier to compare the 16 records.
   */
  for (
    const occurrence
    of occurrences
  ) {
    console.log(
      [
        occurrence.code,
        `CP=${
          occurrence.totalCreditPoints ??
          'NONE'
        }`,
        `matched=${
          occurrence.matchedAwardSection
            ? 'YES'
            : 'NO'
        }`,
        `method=${occurrence.matchMethod}`,
        `requirements=${occurrence.requirementCount}`,
        `category=${occurrence.handbookCategory}`,
      ].join(
        ' | ',
      ),
    );
  }

  /*
   * This runner only fails when an expected fallback
   * code disappears completely.
   *
   * It does NOT fail merely because the award uses
   * FALLBACK.
   */
  const passed =
    missingCodes.length ===
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