import axios from 'axios';
import * as cheerio from 'cheerio';

import {
  discoverUsydUndergraduateDegrees,
  type UsydGlobalDegreeLink,
} from './usyd.global-degree-discovery';

import {
  parseUsydGlobalCourse,
} from './usyd.global-degree-parser';

/**
 * ------------------------------------------------
 * PURPOSE
 * ------------------------------------------------
 *
 * Verify that global USYD undergraduate degree
 * discovery is not missing important Law or
 * Engineering degree families.
 *
 * This audit:
 *
 * 1. Runs the current production degree discovery.
 * 2. Parses all discovered course pages.
 * 3. Lists Law-related awards.
 * 4. Lists Engineering-related awards.
 * 5. Crawls the Law handbook.
 * 6. Crawls the Engineering handbook.
 * 7. Filters out Engineering stream/pathway pages.
 * 8. Ignores known Law duplicate-source pages.
 * 9. Reports genuinely uncovered degree pages.
 *
 * IMPORTANT:
 *
 * This file is an audit only.
 * It does not modify production discovery.
 */

/**
 * ------------------------------------------------
 * HANDBOOK ROOTS
 * ------------------------------------------------
 */

const LAW_ROOT =
  'https://www.sydney.edu.au/handbooks/law/undergraduate.html';

const ENGINEERING_ROOT =
  'https://www.sydney.edu.au/handbooks/engineering.html';

/**
 * Conservative crawl depth.
 *
 * We only need enough depth to discover nested
 * degree-family pages.
 */
const MAX_DEPTH = 3;

/**
 * Safety limit so this audit does not accidentally
 * crawl large unrelated sections of the university
 * website.
 */
const MAX_PAGES_PER_ROOT = 250;

/**
 * ------------------------------------------------
 * TYPES
 * ------------------------------------------------
 */

interface CrawledPage {
  url: string;

  depth: number;

  sourceUrl: string | null;

  title: string;

  candidateDegreePage: boolean;
}

interface ParsedAwardSummary {
  code: string;

  title: string;

  category:
    UsydGlobalDegreeLink['handbookCategory'];

  discoveredName: string;

  sourceUrl: string;

  resolutionsUrl: string | null;

  totalCreditPoints: number | null;

  matchMethod: string;
}

/**
 * ------------------------------------------------
 * TEXT HELPERS
 * ------------------------------------------------
 */

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

function normalizeUrl(
  href: string,
  baseUrl: string,
): string | null {
  try {
    const url =
      new URL(
        href,
        baseUrl,
      );

    /*
     * Fragments do not represent a different page.
     */
    url.hash = '';

    return url.toString();
  } catch {
    return null;
  }
}

function divider(): void {
  console.log(
    '================================',
  );
}

/**
 * ------------------------------------------------
 * HANDBOOK URL FILTERS
 * ------------------------------------------------
 */

function isUsydHandbookUrl(
  url: string,
): boolean {
  try {
    const parsed =
      new URL(
        url,
      );

    return (
      parsed.hostname ===
        'www.sydney.edu.au' &&
      parsed.pathname.startsWith(
        '/handbooks/',
      )
    );
  } catch {
    return false;
  }
}

function isLawHandbookUrl(
  url: string,
): boolean {
  try {
    const parsed =
      new URL(
        url,
      );

    return (
      parsed.hostname ===
        'www.sydney.edu.au' &&
      parsed.pathname.startsWith(
        '/handbooks/law/',
      )
    );
  } catch {
    return false;
  }
}

function isEngineeringHandbookUrl(
  url: string,
): boolean {
  try {
    const parsed =
      new URL(
        url,
      );

    return (
      parsed.hostname ===
        'www.sydney.edu.au' &&
      parsed.pathname.startsWith(
        '/handbooks/engineering',
      )
    );
  } catch {
    return false;
  }
}

/**
 * Ignore pages that clearly cannot be degree pages.
 */
function shouldIgnoreUrl(
  url: string,
): boolean {
  return (
    /\.(?:pdf|jpg|jpeg|png|gif|svg|doc|docx|xls|xlsx)$/i.test(
      url,
    ) ||
    /\/units\//i.test(
      url,
    ) ||
    /unit-of-study-table/i.test(
      url,
    ) ||
    /subject-areas/i.test(
      url,
    ) ||
    /table-[a-z]\//i.test(
      url,
    )
  );
}

