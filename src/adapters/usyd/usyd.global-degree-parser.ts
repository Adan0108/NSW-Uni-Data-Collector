import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

import type {
  UsydGlobalDegreeLink,
} from './usyd.global-degree-discovery';

export interface UsydGlobalCourseCode {
  code: string;
  title: string;
}

export interface UsydGlobalDegreeRequirement {
  rawText: string;
  requiredCreditPoints: number | null;
}

export interface UsydGlobalParsedAward {
  code: string;

  title: string;

  totalCreditPoints: number | null;

  awardRequirements:
  UsydGlobalDegreeRequirement[];

  rawAwardRequirements:
  string | null;

  matchedAwardSection: boolean;

  matchMethod:
  | 'QUALIFICATION_SENTENCE'
  | 'TITLE_CLAUSE'
  | 'HEADING'
  | 'FALLBACK';
}

export interface UsydGlobalParsedCourse {
  discoveredName: string;

  handbookCategory:
  UsydGlobalDegreeLink['handbookCategory'];

  sourceRootUrl: string;

  sourceUrl: string;

  resolutionsUrl: string | null;

  courseCodes:
  UsydGlobalCourseCode[];

  awards:
  UsydGlobalParsedAward[];

  /*
   * Page-level debug fields.
   *
   * Individual Degree rows must use awards[].
   */
  totalCreditPoints:
  number | null;

  awardRequirements:
  UsydGlobalDegreeRequirement[];

  rawAwardRequirements:
  string | null;
}

interface UsydTopLevelRequirementClause {
  number: number;

  rawText: string;

  heading: string;
}

/*
 * ------------------------------------------------
 * NORMALIZATION
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

function normalizeMatchText(
  value: string,
): string {
  return normalizeText(
    value,
  )
    .toLowerCase()
    .replace(
      /&/g,
      'and',
    )
    .replace(
      /[\u2010\u2011\u2012\u2013\u2014\u2212]/g,
      '-',
    )
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function normalizeCourseCode(
  value: string,
): string {
  return normalizeText(
    value,
  )
    .replace(
      /[\u2010\u2011\u2012\u2013\u2014\u2212]/g,
      '-',
    )
    .toUpperCase();
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

function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
}

/*
 * ------------------------------------------------
 * CREDIT POINTS
 * ------------------------------------------------
 */

function parseCreditPoints(
  text: string,
): number | null {
  const match =
    text.match(
      /\b(\d+)\s*(?:credit points?|cps?)\b/i,
    );

  if (!match) {
    return null;
  }

  return Number(
    match[1],
  );
}

