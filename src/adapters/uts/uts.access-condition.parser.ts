import * as cheerio from 'cheerio';

import type {
  AnyNode,
} from 'domhandler';

export interface UtsAccessConditionItem {
  id: string;

  sourceType: string;

  details: string;

  referencedCodes: string[];
}

export interface UtsRequisiteGroup {
  rule?: string;

  items: UtsAccessConditionItem[];
}

export interface UtsAntiRequisiteItem {
  id: string;

  details: string;

  referencedCodes: string[];
}

export interface ParsedUtsAccessConditions {
  subjectCode: string;

  subjectName?: string;

  requisiteGroups: UtsRequisiteGroup[];

  rule?: string;

  items: UtsAccessConditionItem[];

  antiRequisiteRule?: string;

  antiRequisites: UtsAntiRequisiteItem[];

  hasConditions: boolean;
}

export function parseUtsAccessConditions(
  html: string,
  subjectCode: string,
): ParsedUtsAccessConditions {
  const $ =
    cheerio.load(
      html,
    );

  const bodyText =
    normalizeText(
      $('body').text(),
    );

  const subjectName =
    extractSubjectName(
      $,
      subjectCode,
    );

  const rule =
    extractRequisiteRule(
      bodyText,
    );

  const items =
    extractRequisiteItems(
      $,
    );

  const antiRequisiteRule =
    extractAntiRequisiteRule(
      bodyText,
    );

  const antiRequisites =
    extractAntiRequisiteItems(
      $,
    );

  const requisiteGroups:
    UtsRequisiteGroup[] =
      rule || items.length > 0
        ? [
            {
              rule,

              items,
            },
          ]
        : [];

  return {
    subjectCode,

    subjectName,

    requisiteGroups,

    rule,

    items,

    antiRequisiteRule,

    antiRequisites,

    hasConditions:
      items.length > 0 ||
      antiRequisites.length > 0,
  };
}

function extractSubjectName(
  $: cheerio.CheerioAPI,
  subjectCode: string,
): string | undefined {
  const headings =
    $('.heading')
      .map(
        (
          _,
          element,
        ) =>
          normalizeText(
            $(element).text(),
          ),
      )
      .get()
      .filter(
        Boolean,
      );

  for (const heading of headings) {
    if (
      heading.startsWith(
        subjectCode,
      )
    ) {
      const name =
        heading
          .slice(
            subjectCode.length,
          )
          .trim();

      if (name) {
        return name;
      }
    }
  }

  const bodyText =
    normalizeText(
      $('body').text(),
    );

  const expression =
    new RegExp(
      `${escapeRegex(subjectCode)}\\s+(.+?)(?:Anti-requisite\\(s\\)|Requisite\\(s\\)|$)`,
      'i',
    );

  const match =
    bodyText.match(
      expression,
    );

  if (!match?.[1]) {
    return undefined;
  }

  const cleaned =
    normalizeText(
      match[1],
    );

  const repeatedCodeIndex =
    cleaned.indexOf(
      subjectCode,
    );

  if (
    repeatedCodeIndex !== -1
  ) {
    return cleaned
      .slice(
        0,
        repeatedCodeIndex,
      )
      .trim();
  }

  return cleaned ||
    undefined;
}

function extractRequisiteRule(
  text: string,
): string | undefined {
  const match =
    text.match(
      /(?:^|\s)Requisite rule:\s*(.+?)\s+Item\s*Type\s*Details\b/i,
    );

  if (!match?.[1]) {
    return undefined;
  }

  const rule =
    normalizeText(
      match[1],
    );

  return rule ||
    undefined;
}

function extractAntiRequisiteRule(
  text: string,
): string | undefined {
  const match =
    text.match(
      /Anti-requisite rule:\s*(.+?)\s+Item\s*Details\b/i,
    );

  if (!match?.[1]) {
    return undefined;
  }

  const rule =
    normalizeText(
      match[1],
    );

  return rule ||
    undefined;
}

function extractRequisiteItems(
  $: cheerio.CheerioAPI,
): UtsAccessConditionItem[] {
  const items:
    UtsAccessConditionItem[] = [];

  const seen =
    new Set<string>();

  $('tr').each(
    (
      _,
      row,
    ) => {
      const cells =
        getDirectCells(
          $,
          row,
        );

      const parsed =
        parseRequisiteCells(
          cells,
        );

      if (!parsed) {
        return;
      }

      const key =
        [
          parsed.id,
          parsed.sourceType,
          parsed.details,
        ].join(
          '|',
        );

      if (
        seen.has(
          key,
        )
      ) {
        return;
      }

      seen.add(
        key,
      );

      items.push(
        parsed,
      );
    },
  );

  return sortById(
    items,
  );
}

