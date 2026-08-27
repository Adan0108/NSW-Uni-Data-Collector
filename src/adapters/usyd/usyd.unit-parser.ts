import axios from 'axios';
import * as cheerio from 'cheerio';

import type {
  UsydUnit,
  UsydUnitAccessConditions,
  UsydUnitAvailability,
} from './usyd.types';

const USYD_UNIT_BASE_URL =
  'https://www.sydney.edu.au/units';

function normalizeText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUsydRuleText(
  value: string,
): string {
  return normalizeText(value)
    /**
     * USYD occasionally renders conjunctions joined
     * directly to a referenced unit code, for example:
     *
     * "orAGRI3888"
     * "andCOMP2017"
     */
    .replace(
      /(or|and)\s*(?=[A-Z]{4}\d{4}\b)/g,
      '$1 ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function emptyToNull(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    normalizeText(value);

  if (
    !normalized ||
    /^none$/i.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function ruleToNull(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalized =
    normalizeUsydRuleText(value);

  if (
    !normalized ||
    /^none$/i.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function parseUnitHeading(
  heading: string,
): {
  code: string;
  name: string;
} {
  const normalized =
    normalizeText(heading);

  const match =
    normalized.match(
      /^([A-Z]{4}\d{4})\s*:\s*(.+)$/,
    );

  if (!match) {
    throw new Error(
      `Could not parse USYD unit heading: "${normalized}"`,
    );
  }

  return {
    code: match[1],
    name: match[2],
  };
}

/**
 * ------------------------------------------------
 * UNIT YEAR
 * ------------------------------------------------
 *
 * USYD normally exposes a heading such as:
 *
 * 2026 unit information
 *
 * Some valid unit pages do not include that heading.
 *
 * PSYC3014 is one example. Its page still contains a
 * current availability such as:
 *
 * Semester 2 2026
 *
 * Therefore:
 *
 * 1. Prefer the existing explicit "YYYY unit information"
 *    heading when present.
 *
 * 2. Otherwise inspect unit availability and use the
 *    newest/current year shown there.
 *
 * 3. As a final fallback, inspect the page for plausible
 *    years.
 *
 * Historical unit pages are intentionally preserved.
 * We do NOT force everything to 2026.
 */

function parseYear(
  $: cheerio.CheerioAPI,
): number {
  /**
   * ------------------------------------------------
   * STRATEGY 1
   * Existing canonical heading
   * ------------------------------------------------
   */

  const headingText =
    $('h1, h2, h3, h4, h5, h6')
      .map(
        (_, element) =>
          normalizeText(
            $(element).text(),
          ),
      )
      .get()
      .find(
        (text) =>
          /^\d{4}\s+unit information$/i.test(
            text,
          ),
      );

  if (headingText) {
    const match =
      headingText.match(
        /^(\d{4})/,
      );

    if (match) {
      return Number(
        match[1],
      );
    }
  }

  /**
   * ------------------------------------------------
   * STRATEGY 2
   * Unit availability tables
   * ------------------------------------------------
   *
   * Example:
   *
   * Semester 2 2026
   * Intensive January 2026
   *
   * We intentionally gather all availability years and
   * use the largest one because USYD can list current and
   * previous years on the same page.
   */

  const availabilityYears:
    number[] =
    [];

  $('table').each(
    (_, table) => {
      const rows =
        $(table)
          .find('tr')
          .toArray();

      if (
        rows.length <
        2
      ) {
        return;
      }

      const headerCells =
        $(rows[0])
          .find('th, td')
          .map(
            (_, cell) =>
              normalizeText(
                $(cell).text(),
              ),
          )
          .get();

      const hasSession =
        headerCells.some(
          (cell) =>
            /^Session$/i.test(
              cell,
            ),
        );

      const hasLocation =
        headerCells.some(
          (cell) =>
            /^Location$/i.test(
              cell,
            ),
        );

      if (
        !hasSession ||
        !hasLocation
      ) {
        return;
      }

      for (
        const row
        of rows.slice(1)
      ) {
        const cells =
          $(row)
            .find('th, td')
            .map(
              (_, cell) =>
                normalizeText(
                  $(cell).text(),
                ),
            )
            .get();

        if (
          cells.length <
          1
        ) {
          continue;
        }

        const sessionText =
          cells[0];

        const yearMatch =
          sessionText.match(
            /\b((?:19|20)\d{2})\b/,
          );

        if (
          !yearMatch
        ) {
          continue;
        }

        const year =
          Number(
            yearMatch[1],
          );

        if (
          Number.isInteger(
            year,
          ) &&
          year >=
            1900 &&
          year <=
            2100
        ) {
          availabilityYears.push(
            year,
          );
        }
      }
    },
  );

  if (
    availabilityYears.length >
    0
  ) {
    return Math.max(
      ...availabilityYears,
    );
  }

  /**
   * ------------------------------------------------
   * STRATEGY 3
   * Page-text fallback
   * ------------------------------------------------
   *
   * This is intentionally last.
   *
   * Some pages may mention many years in previous unit
   * outlines. If no canonical heading or structured
   * availability table exists, the newest plausible year
   * is our best remaining signal.
   */

  const mainText =
    normalizeText(
      $('main').length >
        0
        ? $('main').text()
        : $('body').text(),
    );

  const yearMatches =
    mainText.match(
      /\b(?:19|20)\d{2}\b/g,
    ) ??
    [];

  const years =
    yearMatches
      .map(
        (value) =>
          Number(value),
      )
      .filter(
        (year) =>
          Number.isInteger(
            year,
          ) &&
          year >=
            1900 &&
          year <=
            2100,
      );

  if (
    years.length >
    0
  ) {
    return Math.max(
      ...years,
    );
  }

  throw new Error(
    'Could not determine USYD unit year.',
  );
}

function parseManagingFaculty(
  $: cheerio.CheerioAPI,
): string | null {
  const headings =
    $('h4').toArray();

  for (
    let index = 0;
    index <
    headings.length;
    index +=
    1
  ) {
    const heading =
      headings[index];

    const text =
      normalizeText(
        $(heading).text(),
      );

    if (
      !/^Managing faculty or University school:?$/i.test(
        text,
      )
    ) {
      continue;
    }

    const nextHeading =
      headings[
        index +
        1
      ];

    if (
      !nextHeading
    ) {
      return null;
    }

    return emptyToNull(
      $(nextHeading).text(),
    );
  }

  return null;
}

function parseDetailsTable(
  $: cheerio.CheerioAPI,
): {
  studyLevel:
    string | null;

  academicUnit:
    string | null;

  creditPoints:
    number | null;
} {
  let studyLevel:
    string | null =
    null;

  let academicUnit:
    string | null =
    null;

  let creditPoints:
    number | null =
    null;

  $('table').each(
    (_, table) => {
      $(table)
        .find('tr')
        .each(
          (_, row) => {
            const cells =
              $(row)
                .find(
                  'th, td',
                )
                .map(
                  (_, cell) =>
                    normalizeText(
                      $(cell).text(),
                    ),
                )
                .get();

            if (
              cells.length <
              2
            ) {
              return;
            }

            const label =
              cells[0];

            const value =
              cells[1];

            if (
              /^Study level$/i.test(
                label,
              )
            ) {
              studyLevel =
                emptyToNull(
                  value,
                );
            }

            if (
              /^Academic unit$/i.test(
                label,
              )
            ) {
              academicUnit =
                emptyToNull(
                  value,
                );
            }

            if (
              /^Credit points$/i.test(
                label,
              )
            ) {
              const parsed =
                Number(
                  value,
                );

              creditPoints =
                Number.isFinite(
                  parsed,
                )
                  ? parsed
                  : null;
            }
          },
        );
    },
  );

  return {
    studyLevel,
    academicUnit,
    creditPoints,
  };
}

function normalizeRuleLabel(
  label: string,
): string {
  return normalizeText(
    label,
  )
    .replace(
      /\s*\?\s*$/,
      '',
    )
    .replace(
      /:\s*$/,
      '',
    )
    .toLowerCase();
}

function parseAccessConditions(
  $: cheerio.CheerioAPI,
): UsydUnitAccessConditions {
  const result:
    UsydUnitAccessConditions =
    {
      prerequisite:
        null,

      corequisite:
        null,

      prohibition:
        null,

      assumedKnowledge:
        null,
    };

  $('table').each(
    (_, table) => {
      $(table)
        .find('tr')
        .each(
          (_, row) => {
            const cells =
              $(row)
                .find(
                  'th, td',
                )
                .map(
                  (_, cell) =>
                    normalizeText(
                      $(cell).text(),
                    ),
                )
                .get();

            if (
              cells.length <
              2
            ) {
              return;
            }

            const label =
              normalizeRuleLabel(
                cells[0],
              );

            const value =
              ruleToNull(
                cells[1],
              );

            if (
              label ===
              'prerequisites'
            ) {
              result.prerequisite =
                value;
            }

            if (
              label ===
              'corequisites'
            ) {
              result.corequisite =
                value;
            }

            if (
              label ===
              'prohibitions'
            ) {
              result.prohibition =
                value;
            }

            if (
              label ===
              'assumed knowledge'
            ) {
              result.assumedKnowledge =
                value;
            }
          },
        );
    },
  );

  return result;
}

function parseDescription(
  $: cheerio.CheerioAPI,
  year: number,
): string | null {
  /**
   * USYD's description is not always a direct sibling
   * of the "2026 unit information" heading.
   *
   * The normalized page text is much more reliable:
   *
   * 2026 unit information
   * <description>
   * Unit details and rules
   */

  const mainText =
    normalizeText(
      $('main').length >
        0
        ? $('main').text()
        : $('body').text(),
    );

  const startMarker =
    `${year} unit information`;

  const endMarker =
    'Unit details and rules';

  const startIndex =
    mainText.indexOf(
      startMarker,
    );

  /**
   * Some valid pages, such as PSYC3014, do not expose
   * the "YYYY unit information" heading.
   *
   * In that case we do not invent a description boundary.
   * The rest of the unit data can still be parsed.
   */
  if (
    startIndex <
    0
  ) {
    return null;
  }

  const descriptionStart =
    startIndex +
    startMarker.length;

  const endIndex =
    mainText.indexOf(
      endMarker,
      descriptionStart,
    );

  if (
    endIndex <
    0
  ) {
    return null;
  }

  const description =
    normalizeText(
      mainText.slice(
        descriptionStart,
        endIndex,
      ),
    );

  return (
    description ||
    null
  );
}

function parseLearningOutcomes(
  $: cheerio.CheerioAPI,
): string[] {
  const mainText =
    normalizeText(
      $('main').length >
        0
        ? $('main').text()
        : $('body').text(),
    );

  const startMarker =
    'Learning outcomes';

  const endMarker =
    'Unit availability';

  const startIndex =
    mainText.indexOf(
      startMarker,
    );

  if (
    startIndex <
    0
  ) {
    return [];
  }

  const endIndex =
    mainText.indexOf(
      endMarker,
      startIndex +
        startMarker.length,
    );

  const section =
    endIndex >=
    0
      ? mainText.slice(
          startIndex +
            startMarker.length,
          endIndex,
        )
      : mainText.slice(
          startIndex +
            startMarker.length,
        );

  const matches =
    [
      ...section.matchAll(
        /LO\d+\.\s*(.*?)(?=\s+LO\d+\.|$)/g,
      ),
    ];

  return matches
    .map(
      (match) =>
        normalizeText(
          match[1] ??
            '',
        ),
    )
    .filter(
      Boolean,
    );
}

function parseAvailability(
  $: cheerio.CheerioAPI,
  year: number,
  sourceUrl: string,
): UsydUnitAvailability[] {
  const results:
    UsydUnitAvailability[] =
    [];

  $('table').each(
    (_, table) => {
      const rows =
        $(table)
          .find('tr')
          .toArray();

      if (
        rows.length <
        2
      ) {
        return;
      }

      const headerCells =
        $(rows[0])
          .find(
            'th, td',
          )
          .map(
            (_, cell) =>
              normalizeText(
                $(cell).text(),
              ),
          )
          .get();

      const hasSession =
        headerCells.some(
          (cell) =>
            /^Session$/i.test(
              cell,
            ),
        );

      const hasLocation =
        headerCells.some(
          (cell) =>
            /^Location$/i.test(
              cell,
            ),
        );

      if (
        !hasSession ||
        !hasLocation
      ) {
        return;
      }

      for (
        const row
        of rows.slice(1)
      ) {
        const cells =
          $(row)
            .find(
              'th, td',
            )
            .map(
              (_, cell) =>
                normalizeText(
                  $(cell).text(),
                ),
            )
            .get();

        if (
          cells.length <
          3
        ) {
          continue;
        }

        const sessionText =
          cells[0];

        if (
          !sessionText.includes(
            String(year),
          )
        ) {
          continue;
        }

        const yearMatch =
          sessionText.match(
            /\b(\d{4})\b/,
          );

        if (
          !yearMatch
        ) {
          continue;
        }

        const session =
          normalizeText(
            sessionText.replace(
              /\b\d{4}\b/,
              '',
            ),
          );

        const outlineAnchor =
          $(row)
            .find('a[href]')
            .first();

        const href =
          outlineAnchor.attr(
            'href',
          );

        let outlineUrl:
          string | null =
          null;

        if (
          href
        ) {
          try {
            outlineUrl =
              new URL(
                href,
                sourceUrl,
              ).toString();
          } catch {
            outlineUrl =
              null;
          }
        }

        results.push({
          session,

          year:
            Number(
              yearMatch[
                1
              ],
            ),

          mode:
            emptyToNull(
              cells[1],
            ),

          location:
            emptyToNull(
              cells[2],
            ),

          outlineUrl,
        });
      }
    },
  );

  return results;
}

export async function fetchUsydUnit(
  code: string,
): Promise<UsydUnit> {
  const normalizedCode =
    code
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{4}\d{4}$/.test(
      normalizedCode,
    )
  ) {
    throw new Error(
      `Invalid USYD unit code: "${code}"`,
    );
  }

  const sourceUrl =
    `${USYD_UNIT_BASE_URL}/${normalizedCode}`;

  const response =
    await axios.get<string>(
      sourceUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
        },
      },
    );

  const $ =
    cheerio.load(
      response.data,
    );

  const heading =
    normalizeText(
      $('h1')
        .first()
        .text(),
    );

  if (
    !heading
  ) {
    throw new Error(
      `Could not find H1 for USYD unit ${normalizedCode}.`,
    );
  }

  const parsedHeading =
    parseUnitHeading(
      heading,
    );

  if (
    parsedHeading.code !==
    normalizedCode
  ) {
    throw new Error(
      `Requested ${normalizedCode}, but page returned ${parsedHeading.code}.`,
    );
  }

  const year =
    parseYear(
      $,
    );

  const details =
    parseDetailsTable(
      $,
    );

  return {
    code:
      parsedHeading.code,

    name:
      parsedHeading.name,

    year,

    studyLevel:
      details.studyLevel,

    academicUnit:
      details.academicUnit,

    managingFaculty:
      parseManagingFaculty(
        $,
      ),

    creditPoints:
      details.creditPoints,

    description:
      parseDescription(
        $,
        year,
      ),

    accessConditions:
      parseAccessConditions(
        $,
      ),

    availabilities:
      parseAvailability(
        $,
        year,
        sourceUrl,
      ),

    learningOutcomes:
      parseLearningOutcomes(
        $,
      ),

    sourceUrl,
  };
}