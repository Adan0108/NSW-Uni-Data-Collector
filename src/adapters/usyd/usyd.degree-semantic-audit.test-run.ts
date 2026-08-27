import {
  discoverUsydUndergraduateDegrees,
} from './usyd.global-degree-discovery';

import {
  parseUsydGlobalCourse,
} from './usyd.global-degree-parser';

/**
 * Awards that we want to inspect in detail.
 *
 * This includes:
 *
 * 1. All remaining FALLBACK-only awards.
 * 2. Awards that previously exposed CP parsing bugs.
 * 3. Important combined degrees whose totals were
 *    manually verified from their official resolutions.
 */
const AUDIT_CODES =
  new Set<string>([
    /*
     * ------------------------------------------------
     * FALLBACK-ONLY AWARDS
     * ------------------------------------------------
     */

    'BHADVFGB-01',
    'BHADVMDC-03',
    'BHADVTWC-01',

    'BPARCENV-01',
    'BHARCENV-01',

    'BUDARCHI-01',
    'BHDARCHH-01',

    'BPLIARSC-02',
    'BHLIARSH-01',

    'BUNUPORE-01',
    'BUNUPORE-02',

    'BPPRJMGT-02',
    'BHPRJMGT-01',

    'BHSCIFGB-01',
    'BHSCITWC-01',

    'BPSCINUD-02',

    /*
     * ------------------------------------------------
     * IMPORTANT MATCHED AWARDS
     * ------------------------------------------------
     *
     * These previously exposed parser issues or have
     * important combined-degree totals.
     */

    'BPARTNUR-02',

    'BPEDSAVS-01',

    'BHENGPRM-05',
    'BHENGSCI-05',
  ]);

/**
 * CP values that have been directly verified from the
 * official resolution wording.
 *
 * IMPORTANT:
 *
 * Do NOT add a value here merely because the current
 * parser happens to output it.
 *
 * This map is intended to work as a regression test.
 *
 * If one of these changes, the audit should fail.
 */
const EXPECTED_CP =
  new Map<string, number>([
    /*
     * Bachelor of Arts + Master of Nursing
     *
     * Official combined award:
     * 192 CP
     */
    [
      'BPARTNUR-02',
      192,
    ],
        /*
     * Architecture and Environments Honours.
     *
     * Separate 48 CP Honours program.
     * Do not inherit the 144 CP pass-degree total.
     */
    [
      'BHARCENV-01',
      48,
    ],

    /*
     * Design in Architecture Honours.
     *
     * Separate 48 CP Honours program.
     */
    [
      'BHDARCHH-01',
      48,
    ],

    /*
     * Project Management Honours.
     *
     * Separate 48 CP Honours program.
     */
    [
      'BHPRJMGT-01',
      48,
    ],
    /*
 * Science Honours variants.
 *
 * Verified as 48 CP Honours awards.
 */
[
  'BHSCIFGB-01',
  48,
],

[
  'BHSCITWC-01',
  48,
],

    /*
     * Post-registration Nursing.
     *
     * Total award:
     * 144 CP
     *
     * The remaining USYD study can be 48 CP,
     * but that is NOT the total award size.
     */
    [
      'BUNUPORE-01',
      144,
    ],

    [
      'BUNUPORE-02',
      144,
    ],

    /*
     * Bachelor of Science +
     * Master of Nutrition and Dietetics.
     *
     * 144 CP Bachelor component
     * +
     * 96 CP Master component
     * =
     * 240 CP total.
     */
    [
      'BPSCINUD-02',
      240,
    ],

    /*
     * Bachelor of Education +
     * Bachelor of Advanced Studies (Secondary).
     */
    [
      'BPEDSAVS-01',
      240,
    ],

    /*
     * Engineering Honours +
     * Project Management.
     *
     * 156 CP Engineering component
     * +
     * 84 CP Project Management
     * =
     * 240 CP.
     */
    [
      'BHENGPRM-05',
      240,
    ],

    /*
     * Engineering Honours +
     * Science.
     *
     * Official combined award total:
     * 240 CP.
     */
    [
      'BHENGSCI-05',
      240,
    ],
  ]);

