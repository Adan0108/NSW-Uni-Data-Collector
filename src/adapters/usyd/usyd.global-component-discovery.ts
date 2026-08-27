import axios from 'axios';
import * as cheerio from 'cheerio';

import type {
  UsydHandbookCategory,
} from './usyd.handbook-discovery';

/**
 * ------------------------------------------------
 * GLOBAL USYD COMPONENT DISCOVERY
 * ------------------------------------------------
 *
 * Discovers reusable academic component families:
 *
 * - majors
 * - minors
 * - programs
 * - streams
 * - specialisations
 *
 * This file DOES NOT:
 *
 * - parse formal requirements
 * - parse unit rows
 * - parse requisites
 * - create database records
 *
 * Overview pages, learning-outcome pages and unit-table
 * pages belonging to the same academic component are
 * merged into one component family.
 */

export type UsydGlobalComponentType =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM'
  | 'SPECIALISATION'
  | 'OTHER';

export interface UsydDiscoveredComponent {
  handbookCategory:
    UsydHandbookCategory;

  name: string;

  type:
    UsydGlobalComponentType;

  /**
   * Canonical component page.
   *
   * Prefer overview page when available.
   */
  overviewUrl: string;

  /**
   * Preferred normal unit table.
   *
   * Some components have multiple tables, therefore all
   * tables are also preserved in tableUrls.
   */
  unitTableUrl: string | null;

  /**
   * All tables attached to this component.
   *
   * Examples:
   *
   * - normal table
   * - Honours table
   * - introductory language table
   * - intermediate language table
   * - advanced language table
   */
  tableUrls: string[];

  learningOutcomesUrl: string | null;

  /**
   * Navigation page from which we originally reached
   * this component.
   */
  sourceUrl: string;
}

interface DiscoverySeed {
  category:
    UsydHandbookCategory;

  url: string;
}

interface FetchedPage {
  finalUrl: string;

  title: string;

  bodyText: string;

  links:
    Array<{
      text: string;
      url: string;
    }>;
}

interface ComponentFamilyAccumulator {
  handbookCategory:
    UsydHandbookCategory;

  familyKey: string;

  name: string;

  type:
    UsydGlobalComponentType;

  sourceUrl: string;

  overviewUrl: string | null;

  learningOutcomesUrl: string | null;

  tableUrls:
    Set<string>;

  pages:
    Set<string>;
}

/**
 * ------------------------------------------------
 * HANDBOOK ROOTS
 * ------------------------------------------------
 */

const HANDBOOK_ROOTS:
  DiscoverySeed[] = [
    {
      category:
        'ARCHITECTURE',

      url:
        'https://www.sydney.edu.au/handbooks/architecture.html',
    },

    {
      category:
        'ARTS',

      url:
        'https://www.sydney.edu.au/handbooks/arts.html',
    },

    {
      category:
        'BUSINESS',

      url:
        'https://www.sydney.edu.au/handbooks/business-school.html',
    },

    {
      category:
        'ENGINEERING',

      url:
        'https://www.sydney.edu.au/handbooks/engineering.html',
    },

    {
      category:
        'INTERDISCIPLINARY',

      url:
        'https://www.sydney.edu.au/handbooks/interdisciplinary-studies.html',
    },

    {
      category:
        'MEDICINE_HEALTH',

      url:
        'https://www.sydney.edu.au/handbooks/medicine-health.html',
    },

    {
      category:
        'SCIENCE',

      url:
        'https://www.sydney.edu.au/handbooks/science.html',
    },

    {
      category:
        'CONSERVATORIUM',

      url:
        'https://www.sydney.edu.au/handbooks/conservatorium.html',
    },

    {
      category:
        'LAW',

      url:
        'https://www.sydney.edu.au/handbooks/law.html',
    },
  ];

/**
 * ------------------------------------------------
 * EXTRA NAVIGATION SEEDS
 * ------------------------------------------------
 *
 * USYD handbook navigation differs heavily between
 * faculties.
 *
 * These are official index/navigation pages only.
 *
 * We are NOT hardcoding individual components.
 */

