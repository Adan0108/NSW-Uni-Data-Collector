import axios from 'axios';
import * as cheerio from 'cheerio';

import {
  discoverUsydHandbooks,
} from './usyd.handbook-discovery';

import {
  discoverUsydCourseworkRoot,
  type UsydCourseworkRoot,
} from './usyd.coursework-discovery';

export interface UsydGlobalDegreeLink {
  name: string;

  overviewUrl: string;

  handbookCategory:
    UsydCourseworkRoot['handbookCategory'];

  sourceRootUrl: string;
}

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
): string {
  return new URL(
    href,
    baseUrl,
  ).toString();
}

function stripUrlNoise(
  url: string,
): string {
  return url
    .replace(
      /#.*$/,
      '',
    )
    .replace(
      /\?.*$/,
      '',
    );
}

function isSupportPage(
  url: string,
): boolean {
  return (
    /\/enrolment-planner\.html$/i.test(
      url,
    ) ||
    /\/learning-outcomes\.html$/i.test(
      url,
    ) ||
    /\/unit-of-study-table\.html$/i.test(
      url,
    ) ||
    /\/core-unit-of-study-table\.html$/i.test(
      url,
    ) ||
    /\/streams\.html$/i.test(
      url,
    ) ||
    /\/stream[s]?\//i.test(
      url,
    )
  );
}

function canonicalCourseKey(
  url: string,
): string {
  return stripUrlNoise(
    url,
  )
    .replace(
      /\/overview\.html$/i,
      '',
    )
    .replace(
      /\/course-resolutions\.html$/i,
      '',
    )
    .replace(
      /\.html$/i,
      '',
    )
    .replace(
      /\/$/,
      '',
    )
    .toLowerCase();
}

async function fetchPage(
  url: string,
): Promise<{
  html: string;
  finalUrl: string;
}> {
  const response =
    await axios.get<string>(
      url,
      {
        maxRedirects: 10,
      },
    );

  const responseUrl =
    (
      response.request as {
        res?: {
          responseUrl?: string;
        };
      }
    )
      .res
      ?.responseUrl;

  return {
    html:
      response.data,

    finalUrl:
      stripUrlNoise(
        responseUrl ??
        url,
      ),
  };
}

async function resolveCanonicalCoursePage(
  url: string,
): Promise<{
  url: string;
  heading: string | null;
} | null> {
  try {
    const fetched =
      await fetchPage(
        url,
      );

    if (
      isSupportPage(
        fetched.finalUrl,
      )
    ) {
      return null;
    }

    const $ =
      cheerio.load(
        fetched.html,
      );

    const heading =
      normalizeText(
        $('h1')
          .first()
          .text(),
      );

    let canonicalUrl =
      fetched.finalUrl;

    /*
     * Prefer overview.html when discovery lands
     * directly on course-resolutions.html.
     */
    if (
      /\/course-resolutions\.html$/i.test(
        canonicalUrl,
      )
    ) {
      const overviewCandidate =
        canonicalUrl.replace(
          /course-resolutions\.html$/i,
          'overview.html',
        );

      try {
        const overview =
          await fetchPage(
            overviewCandidate,
          );

        const overview$ =
          cheerio.load(
            overview.html,
          );

        const overviewHeading =
          normalizeText(
            overview$('h1')
              .first()
              .text(),
          );

        if (
          overviewHeading
        ) {
          return {
            url:
              overview.finalUrl,

            heading:
              overviewHeading,
          };
        }
      } catch {
        /*
         * Some handbook structures do not provide
         * an overview.html sibling.
         */
      }
    }

    return {
      url:
        canonicalUrl,

      heading:
        heading ||
        null,
    };
  } catch {
    return null;
  }
}

/*
 * ------------------------------------------------
 * STANDARD COURSEWORK FACULTIES
 * ------------------------------------------------
 *
 * Arts
 * Business
 * Medicine and Health
 * Science
 */

