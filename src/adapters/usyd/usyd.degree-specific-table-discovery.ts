import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * ------------------------------------------------
 * USYD DEGREE-SPECIFIC TABLE DISCOVERY
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * Discover degree-specific undergraduate unit tables for
 * handbook areas that do not expose reusable component
 * catalogues in the same way as Arts/Science/etc.
 *
 * Current target:
 *
 * - Architecture
 * - Medicine & Health
 * - Law
 *
 * IMPORTANT
 *
 * This collector is intentionally undergraduate-focused.
 *
 * We exclude pure postgraduate catalogues such as:
 *
 * - /law/postgraduate/
 * - /medicine-health-pg/
 *
 * But we keep undergraduate-entry combined courses whose
 * final award may include a postgraduate/professional
 * qualification, for example:
 *
 * - Bachelor of Arts and Doctor of Medicine
 * - Bachelor of Science and Doctor of Medicine
 * - Bachelor of Science and Doctor of Dental Medicine
 *
 * Those remain relevant because entry is through an
 * undergraduate package.
 */

export type UsydDegreeSpecificTableCategory =
  | 'ARCHITECTURE'
  | 'MEDICINE_HEALTH'
  | 'LAW';

export interface UsydDegreeSpecificTable {
  handbookCategory:
    UsydDegreeSpecificTableCategory;

  courseName: string;

  sourcePageUrl: string;

  tableUrl: string;

  linkText: string;

  courseFamilyKey: string;
}

interface DiscoverySeed {
  category:
    UsydDegreeSpecificTableCategory;

  url: string;
}

interface CrawlItem {
  category:
    UsydDegreeSpecificTableCategory;

  url: string;

  depth: number;
}

interface FetchedPage {
  finalUrl: string;

  title: string;

  links:
    Array<{
      text: string;
      url: string;
    }>;
}

/**
 * ------------------------------------------------
 * SEEDS
 * ------------------------------------------------
 */

const SEEDS:
  DiscoverySeed[] = [
    {
      category:
        'ARCHITECTURE',

      url:
        'https://www.sydney.edu.au/handbooks/architecture/undergraduate/overview.html',
    },

    {
      category:
        'MEDICINE_HEALTH',

      url:
        'https://www.sydney.edu.au/handbooks/medicine-health/coursework.html',
    },

    {
      category:
        'LAW',

      url:
        'https://www.sydney.edu.au/handbooks/law/undergraduate.html',
    },
  ];

const MAX_DEPTH =
  7;

const MAX_PAGES_PER_CATEGORY =
  1200;

/**
 * ------------------------------------------------
 * TEXT
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
      /\u00A0/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

/**
 * ------------------------------------------------
 * URL HELPERS
 * ------------------------------------------------
 */

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

    url.hash =
      '';

    url.pathname =
      url.pathname.replace(
        /\/{2,}/g,
        '/',
      );

    return url.toString();
  } catch {
    return null;
  }
}

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

/**
 * ------------------------------------------------
 * PURE POSTGRADUATE EXCLUSION
 * ------------------------------------------------
 */

function isPurePostgraduateUrl(
  url: string,
): boolean {
  try {
    const pathname =
      new URL(
        url,
      ).pathname.toLowerCase();

    return (
      pathname.startsWith(
        '/handbooks/medicine-health-pg/',
      ) ||
      pathname ===
        '/handbooks/medicine-health-pg.html' ||
      pathname.includes(
        '/law/postgraduate/',
      )
    );
  } catch {
    return true;
  }
}

/**
 * ------------------------------------------------
 * CATEGORY OWNERSHIP
 * ------------------------------------------------
 */

function belongsToCategory(
  category:
    UsydDegreeSpecificTableCategory,

  url: string,
): boolean {
  if (
    isPurePostgraduateUrl(
      url,
    )
  ) {
    return false;
  }

  try {
    const pathname =
      new URL(
        url,
      ).pathname.toLowerCase();

    switch (
      category
    ) {
      case 'ARCHITECTURE':
        return (
          pathname ===
            '/handbooks/architecture/undergraduate.html' ||
          pathname.startsWith(
            '/handbooks/architecture/undergraduate/',
          )
        );

      case 'MEDICINE_HEALTH':
        return (
          pathname ===
            '/handbooks/medicine-health/coursework.html' ||
          pathname.startsWith(
            '/handbooks/medicine-health/coursework/',
          ) ||
          pathname ===
            '/handbooks/medicine-health/honours.html' ||
          pathname.startsWith(
            '/handbooks/medicine-health/honours/',
          )
        );

      case 'LAW':
        return (
          pathname ===
            '/handbooks/law/undergraduate.html' ||
          pathname.startsWith(
            '/handbooks/law/undergraduate/',
          )
        );

      default:
        return false;
    }
  } catch {
    return false;
  }
}