const EXTRA_SEEDS:
  DiscoverySeed[] = [
    /**
     * Arts.
     */
    {
      category:
        'ARTS',

      url:
        'https://www.sydney.edu.au/handbooks/arts/subject-areas.html',
    },

    /**
     * Business.
     */
    {
      category:
        'BUSINESS',

      url:
        'https://www.sydney.edu.au/handbooks/business-school/commerce-subject-areas/overview.html',
    },

    /**
     * Engineering.
     */
    {
      category:
        'ENGINEERING',

      url:
        'https://www.sydney.edu.au/handbooks/engineering/engineering-honours/streams.html',
    },

    {
      category:
        'ENGINEERING',

      url:
        'https://www.sydney.edu.au/handbooks/engineering/advanced-computing/overview.html',
    },

    {
      category:
        'ENGINEERING',

      url:
        'https://www.sydney.edu.au/handbooks/engineering/project-management/overview.html',
    },

    /**
     * Shared Table S.
     *
     * IMPORTANT:
     *
     * table-s/overview.html does NOT exist.
     */
    {
      category:
        'INTERDISCIPLINARY',

      url:
        'https://www.sydney.edu.au/handbooks/interdisciplinary-studies/table-s.html',
    },

    {
      category:
        'INTERDISCIPLINARY',

      url:
        'https://www.sydney.edu.au/handbooks/interdisciplinary-studies/table-s/subject-areas.html',
    },

    /**
     * Science.
     */
    {
      category:
        'SCIENCE',

      url:
        'https://www.sydney.edu.au/handbooks/science/table-a/overview.html',
    },

    {
      category:
        'SCIENCE',

      url:
        'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas.html',
    },

    /**
     * Architecture.
     */
    {
      category:
        'ARCHITECTURE',

      url:
        'https://www.sydney.edu.au/handbooks/architecture/undergraduate/overview.html',
    },

    /**
     * Law.
     */
    {
      category:
        'LAW',

      url:
        'https://www.sydney.edu.au/handbooks/law/undergraduate.html',
    },
  ];

/**
 * ------------------------------------------------
 * CRAWL SETTINGS
 * ------------------------------------------------
 */

const MAX_DEPTH =
  6;

const MAX_PAGES_PER_HANDBOOK =
  1000;

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