async function discoverStandardCourseworkPages(
  root: UsydCourseworkRoot,
): Promise<UsydGlobalDegreeLink[]> {
  if (
    !root.courseworkUrl
  ) {
    return [];
  }

  const fetched =
    await fetchPage(
      root.courseworkUrl,
    );

  const $ =
    cheerio.load(
      fetched.html,
    );

  const candidates =
    new Map<
      string,
      string
    >();

  /*
   * Course catalogue entries are normally h4 links.
   */
  $('h4 a').each(
    (_, element) => {
      const anchor =
        $(element);

      const name =
        normalizeText(
          anchor.text(),
        );

      const href =
        anchor.attr(
          'href',
        );

      if (
        !name ||
        !href
      ) {
        return;
      }

      const url =
        normalizeUrl(
          href,
          fetched.finalUrl,
        );

      if (
        !url.includes(
          '/handbooks/',
        )
      ) {
        return;
      }

      candidates.set(
        stripUrlNoise(
          url,
        ),
        name,
      );
    },
  );

  const results:
    UsydGlobalDegreeLink[] =
    [];

  const seen =
    new Set<string>();

  for (
    const [
      candidateUrl,
      catalogueName,
    ]
    of candidates
  ) {
    const resolved =
      await resolveCanonicalCoursePage(
        candidateUrl,
      );

    if (
      !resolved
    ) {
      continue;
    }

    const key =
      canonicalCourseKey(
        resolved.url,
      );

    if (
      seen.has(
        key,
      )
    ) {
      continue;
    }

    seen.add(
      key,
    );

    results.push({
      name:
        resolved.heading ??
        catalogueName,

      overviewUrl:
        resolved.url,

      handbookCategory:
        root.handbookCategory,

      sourceRootUrl:
        root.courseworkUrl,
    });
  }

  return results;
}

/*
 * ------------------------------------------------
 * ARCHITECTURE
 * ------------------------------------------------
 */

async function discoverArchitecturePages(
  root: UsydCourseworkRoot,
): Promise<UsydGlobalDegreeLink[]> {
  if (
    !root.courseworkUrl
  ) {
    return [];
  }

  const fetched =
    await fetchPage(
      root.courseworkUrl,
    );

  const $ =
    cheerio.load(
      fetched.html,
    );

  const candidates =
    new Map<
      string,
      string
    >();

  $('a').each(
    (_, element) => {
      const anchor =
        $(element);

      const name =
        normalizeText(
          anchor.text(),
        );

      const href =
        anchor.attr(
          'href',
        );

      if (
        !name ||
        !href ||
        !/^Bachelor\b/i.test(
          name,
        )
      ) {
        return;
      }

      const url =
        normalizeUrl(
          href,
          fetched.finalUrl,
        );

      if (
        !url.includes(
          '/handbooks/architecture/undergraduate/',
        )
      ) {
        return;
      }

      if (
        isSupportPage(
          url,
        )
      ) {
        return;
      }

      candidates.set(
        canonicalCourseKey(
          url,
        ),
        url,
      );
    },
  );

  const results:
    UsydGlobalDegreeLink[] =
    [];

  for (
    const url
    of candidates.values()
  ) {
    const resolved =
      await resolveCanonicalCoursePage(
        url,
      );

    if (
      !resolved ||
      !resolved.heading
    ) {
      continue;
    }

    results.push({
      name:
        resolved.heading,

      overviewUrl:
        resolved.url,

      handbookCategory:
        root.handbookCategory,

      sourceRootUrl:
        root.courseworkUrl,
    });
  }

  return results;
}

/*
 * ------------------------------------------------
 * ENGINEERING
 * ------------------------------------------------
 */