function extractTotalCreditPoints(
  text: string,
): number | null {
  /*
   * ------------------------------------------------
   * 1. STRONG AWARD-QUALIFICATION TOTALS
   * ------------------------------------------------
   *
   * Award-level qualification wording has priority
   * over constituent/component requirements.
   *
   * Examples:
   *
   * "To qualify for the award ... must complete
   * a total of 192 credit points"
   *
   * "To qualify for the award ... must complete
   * 144 credit points"
   */

  const qualificationPatterns =
    [
      /*
       * Explicit TOTAL OF.
       *
       * This MUST come before the generic qualification
       * patterns.
       *
       * Example:
       *
       * Bachelor of Arts and Master of Nursing:
       *
       * "must complete a total of 192 credit points"
       */
      /to\s+qualify\s+for\s+the\s+award[\s\S]{0,400}?must\s*(?:successfully\s*)?(?:satisfactorily\s*)?complete\s+(?:a\s+)?total\s+of\s+(\d+)\s+credit points?\b/i,

      /*
       * Same structure without "total of".
       */
      /to\s+qualify\s+for\s+the\s+award[\s\S]{0,400}?must\s*(?:successfully\s*)?(?:satisfactorily\s*)?complete\s+(\d+)\s+credit points?\b/i,

      /*
       * Some resolutions use "complete" without
       * explicitly writing "must".
       */
      /to\s+qualify\s+for\s+the\s+award[\s\S]{0,400}?complete\s+(?:a\s+)?total\s+of\s+(\d+)\s+credit points?\b/i,

      /to\s+qualify\s+for\s+the\s+award[\s\S]{0,400}?complete\s+(\d+)\s+credit points?\b/i,

      /*
       * Degree wording instead of award wording.
       */
      /to\s+qualify\s+for\s+the\s+degree[\s\S]{0,400}?must\s*(?:successfully\s*)?(?:satisfactorily\s*)?complete\s+(?:a\s+)?total\s+of\s+(\d+)\s+credit points?\b/i,

      /to\s+qualify\s+for\s+the\s+degree[\s\S]{0,400}?must\s*(?:successfully\s*)?(?:satisfactorily\s*)?complete\s+(\d+)\s+credit points?\b/i,

      /to\s+qualify\s+for\s+the\s+degree[\s\S]{0,400}?complete\s+(?:a\s+)?total\s+of\s+(\d+)\s+credit points?\b/i,

      /to\s+qualify\s+for\s+the\s+degree[\s\S]{0,400}?complete\s+(\d+)\s+credit points?\b/i,
    ];

  for (
    const pattern
    of qualificationPatterns
  ) {
    const match =
      text.match(
        pattern,
      );

    if (match) {
      return Number(
        match[1],
      );
    }
  }

  /*
   * ------------------------------------------------
   * 2. GENERAL TOTAL EXPRESSIONS
   * ------------------------------------------------
   */

  const patterns =
    [
      /must\s*(?:successfully\s+)?complete\s+(?:a\s+)?total\s+of\s+(\d+)\s+credit points?\b/i,

      /complete\s+(?:a\s+)?total\s+of\s+(\d+)\s+credit points?\b/i,

      /must\s*successfully\s*complete\s+(?:a\s+)?minimum\s+of\s+(\d+)\s+credit points?\b/i,

      /must\s*satisfactorily\s*complete\s+(?:a\s+)?minimum\s+of\s+(\d+)\s+credit points?\b/i,

      /must\s*complete\s+(?:a\s+)?minimum\s+of\s+(\d+)\s+credit points?\b/i,

      /complete\s+(?:a\s+)?minimum\s+of\s+(\d+)\s+credit points?\b/i,

      /must\s*successfully\s*complete\s+(?:a\s+)?fixed curriculum of\s+(\d+)\s+credit points?\b/i,

      /must\s*complete\s+(?:a\s+)?fixed curriculum of\s+(\d+)\s+credit points?\b/i,

      /complete\s+(?:a\s+)?fixed curriculum of\s+(\d+)\s+credit points?\b/i,

      /must\s*successfully\s*complete\s+(\d+)\s+credit points?\b/i,

      /must\s*satisfactorily\s*complete\s+(\d+)\s+credit points?\b/i,

      /must\s*complete\s+(\d+)\s+credit points?\b/i,

      /complete\s+(\d+)\s+credit points?\b/i,

      /completion\s+of\s+(\d+)\s+credit points?\b/i,

      /comprising\s+(\d+)\s+credit points?\b/i,

      /requires?\s+(?:the\s+)?completion\s+of\s+(\d+)\s+credit points?\b/i,

      /requires?\s+(\d+)\s+credit points?\b/i,
    ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      text.match(
        pattern,
      );

    if (match) {
      return Number(
        match[1],
      );
    }
  }

  return null;
}

/*
 * ------------------------------------------------
 * REQUIREMENT ITEMS
 * ------------------------------------------------
 */

function extractRequirementLines(
  text: string,
): UsydGlobalDegreeRequirement[] {
  const requirements:
    UsydGlobalDegreeRequirement[] =
    [];

  const matches =
    text.matchAll(
      /\([a-z]+\)\s+(.+?)(?=\s+\([a-z]+\)\s+|$)/gi,
    );

  for (
    const match
    of matches
  ) {
    const rawText =
      normalizeText(
        match[1],
      );

    if (!rawText) {
      continue;
    }

    requirements.push({
      rawText,

      requiredCreditPoints:
        parseCreditPoints(
          rawText,
        ),
    });
  }

  return requirements;
}

function extractFallbackRequirement(
  text: string,
): UsydGlobalDegreeRequirement[] {
  const normalized =
    normalizeText(
      text,
    );

  if (!normalized) {
    return [];
  }

  return [
    {
      rawText:
        normalized,

      requiredCreditPoints:
        parseCreditPoints(
          normalized,
        ),
    },
  ];
}

/*
 * ------------------------------------------------
 * HTTP
 * ------------------------------------------------
 */

async function fetchHtml(
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
      responseUrl ??
      url,
  };
}