function titleCaseSlug(
  slug: string,
): string {
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

/**
 * ------------------------------------------------
 * URL FILTERS
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

function belongsToCategory(
  category:
    UsydHandbookCategory,
  url: string,
): boolean {
  try {
    const pathname =
      new URL(
        url,
      ).pathname;

    switch (
      category
    ) {
      case 'ARCHITECTURE':
        return pathname.startsWith(
          '/handbooks/architecture',
        );

      case 'ARTS':
        return pathname.startsWith(
          '/handbooks/arts',
        );

      case 'BUSINESS':
        return pathname.startsWith(
          '/handbooks/business-school',
        );

      case 'ENGINEERING':
        return pathname.startsWith(
          '/handbooks/engineering',
        );

      case 'INTERDISCIPLINARY':
        return pathname.startsWith(
          '/handbooks/interdisciplinary-studies',
        );

      case 'MEDICINE_HEALTH':
        return pathname.startsWith(
          '/handbooks/medicine-health',
        );

      case 'SCIENCE':
        return pathname.startsWith(
          '/handbooks/science',
        );

      case 'CONSERVATORIUM':
        return pathname.startsWith(
          '/handbooks/conservatorium',
        );

      case 'LAW':
        return pathname.startsWith(
          '/handbooks/law',
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
    )
  );
}

/**
 * ------------------------------------------------
 * PAGE TYPES
 * ------------------------------------------------
 */

function isLearningOutcomesUrl(
  url: string,
): boolean {
  return (
    /\/learning-outcomes\.html$/i.test(
      url,
    )
  );
}

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

function isOverviewUrl(
  url: string,
): boolean {
  return (
    /\/overview\.html$/i.test(
      url,
    )
  );
}

/**
 * ------------------------------------------------
 * SPECIALISATION SLUG
 * ------------------------------------------------
 */

function extractSpecialisationSlug(
  url: string,
): string | null {
  try {
    const pathname =
      new URL(
        url,
      ).pathname;

    const match =
      pathname.match(
        /\/specialisations\/([^/]+?)-unit-of-study-table\.html$/i,
      );

    return (
      match?.[1] ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * ------------------------------------------------
 * COMPONENT FAMILY KEY
 * ------------------------------------------------
 *
 * Standard component:
 *
 * /american-studies/overview.html
 * /american-studies/unit-of-study-table.html
 * /american-studies/honours-unit-of-study-table.html
 *
 * all become:
 *
 * /american-studies/
 *
 *
 * Engineering specialisations are different:
 *
 * /specialisations/computer-unit-of-study-table.html
 *
 * There is usually no child directory, therefore the
 * filename becomes part of the family identity.
 */

function componentFamilyKey(
  url: string,
): string {
  try {
    const parsed =
      new URL(
        url,
      );

    parsed.hash =
      '';

    const specialisationSlug =
      extractSpecialisationSlug(
        url,
      );

    if (
      specialisationSlug
    ) {
      const parentPath =
        parsed.pathname.replace(
          /\/[^/]+\.html$/i,
          '/',
        );

      return (
        parsed.origin +
        parentPath +
        specialisationSlug +
        '/'
      );
    }

    const pathname =
      parsed.pathname.replace(
        /\/[^/]+\.html$/i,
        '/',
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
 * COMPONENT NAME FROM URL
 * ------------------------------------------------
 */

function componentNameFromUrl(
  url: string,
): string {
  try {
    /**
     * Engineering specialisation.
     */
    const specialisationSlug =
      extractSpecialisationSlug(
        url,
      );

    if (
      specialisationSlug
    ) {
      return titleCaseSlug(
        specialisationSlug,
      );
    }

    const parsed =
      new URL(
        url,
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

    return slug
      ? titleCaseSlug(
          slug,
        )
      : '';
  } catch {
    return '';
  }
}

/**
 * ------------------------------------------------
 * COMPONENT CLASSIFICATION
 * ------------------------------------------------
 */

function classifyComponentType(
  url: string,
  title: string,
  bodyText: string,
): UsydGlobalComponentType {
  /**
   * Strong URL hierarchy first.
   */

  if (
    /\/specialisations\//i.test(
      url,
    )
  ) {
    return 'SPECIALISATION';
  }

  if (
    /\/streams?\//i.test(
      url,
    )
  ) {
    return 'STREAM';
  }

  if (
    /\/majors?\//i.test(
      url,
    ) ||
    /\/project-management-majors\//i.test(
      url,
    )
  ) {
    return 'MAJOR';
  }

  /**
   * Business "commerce-subject-areas" are genuine
   * Commerce majors / subject areas.
   *
   * Previous run classified these as OTHER.
   */
  if (
    /\/commerce-subject-areas\/[^/]+\//i.test(
      url,
    )
  ) {
    return 'MAJOR';
  }

  /**
   * Arts, Science and Table S subject-area families.
   */
  if (
    /\/subject-areas\/[^/]+\//i.test(
      url,
    )
  ) {
    return 'MAJOR';
  }

  if (
    /\/programs?\//i.test(
      url,
    )
  ) {
    return 'PROGRAM';
  }

  if (
    /\/minors?\//i.test(
      url,
    )
  ) {
    return 'MINOR';
  }

  if (
    /\/dalyell-stream(?:\/|\.html)/i.test(
      url,
    )
  ) {
    return 'STREAM';
  }

  const combinedText =
    normalizeText(
      `${title} ${bodyText.slice(
        0,
        2500,
      )}`,
    );

  if (
    /\bspecialisation\b/i.test(
      combinedText,
    )
  ) {
    return 'SPECIALISATION';
  }

  if (
    /\bstream\b/i.test(
      title,
    )
  ) {
    return 'STREAM';
  }

  if (
    /\bprogram\b/i.test(
      title,
    )
  ) {
    return 'PROGRAM';
  }

  if (
    /\bminor\b/i.test(
      title,
    ) &&
    !/\bmajor\b/i.test(
      title,
    )
  ) {
    return 'MINOR';
  }

  if (
    /\bmajor\b/i.test(
      title,
    )
  ) {
    return 'MAJOR';
  }

  return 'OTHER';
}