async function discoverEngineeringPages(
  root: UsydCourseworkRoot,
): Promise<UsydGlobalDegreeLink[]> {
  const fetched =
    await fetchPage(
      root.handbookUrl,
    );

  const $ =
    cheerio.load(
      fetched.html,
    );

  const candidates =
    new Map<
      string,
      string
    >();

  $('a').each(
    (_, element) => {
      const anchor =
        $(element);

      const name =
        normalizeText(
          anchor.text(),
        );

      const href =
        anchor.attr(
          'href',
        );

      if (
        !name ||
        !href ||
        !/^Bachelor\b/i.test(
          name,
        )
      ) {
        return;
      }

      const url =
        normalizeUrl(
          href,
          fetched.finalUrl,
        );

      if (
        !url.startsWith(
          'https://www.sydney.edu.au/handbooks/engineering/',
        )
      ) {
        return;
      }

      if (
        isSupportPage(
          url,
        )
      ) {
        return;
      }

      candidates.set(
        canonicalCourseKey(
          url,
        ),
        url,
      );
    },
  );

  const results:
    UsydGlobalDegreeLink[] =
    [];

  for (
    const url
    of candidates.values()
  ) {
    const resolved =
      await resolveCanonicalCoursePage(
        url,
      );

    if (
      !resolved ||
      !resolved.heading
    ) {
      continue;
    }

    results.push({
      name:
        resolved.heading,

      overviewUrl:
        resolved.url,

      handbookCategory:
        root.handbookCategory,

      sourceRootUrl:
        root.handbookUrl,
    });
  }

  return results;
}

/*
 * ------------------------------------------------
 * LAW
 * ------------------------------------------------
 */

async function discoverLawPages(
  root: UsydCourseworkRoot,
): Promise<UsydGlobalDegreeLink[]> {
  if (
    !root.courseworkUrl
  ) {
    return [];
  }

  const fetched =
    await fetchPage(
      root.courseworkUrl,
    );

  const $ =
    cheerio.load(
      fetched.html,
    );

  const candidates =
    new Map<
      string,
      string
    >();

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

      if (
        !text ||
        !href
      ) {
        return;
      }

      if (
        !/^Bachelor\b/i.test(
          text,
        )
      ) {
        return;
      }

      const url =
        normalizeUrl(
          href,
          fetched.finalUrl,
        );

      if (
        !url.includes(
          '/handbooks/law/undergraduate/',
        )
      ) {
        return;
      }

      if (
        isSupportPage(
          url,
        )
      ) {
        return;
      }

      candidates.set(
        canonicalCourseKey(
          url,
        ),
        url,
      );
    },
  );

  const results:
    UsydGlobalDegreeLink[] =
    [];

  for (
    const url
    of candidates.values()
  ) {
    const resolved =
      await resolveCanonicalCoursePage(
        url,
      );

    if (
      !resolved ||
      !resolved.heading
    ) {
      continue;
    }

    results.push({
      name:
        resolved.heading,

      overviewUrl:
        resolved.url,

      handbookCategory:
        root.handbookCategory,

      sourceRootUrl:
        root.courseworkUrl,
    });
  }

  return results;
}

/*
 * ------------------------------------------------
 * CONSERVATORIUM
 * ------------------------------------------------
 */