function parseRequisiteCells(
  cells: string[],
): UtsAccessConditionItem | undefined {
  if (
    cells.length <
    3
  ) {
    return undefined;
  }

  const id =
    cells[0];

  const sourceType =
    cells[1];

  if (
    !id ||
    !sourceType
  ) {
    return undefined;
  }

  if (
    !isConditionId(
      id,
    )
  ) {
    return undefined;
  }

  if (
    !looksLikeConditionType(
      sourceType,
    )
  ) {
    return undefined;
  }

  const details =
    normalizeText(
      cells
        .slice(
          2,
        )
        .join(
          ' ',
        ),
    );

  if (!details) {
    return undefined;
  }

  return {
    id,

    sourceType,

    details,

    referencedCodes:
      extractReferencedCodes(
        details,
      ),
  };
}

function extractAntiRequisiteItems(
  $: cheerio.CheerioAPI,
): UtsAntiRequisiteItem[] {
  const items:
    UtsAntiRequisiteItem[] = [];

  const seen =
    new Set<string>();

  $('tr').each(
    (
      _,
      row,
    ) => {
      const cells =
        getDirectCells(
          $,
          row,
        );

      const parsed =
        parseAntiRequisiteCells(
          cells,
        );

      if (!parsed) {
        return;
      }

      const key =
        [
          parsed.id,
          parsed.details,
        ].join(
          '|',
        );

      if (
        seen.has(
          key,
        )
      ) {
        return;
      }

      seen.add(
        key,
      );

      items.push(
        parsed,
      );
    },
  );

  return sortById(
    items,
  );
}

function parseAntiRequisiteCells(
  cells: string[],
): UtsAntiRequisiteItem | undefined {
  if (
    cells.length !==
    2
  ) {
    return undefined;
  }

  const id =
    cells[0];

  const details =
    cells[1];

  if (
    !id ||
    !details
  ) {
    return undefined;
  }

  if (
    !isConditionId(
      id,
    )
  ) {
    return undefined;
  }

  const referencedCodes =
    extractReferencedCodes(
      details,
    );

  if (
    referencedCodes.length ===
    0
  ) {
    return undefined;
  }

  return {
    id,

    details,

    referencedCodes,
  };
}

function getDirectCells(
  $: cheerio.CheerioAPI,
  row: AnyNode,
): string[] {
  return $(row)
    .children(
      'th, td',
    )
    .map(
      (
        _,
        cell,
      ) =>
        normalizeText(
          $(cell)
            .clone()
            .children(
              'table',
            )
            .remove()
            .end()
            .text(),
        ),
    )
    .get()
    .filter(
      Boolean,
    );
}

function looksLikeConditionType(
  value: string,
): boolean {
  const normalized =
    normalizeText(
      value,
    )
      .toLowerCase();

  return (
    normalized.includes(
      'requisite',
    ) ||
    normalized ===
      'corequisite' ||
    normalized ===
      'co-requisite' ||
    normalized ===
      'prerequisite' ||
    normalized ===
      'pre-requisite' ||
    normalized ===
      'exclusion'
  );
}

function isConditionId(
  value: string,
): boolean {
  return /^\d+[a-z]*$/i.test(
    value.trim(),
  );
}

function extractReferencedCodes(
  details: string,
): string[] {
  const matches =
    details.match(
      /\b(?:[A-Z]{1,5}\d{4,6}|\d{5,6})\b/g,
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

function sortById<
  T extends {
    id: string;
  },
>(
  items: T[],
): T[] {
  return [
    ...items,
  ].sort(
    (
      first,
      second,
    ) =>
      compareConditionIds(
        first.id,
        second.id,
      ),
  );
}

function compareConditionIds(
  first: string,
  second: string,
): number {
  const firstMatch =
    first.match(
      /^(\d+)([a-z]*)$/i,
    );

  const secondMatch =
    second.match(
      /^(\d+)([a-z]*)$/i,
    );

  if (
    !firstMatch ||
    !secondMatch
  ) {
    return first.localeCompare(
      second,
    );
  }

  const firstNumber =
    Number(
      firstMatch[1],
    );

  const secondNumber =
    Number(
      secondMatch[1],
    );

  if (
    firstNumber !==
    secondNumber
  ) {
    return (
      firstNumber -
      secondNumber
    );
  }

  return (
    firstMatch[2] ?? ''
  ).localeCompare(
    secondMatch[2] ?? '',
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

function escapeRegex(
  value: string,
): string {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
}