/**
 * ------------------------------------------------
 * COMPONENT PATH SIGNALS
 * ------------------------------------------------
 */

function hasStrongComponentPath(
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
    /\/project-management-majors\//i.test(
      url,
    ) ||
    /\/minors?\//i.test(
      url,
    ) ||
    /\/programs?\//i.test(
      url,
    ) ||
    /\/streams?\//i.test(
      url,
    ) ||
    /\/specialisations?\//i.test(
      url,
    ) ||
    /\/dalyell-stream(?:\/|\.html)/i.test(
      url,
    )
  );
}

function hasNavigationSignal(
  text: string,
  url: string,
): boolean {
  const combined =
    `${text} ${url}`;

  return (
    /\bsubject areas?\b/i.test(
      combined,
    ) ||
    /\bcommerce subject areas?\b/i.test(
      combined,
    ) ||
    /\bmajors?\b/i.test(
      combined,
    ) ||
    /\bminors?\b/i.test(
      combined,
    ) ||
    /\bprograms?\b/i.test(
      combined,
    ) ||
    /\bstreams?\b/i.test(
      combined,
    ) ||
    /\bspecialisations?\b/i.test(
      combined,
    ) ||
    /\btable [asdo]\b/i.test(
      combined,
    ) ||
    /\bshared pool\b/i.test(
      combined,
    ) ||
    /unit-of-study-table/i.test(
      combined,
    )
  );
}

/**
 * ------------------------------------------------
 * INDEX PAGE DETECTION
 * ------------------------------------------------
 */

function isComponentIndexPage(
  url: string,
  title: string,
): boolean {
  const pathname =
    new URL(
      url,
    ).pathname;

  /**
   * Arts/Science/Table S indexes.
   */
  if (
    /\/subject-areas\.html$/i.test(
      pathname,
    )
  ) {
    return true;
  }

  /**
   * Business commerce-subject-areas overview is an
   * index, not an actual component.
   *
   * Previous output incorrectly created:
   *
   * OTHER — Commerce subject areas
   */
  if (
    /\/commerce-subject-areas\/overview\.html$/i.test(
      pathname,
    )
  ) {
    return true;
  }

  /**
   * Generic component indexes.
   */
  if (
    /\/(?:streams|majors|minors|programs|specialisations)\.html$/i.test(
      pathname,
    )
  ) {
    return true;
  }

  /**
   * Conservatorium index pages such as:
   *
   * /programs/overview.html
   * /streams/overview.html
   * /minors/overview.html
   *
   * are containers, not components themselves.
   */
  if (
    /\/(?:programs|streams|minors|majors)\/overview\.html$/i.test(
      pathname,
    )
  ) {
    return true;
  }

  if (
    /^(?:subject areas?|commerce subject areas?|majors?|minors?|programs?|streams?|specialisations?)$/i.test(
      normalizeText(
        title,
      ),
    )
  ) {
    return true;
  }

  return false;
}

/**
 * ------------------------------------------------
 * DEGREE PAGE DETECTION
 * ------------------------------------------------
 */

function isClearlyDegreePage(
  url: string,
  title: string,
  bodyText: string,
): boolean {
  if (
    hasStrongComponentPath(
      url,
    )
  ) {
    return false;
  }

  const awardTitle =
    /^(?:Bachelor|Diploma|Master|Doctor)\b/i.test(
      normalizeText(
        title,
      ),
    );

  const awardText =
    /\bRequirements for award\b/i.test(
      bodyText,
    ) ||
    /\bTo qualify for the award\b/i.test(
      bodyText,
    );

  return (
    awardTitle &&
    awardText
  );
}

/**
 * ------------------------------------------------
 * COMPONENT PAGE DETECTION
 * ------------------------------------------------
 */