async function discoverConservatoriumPages(
  root: UsydCourseworkRoot,
): Promise<UsydGlobalDegreeLink[]> {
  const seedUrls =
    [
      'https://www.sydney.edu.au/handbooks/conservatorium/undergraduate/bachelor-of-music.html',

      'https://www.sydney.edu.au/handbooks/conservatorium/undergraduate/bachelor-of-music/streams.html',
    ];

  const candidates =
    new Map<
      string,
      string
    >();

  for (
    const seedUrl
    of seedUrls
  ) {
    try {
      const fetched =
        await fetchPage(
          seedUrl,
        );

      const $ =
        cheerio.load(
          fetched.html,
        );

      /*
       * Seed itself may be a real award page.
       */
      const ownHeading =
        normalizeText(
          $('h1')
            .first()
            .text(),
        );

      if (
        /^Bachelor\b/i.test(
          ownHeading,
        ) &&
        !isSupportPage(
          fetched.finalUrl,
        )
      ) {
        candidates.set(
          canonicalCourseKey(
            fetched.finalUrl,
          ),
          fetched.finalUrl,
        );
      }

      $('a').each(
        (_, element) => {
          const href =
            $(element).attr(
              'href',
            );

          if (!href) {
            return;
          }

          const url =
            normalizeUrl(
              href,
              fetched.finalUrl,
            );

          if (
            !url.startsWith(
              'https://www.sydney.edu.au/handbooks/conservatorium/undergraduate/',
            )
          ) {
            return;
          }

          /*
           * Stream unit tables can expose Bachelor
           * titles, so they are temporarily allowed
           * through for inspection.
           */
          if (
            /\/unit-of-study-table\.html$/i.test(
              url,
            )
          ) {
            candidates.set(
              url,
              url,
            );

            return;
          }

          if (
            isSupportPage(
              url,
            )
          ) {
            return;
          }

          candidates.set(
            canonicalCourseKey(
              url,
            ),
            url,
          );
        },
      );
    } catch {
      /*
       * Missing seed should not fail the complete
       * university discovery.
       */
    }
  }

  const results:
    UsydGlobalDegreeLink[] =
    [];

  const seenNames =
    new Set<string>();

  for (
    const url
    of candidates.values()
  ) {
    try {
      const fetched =
        await fetchPage(
          url,
        );

      const $ =
        cheerio.load(
          fetched.html,
        );

      const heading =
        normalizeText(
          $('h1')
            .first()
            .text(),
        );

      /*
       * Must represent a Bachelor-level page.
       */
      if (
        !/^Bachelor\b/i.test(
          heading,
        )
      ) {
        continue;
      }

      /*
       * These are component/container pages,
       * not actual awards.
       *
       * Examples:
       *
       * Bachelor of Music - Majors
       * Bachelor of Music - Minors
       */
      if (
        /Bachelor of Music\s*-\s*(Majors|Minors)$/i.test(
          heading,
        )
      ) {
        continue;
      }

      const nameKey =
        heading
          .toLowerCase()
          .replace(
            /\s+/g,
            ' ',
          )
          .trim();

      if (
        seenNames.has(
          nameKey,
        )
      ) {
        continue;
      }

      seenNames.add(
        nameKey,
      );

      results.push({
        name:
          heading,

        overviewUrl:
          fetched.finalUrl,

        handbookCategory:
          root.handbookCategory,

        sourceRootUrl:
          root.handbookUrl,
      });
    } catch {
      continue;
    }
  }

  return results;
}

async function discoverPagesFromRoot(
  root: UsydCourseworkRoot,
): Promise<UsydGlobalDegreeLink[]> {
  switch (
    root.rootType
  ) {
    case 'COURSEWORK':
      return discoverStandardCourseworkPages(
        root,
      );

    case 'UNDERGRADUATE':
      if (
        root.handbookCategory ===
        'ARCHITECTURE'
      ) {
        return discoverArchitecturePages(
          root,
        );
      }

      if (
        root.handbookCategory ===
        'LAW'
      ) {
        return discoverLawPages(
          root,
        );
      }

      return [];

    case 'ENGINEERING':
      return discoverEngineeringPages(
        root,
      );

    case 'CONSERVATORIUM':
      return discoverConservatoriumPages(
        root,
      );

    case 'SHARED_TABLES':
      return [];

    default:
      return [];
  }
}

export async function discoverUsydUndergraduateDegrees(): Promise<
  UsydGlobalDegreeLink[]
> {
  const handbooks =
    await discoverUsydHandbooks();

  const discovered:
    UsydGlobalDegreeLink[] =
    [];

  for (
    const handbook
    of handbooks
  ) {
    const root =
      await discoverUsydCourseworkRoot(
        handbook,
      );

    if (!root) {
      continue;
    }

    const pages =
      await discoverPagesFromRoot(
        root,
      );

    discovered.push(
      ...pages,
    );
  }

  /*
   * ------------------------------------------------
   * GLOBAL COURSE-PAGE DEDUPLICATION
   * ------------------------------------------------
   *
   * This is still deduplication by course page.
   *
   * Final canonical degree deduplication will be by
   * course code after resolutions parsing.
   */

  const unique =
    new Map<
      string,
      UsydGlobalDegreeLink
    >();

  for (
    const page
    of discovered
  ) {
    const key =
      canonicalCourseKey(
        page.overviewUrl,
      );

    if (
      !unique.has(
        key,
      )
    ) {
      unique.set(
        key,
        page,
      );
    }
  }

  return [
    ...unique.values(),
  ].sort(
    (a, b) => {
      const facultyCompare =
        a.handbookCategory.localeCompare(
          b.handbookCategory,
        );

      if (
        facultyCompare !==
        0
      ) {
        return facultyCompare;
      }

      return a.name.localeCompare(
        b.name,
      );
    },
  );
}