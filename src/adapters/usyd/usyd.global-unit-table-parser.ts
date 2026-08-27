import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

export interface UsydGlobalTableUnit {
  code: string;

  title: string;

  creditPoints: number | null;

  /**
   * Raw A/P/C/N text from the table row.
   *
   * We preserve this for later detailed requisite parsing.
   */
  accessConditionsRaw: string | null;

  /**
   * Section/category immediately surrounding the row.
   *
   * Examples:
   *
   * - Major core
   * - 1000-level units of study
   * - Selective units
   * - Core (Honours)
   */
  section: string | null;

  sourceUrl: string;
}

export interface UsydGlobalUnitTableParseResult {
  url: string;

  title: string;

  units: UsydGlobalTableUnit[];

  uniqueUnitCodes: string[];

  unitOccurrenceCount: number;

  uniqueUnitCount: number;

  tableCount: number;

  rowsInspected: number;
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
      /\u00A0/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function extractUnitCode(
  value: string,
): string | null {
  const match =
    normalizeText(
      value,
    ).match(
      /\b[A-Z]{4}\d{4}\b/,
    );

  return (
    match?.[0] ??
    null
  );
}

function extractCodeFromHref(
  href: string,
): string | null {
  const match =
    href.match(
      /\/units\/([A-Z]{4}\d{4})(?:[/?#]|$)/i,
    );

  return match
    ? match[1].toUpperCase()
    : null;
}

function parseCreditPoints(
  value: string,
): number | null {
  const normalized =
    normalizeText(
      value,
    );

  /**
   * Standard CP cell.
   */
  if (
    /^\d+(?:\.\d+)?$/.test(
      normalized,
    )
  ) {
    const number =
      Number(
        normalized,
      );

    return Number.isFinite(
      number,
    )
      ? number
      : null;
  }

  /**
   * Defensive form:
   *
   * "6 credit points"
   * "6 cp"
   */
  const match =
    normalized.match(
      /^(\d+(?:\.\d+)?)\s*(?:credit points?|cp)$/i,
    );

  if (
    !match
  ) {
    return null;
  }

  const number =
    Number(
      match[1],
    );

  return Number.isFinite(
    number,
  )
    ? number
    : null;
}

function cleanUnitTitle(
  value: string,
  code: string,
): string {
  return normalizeText(
    value.replace(
      new RegExp(
        `\\b${code}\\b`,
        'i',
      ),
      '',
    ),
  );
}

/**
 * ------------------------------------------------
 * SECTION ROW
 * ------------------------------------------------
 */

function getSectionCandidate(
  cells: string[],
): string | null {
  const nonEmpty =
    cells
      .map(
        normalizeText,
      )
      .filter(
        Boolean,
      );

  if (
    nonEmpty.length ===
    0
  ) {
    return null;
  }

  const combined =
    normalizeText(
      nonEmpty.join(
        ' ',
      ),
    );

  /**
   * Ignore actual table column headings.
   */
  if (
    /unit of study/i.test(
      combined,
    ) &&
    /credit points/i.test(
      combined,
    )
  ) {
    return null;
  }

  if (
    /^credit points$/i.test(
      combined,
    )
  ) {
    return null;
  }

  /**
   * Avoid turning long explanatory paragraphs into
   * section labels.
   */
  if (
    combined.length >
    180
  ) {
    return null;
  }

  /**
   * Rows containing unit codes are usually requirement
   * or instruction rows rather than headings.
   */
  if (
    /\b[A-Z]{4}\d{4}\b/.test(
      combined,
    )
  ) {
    return null;
  }

  return combined;
}

/**
 * ------------------------------------------------
 * FIND UNIT CODE INSIDE ROW
 * ------------------------------------------------
 */

function findRowUnitCode(
  $: cheerio.CheerioAPI,
  row: AnyNode,
): {
  code: string;
  cellIndex: number;
} | null {
  const cells =
    $(row).find(
      'th, td',
    );

  for (
    let index = 0;
    index <
    cells.length;
    index += 1
  ) {
    const cell =
      cells.eq(
        index,
      );

    /**
     * Strongest signal:
     *
     * official link to a unit detail page.
     */
    const unitAnchor =
      cell
        .find(
          'a[href*="/units/"]',
        )
        .first();

    if (
      unitAnchor.length >
      0
    ) {
      const href =
        unitAnchor.attr(
          'href',
        );

      if (
        href
      ) {
        const hrefCode =
          extractCodeFromHref(
            href,
          );

        if (
          hrefCode
        ) {
          return {
            code:
              hrefCode,

            cellIndex:
              index,
          };
        }
      }

      const anchorCode =
        extractUnitCode(
          unitAnchor.text(),
        );

      if (
        anchorCode
      ) {
        return {
          code:
            anchorCode,

          cellIndex:
            index,
        };
      }
    }

    /**
     * Some tables render the code as plain text.
     *
     * Only inspect the first two cells so prerequisite
     * codes in A/P/C/N do not become the table unit.
     */
    if (
      index <=
      1
    ) {
      const textCode =
        extractUnitCode(
          cell.text(),
        );

      if (
        textCode
      ) {
        return {
          code:
            textCode,

          cellIndex:
            index,
        };
      }
    }
  }

  return null;
}

/**
 * ------------------------------------------------
 * PARSE ONE HTML TABLE
 * ------------------------------------------------
 */

function parseHtmlTable(
  $: cheerio.CheerioAPI,
  table: AnyNode,
  sourceUrl: string,
): {
  units: UsydGlobalTableUnit[];
  rowsInspected: number;
} {
  const units:
    UsydGlobalTableUnit[] =
    [];

  let rowsInspected =
    0;

  let currentSection:
    string | null =
    null;

  $(table)
    .find(
      'tr',
    )
    .each(
      (
        _,
        row,
      ) => {
        rowsInspected +=
          1;

        const cellElements =
          $(row).find(
            'th, td',
          );

        if (
          cellElements.length ===
          0
        ) {
          return;
        }

        const cellTexts:
          string[] =
          [];

        cellElements.each(
          (
            __,
            cell,
          ) => {
            cellTexts.push(
              normalizeText(
                $(cell).text(),
              ),
            );
          },
        );

        const unitIdentity =
          findRowUnitCode(
            $,
            row,
          );

        /**
         * No unit code:
         *
         * possibly a heading/section row.
         */
        if (
          !unitIdentity
        ) {
          const section =
            getSectionCandidate(
              cellTexts,
            );

          if (
            section
          ) {
            currentSection =
              section;
          }

          return;
        }

        const {
          code,
          cellIndex:
            codeCellIndex,
        } =
          unitIdentity;

        /**
         * ------------------------------------------------
         * CREDIT POINTS
         * ------------------------------------------------
         */

        let creditPoints:
          number | null =
          null;

        let creditPointCellIndex =
          -1;

        for (
          let index =
            codeCellIndex +
            1;
          index <
          cellTexts.length;
          index += 1
        ) {
          const parsed =
            parseCreditPoints(
              cellTexts[
                index
              ],
            );

          if (
            parsed !==
            null
          ) {
            creditPoints =
              parsed;

            creditPointCellIndex =
              index;

            break;
          }
        }

        /**
         * ------------------------------------------------
         * TITLE
         * ------------------------------------------------
         */

        let title =
          cleanUnitTitle(
            cellTexts[
              codeCellIndex
            ] ??
              '',
            code,
          );

        /**
         * Code and title can be separate:
         *
         * CODE | TITLE | CP | A/P/C/N
         */
        if (
          !title &&
          creditPointCellIndex >
            codeCellIndex +
              1
        ) {
          title =
            normalizeText(
              cellTexts
                .slice(
                  codeCellIndex +
                    1,
                  creditPointCellIndex,
                )
                .join(
                  ' ',
                ),
            );
        }

        /**
         * Defensive fallback when CP detection fails.
         */
        if (
          !title &&
          cellTexts[
            codeCellIndex +
              1
          ] &&
          extractUnitCode(
            cellTexts[
              codeCellIndex +
                1
            ],
          ) ===
            null
        ) {
          title =
            normalizeText(
              cellTexts[
                codeCellIndex +
                  1
              ],
            );
        }

        /**
         * ------------------------------------------------
         * RAW ACCESS CONDITIONS
         * ------------------------------------------------
         */

        let conditions:
          string | null =
          null;

        if (
          creditPointCellIndex >=
            0 &&
          creditPointCellIndex +
            1 <
            cellTexts.length
        ) {
          const raw =
            normalizeText(
              cellTexts
                .slice(
                  creditPointCellIndex +
                    1,
                )
                .join(
                  ' ',
                ),
            );

          conditions =
            raw ||
            null;
        }

        units.push({
          code,

          title,

          creditPoints,

          accessConditionsRaw:
            conditions,

          section:
            currentSection,

          sourceUrl,
        });
      },
    );

  return {
    units,

    rowsInspected,
  };
}

/**
 * ------------------------------------------------
 * FALLBACK EXTRACTION
 * ------------------------------------------------
 *
 * If a page contains unit links but its visual table is
 * not represented through normal HTML table rows, use
 * the official /units/ links conservatively.
 */

function extractFallbackUnits(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
): UsydGlobalTableUnit[] {
  const units:
    UsydGlobalTableUnit[] =
    [];

  const seen =
    new Set<string>();

  $(
    'a[href*="/units/"]',
  ).each(
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

      const code =
        extractCodeFromHref(
          href,
        ) ??
        extractUnitCode(
          $(anchor).text(),
        );

      if (
        !code ||
        seen.has(
          code,
        )
      ) {
        return;
      }

      seen.add(
        code,
      );

      units.push({
        code,

        title:
          '',

        creditPoints:
          null,

        accessConditionsRaw:
          null,

        section:
          null,

        sourceUrl,
      });
    },
  );

  return units;
}

/**
 * ------------------------------------------------
 * PUBLIC TABLE PARSER
 * ------------------------------------------------
 */

export async function fetchUsydGlobalUnitTable(
  url: string,
): Promise<UsydGlobalUnitTableParseResult> {
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
            'Mozilla/5.0 USYD handbook global unit table parser',
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

  const tables =
    $('table');

  const allUnits:
    UsydGlobalTableUnit[] =
    [];

  let rowsInspected =
    0;

  tables.each(
    (
      _,
      table,
    ) => {
      const parsed =
        parseHtmlTable(
          $,
          table,
          finalUrl,
        );

      rowsInspected +=
        parsed.rowsInspected;

      allUnits.push(
        ...parsed.units,
      );
    },
  );

  /**
   * Fallback to official unit links if no standard rows
   * were found.
   */
  if (
    allUnits.length ===
    0
  ) {
    allUnits.push(
      ...extractFallbackUnits(
        $,
        finalUrl,
      ),
    );
  }

  const uniqueUnitCodes =
    [
      ...new Set(
        allUnits.map(
          (unit) =>
            unit.code,
        ),
      ),
    ].sort();

  return {
    url:
      finalUrl,

    title,

    units:
      allUnits,

    uniqueUnitCodes,

    unitOccurrenceCount:
      allUnits.length,

    uniqueUnitCount:
      uniqueUnitCodes.length,

    tableCount:
      tables.length,

    rowsInspected,
  };
}