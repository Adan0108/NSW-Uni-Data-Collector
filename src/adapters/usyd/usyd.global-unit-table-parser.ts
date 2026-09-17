import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

export interface UsydGlobalTableHeadingContext {
  text: string;
  level: number;
}

export interface UsydGlobalTableUnit {
  code: string;

  title: string;

  creditPoints: number | null;

  /**
   * Raw A/P/C/N text from the table row.
   */
  accessConditionsRaw: string | null;

  /**
   * Legacy immediate section label.
   *
   * Keep this for all existing consumers.
   */
  section: string | null;

  /**
   * Structural heading context surrounding this unit.
   *
   * This is additive and does not replace `section`.
   */
  headingPath?: UsydGlobalTableHeadingContext[];

  sourceUrl: string;
}

export interface UsydGlobalTableHeadingRow {
  kind: 'HEADING';

  text: string;

  level: number;

  tableIndex: number;

  rowIndex: number;

  sourceOrder: number;
}

export interface UsydGlobalTableSectionRow {
  kind: 'SECTION';

  text: string;

  tableIndex: number;

  rowIndex: number;

  sourceOrder: number;
}

export interface UsydGlobalTableNarrativeRow {
  kind: 'NARRATIVE';

  text: string;

  tableIndex: number;

  rowIndex: number;

  sourceOrder: number;
}

export interface UsydGlobalTableUnitRow {
  kind: 'UNIT';

  code: string;

  title: string;

  creditPoints: number | null;

  accessConditionsRaw: string | null;

  section: string | null;

  headingPath: UsydGlobalTableHeadingContext[];

  tableIndex: number;

  rowIndex: number;

  sourceOrder: number;
}

export type UsydGlobalTableStructureRow =
  | UsydGlobalTableHeadingRow
  | UsydGlobalTableSectionRow
  | UsydGlobalTableNarrativeRow
  | UsydGlobalTableUnitRow;

export interface UsydGlobalUnitTableParseResult {
  url: string;

  title: string;

  units: UsydGlobalTableUnit[];

  /**
   * Lossless source-order structural view of table rows.
   *
   * Existing consumers can continue using `units`.
   *
   * Consumers that need hierarchy, such as the Engineering
   * Core repair, can use this field instead of reconstructing
   * structure from the flattened `section` property.
   */
  structureRows: UsydGlobalTableStructureRow[];

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
   * Standard numeric cell.
   *
   * Important:
   * 0 is valid and must remain 0.
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
   * Defensive forms:
   *
   * 6 credit points
   * 6 cp
   * 0 credit points
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
 * TABLE TEXT
 * ------------------------------------------------
 */

function getRowText(
  $: cheerio.CheerioAPI,
  row: AnyNode,
): string {
  return normalizeText(
    $(row)
      .find(
        'th, td',
      )
      .map(
        (
          _,
          cell,
        ) =>
          normalizeText(
            $(cell).text(),
          ),
      )
      .get()
      .filter(
        Boolean,
      )
      .join(
        ' ',
      ),
  );
}

/**
 * ------------------------------------------------
 * EXPLICIT HTML HEADING ROW
 * ------------------------------------------------
 *
 * This is the important addition for tables such as:
 *
 * Foundations
 * Computing Units
 * Mathematics Units
 * Projects Table
 * Project 1
 * Project 2 & 3
 * Thesis Units
 *
 * We preserve the actual h1-h6 level and source order.
 *
 * We do NOT infer academic semantics here.
 */

function getExplicitHeading(
  $: cheerio.CheerioAPI,
  row: AnyNode,
): UsydGlobalTableHeadingContext | null {
  const heading =
    $(row)
      .find(
        'h1, h2, h3, h4, h5, h6',
      )
      .first();

  if (
    heading.length ===
    0
  ) {
    return null;
  }

  const text =
    normalizeText(
      heading.text(),
    );

  if (
    !text
  ) {
    return null;
  }

  const tagName =
    (
      heading
        .get(0) as
        | {
            tagName?: string;
            name?: string;
          }
        | undefined
    )
      ?.tagName ??
    (
      heading
        .get(0) as
        | {
            name?: string;
          }
        | undefined
    )
      ?.name ??
    '';

  const match =
    String(
      tagName,
    ).match(
      /^h([1-6])$/i,
    );

  if (
    !match
  ) {
    return null;
  }

  return {
    text,

    level:
      Number(
        match[1],
      ),
  };
}

/**
 * ------------------------------------------------
 * LEGACY SECTION ROW
 * ------------------------------------------------
 *
 * Not every USYD table uses actual h4/h5 elements for
 * section labels.
 *
 * Keep the previous fallback behaviour for generic consumers.
 *
 * Structural consumers should prefer HEADING rows where they
 * exist.
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
   * Actual table column headings.
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
   * Long text is narrative rather than a safe generic
   * section label.
   */
  if (
    combined.length >
    180
  ) {
    return null;
  }

