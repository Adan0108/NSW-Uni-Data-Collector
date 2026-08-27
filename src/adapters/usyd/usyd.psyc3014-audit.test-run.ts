import axios from 'axios';
import * as cheerio from 'cheerio';

import {
  fetchUsydUnit,
} from './usyd.unit-parser';

/**
 * ------------------------------------------------
 * USYD PSYC3014 FOCUSED AUDIT
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * PSYC3014 is the only remaining manual-review unit from
 * the 112 unresolved unit-detail failures.
 *
 * Current failure:
 *
 * "Could not determine USYD unit year."
 *
 * We want to inspect the raw page and compare it with a
 * normal working Psychology unit.
 *
 * This audit does NOT modify any parser logic.
 *
 * It only prints evidence so we can decide whether:
 *
 * 1. the page has a valid year in a different format
 * 2. the page has no year but otherwise valid content
 * 3. the page is effectively unavailable
 */

const TARGET_CODE =
  'PSYC3014';

const CONTROL_CODE =
  'PSYC2010';

function divider(): void {
  console.log(
    '================================',
  );
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(
      /\u00a0/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function unitUrl(
  code: string,
): string {
  return `https://www.sydney.edu.au/units/${code}`;
}

async function fetchRawPage(
  code: string,
): Promise<{
  code: string;
  url: string;
  status: number;
  title: string;
  heading: string | null;
  bodyText: string;
  html: string;
}> {
  const url =
    unitUrl(
      code,
    );

  const response =
    await axios.get<string>(
      url,
      {
        timeout:
          30000,

        maxRedirects:
          10,

        headers: {
          'User-Agent':
            'Mozilla/5.0 USYD handbook collector',
        },

        validateStatus: () =>
          true,
      },
    );

  const html =
    response.data;

  const $ =
    cheerio.load(
      html,
    );

  const title =
    normalizeText(
      $('title')
        .first()
        .text(),
    );

  const headingText =
    normalizeText(
      $('h1')
        .first()
        .text(),
    );

  const heading =
    headingText.length >
    0
      ? headingText
      : null;

  const bodyText =
    normalizeText(
      $('body')
        .text(),
    );

  return {
    code,
    url,
    status:
      response.status,
    title,
    heading,
    bodyText,
    html,
  };
}

function findYearCandidates(
  bodyText: string,
): string[] {
  const matches =
    bodyText.match(
      /\b(?:19|20)\d{2}\b/g,
    ) ??
    [];

  return [
    ...new Set(
      matches,
    ),
  ];
}

function extractContextAround(
  bodyText: string,
  searchText: string,
  radius = 300,
): string | null {
  const index =
    bodyText
      .toLowerCase()
      .indexOf(
        searchText
          .toLowerCase(),
      );

  if (
    index <
    0
  ) {
    return null;
  }

  const start =
    Math.max(
      0,
      index -
        radius,
    );

  const end =
    Math.min(
      bodyText.length,
      index +
        searchText.length +
        radius,
    );

  return bodyText
    .slice(
      start,
      end,
    )
    .trim();
}

function printRawPage(
  label: string,
  page: {
    code: string;
    url: string;
    status: number;
    title: string;
    heading: string | null;
    bodyText: string;
  },
): void {
  divider();

  console.log(
    label,
  );

  divider();

  console.log(
    `Code: ${page.code}`,
  );

  console.log(
    `URL: ${page.url}`,
  );

  console.log(
    `HTTP status: ${page.status}`,
  );

  console.log(
    `Title: ${page.title || 'NONE'}`,
  );

  console.log(
    `Heading: ${page.heading ?? 'NONE'}`,
  );

  console.log('');

  console.log(
    'YEAR CANDIDATES',
  );

  const years =
    findYearCandidates(
      page.bodyText,
    );

  console.log(
    years.length >
      0
      ? years.join(
          ', ',
        )
      : 'NONE',
  );

  console.log('');

  const codeContext =
    extractContextAround(
      page.bodyText,
      page.code,
    );

  console.log(
    'CONTEXT AROUND UNIT CODE',
  );

  console.log(
    codeContext ??
      'NONE',
  );

  console.log('');

  const yearContext =
    extractContextAround(
      page.bodyText,
      '2026',
    );

  console.log(
    'CONTEXT AROUND "2026"',
  );

  console.log(
    yearContext ??
      'NONE',
  );

  console.log('');

  const creditPointContext =
    extractContextAround(
      page.bodyText,
      'credit point',
    );

  console.log(
    'CONTEXT AROUND CREDIT POINTS',
  );

  console.log(
    creditPointContext ??
      'NONE',
  );

  console.log('');

  const prerequisiteContext =
    extractContextAround(
      page.bodyText,
      'prerequisite',
    );

  console.log(
    'CONTEXT AROUND PREREQUISITE',
  );

  console.log(
    prerequisiteContext ??
      'NONE',
  );

  console.log('');

  const availabilityContext =
    extractContextAround(
      page.bodyText,
      'availability',
    );

  console.log(
    'CONTEXT AROUND AVAILABILITY',
  );

  console.log(
    availabilityContext ??
      'NONE',
  );
}

async function testExistingParser(
  code: string,
): Promise<void> {
  divider();

  console.log(
    `EXISTING PARSER TEST — ${code}`,
  );

  divider();

  try {
    const unit =
      await fetchUsydUnit(
        code,
      );

    console.log(
      'PASS',
    );

    console.log(
      `Code: ${unit.code}`,
    );

    console.log(
      `Name: ${unit.name}`,
    );

    console.log(
      `Year: ${unit.year}`,
    );

    console.log(
      `Study level: ${unit.studyLevel ?? 'NONE'}`,
    );

    console.log(
      `Academic unit: ${unit.academicUnit ?? 'NONE'}`,
    );

    console.log(
      `Faculty: ${unit.managingFaculty ?? 'NONE'}`,
    );

    console.log(
      `CP: ${unit.creditPoints ?? 'NONE'}`,
    );

    console.log(
      `P: ${unit.accessConditions.prerequisite ?? 'NONE'}`,
    );

    console.log(
      `C: ${unit.accessConditions.corequisite ?? 'NONE'}`,
    );

    console.log(
      `N: ${unit.accessConditions.prohibition ?? 'NONE'}`,
    );

    console.log(
      `A: ${unit.accessConditions.assumedKnowledge ?? 'NONE'}`,
    );

    console.log(
      `Availability records: ${unit.availabilities.length}`,
    );

    console.log(
      `Learning outcomes: ${unit.learningOutcomes.length}`,
    );

    console.log(
      `Source: ${unit.sourceUrl}`,
    );
  } catch (
    error
  ) {
    console.log(
      'FAIL',
    );

    console.log(
      error instanceof Error
        ? error.message
        : String(
            error,
          ),
    );
  }
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD PSYC3014 FOCUSED AUDIT',
  );

  divider();

  /**
   * ------------------------------------------------
   * FETCH RAW TARGET
   * ------------------------------------------------
   */

  const target =
    await fetchRawPage(
      TARGET_CODE,
    );

  printRawPage(
    'TARGET RAW PAGE — PSYC3014',
    target,
  );

  /**
   * ------------------------------------------------
   * FETCH RAW CONTROL
   * ------------------------------------------------
   *
   * Use a working Psychology unit so we can compare page
   * structure.
   */

  const control =
    await fetchRawPage(
      CONTROL_CODE,
    );

  printRawPage(
    'CONTROL RAW PAGE — PSYC2010',
    control,
  );

  /**
   * ------------------------------------------------
   * BODY STRUCTURE COMPARISON
   * ------------------------------------------------
   */

  divider();

  console.log(
    'RAW PAGE COMPARISON',
  );

  divider();

  console.log(
    `PSYC3014 HTTP: ${target.status}`,
  );

  console.log(
    `PSYC2010 HTTP: ${control.status}`,
  );

  console.log(
    `PSYC3014 body chars: ${target.bodyText.length}`,
  );

  console.log(
    `PSYC2010 body chars: ${control.bodyText.length}`,
  );

  console.log(
    `PSYC3014 year candidates: ${
      findYearCandidates(
        target.bodyText,
      ).join(
        ', ',
      ) ||
      'NONE'
    }`,
  );

  console.log(
    `PSYC2010 year candidates: ${
      findYearCandidates(
        control.bodyText,
      ).join(
        ', ',
      ) ||
      'NONE'
    }`,
  );

  console.log(
    `PSYC3014 says page not found: ${
      target.bodyText
        .toLowerCase()
        .includes(
          'page not found',
        )
        ? 'YES'
        : 'NO'
    }`,
  );

  console.log(
    `PSYC3014 says not available: ${
      target.bodyText
        .toLowerCase()
        .includes(
          'unit of study is not available',
        )
        ? 'YES'
        : 'NO'
    }`,
  );

  /**
   * ------------------------------------------------
   * EXISTING PARSER COMPARISON
   * ------------------------------------------------
   */

  await testExistingParser(
    TARGET_CODE,
  );

  await testExistingParser(
    CONTROL_CODE,
  );

  /**
   * ------------------------------------------------
   * FINAL EVIDENCE
   * ------------------------------------------------
   */

  const targetYears =
    findYearCandidates(
      target.bodyText,
    );

  const targetUnavailable =
    target.bodyText
      .toLowerCase()
      .includes(
        'unit of study is not available',
      );

  const targetPageNotFound =
    target.bodyText
      .toLowerCase()
      .includes(
        'page not found',
      );

  divider();

  console.log(
    'AUDIT DECISION SUPPORT',
  );

  divider();

  if (
    targetPageNotFound
  ) {
    console.log(
      'Likely classification: PAGE_NOT_FOUND',
    );
  } else if (
    targetUnavailable
  ) {
    console.log(
      'Likely classification: NOT_AVAILABLE_OR_UNDER_DEVELOPMENT',
    );
  } else if (
    targetYears.length ===
    0
  ) {
    console.log(
      'Likely classification: VALID PAGE WITH NO DETECTABLE YEAR',
    );

    console.log(
      'Next action: inspect parser year assumption before changing schema.',
    );
  } else {
    console.log(
      'Year text exists on page but existing parser could not detect it.',
    );

    console.log(
      'Next action: minimally update year extraction logic.',
    );
  }

  divider();

  console.log(
    'END PSYC3014 AUDIT',
  );

  divider();
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