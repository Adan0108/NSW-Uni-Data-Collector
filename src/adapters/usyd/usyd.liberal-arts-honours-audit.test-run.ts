import axios from 'axios';
import * as cheerio from 'cheerio';

import {
  discoverUsydUndergraduateDegrees,
} from './usyd.global-degree-discovery';

import {
  parseUsydGlobalCourse,
} from './usyd.global-degree-parser';

const TARGET_CODE =
  'BHLIARSH-01';

function normalizeText(
  value: string,
): string {
  return value
    .replace(
      /[\u200B-\u200D\uFEFF]/g,
      '',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function divider(): void {
  console.log(
    '================================',
  );
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD LIBERAL ARTS HONOURS AUDIT',
  );

  divider();

  /*
   * ------------------------------------------------
   * 1. FIND THE DEGREE PAGE
   * ------------------------------------------------
   *
   * We reuse the normal global discovery instead of
   * hardcoding the URL.
   */
  const discovered =
    await discoverUsydUndergraduateDegrees();

  let targetCourse =
    null as
      | (typeof discovered)[number]
      | null;

  for (
    const course
    of discovered
  ) {
    const parsed =
      await parseUsydGlobalCourse(
        course,
      );

    const hasTarget =
      parsed.awards.some(
        (award) =>
          award.code ===
          TARGET_CODE,
      );

    if (hasTarget) {
      targetCourse =
        course;

      break;
    }
  }

  if (!targetCourse) {
    throw new Error(
      `Could not find ${TARGET_CODE}`,
    );
  }

  /*
   * ------------------------------------------------
   * 2. PARSE THE COURSE USING OUR CURRENT PARSER
   * ------------------------------------------------
   */
  const parsed =
    await parseUsydGlobalCourse(
      targetCourse,
    );

  const award =
    parsed.awards.find(
      (item) =>
        item.code ===
        TARGET_CODE,
    );

  if (!award) {
    throw new Error(
      `Parsed course does not contain ${TARGET_CODE}`,
    );
  }

  divider();

  console.log(
    'CURRENT PARSED AWARD',
  );

  divider();

  console.log(
    `Code: ${award.code}`,
  );

  console.log(
    `Title: ${award.title}`,
  );

  console.log(
    `Current CP: ${
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
    `Source: ${parsed.sourceUrl}`,
  );

  console.log(
    `Resolutions: ${
      parsed.resolutionsUrl ??
      'NONE'
    }`,
  );

  /*
   * ------------------------------------------------
   * 3. PRINT ALL COURSE CODES ON THE PAGE
   * ------------------------------------------------
   *
   * We want to confirm that the pass degree and Honours
   * degree are declared together on the same page.
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

  /*
   * ------------------------------------------------
   * 4. FETCH THE OFFICIAL RESOLUTION PAGE DIRECTLY
   * ------------------------------------------------
   */
  if (!parsed.resolutionsUrl) {
    throw new Error(
      'No resolutions URL found.',
    );
  }

  const response =
    await axios.get<string>(
      parsed.resolutionsUrl,
      {
        maxRedirects: 10,
      },
    );

  const $ =
    cheerio.load(
      response.data,
    );

  const bodyText =
    normalizeText(
      $('body').text(),
    );

  divider();

  console.log(
    'HONOURS TEXT MATCHES',
  );

  divider();

  /*
   * ------------------------------------------------
   * 5. PRINT SENTENCES / TEXT WINDOWS AROUND "HONOURS"
   * ------------------------------------------------
   *
   * This is the important evidence.
   *
   * We are looking for wording such as:
   *
   * - 48 credit points
   * - additional year
   * - honours year
   * - after completing the pass degree
   * - separate honours program
   */
  const lowerBody =
    bodyText.toLowerCase();

  let searchIndex =
    0;

  let honourMatchCount =
    0;

  while (true) {
    const index =
      lowerBody.indexOf(
        'honours',
        searchIndex,
      );

    if (index === -1) {
      break;
    }

    honourMatchCount += 1;

    const start =
      Math.max(
        0,
        index - 250,
      );

    const end =
      Math.min(
        bodyText.length,
        index + 500,
      );

    console.log('');

    console.log(
      `HONOURS MATCH ${honourMatchCount}`,
    );

    console.log(
      bodyText.slice(
        start,
        end,
      ),
    );

    searchIndex =
      index + 7;
  }

  console.log('');

  console.log(
    `Honours matches found: ${honourMatchCount}`,
  );

  /*
   * ------------------------------------------------
   * 6. LOOK FOR EXPLICIT CREDIT-POINT WORDING
   * ------------------------------------------------
   */
  divider();

  console.log(
    'CREDIT POINT EVIDENCE',
  );

  divider();

  const cpPatterns =
    [
      /\b48\s+credit points?\b/gi,
      /\b144\s+credit points?\b/gi,
      /\b192\s+credit points?\b/gi,
    ];

  for (
    const pattern
    of cpPatterns
  ) {
    const matches =
      [
        ...bodyText.matchAll(
          pattern,
        ),
      ];

    console.log(
      `${pattern.source}: ${matches.length}`,
    );

    for (
      const match
      of matches
    ) {
      if (
        match.index ===
        undefined
      ) {
        continue;
      }

      const start =
        Math.max(
          0,
          match.index - 180,
        );

      const end =
        Math.min(
          bodyText.length,
          match.index + 300,
        );

      console.log(
        bodyText.slice(
          start,
          end,
        ),
      );

      console.log('');
    }
  }

  /*
   * ------------------------------------------------
   * 7. LOOK FOR HONOURS-RELATED LINKS
   * ------------------------------------------------
   *
   * Sometimes the resolution page only gives the pass
   * degree requirements while a separate Honours page
   * or unit table contains the real Honours structure.
   */
  divider();

  console.log(
    'HONOURS-RELATED LINKS',
  );

  divider();

  const seenLinks =
    new Set<string>();

  $('a').each(
    (_, element) => {
      const anchor =
        $(element);

      const text =
        normalizeText(
          anchor.text(),
        );

      const href =
        anchor.attr(
          'href',
        );

      if (!href) {
        return;
      }

      if (
        !/honours/i.test(
          text,
        ) &&
        !/honours/i.test(
          href,
        )
      ) {
        return;
      }

      const url =
        new URL(
          href,
          parsed.resolutionsUrl!,
        ).toString();

      const key =
        `${text}::${url}`;

      if (
        seenLinks.has(
          key,
        )
      ) {
        return;
      }

      seenLinks.add(
        key,
      );

      console.log(
        `- ${text || '(no text)'}`,
      );

      console.log(
        `  ${url}`,
      );
    },
  );

  /*
   * ------------------------------------------------
   * 8. CURRENT RAW PARSER SECTION
   * ------------------------------------------------
   */
  divider();

  console.log(
    'CURRENT RAW AWARD REQUIREMENTS',
  );

  divider();

  console.log(
    award.rawAwardRequirements ??
    'NONE',
  );

  /*
   * ------------------------------------------------
   * 9. FINAL REVIEW
   * ------------------------------------------------
   *
   * This file intentionally does NOT automatically set
   * the CP value.
   *
   * We want to see the official wording first.
   */
  divider();

  console.log(
    'AUDIT COMPLETE',
  );

  divider();

  console.log(
    `Target: ${TARGET_CODE}`,
  );

  console.log(
    `Current parser CP: ${
      award.totalCreditPoints ??
      'NONE'
    }`,
  );

  console.log(
    'Review the Honours text and links above before changing production code.',
  );
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