/**
 * ------------------------------------------------
 * DEGREE PAGE DETECTION
 * ------------------------------------------------
 */

function looksLikeDegreePage(
  url: string,
  title: string,
  bodyText: string,
): boolean {
  /*
   * ------------------------------------------------
   * EXCLUDE ENGINEERING COMPONENT PAGES
   * ------------------------------------------------
   *
   * Example:
   *
   * /engineering-honours/streams/software/overview.html
   *
   * Software is a stream inside the Engineering
   * Honours degree, not a standalone award.
   */
  if (
    /\/streams\//i.test(
      url,
    )
  ) {
    return false;
  }

  /*
   * Flexible First Year is a pathway into an
   * Engineering stream.
   *
   * It is not a separate degree award.
   */
  if (
    /\/flexible-first-year\//i.test(
      url,
    )
  ) {
    return false;
  }

  /*
   * ------------------------------------------------
   * URL SIGNAL
   * ------------------------------------------------
   */

  const urlSignal =
    /\/overview\.html$/i.test(
      url,
    ) ||
    /\/course-resolutions\.html$/i.test(
      url,
    ) ||
    /\/combined-course-resolutions\.html$/i.test(
      url,
    ) ||
    /\/resolutions\.html$/i.test(
      url,
    );

  /*
   * ------------------------------------------------
   * TITLE SIGNAL
   * ------------------------------------------------
   */

  const titleSignal =
    /\bBachelor\b/i.test(
      title,
    ) ||
    /\bDiploma\b/i.test(
      title,
    ) ||
    /\bHonours\b/i.test(
      title,
    );

  /*
   * ------------------------------------------------
   * COURSE-CODE TABLE SIGNAL
   * ------------------------------------------------
   */

  const courseCodeSignal =
    /\bCourse codes?\b/i.test(
      bodyText,
    ) &&
    (
      /\bCourse title\b/i.test(
        bodyText,
      ) ||
      /\bCourse and stream title\b/i.test(
        bodyText,
      )
    );

  /*
   * ------------------------------------------------
   * AWARD-REQUIREMENT SIGNAL
   * ------------------------------------------------
   */

  const resolutionSignal =
    /\bRequirements for award\b/i.test(
      bodyText,
    ) ||
    /\bTo qualify for the award\b/i.test(
      bodyText,
    );

  return (
    titleSignal &&
    (
      urlSignal ||
      courseCodeSignal ||
      resolutionSignal
    )
  );
}

/**
 * ------------------------------------------------
 * KNOWN DUPLICATE LAW SOURCES
 * ------------------------------------------------
 *
 * These are real Law handbook pages, but they represent
 * combined degrees already collected from their primary
 * faculty pages.
 *
 * Example:
 *
 * Arts + Laws is already discovered through Arts.
 *
 * The Law handbook version is therefore another source
 * for the same award, not a missing standalone degree.
 */

function isKnownLawDuplicateSource(
  url: string,
): boolean {
  return (
    /\/law\/undergraduate\/combined-laws\/arts-laws\.html$/i.test(
      url,
    ) ||
    /\/law\/undergraduate\/combined-laws\/commerce-laws\.html$/i.test(
      url,
    ) ||
    /\/law\/undergraduate\/combined-laws\/economics-laws\.html$/i.test(
      url,
    ) ||
    /\/law\/undergraduate\/combined-laws\/engineering-honours-laws\.html$/i.test(
      url,
    ) ||
    /\/law\/undergraduate\/combined-laws\/science-laws\.html$/i.test(
      url,
    )
  );
}

/**
 * ------------------------------------------------
 * FETCH
 * ------------------------------------------------
 */