async function findResolutionsUrl(
  sourceUrl: string,
): Promise<string | null> {
  if (
    /\/(?:course-)?resolutions\.html$/i.test(
      sourceUrl,
    )
  ) {
    return sourceUrl;
  }

  try {
    const fetched =
      await fetchHtml(
        sourceUrl,
      );

    const $ =
      cheerio.load(
        fetched.html,
      );

    let discovered:
      string | null =
      null;

    $('a').each(
      (_, element) => {
        if (discovered) {
          return;
        }

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

        const url =
          normalizeUrl(
            href,
            fetched.finalUrl,
          );

        if (
          /course resolutions/i.test(
            text,
          ) ||
          /(?:course-)?resolutions\.html$/i.test(
            url,
          )
        ) {
          discovered =
            url;
        }
      },
    );

    if (discovered) {
      return discovered;
    }

    if (
      /\/overview\.html$/i.test(
        fetched.finalUrl,
      )
    ) {
      const candidates =
        [
          fetched.finalUrl.replace(
            /overview\.html$/i,
            'course-resolutions.html',
          ),

          fetched.finalUrl.replace(
            /overview\.html$/i,
            'resolutions.html',
          ),
        ];

      for (
        const candidate
        of candidates
      ) {
        try {
          await axios.get(
            candidate,
            {
              maxRedirects: 10,
            },
          );

          return candidate;
        } catch {
          // Try next candidate.
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/*
 * ------------------------------------------------
 * COURSE CODES
 * ------------------------------------------------
 */

function extractCodesFromCell(
  cellText: string,
): string[] {
  const normalized =
    normalizeCourseCode(
      cellText,
    );

  const matches =
    normalized.match(
      /\b[A-Z]{2,}[A-Z0-9]*-[A-Z0-9]+\b/g,
    );

  if (!matches) {
    return [];
  }

  return [
    ...new Set(
      matches,
    ),
  ];
}

function extractCourseCodes(
  $: cheerio.CheerioAPI,
): UsydGlobalCourseCode[] {
  const results:
    UsydGlobalCourseCode[] =
    [];

  const seen =
    new Set<string>();

  $('table').each(
    (_, element) => {
      const table =
        $(element);

      const tableText =
        normalizeText(
          table.text(),
        );

      if (
        !/\bCode\b/i.test(
          tableText,
        )
      ) {
        return;
      }

      if (
        !/\bCourse(?:\s+and\s+stream)?\s+title\b/i.test(
          tableText,
        ) &&
        !/\bCourse\s*title\b/i.test(
          tableText,
        ) &&
        !/\bAward\b/i.test(
          tableText,
        )
      ) {
        return;
      }

      table
        .find('tr')
        .each(
          (_, rowElement) => {
            const cells =
              $(rowElement)
                .find('td');

            if (
              cells.length <
              2
            ) {
              return;
            }

            const codeCell =
              cells
                .eq(0)
                .text();

            const title =
              normalizeText(
                cells
                  .eq(1)
                  .text(),
              );

            if (!title) {
              return;
            }

            const codes =
              extractCodesFromCell(
                codeCell,
              );

            for (
              const code
              of codes
            ) {
              const key =
                `${code}::${title}`;

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
                code,
                title,
              });
            }
          },
        );
    },
  );

  return results;
}

/*
 * ------------------------------------------------
 * REQUIREMENTS SECTION
 * ------------------------------------------------
 *
 * Do not determine section boundaries using
 * flattened numbered text.
 *
 * Handbook requirement prose frequently contains
 * references such as:
 *
 * "as defined in section 7"
 *
 * which can be mistaken for a real section heading.
 *
 * Use actual HTML heading nodes instead.
 */

function headingLevel(
  element: AnyNode,
): number | null {
  if (
    element.type !==
    'tag'
  ) {
    return null;
  }

  const tagName =
    element.name.toLowerCase();

  const match =
    /^h([1-6])$/.exec(
      tagName,
    );

  if (!match) {
    return null;
  }

  return Number(
    match[1],
  );
}

function isRequirementsHeading(
  text: string,
): boolean {
  const normalized =
    normalizeText(
      text,
    );

  return (
    /^(?:\(\d+\)|\d+[.]?)?\s*Requirements for award\b/i.test(
      normalized,
    ) ||
    /^(?:\(\d+\)|\d+[.]?)?\s*Requirements for (?:the )?Honours degree\b/i.test(
      normalized,
    )
  );
}

function extractRequirementsSectionFromDom(
  $: cheerio.CheerioAPI,
): string | null {
  let requirementsHeading:
    AnyNode | null =
    null;

  $('h1, h2, h3, h4, h5, h6').each(
    (_, element) => {
      if (
        requirementsHeading
      ) {
        return;
      }

      const text =
        normalizeText(
          $(element).text(),
        );

      if (
        isRequirementsHeading(
          text,
        )
      ) {
        requirementsHeading =
          element;
      }
    },
  );

  if (
    !requirementsHeading
  ) {
    return null;
  }

  const targetLevel =
    headingLevel(
      requirementsHeading,
    );

  if (
    targetLevel ===
    null
  ) {
    return null;
  }

  const pieces:
    string[] =
    [];

  let current =
    $(requirementsHeading).next();

  while (
    current.length >
    0
  ) {
    const element =
      current.get(0);

    if (!element) {
      break;
    }

    const level =
      headingLevel(
        element,
      );

    /*
     * Stop only when another actual HTML heading
     * of the same or higher level begins.
     *
     * Example:
     *
     * h2 Requirements for award
     * h3 Bachelor of Commerce
     * h3 Bachelor of Commerce and Advanced Studies
     * h2 Progression
     *
     * The h3 headings stay inside the requirement
     * section. The next h2 ends it.
     */
    if (
      level !==
      null &&
      level <=
      targetLevel
    ) {
      break;
    }

    const text =
      normalizeText(
        current.text(),
      );

    if (text) {
      pieces.push(
        text,
      );
    }

    current =
      current.next();
  }

  const result =
    normalizeText(
      pieces.join(
        ' ',
      ),
    );

  return result ||
    null;
}

/*
 * Fallback only for unusual pages whose
 * Requirements heading is not represented by a
 * standard heading element.
 *
 * Do not try to guess the end using numbered
 * section references.
 */
function extractRequirementsSectionFallback(
  bodyText: string,
): string | null {
  const patterns =
    [
      /(?:\(\d+\)|\d+\s*[.]?)\s*Requirements for award\b/i,

      /(?:\(\d+\)|\d+\s*[.]?)\s*Requirements for (?:the )?Honours degree\b/i,
    ];

  for (
    const pattern
    of patterns
  ) {
    const match =
      pattern.exec(
        bodyText,
      );

    if (
      !match ||
      match.index ===
      undefined
    ) {
      continue;
    }

    return normalizeText(
      bodyText.slice(
        match.index +
        match[0].length,
      ),
    );
  }

  return null;
}

function extractRequirementsSection(
  $: cheerio.CheerioAPI,

  bodyText: string,
): string | null {
  return (
    extractRequirementsSectionFromDom(
      $,
    ) ??
    extractRequirementsSectionFallback(
      bodyText,
    )
  );
}

/*
 * ------------------------------------------------
 * TOP-LEVEL NUMBERED CLAUSES
 * ------------------------------------------------
 */

function extractClauseHeading(
  rawText: string,
): string {
  const normalized =
    normalizeText(
      rawText,
    );

  const stoppingPatterns =
    [
      /\bTo qualify\b/i,
      /\bTo be eligible\b/i,
      /\bA candidate\b/i,
      /\bCandidates\b/i,
      /\bThe candidate\b/i,
      /\bStudents\b/i,
      /\bA student\b/i,
      /\bThe requirements\b/i,
    ];

  let end =
    normalized.length;

  for (
    const pattern
    of stoppingPatterns
  ) {
    const match =
      pattern.exec(
        normalized,
      );

    if (
      match &&
      match.index <
      end
    ) {
      end =
        match.index;
    }
  }

  return normalizeText(
    normalized.slice(
      0,
      end,
    ),
  )
    .replace(
      /[:;,.]+$/,
      '',
    )
    .trim();
}

function extractTopLevelRequirementClauses(
  requirementsSection: string,
): UsydTopLevelRequirementClause[] {
  const matches =
    [
      ...requirementsSection.matchAll(
        /\((\d+)\)\s*/g,
      ),
    ];

  const clauses:
    UsydTopLevelRequirementClause[] =
    [];

  for (
    let index = 0;
    index <
    matches.length;
    index += 1
  ) {
    const match =
      matches[index];

    if (
      match.index ===
      undefined
    ) {
      continue;
    }

    const start =
      match.index +
      match[0].length;

    const end =
      index + 1 <
        matches.length
        ? (
          matches[
            index + 1
          ].index ??
          requirementsSection.length
        )
        : requirementsSection.length;

    const rawText =
      normalizeText(
        requirementsSection.slice(
          start,
          end,
        ),
      );

    if (!rawText) {
      continue;
    }

    clauses.push({
      number:
        Number(
          match[1],
        ),

      rawText,

      heading:
        extractClauseHeading(
          rawText,
        ),
    });
  }

  return clauses;
}

/*
 * ------------------------------------------------
 * TITLE MATCHING
 * ------------------------------------------------
 */

function titleWords(
  value: string,
): string[] {
  return normalizeMatchText(
    value,
  )
    .split(
      ' ',
    )
    .filter(
      Boolean,
    );
}

function titleSimilarity(
  left: string,
  right: string,
): number {
  const leftWords =
    new Set(
      titleWords(
        left,
      ),
    );

  const rightWords =
    new Set(
      titleWords(
        right,
      ),
    );

  if (
    leftWords.size ===
    0 ||
    rightWords.size ===
    0
  ) {
    return 0;
  }

  let shared = 0;

  for (
    const word
    of leftWords
  ) {
    if (
      rightWords.has(
        word,
      )
    ) {
      shared += 1;
    }
  }

  return (
    shared /
    Math.max(
      leftWords.size,
      rightWords.size,
    )
  );
}

function isStrongTitleMatch(
  awardTitle: string,
  candidate: string,
): boolean {
  const award =
    normalizeMatchText(
      awardTitle,
    );

  const value =
    normalizeMatchText(
      candidate,
    );

  if (
    !award ||
    !value
  ) {
    return false;
  }

  if (
    award ===
    value
  ) {
    return true;
  }

  if (
    value.startsWith(
      `${award} `,
    )
  ) {
    return true;
  }

  if (
    award.startsWith(
      `${value} `,
    ) &&
    value.length >=
    20
  ) {
    return true;
  }

  return (
    titleSimilarity(
      award,
      value,
    ) >=
    0.9
  );
}

function findAwardClauseByTitleOccurrence(
  title: string,

  clauses:
    UsydTopLevelRequirementClause[],
): UsydTopLevelRequirementClause | null {
  const titleKey =
    normalizeMatchText(
      title,
    );

  if (!titleKey) {
    return null;
  }

  /*
   * Strongest match:
   *
   * title appears in the clause and the clause
   * contains explicit qualification wording.
   */
  for (
    const clause
    of clauses
  ) {
    const clauseKey =
      normalizeMatchText(
        clause.rawText,
      );

    const containsTitle =
      clauseKey.includes(
        titleKey,
      );

    const hasQualificationLanguage =
      /\bto\s+qualify\b/i.test(
        clause.rawText,
      ) ||
      /\bto\s+be\s+eligible\b/i.test(
        clause.rawText,
      );

    if (
      containsTitle &&
      hasQualificationLanguage
    ) {
      return clause;
    }
  }

  /*
   * Award title as clause heading.
   */
  for (
    const clause
    of clauses
  ) {
    if (
      isStrongTitleMatch(
        title,
        clause.heading,
      )
    ) {
      return clause;
    }
  }

  /*
   * Award title starts the clause.
   */
  for (
    const clause
    of clauses
  ) {
    const clauseKey =
      normalizeMatchText(
        clause.rawText,
      );

    if (
      clauseKey ===
      titleKey ||
      clauseKey.startsWith(
        `${titleKey} `,
      )
    ) {
      return clause;
    }
  }

  return null;
}

function findAwardClauseByHeading(
  title: string,

  clauses:
    UsydTopLevelRequirementClause[],
): UsydTopLevelRequirementClause | null {
  const titleKey =
    normalizeMatchText(
      title,
    );

  if (!titleKey) {
    return null;
  }

  for (
    const clause
    of clauses
  ) {
    const headingKey =
      normalizeMatchText(
        clause.heading,
      );

    if (
      headingKey ===
      titleKey
    ) {
      return clause;
    }
  }

  for (
    const clause
    of clauses
  ) {
    const headingKey =
      normalizeMatchText(
        clause.heading,
      );

    if (
      headingKey.startsWith(
        `${titleKey} `,
      )
    ) {
      return clause;
    }
  }

  return null;
}

/*
 * ------------------------------------------------
 * QUALIFICATION SENTENCE MATCHER
 * ------------------------------------------------
 */

function createQualificationTitleVariants(
  title: string,
): string[] {
  const normalized =
    normalizeText(
      title,
    );

  const variants =
    new Set<string>();

  /*
   * Original handbook/course-code title.
   */
  variants.add(
    normalized,
  );

  /*
   * Some resolutions write:
   *
   * Bachelor of Science (Honours)
   *
   * while others use:
   *
   * Bachelor of Science Honours
   */
  variants.add(
    normalized.replace(
      /\s*\(Honours\)/gi,
      ' Honours',
    ),
  );

  variants.add(
    normalized.replace(
      /\s+Honours\b/gi,
      ' (Honours)',
    ),
  );

  /*
   * Normal punctuation variation.
   */
  variants.add(
    normalized.replace(
      /;/g,
      ',',
    ),
  );

  /*
   * USYD sometimes separates two awards with a
   * semicolon in the resolutions even though the
   * official course-code title uses "and".
   *
   * Example:
   *
   * Course-code title:
   * Bachelor of Advanced Computing and
   * Bachelor of Commerce
   *
   * Resolution:
   * Bachelor of Advanced Computing;
   * Bachelor of Commerce
   *
   * Keep this generic rather than hardcoding the
   * Advanced Computing course.
   */
  variants.add(
    normalized.replace(
      /\s+and\s+(?=Bachelor\b)/gi,
      '; ',
    ),
  );

  /*
   * Some pages may use a comma between the two
   * Bachelor award names.
   */
  variants.add(
    normalized.replace(
      /\s+and\s+(?=Bachelor\b)/gi,
      ', ',
    ),
  );

  return [
    ...variants,
  ]
    .map(
      (variant) =>
        normalizeText(
          variant,
        ),
    )
    .filter(
      Boolean,
    );
}

function titleToFlexibleRegex(
  title: string,
): string {
  const words =
    normalizeText(
      title,
    )
      .split(
        /\s+/,
      )
      .filter(
        Boolean,
      );

  return words
    .map(
      (word) =>
        escapeRegex(
          word,
        ),
    )
    .join(
      '\\s+',
    );
}

function findQualificationSentenceStart(
  text: string,

  title: string,
): number | null {
  const variants =
    createQualificationTitleVariants(
      title,
    );

  for (
    const variant
    of variants
  ) {
    const flexibleTitle =
      titleToFlexibleRegex(
        variant,
      );

    const patterns =
      [
        new RegExp(
          `To\\s+qualify\\s+for\\s+the\\s+award\\s+of\\s+(?:the\\s+)?${flexibleTitle}\\b`,
          'i',
        ),

        new RegExp(
          `To\\s+qualify\\s+for\\s+(?:the\\s+)?${flexibleTitle}\\b`,
          'i',
        ),

        new RegExp(
          `To\\s+be\\s+eligible\\s+for\\s+(?:the\\s+award\\s+of\\s+)?(?:the\\s+)?${flexibleTitle}\\b`,
          'i',
        ),
      ];

    for (
      const pattern
      of patterns
    ) {
      const match =
        pattern.exec(
          text,
        );

      if (
        match &&
        match.index !==
        undefined
      ) {
        return match.index;
      }
    }
  }

  return null;
}

function findNextQualificationSentenceStart(
  text: string,

  afterIndex: number,
): number | null {
  const remaining =
    text.slice(
      afterIndex,
    );

  const patterns =
    [
      /\bTo\s+qualify\s+for\s+the\s+award\s+of\b/i,

      /\bTo\s+qualify\s+for\s+the\s+Bachelor\b/i,

      /\bTo\s+qualify\s+for\s+the\s+Diploma\b/i,

      /\bTo\s+qualify\s+for\s+the\s+degree\b/i,

      /\bTo\s+qualify\s+for\s+the\s+course\b/i,

      /\bTo\s+be\s+eligible\s+for\s+the\s+award\b/i,
    ];

  let earliest:
    number | null =
    null;

  for (
    const pattern
    of patterns
  ) {
    const match =
      pattern.exec(
        remaining,
      );

    if (
      !match ||
      match.index ===
      undefined
    ) {
      continue;
    }

    const absolute =
      afterIndex +
      match.index;

    if (
      earliest ===
      null ||
      absolute <
      earliest
    ) {
      earliest =
        absolute;
    }
  }

  return earliest;
}

function findQualificationAwardBlock(
  title: string,

  requirementsSection: string,
): string | null {
  const start =
    findQualificationSentenceStart(
      requirementsSection,
      title,
    );

  if (
    start ===
    null
  ) {
    return null;
  }

  const searchFrom =
    start +
    30;

  const nextQualification =
    findNextQualificationSentenceStart(
      requirementsSection,
      searchFrom,
    );

  let end =
    requirementsSection.length;

  if (
    nextQualification !==
    null &&
    nextQualification >
    start
  ) {
    end =
      nextQualification;
  }

  return (
    normalizeText(
      requirementsSection.slice(
        start,
        end,
      ),
    ) ||
    null
  );
}

/*
 * ------------------------------------------------
 * KNOWN STRUCTURAL TOTALS
 * ------------------------------------------------
 */

/**
 * Applies an explicitly verified award total when the
 * handbook resolution does not provide a title-specific
 * total that our generic parser can safely identify.
 *
 * IMPORTANT:
 *
 * Only put an award here when its total has been
 * independently verified from an official USYD source.
 *
 * Do NOT use this table simply to make FALLBACK records
 * look correct.
 */
/**
 * Applies an explicitly verified award total when the
 * handbook resolution does not provide a title-specific
 * total that our generic parser can safely identify.
 *
 * IMPORTANT:
 *
 * Only put an award here when its total has been
 * independently verified from an official USYD source.
 *
 * Do NOT use this table simply to make FALLBACK records
 * look correct.
 */
function applyKnownAwardTotal(
  code: string,
  parsedTotal: number | null,
): number | null {
  const knownAwardTotals =
    new Map<string, number>([
      /*
       * Standard Bachelor of Science Honours.
       */
      [
        'BHSCIENH-02',
        48,
      ],

      /*
       * Architecture Honours.
       */
      [
        'BHARCENV-01',
        48,
      ],

      [
        'BHDARCHH-01',
        48,
      ],

      /*
       * Project Management Honours.
       */
      [
        'BHPRJMGT-01',
        48,
      ],

      /*
       * ------------------------------------------------
       * SCIENCE HONOURS VARIANTS
       * ------------------------------------------------
       *
       * The generic Science Honours resolution starts
       * with:
       *
       * "minimum of 12 credit points of coursework..."
       *
       * so the generic total parser can incorrectly
       * interpret 12 as the total award size.
       *
       * The official Honours tables establish these as
       * 48 CP Honours awards.
       */

      [
        'BHSCIFGB-01',
        48,
      ],

      [
        'BHSCITWC-01',
        48,
      ],
    ]);

  return (
    knownAwardTotals.get(
      code,
    ) ??
    parsedTotal
  );
}
/*
 * ------------------------------------------------
 * AWARD CREATION
 * ------------------------------------------------
 */

function parseAwardFromSection(
  courseCode:
    UsydGlobalCourseCode,

  section: string,

  matchMethod:
    UsydGlobalParsedAward['matchMethod'],
): UsydGlobalParsedAward {
  /*
   * First try to split the selected award section into
   * individual lettered requirement clauses.
   *
   * Example:
   *
   * (a) 48 CP major
   * (b) 6 CP OLE
   * (c) electives
   */
  let requirements =
    extractRequirementLines(
      section,
    );

  /*
   * Some USYD resolutions do not use normal lettered
   * requirement clauses.
   *
   * Preserve the whole section rather than losing the
   * requirement completely.
   */
  if (
    requirements.length ===
    0
  ) {
    requirements =
      extractFallbackRequirement(
        section,
      );
  }

  /*
   * Build the normal parsed award first.
   *
   * The generic parser determines:
   *
   * - award title/code
   * - total CP
   * - requirements
   * - raw source text
   * - how confidently the award section was matched
   */
  const award:
    UsydGlobalParsedAward =
  {
    code:
      courseCode.code,

    title:
      courseCode.title,

    totalCreditPoints:
      extractTotalCreditPoints(
        section,
      ),

    awardRequirements:
      requirements,

    rawAwardRequirements:
      normalizeText(
        section,
      ) ||
      null,

    matchedAwardSection:
      matchMethod !==
      'FALLBACK',

    matchMethod,
  };

  /*
   * ------------------------------------------------
   * VERIFIED STRUCTURAL TOTAL OVERRIDES
   * ------------------------------------------------
   *
   * Some USYD pages list multiple course codes but only
   * provide a generic/shared requirement section.
   *
   * In those cases the generic parser can correctly
   * parse the shared pass-degree total while assigning
   * that same number to a separate Honours code.
   *
   * applyKnownAwardTotal() corrects only awards whose
   * totals have already been independently verified.
   *
   * IMPORTANT:
   *
   * We pass:
   *
   * 1. the award code
   * 2. the total found by the generic parser
   *
   * If no verified override exists, the parsed value is
   * returned unchanged.
   */
  award.totalCreditPoints =
    applyKnownAwardTotal(
      award.code,
      award.totalCreditPoints,
    );

  return award;
}

/*
 * ------------------------------------------------
 * BUILD AWARDS
 * ------------------------------------------------
 */

function buildAwards(
  courseCodes:
    UsydGlobalCourseCode[],

  requirementsSection:
    string | null,

  bodyText: string,
): UsydGlobalParsedAward[] {
  if (
    courseCodes.length ===
    0
  ) {
    return [];
  }

  const source =
    requirementsSection ??
    bodyText;

  /*
   * Single award page.
   */
  if (
    courseCodes.length ===
    1
  ) {
    const award =
      parseAwardFromSection(
        courseCodes[0],
        source,
        requirementsSection
          ? 'HEADING'
          : 'FALLBACK',
      );

    /*
     * Some single-award pages state the total
     * elsewhere in the resolutions page.
     *
     * Arts Honours and Visual Arts Honours are
     * examples discovered by the audit.
     */
    if (
      award.totalCreditPoints ===
      null
    ) {
      award.totalCreditPoints =
        extractTotalCreditPoints(
          bodyText,
        );
    }

    return [
      award,
    ];
  }

  const clauses =
    requirementsSection
      ? extractTopLevelRequirementClauses(
        requirementsSection,
      )
      : [];

  return courseCodes.map(
    (
      courseCode,
    ) => {
      /*
       * ------------------------------------------------
       * 1. QUALIFICATION SENTENCE
       * ------------------------------------------------
       */
      if (
        requirementsSection
      ) {
        const qualificationBlock =
          findQualificationAwardBlock(
            courseCode.title,
            requirementsSection,
          );

        if (
          qualificationBlock
        ) {
          const parsed =
            parseAwardFromSection(
              courseCode,
              qualificationBlock,
              'QUALIFICATION_SENTENCE',
            );

          if (
            parsed.totalCreditPoints !==
            null
          ) {
            return parsed;
          }
        }
      }

      /*
       * ------------------------------------------------
       * 2. NUMBERED TITLE CLAUSE
       * ------------------------------------------------
       */
      if (
        clauses.length >
        0
      ) {
        const titleClause =
          findAwardClauseByTitleOccurrence(
            courseCode.title,
            clauses,
          );

        if (
          titleClause
        ) {
          const parsed =
            parseAwardFromSection(
              courseCode,
              titleClause.rawText,
              'TITLE_CLAUSE',
            );

          if (
            parsed.totalCreditPoints !==
            null
          ) {
            return parsed;
          }
        }
      }

      /*
       * ------------------------------------------------
       * 3. HEADING MATCH
       * ------------------------------------------------
       */
      if (
        clauses.length >
        0
      ) {
        const headingClause =
          findAwardClauseByHeading(
            courseCode.title,
            clauses,
          );

        if (
          headingClause
        ) {
          const parsed =
            parseAwardFromSection(
              courseCode,
              headingClause.rawText,
              'HEADING',
            );

          if (
            parsed.totalCreditPoints !==
            null
          ) {
            return parsed;
          }
        }
      }

      /*
       * ------------------------------------------------
       * 4. FALLBACK
       * ------------------------------------------------
       */
      return parseAwardFromSection(
        courseCode,
        source,
        'FALLBACK',
      );
    },
  );
}

/*
 * ------------------------------------------------
 * MAIN PARSER
 * ------------------------------------------------
 */

export async function parseUsydGlobalCourse(
  discovered:
    UsydGlobalDegreeLink,
): Promise<UsydGlobalParsedCourse> {
  /*
   * Law Honours is an embedded pathway rather than
   * a separate course-code award.
   */
  if (
    discovered.handbookCategory ===
    'LAW' &&
    /^Honours in the Bachelor of Laws$/i.test(
      discovered.name,
    )
  ) {
    return {
      discoveredName:
        discovered.name,

      handbookCategory:
        discovered.handbookCategory,

      sourceRootUrl:
        discovered.sourceRootUrl,

      sourceUrl:
        discovered.overviewUrl,

      resolutionsUrl:
        discovered.overviewUrl,

      courseCodes:
        [],

      awards:
        [],

      totalCreditPoints:
        null,

      awardRequirements:
        [
          {
            rawText:
              'Embedded Honours pathway within the Bachelor of Laws; not a separate course-code award.',

            requiredCreditPoints:
              12,
          },
        ],

      rawAwardRequirements:
        'Honours in the Bachelor of Laws is an embedded honours pathway within the Bachelor of Laws.',
    };
  }

  const resolutionsUrl =
    await findResolutionsUrl(
      discovered.overviewUrl,
    );

  const result:
    UsydGlobalParsedCourse =
  {
    discoveredName:
      discovered.name,

    handbookCategory:
      discovered.handbookCategory,

    sourceRootUrl:
      discovered.sourceRootUrl,

    sourceUrl:
      discovered.overviewUrl,

    resolutionsUrl,

    courseCodes:
      [],

    awards:
      [],

    totalCreditPoints:
      null,

    awardRequirements:
      [],

    rawAwardRequirements:
      null,
  };

  if (!resolutionsUrl) {
    return result;
  }

  const fetched =
    await fetchHtml(
      resolutionsUrl,
    );

  const $ =
    cheerio.load(
      fetched.html,
    );

  /*
   * Course codes.
   */
  result.courseCodes =
    extractCourseCodes(
      $,
    );

  /*
   * Full page text.
   */
  const bodyText =
    normalizeText(
      $('body').text(),
    );

  /*
   * IMPORTANT:
   *
   * Use DOM heading boundaries rather than
   * numbered-text guessing.
   */
  const requirementsSection =
    extractRequirementsSection(
      $,
      bodyText,
    );

  /*
   * Page-level debug data.
   */
  if (
    requirementsSection
  ) {
    result.rawAwardRequirements =
      requirementsSection;

    result.totalCreditPoints =
      extractTotalCreditPoints(
        requirementsSection,
      );

    result.awardRequirements =
      extractRequirementLines(
        requirementsSection,
      );

    if (
      result.awardRequirements.length ===
      0
    ) {
      result.awardRequirements =
        extractFallbackRequirement(
          requirementsSection,
        );
    }
  }

  if (
    result.totalCreditPoints ===
    null
  ) {
    result.totalCreditPoints =
      extractTotalCreditPoints(
        bodyText,
      );
  }

  /*
   * Per-award records.
   */
  result.awards =
    buildAwards(
      result.courseCodes,
      requirementsSection,
      bodyText,
    );

  return result;
}