  /**
   * Rows mentioning subject codes are normally instructions,
   * rules or prose rather than section headings.
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
 * HEADING PATH
 * ------------------------------------------------
 *
 * This preserves literal HTML hierarchy only.
 *
 * It deliberately does NOT claim that two sibling h4 rows
 * have an academic parent-child relationship.
 *
 * Example:
 *
 * h4 Projects Table
 * h5 Project 1
 *
 * gives:
 *
 * Projects Table -> Project 1
 *
 * But:
 *
 * h4 Foundations
 * h4 Computing Units
 *
 * remains two h4 source headings.
 *
 * Engineering-specific semantic nesting is handled later by
 * the Engineering repair.
 */

function updateHeadingPath(
  current:
    UsydGlobalTableHeadingContext[],

  next:
    UsydGlobalTableHeadingContext,
): UsydGlobalTableHeadingContext[] {
  const retained =
    current.filter(
      (
        heading,
      ) =>
        heading.level <
        next.level,
    );

  retained.push(
    next,
  );

  return retained;
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

    const cellText =
      normalizeText(
        cell.text(),
      );

    /**
     * ------------------------------------------------
     * OFFICIAL /units/ LINK
     * ------------------------------------------------
     *
     * A real unit row normally starts with its own unit code:
     *
     * INFO1110 Introduction to Programming | 6 | ...
     *
     * However narrative rows can also contain links:
     *
     * "Students in the Electrical and Software streams are
     * strongly recommended to take INFO1110 or INFO1910..."
     *
     * The old parser treated any /units/ link as the identity
     * of the row, which incorrectly converted narrative text
     * into fake subject rows.
     *
     * Therefore an official unit link is only accepted as the
     * row identity when the corresponding cell itself starts
     * with that unit code.
     */

    const unitAnchors =
      cell.find(
        'a[href*="/units/"]',
      );

    for (
      let anchorIndex = 0;
      anchorIndex <
      unitAnchors.length;
      anchorIndex += 1
    ) {
      const anchor =
        unitAnchors.eq(
          anchorIndex,
        );

      const href =
        anchor.attr(
          'href',
        );

      const code =
        (
          href
            ? extractCodeFromHref(
                href,
              )
            : null
        ) ??
        extractUnitCode(
          anchor.text(),
        );

      if (
        !code
      ) {
        continue;
      }

      /**
       * The unit code must be the leading meaningful text of
       * its table cell.
       *
       * Accept:
       *
       * INFO1110
       * INFO1110 Introduction to Programming
       *
       * Reject:
       *
       * Students should take INFO1110...
       * P INFO1110...
       */
      const startsWithCode =
        new RegExp(
          `^${code}\\b`,
          'i',
        ).test(
          cellText,
        );

      if (
        startsWithCode
      ) {
        return {
          code,

          cellIndex:
            index,
        };
      }
    }

    /**
     * ------------------------------------------------
     * PLAIN-TEXT UNIT CODE
     * ------------------------------------------------
     *
     * Some tables do not use links.
     *
     * Again, require the code to occur at the beginning of the
     * first two cells instead of merely appearing somewhere in
     * the text. This prevents prerequisite/advisory prose from
     * becoming a fake unit row.
     */
    if (
      index <=
      1
    ) {
      const leadingMatch =
        cellText.match(
          /^([A-Z]{4}\d{4})\b/,
        );

      if (
        leadingMatch
      ) {
        return {
          code:
            leadingMatch[1]
              .toUpperCase(),

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
 * UNIT ROW PARSING
 * ------------------------------------------------
 */

function parseUnitRow(
  $: cheerio.CheerioAPI,

  row: AnyNode,

  sourceUrl: string,

  unitIdentity: {
    code: string;
    cellIndex: number;
  },

  currentSection:
    string | null,

  headingPath:
    UsydGlobalTableHeadingContext[],
): UsydGlobalTableUnit {
  const cellElements =
    $(row).find(
      'th, td',
    );

  const cellTexts:
    string[] =
    [];

  cellElements.each(
    (
      _,
      cell,
    ) => {
      cellTexts.push(
        normalizeText(
          $(cell).text(),
        ),
      );
    },
  );

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

  return {
    code,

    title,

    creditPoints,

    accessConditionsRaw:
      conditions,

    section:
      currentSection,

    headingPath:
      headingPath.map(
        (
          heading,
        ) => ({
          ...heading,
        }),
      ),

    sourceUrl,
  };
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

  tableIndex: number,

  initialSourceOrder: number,
): {
  units:
    UsydGlobalTableUnit[];

  structureRows:
    UsydGlobalTableStructureRow[];

  rowsInspected:
    number;

  nextSourceOrder:
    number;
} {
  const units:
    UsydGlobalTableUnit[] =
    [];

  const structureRows:
    UsydGlobalTableStructureRow[] =
    [];

  let rowsInspected =
    0;

  let sourceOrder =
    initialSourceOrder;

  let currentSection:
    string | null =
    null;

  let headingPath:
    UsydGlobalTableHeadingContext[] =
    [];

  const rows =
    $(table)
      .find(
        'tr',
      )
      .toArray();

  for (
    let rowIndex = 0;
    rowIndex <
    rows.length;
    rowIndex += 1
  ) {
    const row =
      rows[
        rowIndex
      ];

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
      continue;
    }

    const cellTexts:
      string[] =
      [];

    cellElements.each(
      (
        _,
        cell,
      ) => {
        cellTexts.push(
          normalizeText(
            $(cell).text(),
          ),
        );
      },
    );

    const rowText =
      getRowText(
        $,
        row,
      );

    const unitIdentity =
      findRowUnitCode(
        $,
        row,
      );

    /**
     * ------------------------------------------------
     * UNIT
     * ------------------------------------------------
     */

    if (
      unitIdentity
    ) {
      const unit =
        parseUnitRow(
          $,
          row,
          sourceUrl,
          unitIdentity,
          currentSection,
          headingPath,
        );

      units.push(
        unit,
      );

      structureRows.push({
        kind:
          'UNIT',

        code:
          unit.code,

        title:
          unit.title,

        creditPoints:
          unit.creditPoints,

        accessConditionsRaw:
          unit.accessConditionsRaw,

        section:
          unit.section,

        headingPath:
          (
            unit.headingPath ??
            []
          ).map(
            (
              heading,
            ) => ({
              ...heading,
            }),
          ),

        tableIndex,

        rowIndex,

        sourceOrder,
      });

      sourceOrder +=
        1;

      continue;
    }

    /**
     * ------------------------------------------------
     * EXPLICIT H1-H6 HEADING
     * ------------------------------------------------
     */

    const explicitHeading =
      getExplicitHeading(
        $,
        row,
      );

    if (
      explicitHeading
    ) {
      headingPath =
        updateHeadingPath(
          headingPath,
          explicitHeading,
        );

      currentSection =
        explicitHeading.text;

      structureRows.push({
        kind:
          'HEADING',

        text:
          explicitHeading.text,

        level:
          explicitHeading.level,

        tableIndex,

        rowIndex,

        sourceOrder,
      });

      sourceOrder +=
        1;

      continue;
    }

    /**
     * Empty rows carry no useful structure.
     */
    if (
      !rowText
    ) {
      continue;
    }

    /**
     * ------------------------------------------------
     * LEGACY GENERIC SECTION
     * ------------------------------------------------
     *
     * Preserve previous parser behaviour for non-heading tables.
     */

    const section =
      getSectionCandidate(
        cellTexts,
      );

    if (
      section
    ) {
      currentSection =
        section;

      structureRows.push({
        kind:
          'SECTION',

        text:
          section,

        tableIndex,

        rowIndex,

        sourceOrder,
      });

      sourceOrder +=
        1;

      continue;
    }

    /**
     * ------------------------------------------------
     * NARRATIVE
     * ------------------------------------------------
     *
     * Unlike the old parser, narrative text is preserved rather
     * than discarded.
     *
     * It does NOT alter explicit headingPath.
     */
    structureRows.push({
      kind:
        'NARRATIVE',

      text:
        rowText,

      tableIndex,

      rowIndex,

      sourceOrder,
    });

    sourceOrder +=
      1;
  }

  return {
    units,

    structureRows,

    rowsInspected,

    nextSourceOrder:
      sourceOrder,
  };
}

/**
 * ------------------------------------------------
 * FALLBACK EXTRACTION
 * ------------------------------------------------
 *
 * If no standard unit rows exist, conservatively use official
 * /units/CODE links.
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

        headingPath:
          [],

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

  const structureRows:
    UsydGlobalTableStructureRow[] =
    [];

  let rowsInspected =
    0;

  let sourceOrder =
    0;

  tables.each(
    (
      tableIndex,
      table,
    ) => {
      const parsed =
        parseHtmlTable(
          $,
          table,
          finalUrl,
          tableIndex,
          sourceOrder,
        );

      rowsInspected +=
        parsed.rowsInspected;

      sourceOrder =
        parsed.nextSourceOrder;

      allUnits.push(
        ...parsed.units,
      );

      structureRows.push(
        ...parsed.structureRows,
      );
    },
  );

  /**
   * Fall back to official unit links only if no normal unit
   * rows were parsed.
   */
  if (
    allUnits.length ===
    0
  ) {
    const fallbackUnits =
      extractFallbackUnits(
        $,
        finalUrl,
      );

    allUnits.push(
      ...fallbackUnits,
    );

    for (
      const unit
      of fallbackUnits
    ) {
      structureRows.push({
        kind:
          'UNIT',

        code:
          unit.code,

        title:
          unit.title,

        creditPoints:
          unit.creditPoints,

        accessConditionsRaw:
          unit.accessConditionsRaw,

        section:
          unit.section,

        headingPath:
          [],

        tableIndex:
          -1,

        rowIndex:
          -1,

        sourceOrder,
      });

      sourceOrder +=
        1;
    }
  }

  const uniqueUnitCodes =
    [
      ...new Set(
        allUnits.map(
          (
            unit,
          ) =>
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

    structureRows,

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