function pageBelongsToComponent(
  page: FetchedPage,
): boolean {
  if (
    isComponentIndexPage(
      page.finalUrl,
      page.title,
    )
  ) {
    return false;
  }

  if (
    isClearlyDegreePage(
      page.finalUrl,
      page.title,
      page.bodyText,
    )
  ) {
    return false;
  }

  if (
    hasStrongComponentPath(
      page.finalUrl,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * ------------------------------------------------
 * FETCH
 * ------------------------------------------------
 */

async function fetchPage(
  url: string,
): Promise<FetchedPage> {
  const response =
    await axios.get<string>(
      url,
      {
        maxRedirects:
          10,

        timeout:
          30_000,

        headers: {
          'User-Agent':
            'Mozilla/5.0 USYD handbook component discovery',
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

  const bodyText =
    normalizeText(
      $('body').text(),
    );

  const linkMap =
    new Map<
      string,
      string
    >();

  $('a').each(
    (
      _,
      element,
    ) => {
      const anchor =
        $(element);

      const href =
        anchor.attr(
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

      if (
        !normalized ||
        !isUsydHandbookUrl(
          normalized,
        ) ||
        shouldIgnoreUrl(
          normalized,
        )
      ) {
        return;
      }

      if (
        !linkMap.has(
          normalized,
        )
      ) {
        linkMap.set(
          normalized,
          normalizeText(
            anchor.text(),
          ),
        );
      }
    },
  );

  return {
    finalUrl,

    title,

    bodyText,

    links:
      [
        ...linkMap.entries(),
      ].map(
        (
          [
            linkUrl,
            text,
          ],
        ) => ({
          text,

          url:
            linkUrl,
        }),
      ),
  };
}

/**
 * ------------------------------------------------
 * CLEAN COMPONENT NAME
 * ------------------------------------------------
 */

function cleanComponentName(
  page: FetchedPage,
): string {
  /**
   * Engineering specialisations MUST use the
   * specialisation filename.
   *
   * Their H1 often contains the parent Engineering
   * stream name, which caused duplicate names in the
   * previous audit.
   */
  const specialisationSlug =
    extractSpecialisationSlug(
      page.finalUrl,
    );

  if (
    specialisationSlug
  ) {
    return titleCaseSlug(
      specialisationSlug,
    );
  }

  /**
   * For nested program/stream table pages, the current
   * directory is usually more precise than a generic
   * "Bachelor of Music" page title.
   */
  if (
    isUnitTableUrl(
      page.finalUrl,
    ) &&
    (
      /\/programs\/[^/]+\//i.test(
        page.finalUrl,
      ) ||
      /\/streams\/[^/]+\//i.test(
        page.finalUrl,
      ) ||
      /\/minors\/[^/]+\//i.test(
        page.finalUrl,
      )
    )
  ) {
    const urlName =
      componentNameFromUrl(
        page.finalUrl,
      );

    if (
      urlName
    ) {
      return urlName;
    }
  }

  let name =
    normalizeText(
      page.title,
    );

  name =
    name.replace(
      /\s*[-–|]\s*(?:unit of study table(?:\s*\([^)]*\))?|learning outcomes?|overview)$/i,
      '',
    );

  name =
    name.replace(
      /\s+(?:unit of study table|learning outcomes?)$/i,
      '',
    );

  if (
    !name ||
    /^(?:overview|learning outcomes?|unit of study table|units of study)$/i.test(
      name,
    )
  ) {
    name =
      componentNameFromUrl(
        page.finalUrl,
      );
  }

  return normalizeText(
    name,
  );
}

/**
 * ------------------------------------------------
 * ADD PAGE TO COMPONENT FAMILY
 * ------------------------------------------------
 */

function addPageToFamily(
  families:
    Map<
      string,
      ComponentFamilyAccumulator
    >,

  category:
    UsydHandbookCategory,

  page:
    FetchedPage,

  sourceUrl:
    string,
): void {
  const familyKey =
    componentFamilyKey(
      page.finalUrl,
    );

  const name =
    cleanComponentName(
      page,
    );

  const type =
    classifyComponentType(
      page.finalUrl,
      page.title,
      page.bodyText,
    );

  let family =
    families.get(
      familyKey,
    );

  if (
    !family
  ) {
    family = {
      handbookCategory:
        category,

      familyKey,

      name,

      type,

      sourceUrl,

      overviewUrl:
        null,

      learningOutcomesUrl:
        null,

      tableUrls:
        new Set<string>(),

      pages:
        new Set<string>(),
    };

    families.set(
      familyKey,
      family,
    );
  }

  family.pages.add(
    page.finalUrl,
  );

  /**
   * Prefer more useful names.
   */
  if (
    (
      !family.name ||
      family.name.length <
        2
    ) &&
    name
  ) {
    family.name =
      name;
  }

  if (
    family.type ===
      'OTHER' &&
    type !==
      'OTHER'
  ) {
    family.type =
      type;
  }

  if (
    isOverviewUrl(
      page.finalUrl,
    )
  ) {
    family.overviewUrl =
      page.finalUrl;
  }

  if (
    isLearningOutcomesUrl(
      page.finalUrl,
    )
  ) {
    family.learningOutcomesUrl =
      page.finalUrl;
  }

  if (
    isUnitTableUrl(
      page.finalUrl,
    )
  ) {
    family.tableUrls.add(
      page.finalUrl,
    );
  }

  /**
   * Collect sibling tables/outcomes directly from
   * component links.
   */
  for (
    const link
    of page.links
  ) {
    if (
      componentFamilyKey(
        link.url,
      ) !==
      familyKey
    ) {
      continue;
    }

    if (
      isUnitTableUrl(
        link.url,
      )
    ) {
      family.tableUrls.add(
        link.url,
      );
    }

    if (
      isLearningOutcomesUrl(
        link.url,
      )
    ) {
      family.learningOutcomesUrl =
        link.url;
    }

    if (
      isOverviewUrl(
        link.url,
      )
    ) {
      family.overviewUrl ??=
        link.url;
    }
  }
}

/**
 * ------------------------------------------------
 * DISCOVER ONE HANDBOOK CATEGORY
 * ------------------------------------------------
 */

async function discoverComponentsForCategory(
  category:
    UsydHandbookCategory,

  seeds:
    string[],
): Promise<UsydDiscoveredComponent[]> {
  const queue:
    Array<{
      url: string;
      depth: number;
      sourceUrl: string;
    }> =
    seeds.map(
      (url) => ({
        url,

        depth:
          0,

        sourceUrl:
          url,
      }),
    );

  const visited =
    new Set<string>();

  const families =
    new Map<
      string,
      ComponentFamilyAccumulator
    >();

  while (
    queue.length >
      0 &&
    visited.size <
      MAX_PAGES_PER_HANDBOOK
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
      /**
       * ------------------------------------------------
       * SILENT 404
       * ------------------------------------------------
       *
       * USYD currently exposes a few stale/internal links.
       *
       * A single 404 is not a collection failure.
       */
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
        `[USYD components] ${category} fetch failed: ${current.url}`,
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
     * RECORD COMPONENT
     * ------------------------------------------------
     */

    if (
      pageBelongsToComponent(
        page,
      )
    ) {
      addPageToFamily(
        families,
        category,
        page,
        current.sourceUrl,
      );
    }

    /**
     * ------------------------------------------------
     * FOLLOW LINKS
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
        )
      ) {
        continue;
      }

      if (
        !belongsToCategory(
          category,
          link.url,
        )
      ) {
        continue;
      }

      const strongPath =
        hasStrongComponentPath(
          link.url,
        );

      const navigationSignal =
        hasNavigationSignal(
          link.text,
          link.url,
        );

      const shallowNavigation =
        current.depth <=
        1;

      const sameFamily =
        pageBelongsToComponent(
          page,
        ) &&
        componentFamilyKey(
          link.url,
        ) ===
          componentFamilyKey(
            page.finalUrl,
          );

      if (
        !strongPath &&
        !navigationSignal &&
        !shallowNavigation &&
        !sameFamily
      ) {
        continue;
      }

      queue.push({
        url:
          link.url,

        depth:
          current.depth +
          1,

        sourceUrl:
          page.finalUrl,
      });
    }
  }

  /**
   * ------------------------------------------------
   * NORMALIZE FAMILY ACCUMULATORS
   * ------------------------------------------------
   */

  const result:
    UsydDiscoveredComponent[] =
    [];

  for (
    const family
    of families.values()
  ) {
    if (
      !family.name ||
      family.name.length <
        2
    ) {
      continue;
    }

    const tableUrls =
      [
        ...family.tableUrls,
      ].sort();

    /**
     * Prefer a normal table.
     */
    const primaryUnitTable =
      tableUrls.find(
        (url) =>
          /\/unit-of-study-table\.html$/i.test(
            url,
          ) &&
          !/honours-unit-of-study-table/i.test(
            url,
          ),
      ) ??
      tableUrls.find(
        (url) =>
          !/honours-unit-of-study-table/i.test(
            url,
          ),
      ) ??
      tableUrls[0] ??
      null;

    const canonicalPage =
      family.overviewUrl ??
      primaryUnitTable ??
      [
        ...family.pages,
      ][0];

    if (
      !canonicalPage
    ) {
      continue;
    }

    result.push({
      handbookCategory:
        family.handbookCategory,

      name:
        family.name,

      type:
        family.type,

      overviewUrl:
        canonicalPage,

      unitTableUrl:
        primaryUnitTable,

      tableUrls,

      learningOutcomesUrl:
        family.learningOutcomesUrl,

      sourceUrl:
        family.sourceUrl,
    });
  }

  return result;
}

/**
 * ------------------------------------------------
 * GLOBAL DISCOVERY
 * ------------------------------------------------
 */

export async function discoverUsydGlobalComponents():
Promise<UsydDiscoveredComponent[]> {
  const categories =
    [
      ...new Set(
        HANDBOOK_ROOTS.map(
          (root) =>
            root.category,
        ),
      ),
    ];

  const allComponents:
    UsydDiscoveredComponent[] =
    [];

  for (
    const category
    of categories
  ) {
    const seeds =
      [
        ...HANDBOOK_ROOTS
          .filter(
            (seed) =>
              seed.category ===
              category,
          )
          .map(
            (seed) =>
              seed.url,
          ),

        ...EXTRA_SEEDS
          .filter(
            (seed) =>
              seed.category ===
              category,
          )
          .map(
            (seed) =>
              seed.url,
          ),
      ];

    const uniqueSeeds =
      [
        ...new Set(
          seeds,
        ),
      ];

    console.log(
      `[USYD components] discovering ${category}...`,
    );

    const components =
      await discoverComponentsForCategory(
        category,
        uniqueSeeds,
      );

    console.log(
      `[USYD components] ${category}: ${components.length}`,
    );

    allComponents.push(
      ...components,
    );
  }

  /**
   * ------------------------------------------------
   * FINAL DEDUPLICATION
   * ------------------------------------------------
   */

  const unique =
    new Map<
      string,
      UsydDiscoveredComponent
    >();

  for (
    const component
    of allComponents
  ) {
    const key =
      [
        component.handbookCategory,
        componentFamilyKey(
          component.overviewUrl,
        ),
      ].join(
        '::',
      );

    const existing =
      unique.get(
        key,
      );

    if (
      !existing
    ) {
      unique.set(
        key,
        {
          ...component,

          tableUrls:
            [
              ...component.tableUrls,
            ],
        },
      );

      continue;
    }

    existing.tableUrls =
      [
        ...new Set(
          [
            ...existing.tableUrls,
            ...component.tableUrls,
          ],
        ),
      ].sort();

    if (
      !existing.unitTableUrl &&
      component.unitTableUrl
    ) {
      existing.unitTableUrl =
        component.unitTableUrl;
    }

    if (
      !existing.learningOutcomesUrl &&
      component.learningOutcomesUrl
    ) {
      existing.learningOutcomesUrl =
        component.learningOutcomesUrl;
    }

    if (
      existing.type ===
        'OTHER' &&
      component.type !==
        'OTHER'
    ) {
      existing.type =
        component.type;
    }
  }

  return [
    ...unique.values(),
  ].sort(
    (
      left,
      right,
    ) => {
      const categoryCompare =
        left.handbookCategory.localeCompare(
          right.handbookCategory,
        );

      if (
        categoryCompare !==
        0
      ) {
        return categoryCompare;
      }

      const typeCompare =
        left.type.localeCompare(
          right.type,
        );

      if (
        typeCompare !==
        0
      ) {
        return typeCompare;
      }

      return left.name.localeCompare(
        right.name,
      );
    },
  );
}