async function fetchPage(
  url: string,
): Promise<{
  finalUrl: string;
  title: string;
  bodyText: string;
  links: string[];
}> {
  const response =
    await axios.get<string>(
      url,
      {
        maxRedirects: 10,

        timeout: 30_000,

        headers: {
          'User-Agent':
            'Mozilla/5.0 USYD handbook coverage audit',
        },
      },
    );

  const finalUrl =
    (
      response.request as {
        res?: {
          responseUrl?: string;
        };
      }
    )
      .res
      ?.responseUrl ??
    url;

  const $ =
    cheerio.load(
      response.data,
    );

  const title =
    normalizeText(
      $('h1').first().text(),
    ) ||
    normalizeText(
      $('title').text(),
    );

  const bodyText =
    normalizeText(
      $('body').text(),
    );

  const links =
    new Set<string>();

  $('a').each(
    (_, element) => {
      const href =
        $(element).attr(
          'href',
        );

      if (!href) {
        return;
      }

      const normalized =
        normalizeUrl(
          href,
          finalUrl,
        );

      if (!normalized) {
        return;
      }

      if (
        !isUsydHandbookUrl(
          normalized,
        )
      ) {
        return;
      }

      if (
        shouldIgnoreUrl(
          normalized,
        )
      ) {
        return;
      }

      links.add(
        normalized,
      );
    },
  );

  return {
    finalUrl,

    title,

    bodyText,

    links:
      [...links],
  };
}

/**
 * ------------------------------------------------
 * HANDBOOK CRAWLER
 * ------------------------------------------------
 */