/**
 * Some course pages are duplicated across handbook
 * faculties.
 *
 * Example:
 *
 * Bachelor of Arts and Master of Nursing exists under
 * both Arts and Medicine & Health.
 *
 * We therefore track occurrences separately from
 * unique award codes.
 */
interface AuditOccurrence {
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

/**
 * Pretty output helper.
 */
function printDivider(): void {
  console.log(
    '================================',
  );
}

async function main(): Promise<void> {
  printDivider();

  console.log(
    'USYD DEGREE SEMANTIC AUDIT',
  );

  printDivider();

  const discovered =
    await discoverUsydUndergraduateDegrees();

  const foundCodes =
    new Set<string>();

  const occurrences:
    AuditOccurrence[] = [];

  const cpFailures:
    string[] = [];

  /*
   * Parse every discovered course page.
   *
   * We intentionally use the same production parser
   * here rather than duplicating parser logic inside
   * the test.
   */
  for (
    const course
    of discovered
  ) {
    /*
     * Current special Law Honours discovery entry is
     * not a normal independent award page.
     *
     * Keep the same skip used by the other audit
     * runners until Law discovery is reviewed later.
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
      of relevantAwards
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
        `Requirements: ${award.awardRequirements.length}`,
      );

      /*
       * ------------------------------------------------
       * REGRESSION CHECK
       * ------------------------------------------------
       */

      const expectedCp =
        EXPECTED_CP.get(
          award.code,
        );

      if (
        expectedCp !== undefined
      ) {
        const actualCp =
          award.totalCreditPoints;

        const pass =
          actualCp ===
          expectedCp;

        console.log(
          `Expected CP: ${expectedCp}`,
        );

        console.log(
          `CP check: ${
            pass
              ? 'PASS'
              : 'FAIL'
          }`,
        );

        if (!pass) {
          cpFailures.push(
            [
              award.code,
              `expected ${expectedCp}`,
              `received ${
                actualCp ??
                'NONE'
              }`,
              course.handbookCategory,
              parsed.sourceUrl,
            ].join(
              ' | ',
            ),
          );
        }
      }

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

  /*
   * ------------------------------------------------
   * SUMMARY
   * ------------------------------------------------
   */

  printDivider();

  console.log(
    'SEMANTIC AUDIT SUMMARY',
  );

  printDivider();

  console.log(
    `Requested codes: ${AUDIT_CODES.size}`,
  );

  console.log(
    `Unique codes found: ${foundCodes.size}`,
  );

  console.log(
    `Award occurrences: ${occurrences.length}`,
  );

  console.log(
    `Locked CP expectations: ${EXPECTED_CP.size}`,
  );

  console.log(
    `CP failures: ${cpFailures.length}`,
  );

  /*
   * Check that every requested audit code was
   * actually discovered.
   */
  const missingCodes =
    [...AUDIT_CODES].filter(
      (code) =>
        !foundCodes.has(
          code,
        ),
    );

  console.log(
    `Missing audit codes: ${missingCodes.length}`,
  );

  if (
    missingCodes.length >
    0
  ) {
    console.log('');

    console.log(
      'MISSING AUDIT CODES',
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

  /*
   * Print CP regressions clearly.
   */
  if (
    cpFailures.length >
    0
  ) {
    console.log('');

    console.log(
      'CP REGRESSION FAILURES',
    );

    for (
      const failure
      of cpFailures
    ) {
      console.log(
        `- ${failure}`,
      );
    }
  }

  /*
   * ------------------------------------------------
   * FINAL RESULT
   * ------------------------------------------------
   */

  const passed =
    missingCodes.length ===
      0 &&
    cpFailures.length ===
      0;

  console.log('');

  console.log(
    `RESULT: ${
      passed
        ? 'PASS'
        : 'FAIL'
    }`,
  );

  /*
   * Make the script behave like a real test.
   *
   * CI / PowerShell will receive a non-zero exit
   * status when an expected value regresses.
   */
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