function shouldIgnoreUrl(
  url: string,
): boolean {
  return (
    /\.(?:pdf|jpg|jpeg|png|gif|svg|webp|doc|docx|xls|xlsx|zip)$/i.test(
      url,
    ) ||
    /\/units\//i.test(
      url,
    ) ||
    /\/archive\//i.test(
      url,
    ) ||
    isPurePostgraduateUrl(
      url,
    )
  );
}

/**
 * ------------------------------------------------
 * UNIT TABLE DETECTION
 * ------------------------------------------------
 */

function isUnitTableUrl(
  url: string,
): boolean {
  return (
    /unit-of-study-table\.html$/i.test(
      url,
    ) ||
    /units-of-study\.html$/i.test(
      url,
    )
  );
}

/**
 * ------------------------------------------------
 * REUSABLE COMPONENT EXCLUSION
 * ------------------------------------------------
 */

function isReusableComponentPath(
  url: string,
): boolean {
  return (
    /\/subject-areas\//i.test(
      url,
    ) ||
    /\/commerce-subject-areas\//i.test(
      url,
    ) ||
    /\/majors?\//i.test(
      url,
    ) ||
    /\/minors?\//i.test(
      url,
    ) ||
    /\/streams?\//i.test(
      url,
    ) ||
    /\/specialisations?\//i.test(
      url,
    ) ||
    /\/programs?\//i.test(
      url,
    )
  );
}

/**
 * ------------------------------------------------
 * UNDERGRADUATE RELEVANCE
 * ------------------------------------------------
 *
 * IMPORTANT:
 *
 * The category landing pages themselves must be accepted.
 *
 * Medicine & Health starts at:
 *
 * /medicine-health/coursework.html
 *
 * while actual course pages live under:
 *
 * /medicine-health/coursework/<course>/...
 *
 * Rejecting the landing page would prevent the crawler
 * from ever discovering those courses.
 */