async function crawlHandbook(
  rootUrl: string,

  urlAllowed:
    (url: string) => boolean,
): Promise<CrawledPage[]> {
  const results:
    CrawledPage[] = [];

  const visited =
    new Set<string>();

  const queue:
    Array<{
      url: string;
      depth: number;
      sourceUrl: string | null;
    }> =
    [
      {
        url:
          rootUrl,

        depth:
          0,

        sourceUrl:
          null,
      },
    ];

  while (
    queue.length >
      0 &&
    visited.size <
      MAX_PAGES_PER_ROOT
  ) {
    const current =
      queue.shift();

    if (!current) {
      break;
    }

    if (
      visited.has(
        current.url,
      )
    ) {
      continue;
    }

    if (
      !urlAllowed(
        current.url,
      )
    ) {
      continue;
    }

    visited.add(
      current.url,
    );

    try {
      const page =
        await fetchPage(
          current.url,
        );

      const candidateDegreePage =
        looksLikeDegreePage(
          page.finalUrl,
          page.title,
          page.bodyText,
        );

      results.push({
        url:
          page.finalUrl,

        depth:
          current.depth,

        sourceUrl:
          current.sourceUrl,

        title:
          page.title,

        candidateDegreePage,
      });

      if (
        current.depth >=
        MAX_DEPTH
      ) {
        continue;
      }

      for (
        const link
        of page.links
      ) {
        if (
          visited.has(
            link,
          )
        ) {
          continue;
        }

        if (
          !urlAllowed(
            link,
          )
        ) {
          continue;
        }

        queue.push({
          url:
            link,

          depth:
            current.depth +
            1,

          sourceUrl:
            page.finalUrl,
        });
      }
    } catch (
      error
    ) {
      console.log(
        `CRAWL ERROR: ${current.url}`,
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

  return results;
}

/**
 * ------------------------------------------------
 * COURSE-FAMILY URL NORMALIZATION
 * ------------------------------------------------
 */

function canonicalPageUrl(
  value: string,
): string {
  try {
    const url =
      new URL(
        value,
      );

    url.hash = '';

    /*
     * These pages all belong to the same degree family:
     *
     * /overview.html
     * /course-resolutions.html
     * /combined-course-resolutions.html
     * /resolutions.html
     *
     * Compare their directory rather than treating each
     * file as a different degree.
     */
    url.pathname =
      url.pathname.replace(
        /\/(?:overview|course-resolutions|combined-course-resolutions|resolutions)\.html$/i,
        '/',
      );

    return url.toString();
  } catch {
    return value;
  }
}

/**
 * ------------------------------------------------
 * AWARD CLASSIFICATION
 * ------------------------------------------------
 */

function isLawRelatedAward(
  award:
    ParsedAwardSummary,
): boolean {
  return (
    award.category ===
      'LAW' ||
    /\bLaws?\b/i.test(
      award.title,
    )
  );
}

function isEngineeringRelatedAward(
  award:
    ParsedAwardSummary,
): boolean {
  return (
    award.category ===
      'ENGINEERING' ||
    /\bEngineering\b/i.test(
      award.title,
    ) ||
    /\bAdvanced Computing\b/i.test(
      award.title,
    ) ||
    /\bProject Management\b/i.test(
      award.title,
    )
  );
}

/**
 * ------------------------------------------------
 * MAIN
 * ------------------------------------------------
 */

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD DEGREE COVERAGE AUDIT',
  );

  divider();

  /**
   * ------------------------------------------------
   * 1. RUN CURRENT PRODUCTION DISCOVERY
   * ------------------------------------------------
   */

  const discovered =
    await discoverUsydUndergraduateDegrees();

  console.log(
    `Current discovered course pages: ${discovered.length}`,
  );

  const parsedAwards:
    ParsedAwardSummary[] = [];

  const parsedCodes =
    new Set<string>();

  const discoveredPageFamilies =
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

    console.log(
      `Parsing ${
        index + 1
      }/${discovered.length}: ${course.name}`,
    );

    discoveredPageFamilies.add(
      canonicalPageUrl(
        course.overviewUrl,
      ),
    );

    /**
     * Law Honours is currently represented as an
     * embedded pathway rather than a standalone
     * course-code award.
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

    if (
      parsed.resolutionsUrl
    ) {
      discoveredPageFamilies.add(
        canonicalPageUrl(
          parsed.resolutionsUrl,
        ),
      );
    }

    for (
      const award
      of parsed.awards
    ) {
      parsedCodes.add(
        award.code,
      );

      parsedAwards.push({
        code:
          award.code,

        title:
          award.title,

        category:
          course.handbookCategory,

        discoveredName:
          course.name,

        sourceUrl:
          parsed.sourceUrl,

        resolutionsUrl:
          parsed.resolutionsUrl,

        totalCreditPoints:
          award.totalCreditPoints,

        matchMethod:
          award.matchMethod,
      });
    }
  }

  /**
   * ------------------------------------------------
   * 2. LAW AWARDS
   * ------------------------------------------------
   */

  const lawAwards =
    parsedAwards
      .filter(
        isLawRelatedAward,
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.title.localeCompare(
            right.title,
          ),
      );

  divider();

  console.log(
    'CURRENT LAW-RELATED AWARDS',
  );

  divider();

  for (
    const award
    of lawAwards
  ) {
    console.log(
      `${award.code} — ${award.title}`,
    );

    console.log(
      `  Category: ${award.category}`,
    );

    console.log(
      `  CP: ${
        award.totalCreditPoints ??
        'NONE'
      }`,
    );

    console.log(
      `  Source: ${award.sourceUrl}`,
    );

    console.log('');
  }

  const uniqueLawCodes =
    new Set(
      lawAwards.map(
        (award) =>
          award.code,
      ),
    );

  console.log(
    `Law-related award occurrences: ${lawAwards.length}`,
  );

  console.log(
    `Unique Law-related codes: ${uniqueLawCodes.size}`,
  );

  /**
   * ------------------------------------------------
   * 3. ENGINEERING AWARDS
   * ------------------------------------------------
   */

  const engineeringAwards =
    parsedAwards
      .filter(
        isEngineeringRelatedAward,
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.title.localeCompare(
            right.title,
          ),
      );

  divider();

  console.log(
    'CURRENT ENGINEERING-RELATED AWARDS',
  );

  divider();

  for (
    const award
    of engineeringAwards
  ) {
    console.log(
      `${award.code} — ${award.title}`,
    );

    console.log(
      `  Category: ${award.category}`,
    );

    console.log(
      `  CP: ${
        award.totalCreditPoints ??
        'NONE'
      }`,
    );

    console.log(
      `  Source: ${award.sourceUrl}`,
    );

    console.log('');
  }

  const uniqueEngineeringCodes =
    new Set(
      engineeringAwards.map(
        (award) =>
          award.code,
      ),
    );

  console.log(
    `Engineering-related award occurrences: ${engineeringAwards.length}`,
  );

  console.log(
    `Unique Engineering-related codes: ${uniqueEngineeringCodes.size}`,
  );

  /**
   * ------------------------------------------------
   * 4. KNOWN LAW REGRESSION CHECK
   * ------------------------------------------------
   *
   * These are awards already verified as part of our
   * current collector.
   *
   * This list is NOT being used to claim that it is the
   * entire Law catalogue.
   */

  const expectedCurrentLawCodes =
    [
      'BGLAWLAW-01',

      'BPARTLAW-04',

      'BPCOMLAW-05',

      'BPECNLAW-07',

      'BHENGLAW-04',

      'BPSCILAW-02',
    ];

  divider();

  console.log(
    'KNOWN LAW CODE REGRESSION CHECK',
  );

  divider();

  const missingKnownLawCodes =
    expectedCurrentLawCodes.filter(
      (code) =>
        !parsedCodes.has(
          code,
        ),
    );

  for (
    const code
    of expectedCurrentLawCodes
  ) {
    console.log(
      `${
        parsedCodes.has(
          code,
        )
          ? 'PASS'
          : 'FAIL'
      } ${code}`,
    );
  }

  /**
   * ------------------------------------------------
   * 5. KNOWN ENGINEERING REGRESSION CHECK
   * ------------------------------------------------
   */

  const expectedCurrentEngineeringCodes =
    [
      /*
       * Main Engineering Honours award.
       */
      'BHENGINE-04',

      /*
       * Engineering combined awards.
       */
      'BHENGART-05',

      'BHENGCOM-05',

      'BHENGDAR-03',

      'BHENGLAW-04',

      'BHENGPRM-05',

      'BHENGSCI-05',

      /*
       * Project Management.
       */
      'BPPRJMGT-02',

      'BHPRJMGT-01',

      /*
       * Advanced Computing family.
       */
      'BPADVCMP-01',

      'BPACMCOM-01',

      'BPACMSCI-01',

      'BPCOMPUT-01',
    ];

  divider();

  console.log(
    'KNOWN ENGINEERING CODE REGRESSION CHECK',
  );

  divider();

  const missingKnownEngineeringCodes =
    expectedCurrentEngineeringCodes.filter(
      (code) =>
        !parsedCodes.has(
          code,
        ),
    );

  for (
    const code
    of expectedCurrentEngineeringCodes
  ) {
    console.log(
      `${
        parsedCodes.has(
          code,
        )
          ? 'PASS'
          : 'FAIL'
      } ${code}`,
    );
  }

  /**
   * ------------------------------------------------
   * 6. CRAWL LAW
   * ------------------------------------------------
   */

  divider();

  console.log(
    'CRAWLING LAW HANDBOOK',
  );

  divider();

  const lawCrawl =
    await crawlHandbook(
      LAW_ROOT,
      isLawHandbookUrl,
    );

  console.log(
    `Law pages crawled: ${lawCrawl.length}`,
  );

  const lawCandidates =
    lawCrawl.filter(
      (page) =>
        page.candidateDegreePage,
    );

  console.log(
    `Law candidate degree pages: ${lawCandidates.length}`,
  );

  /**
   * ------------------------------------------------
   * 7. CRAWL ENGINEERING
   * ------------------------------------------------
   */

  divider();

  console.log(
    'CRAWLING ENGINEERING HANDBOOK',
  );

  divider();

  const engineeringCrawl =
    await crawlHandbook(
      ENGINEERING_ROOT,
      isEngineeringHandbookUrl,
    );

  console.log(
    `Engineering pages crawled: ${engineeringCrawl.length}`,
  );

  const engineeringCandidates =
    engineeringCrawl.filter(
      (page) =>
        page.candidateDegreePage,
    );

  console.log(
    `Engineering candidate degree pages: ${engineeringCandidates.length}`,
  );

  /**
   * ------------------------------------------------
   * 8. LAW COVERAGE COMPARISON
   * ------------------------------------------------
   *
   * Ignore known Law copies of combined degrees
   * already collected from their primary handbook
   * sources.
   */

  const uncoveredLawPages =
    lawCandidates.filter(
      (page) => {
        if (
          isKnownLawDuplicateSource(
            page.url,
          )
        ) {
          return false;
        }

        return (
          !discoveredPageFamilies.has(
            canonicalPageUrl(
              page.url,
            ),
          )
        );
      },
    );

  divider();

  console.log(
    'LAW CANDIDATES NOT IN CURRENT DISCOVERY',
  );

  divider();

  if (
    uncoveredLawPages.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const page
      of uncoveredLawPages
    ) {
      console.log(
        `- ${page.title || '(no title)'}`,
      );

      console.log(
        `  ${page.url}`,
      );

      console.log(
        `  Depth: ${page.depth}`,
      );

      console.log(
        `  From: ${
          page.sourceUrl ??
          'ROOT'
        }`,
      );

      console.log('');
    }
  }

  /**
   * ------------------------------------------------
   * 9. ENGINEERING COVERAGE COMPARISON
   * ------------------------------------------------
   */

  const uncoveredEngineeringPages =
    engineeringCandidates.filter(
      (page) =>
        !discoveredPageFamilies.has(
          canonicalPageUrl(
            page.url,
          ),
        ),
    );

  divider();

  console.log(
    'ENGINEERING CANDIDATES NOT IN CURRENT DISCOVERY',
  );

  divider();

  if (
    uncoveredEngineeringPages.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const page
      of uncoveredEngineeringPages
    ) {
      console.log(
        `- ${page.title || '(no title)'}`,
      );

      console.log(
        `  ${page.url}`,
      );

      console.log(
        `  Depth: ${page.depth}`,
      );

      console.log(
        `  From: ${
          page.sourceUrl ??
          'ROOT'
        }`,
      );

      console.log('');
    }
  }

  /**
   * ------------------------------------------------
   * 10. CURRENT DISCOVERY BY HANDBOOK
   * ------------------------------------------------
   */

  divider();

  console.log(
    'CURRENT DISCOVERY BY HANDBOOK',
  );

  divider();

  const discoveredByCategory =
    new Map<
      string,
      number
    >();

  for (
    const course
    of discovered
  ) {
    discoveredByCategory.set(
      course.handbookCategory,

      (
        discoveredByCategory.get(
          course.handbookCategory,
        ) ??
        0
      ) +
      1,
    );
  }

  for (
    const [
      category,
      count,
    ]
    of [
      ...discoveredByCategory.entries(),
    ].sort(
      (
        left,
        right,
      ) =>
        left[0].localeCompare(
          right[0],
        ),
    )
  ) {
    console.log(
      `${category}: ${count}`,
    );
  }

  /**
   * ------------------------------------------------
   * FINAL SUMMARY
   * ------------------------------------------------
   */

  divider();

  console.log(
    'DEGREE COVERAGE AUDIT SUMMARY',
  );

  divider();

  console.log(
    `Current discovered pages: ${discovered.length}`,
  );

  console.log(
    `Unique parsed award codes: ${parsedCodes.size}`,
  );

  console.log('');

  console.log(
    `Law-related parsed codes: ${uniqueLawCodes.size}`,
  );

  console.log(
    `Law candidate pages crawled: ${lawCandidates.length}`,
  );

  console.log(
    `Potential uncovered Law pages: ${uncoveredLawPages.length}`,
  );

  console.log('');

  console.log(
    `Engineering-related parsed codes: ${uniqueEngineeringCodes.size}`,
  );

  console.log(
    `Engineering candidate pages crawled: ${engineeringCandidates.length}`,
  );

  console.log(
    `Potential uncovered Engineering pages: ${uncoveredEngineeringPages.length}`,
  );

  console.log('');

  console.log(
    `Missing known Law codes: ${missingKnownLawCodes.length}`,
  );

  console.log(
    `Missing known Engineering codes: ${missingKnownEngineeringCodes.length}`,
  );

  /**
   * ------------------------------------------------
   * FINAL RESULT
   * ------------------------------------------------
   *
   * A hard failure means a previously known award has
   * disappeared.
   *
   * A coverage review means the crawler discovered a
   * genuinely new candidate degree-family page.
   */

  const passed =
    missingKnownLawCodes.length ===
      0 &&
    missingKnownEngineeringCodes.length ===
      0;

  console.log('');

  console.log(
    `RESULT: ${
      passed
        ? 'PASS'
        : 'FAIL'
    }`,
  );

  if (
    uncoveredLawPages.length >
      0 ||
    uncoveredEngineeringPages.length >
      0
  ) {
    console.log(
      'COVERAGE STATUS: REVIEW',
    );

    console.log(
      'Potential new degree-family pages were found. Review them before declaring USYD degree discovery complete.',
    );
  } else {
    console.log(
      'COVERAGE STATUS: NO NEW CANDIDATE PAGES FOUND',
    );
  }

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