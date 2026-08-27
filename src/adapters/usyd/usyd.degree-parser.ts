import { chromium } from 'playwright';

export interface UsydDegreeRequirement {
  rawText: string;
  requiredCreditPoints: number | null;
}

export interface UsydDegreeCourseCode {
  code: string;
  title: string;
}

export interface UsydDegreePage {
  name: string;
  overviewUrl: string;

  resolutionsUrl: string | null;

  courseCodes: UsydDegreeCourseCode[];

  totalCreditPoints: number | null;

  streams: string[];

  awardRequirements: UsydDegreeRequirement[];

  rawAwardRequirements: string | null;

  handbookLinks: {
    text: string;
    url: string;
  }[];
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCreditPoints(
  text: string,
): number | null {
  const match =
    text.match(
      /\b(\d+)\s+credit points?\b/i,
    );

  if (!match) {
    return null;
  }

  return Number(
    match[1],
  );
}

function escapeRegExp(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
}

function extractRequirementLines(
  text: string,
): UsydDegreeRequirement[] {
  const requirements:
    UsydDegreeRequirement[] =
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

/*
 * Some degrees describe their award requirement
 * as ordinary prose rather than lettered clauses.
 *
 * Example:
 *
 * Bachelor of Liberal Arts and Science:
 *
 * "To qualify ... successfully complete
 * 144 credit points ... which must include ..."
 *
 * We keep the whole statement as one raw
 * requirement rather than losing it.
 */
function extractFallbackRequirement(
  text: string,
): UsydDegreeRequirement[] {
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

function extractSection(
  fullText: string,
  headingPattern: RegExp,
): string | null {
  const headingMatch =
    headingPattern.exec(
      fullText,
    );

  if (
    !headingMatch ||
    headingMatch.index ===
      undefined
  ) {
    return null;
  }

  const sectionNumber =
    Number(
      headingMatch[1],
    );

  const start =
    headingMatch.index +
    headingMatch[0].length;

  const afterHeading =
    fullText.slice(
      start,
    );

  /*
   * Stop at the next top-level numbered
   * handbook section.
   */
  const nextSectionRegex =
    new RegExp(
      `\\s+${sectionNumber + 1}\\s+[A-Z]`,
      'i',
    );

  const nextSectionMatch =
    nextSectionRegex.exec(
      afterHeading,
    );

  return normalizeText(
    nextSectionMatch &&
    nextSectionMatch.index !==
      undefined
      ? afterHeading.slice(
          0,
          nextSectionMatch.index,
        )
      : afterHeading,
  );
}

export async function fetchUsydDegreePage(
  overviewUrl: string,
): Promise<UsydDegreePage> {
  const browser =
    await chromium.launch({
      headless: true,
    });

  try {
    const page =
      await browser.newPage();

    /*
     * ------------------------------------------------
     * OVERVIEW PAGE
     * ------------------------------------------------
     */

    await page.goto(
      overviewUrl,
      {
        waitUntil:
          'domcontentloaded',
      },
    );

    const name =
      normalizeText(
        await page
          .locator('h1')
          .first()
          .innerText(),
      );

    const links =
      await page
        .locator('a')
        .evaluateAll(
          (
            anchors:
              HTMLAnchorElement[],
          ) =>
            anchors.map(
              (anchor) => ({
                text:
                  anchor.textContent ??
                  '',

                href:
                  anchor.href,
              }),
            ),
        );

    const handbookLinks =
      links
        .map(
          (link) => ({
            text:
              normalizeText(
                link.text,
              ),

            url:
              link.href,
          }),
        )
        .filter(
          (link) =>
            link.text &&
            link.url.includes(
              '/handbooks/',
            ),
        );

    let resolutionsUrl =
      handbookLinks.find(
        (link) =>
          link.url.endsWith(
            '/course-resolutions.html',
          ),
      )?.url ?? null;

    /*
     * ------------------------------------------------
     * KNOWN CROSS-FACULTY RESOLUTION LOCATION
     * ------------------------------------------------
     *
     * Bachelor of Science and Bachelor of Arts is
     * listed from the Science coursework page, but
     * its actual 2026 resolutions are under the
     * Arts handbook.
     */

    if (
      name ===
      'Bachelor of Science and Bachelor of Arts'
    ) {
      resolutionsUrl =
        'https://www.sydney.edu.au/handbooks/arts/coursework/science-arts/course-resolutions.html';
    }

    /*
     * ------------------------------------------------
     * DEFAULT RESULT
     * ------------------------------------------------
     */

    const result:
      UsydDegreePage =
      {
        name,

        overviewUrl,

        resolutionsUrl,

        courseCodes: [],

        totalCreditPoints:
          null,

        streams: [],

        awardRequirements:
          [],

        rawAwardRequirements:
          null,

        handbookLinks,
      };

    if (!resolutionsUrl) {
      return result;
    }

    /*
     * ------------------------------------------------
     * COURSE RESOLUTIONS
     * ------------------------------------------------
     */

    await page.goto(
      resolutionsUrl,
      {
        waitUntil:
          'domcontentloaded',
      },
    );

    /*
     * ------------------------------------------------
     * COURSE CODES
     * ------------------------------------------------
     */

    const tables =
      page.locator(
        'table',
      );

    const tableCount =
      await tables.count();

    for (
      let index = 0;
      index < tableCount;
      index += 1
    ) {
      const table =
        tables.nth(
          index,
        );

      const text =
        normalizeText(
          await table.innerText(),
        );

      /*
       * Some pages say:
       *
       * "Course title"
       *
       * while cross-faculty pages may say:
       *
       * "Course and stream title"
       */
      if (
        !/\bCode\b/i.test(
          text,
        ) ||
        !/\bCourse(?:\s+and\s+stream)?\s+title\b/i.test(
          text,
        )
      ) {
        continue;
      }

      const rows =
        table.locator(
          'tbody tr',
        );

      const rowCount =
        await rows.count();

      for (
        let rowIndex = 0;
        rowIndex <
        rowCount;
        rowIndex += 1
      ) {
        const cells =
          rows
            .nth(
              rowIndex,
            )
            .locator(
              'td',
            );

        if (
          await cells.count() <
          2
        ) {
          continue;
        }

        const code =
          normalizeText(
            await cells
              .nth(0)
              .innerText(),
          );

        const title =
          normalizeText(
            await cells
              .nth(1)
              .innerText(),
          );

        if (
          code &&
          title
        ) {
          result.courseCodes.push({
            code,
            title,
          });
        }
      }

      break;
    }

    /*
     * ------------------------------------------------
     * FULL RESOLUTION TEXT
     * ------------------------------------------------
     */

    const resolutionText =
      normalizeText(
        await page
          .locator('body')
          .innerText(),
      );

    /*
     * ------------------------------------------------
     * STREAMS
     * ------------------------------------------------
     */

    const streamsSection =
      extractSection(
        resolutionText,
        /(\d+)\s+Streams\b/i,
      );

    if (
      streamsSection
    ) {
      const escapedName =
        escapeRegExp(
          name,
        );

      /*
       * Standard wording:
       *
       * "The Bachelor ... is available
       * in the following streams:"
       */
      const standardStreamRegex =
        new RegExp(
          `(?:\\(\\d+\\)\\s+)?The\\s+${escapedName}\\s+is available in the following streams:\\s*(.+?)(?=\\s+\\(\\d+\\)\\s+[A-Z]|$)`,
          'i',
        );

      const standardMatch =
        streamsSection.match(
          standardStreamRegex,
        );

      /*
       * Other pages use:
       *
       * "The Dalyell stream is available in ..."
       */
      const singularStreamRegex =
        new RegExp(
          `The\\s+(.+?)\\s+stream\\s+is available in\\s+the\\s+${escapedName}`,
          'i',
        );

      const singularMatch =
        streamsSection.match(
          singularStreamRegex,
        );

      if (
        standardMatch
      ) {
        const streamList =
          normalizeText(
            standardMatch[1],
          );

        const streamMatches =
          streamList.matchAll(
            /\([a-z]\)\s+(.+?)(?=\s+\([a-z]\)|$)/gi,
          );

        const streams:
          string[] =
          [];

        for (
          const match
          of streamMatches
        ) {
          const stream =
            normalizeText(
              match[1],
            )
              .replace(
                /[;,.]+$/g,
                '',
              )
              .trim();

          if (
            stream &&
            stream.length <=
            80
          ) {
            streams.push(
              stream,
            );
          }
        }

        result.streams =
          streams;
      } else if (
        singularMatch
      ) {
        const stream =
          normalizeText(
            singularMatch[1],
          );

        if (
          stream
        ) {
          result.streams =
            [
              stream,
            ];
        }
      }
    }

    /*
     * ------------------------------------------------
     * REQUIREMENTS FOR AWARD
     * ------------------------------------------------
     */

    let awardSection =
      extractSection(
        resolutionText,
        /(\d+)\s+Requirements for award\b/i,
      );

    /*
     * Honours courses sometimes use:
     *
     * "Requirements for the Honours degree"
     *
     * rather than:
     *
     * "Requirements for award"
     */
    if (
      !awardSection
    ) {
      awardSection =
        extractSection(
          resolutionText,
          /(\d+)\s+Requirements for the Honours degree\b/i,
        );
    }

    if (
      awardSection
    ) {
      const escapedName =
        escapeRegExp(
          name,
        );

      /*
       * Some pages contain multiple awards within
       * the same Requirements for award section.
       *
       * Try to locate the exact degree subsection.
       */

      const namedDegreeHeadingRegex =
        new RegExp(
          `\\(\\d+\\)\\s+${escapedName}\\s*:`,
          'i',
        );

      const namedDegreeHeadingMatch =
        namedDegreeHeadingRegex.exec(
          awardSection,
        );

      let degreeAwardText =
        awardSection;

      if (
        namedDegreeHeadingMatch &&
        namedDegreeHeadingMatch.index !==
          undefined
      ) {
        degreeAwardText =
          awardSection.slice(
            namedDegreeHeadingMatch.index,
          );

        const afterCurrentHeading =
          degreeAwardText.slice(
            namedDegreeHeadingMatch[0]
              .length,
          );

        const nextAwardSubsection =
          /\(\d+\)\s+[A-Z]/.exec(
            afterCurrentHeading,
          );

        if (
          nextAwardSubsection &&
          nextAwardSubsection.index !==
            undefined
        ) {
          const endIndex =
            namedDegreeHeadingMatch[0]
              .length +
            nextAwardSubsection.index;

          degreeAwardText =
            degreeAwardText.slice(
              0,
              endIndex,
            );
        }
      }

      degreeAwardText =
        normalizeText(
          degreeAwardText,
        );

      result.rawAwardRequirements =
        degreeAwardText;

      /*
       * ------------------------------------------------
       * TOTAL CREDIT POINTS
       * ------------------------------------------------
       */

      const totalPatterns =
        [
          /must successfully complete\s+(\d+)\s+credit points?\b/i,

          /must satisfactorily complete\s+(\d+)\s+credit points?\b/i,

          /must complete\s+(\d+)\s+credit points?\b/i,

          /complete\s+(\d+)\s+credit points?\b/i,

          /completion of\s+(\d+)\s+credit points?\b/i,
        ];

      for (
        const pattern
        of totalPatterns
      ) {
        const totalMatch =
          degreeAwardText.match(
            pattern,
          );

        if (
          totalMatch
        ) {
          result.totalCreditPoints =
            Number(
              totalMatch[1],
            );

          break;
        }
      }

      /*
       * ------------------------------------------------
       * HONOURS TOTAL
       * ------------------------------------------------
       *
       * Bachelor of Science (Honours) says:
       *
       * minimum 12 CP coursework
       * +
       * 24-36 CP research project
       *
       * The course itself is a standard 48 CP
       * appended Honours year.
       *
       * Do not calculate the total by adding the
       * minimum numbers because the project range
       * and coursework allocation can vary.
       */

      if (
        name ===
          'Bachelor of Science (Honours)' &&
        result.totalCreditPoints ===
          null
      ) {
        result.totalCreditPoints =
          48;
      }

      /*
       * ------------------------------------------------
       * REQUIREMENT LINES
       * ------------------------------------------------
       */

      result.awardRequirements =
        extractRequirementLines(
          degreeAwardText,
        );

      /*
       * Bachelor of Liberal Arts and Science uses a
       * prose requirement statement before its nested
       * numbered rules.
       *
       * Preserve that instead of returning zero.
       */
      if (
        result.awardRequirements.length ===
        0
      ) {
        result.awardRequirements =
          extractFallbackRequirement(
            degreeAwardText,
          );
      }
    }

    return result;
  } finally {
    await browser.close();
  }
}