function isUndergraduateRelevantPage(
  category:
    UsydDegreeSpecificTableCategory,

  url: string,
): boolean {
  if (
    isPurePostgraduateUrl(
      url,
    )
  ) {
    return false;
  }

  try {
    const pathname =
      new URL(
        url,
      ).pathname.toLowerCase();

    switch (
      category
    ) {
      case 'ARCHITECTURE':
        return (
          pathname ===
            '/handbooks/architecture/undergraduate.html' ||
          pathname ===
            '/handbooks/architecture/undergraduate/overview.html' ||
          pathname.startsWith(
            '/handbooks/architecture/undergraduate/',
          )
        );

      case 'MEDICINE_HEALTH':
        return (
          pathname ===
            '/handbooks/medicine-health/coursework.html' ||
          pathname.startsWith(
            '/handbooks/medicine-health/coursework/',
          ) ||
          pathname ===
            '/handbooks/medicine-health/honours.html' ||
          pathname.startsWith(
            '/handbooks/medicine-health/honours/',
          )
        );

      case 'LAW':
        return (
          pathname ===
            '/handbooks/law/undergraduate.html' ||
          pathname.startsWith(
            '/handbooks/law/undergraduate/',
          )
        );

      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * ------------------------------------------------
 * CRAWL SIGNAL
 * ------------------------------------------------
 */

function looksRelevantForCrawl(
  url: string,
  text: string,
): boolean {
  if (
    isUnitTableUrl(
      url,
    )
  ) {
    return true;
  }

  const combined =
    normalizeText(
      `${url} ${text}`,
    );

  return (
    /coursework/i.test(
      combined,
    ) ||
    /undergraduate/i.test(
      combined,
    ) ||
    /\bbachelor\b/i.test(
      combined,
    ) ||
    /\bhonours\b/i.test(
      combined,
    ) ||
    /\bdegree\b/i.test(
      combined,
    ) ||
    /\bcourse\b/i.test(
      combined,
    ) ||
    /unit of study/i.test(
      combined,
    ) ||
    /study plan/i.test(
      combined,
    ) ||
    /sample study/i.test(
      combined,
    ) ||
    /overview\.html/i.test(
      url,
    ) ||
    /course-resolutions\.html/i.test(
      url,
    )
  );
}

/**
 * ------------------------------------------------
 * COURSE FAMILY KEY
 * ------------------------------------------------
 */

function courseFamilyKey(
  url: string,
): string {
  try {
    const parsed =
      new URL(
        url,
      );

    let pathname =
      parsed.pathname;

    pathname =
      pathname.replace(
        /\/(?:overview|course-resolutions|combined-course-resolutions|resolutions|unit-of-study-table|units-of-study)\.html$/i,
        '',
      );

    pathname =
      pathname.replace(
        /\/[^/]*unit-of-study-table\.html$/i,
        '',
      );

    pathname =
      pathname.replace(
        /\/+$/g,
        '',
      );

    return (
      parsed.origin +
      pathname
    );
  } catch {
    return url;
  }
}

/**
 * ------------------------------------------------
 * COURSE NAME
 * ------------------------------------------------
 */

function deriveCourseName(
  pageTitle: string,
  linkText: string,
  sourceUrl: string,
): string {
  const cleanedTitle =
    normalizeText(
      pageTitle,
    );

  if (
    cleanedTitle &&
    !/^(?:overview|undergraduate|coursework|unit of study table)$/i.test(
      cleanedTitle,
    )
  ) {
    return cleanedTitle;
  }

  const cleanedLink =
    normalizeText(
      linkText,
    );

  if (
    cleanedLink &&
    !/unit of study table/i.test(
      cleanedLink,
    )
  ) {
    return cleanedLink;
  }

  try {
    const parsed =
      new URL(
        sourceUrl,
      );

    const segments =
      parsed.pathname
        .split(
          '/',
        )
        .filter(
          Boolean,
        );

    if (
      segments.length >
        0 &&
      /\.html$/i.test(
        segments[
          segments.length -
            1
        ],
      )
    ) {
      segments.pop();
    }

    const slug =
      segments[
        segments.length -
          1
      ];

    if (
      slug
    ) {
      return slug
        .split(
          '-',
        )
        .filter(
          Boolean,
        )
        .map(
          (word) =>
            word.charAt(
              0,
            ).toUpperCase() +
            word.slice(
              1,
            ),
        )
        .join(
          ' ',
        );
    }
  } catch {
    // fall through
  }

  return 'Unknown course';
}

/**
 * ------------------------------------------------
 * FETCH PAGE
 * ------------------------------------------------
 */

async function fetchPage(
  url: string,
): Promise<FetchedPage> {
  const response =
    await axios.get<string>(
      url,
      {
        timeout:
          30_000,

        maxRedirects:
          10,

        headers: {
          'User-Agent':
            'Mozilla/5.0 USYD undergraduate degree-specific table discovery',
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
      $('h1')
        .first()
        .text(),
    ) ||
    normalizeText(
      $('title')
        .first()
        .text(),
    );

  const links:
    Array<{
      text: string;
      url: string;
    }> =
    [];

  const seen =
    new Set<string>();

  $('a').each(
    (
      _,
      anchor,
    ) => {
      const href =
        $(anchor).attr(
          'href',
        );

      if (
        !href
      ) {
        return;
      }

      const normalized =
        normalizeUrl(
          href,
          finalUrl,
        );

      if (
        !normalized ||
        seen.has(
          normalized,
        ) ||
        !isUsydHandbookUrl(
          normalized,
        ) ||
        shouldIgnoreUrl(
          normalized,
        )
      ) {
        return;
      }

      seen.add(
        normalized,
      );

      links.push({
        text:
          normalizeText(
            $(anchor).text(),
          ),

        url:
          normalized,
      });
    },
  );

  return {
    finalUrl,

    title,

    links,
  };
}

/**
 * ------------------------------------------------
 * DISCOVER ONE CATEGORY
 * ------------------------------------------------
 */

async function discoverForCategory(
  category:
    UsydDegreeSpecificTableCategory,

  seeds:
    string[],
): Promise<UsydDegreeSpecificTable[]> {
  const queue:
    CrawlItem[] =
    seeds.map(
      (url) => ({
        category,

        url,

        depth:
          0,
      }),
    );

  const visited =
    new Set<string>();

  const tables =
    new Map<
      string,
      UsydDegreeSpecificTable
    >();

  while (
    queue.length >
      0 &&
    visited.size <
      MAX_PAGES_PER_CATEGORY
  ) {
    const current =
      queue.shift();

    if (
      !current
    ) {
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
      !belongsToCategory(
        category,
        current.url,
      )
    ) {
      continue;
    }

    if (
      !isUndergraduateRelevantPage(
        category,
        current.url,
      )
    ) {
      continue;
    }

    visited.add(
      current.url,
    );

    let page:
      FetchedPage;

    try {
      page =
        await fetchPage(
          current.url,
        );
    } catch (
      error
    ) {
      if (
        axios.isAxiosError(
          error,
        ) &&
        error.response?.status ===
          404
      ) {
        continue;
      }

      console.warn(
        `[USYD degree tables] ${category} fetch failed: ${current.url}`,
      );

      console.warn(
        error instanceof Error
          ? error.message
          : String(
              error,
            ),
      );

      continue;
    }

    /**
     * ------------------------------------------------
     * DISCOVER TABLES
     * ------------------------------------------------
     */

    for (
      const link
      of page.links
    ) {
      if (
        !belongsToCategory(
          category,
          link.url,
        ) ||
        !isUndergraduateRelevantPage(
          category,
          link.url,
        )
      ) {
        continue;
      }

      if (
        isUnitTableUrl(
          link.url,
        ) &&
        !isReusableComponentPath(
          link.url,
        )
      ) {
        if (
          !tables.has(
            link.url,
          )
        ) {
          tables.set(
            link.url,
            {
              handbookCategory:
                category,

              courseName:
                deriveCourseName(
                  page.title,
                  link.text,
                  page.finalUrl,
                ),

              sourcePageUrl:
                page.finalUrl,

              tableUrl:
                link.url,

              linkText:
                link.text,

              courseFamilyKey:
                courseFamilyKey(
                  page.finalUrl,
                ),
            },
          );
        }
      }
    }

    /**
     * ------------------------------------------------
     * CRAWL LINKS
     * ------------------------------------------------
     */

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
          link.url,
        ) ||
        !belongsToCategory(
          category,
          link.url,
        ) ||
        !isUndergraduateRelevantPage(
          category,
          link.url,
        )
      ) {
        continue;
      }

      if (
        isUnitTableUrl(
          link.url,
        )
      ) {
        continue;
      }

      if (
        isReusableComponentPath(
          link.url,
        )
      ) {
        continue;
      }

      const shallow =
        current.depth <=
        2;

      if (
        !shallow &&
        !looksRelevantForCrawl(
          link.url,
          link.text,
        )
      ) {
        continue;
      }

      queue.push({
        category,

        url:
          link.url,

        depth:
          current.depth +
          1,
      });
    }
  }

  return [
    ...tables.values(),
  ].sort(
    (
      left,
      right,
    ) => {
      const courseCompare =
        left.courseName.localeCompare(
          right.courseName,
        );

      if (
        courseCompare !==
        0
      ) {
        return courseCompare;
      }

      return left.tableUrl.localeCompare(
        right.tableUrl,
      );
    },
  );
}

/**
 * ------------------------------------------------
 * PUBLIC DISCOVERY
 * ------------------------------------------------
 */

export async function discoverUsydDegreeSpecificTables():
Promise<UsydDegreeSpecificTable[]> {
  const categories:
    UsydDegreeSpecificTableCategory[] = [
      'ARCHITECTURE',
      'MEDICINE_HEALTH',
      'LAW',
    ];

  const all:
    UsydDegreeSpecificTable[] =
    [];

  for (
    const category
    of categories
  ) {
    const seeds =
      [
        ...new Set(
          SEEDS
            .filter(
              (seed) =>
                seed.category ===
                category,
            )
            .map(
              (seed) =>
                seed.url,
            ),
        ),
      ];

    console.log(
      `[USYD degree tables] discovering ${category}...`,
    );

    const discovered =
      await discoverForCategory(
        category,
        seeds,
      );

    console.log(
      `[USYD degree tables] ${category}: ${discovered.length}`,
    );

    all.push(
      ...discovered,
    );
  }

  const unique =
    new Map<
      string,
      UsydDegreeSpecificTable
    >();

  for (
    const item
    of all
  ) {
    const key =
      [
        item.handbookCategory,
        item.tableUrl,
      ].join(
        '::',
      );

    if (
      !unique.has(
        key,
      )
    ) {
      unique.set(
        key,
        item,
      );
    }
  }

  return [
    ...unique.values(),
  ];
}