import axios from 'axios';
import * as cheerio from 'cheerio';

import type {
  UsydComponentReferenceRule,
  UsydConditionalRequirementRule,
  UsydComponentRequirement,
  UsydComponentType,
  UsydFormalRequirement,
  UsydRequirementGroup,
  UsydRequirementUnit,
  UsydSubjectAreaTable,
} from './usyd.types';

function normalizeText(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .replace(
      /(?<=[A-Za-z0-9])(?=[A-Z]{4}\d{4}\b)/g,
      ' ',
    )
    .replace(
      /\b(or|and)(?=[A-Z]{4}\d{4}\b)/g,
      '$1 ',
    )
    .replace(
      /\bcoded(?=interdisciplinary\b)/gi,
      'coded ',
    )
    .trim();
}


function cleanReferencedComponentName(
  value: string,
): string {
  return normalizeText(value)
    .replace(/^or\s+/i, '')
    .replace(/[.;]+$/g, '')
    .trim();
}

/**
 * Detects formal requirements that reference another USYD component.
 *
 * Examples:
 * - "48 credit point major in Physics"
 * - "A 60 credit point program in Medical Science"
 * - "A 48 credit point major in A; B; or C"
 *
 * Multiple names in one rule are alternatives, so they are ONE_OF and
 * contribute the rule CP once, not once per alternative.
 */
export function parseUsydComponentReferenceRule(
  rawText: string,
): UsydComponentReferenceRule | null {
  const text = normalizeText(rawText)
    .replace(/^\([ivxlcdm]+\)\s*/i, '')
    .trim();

  const match = text.match(
    /\b(\d+(?:\.\d+)?)\s+credit point(?:s)?\s+(major|program|stream)\s+in\s+(.+)$/i,
  );

  if (!match) {
    return null;
  }

  const requiredCreditPoints = Number(match[1]);

  if (!Number.isFinite(requiredCreditPoints)) {
    return null;
  }

  const type = match[2].toUpperCase() as
    UsydComponentReferenceRule['components'][number]['type'];

  const names = match[3]
    .split(/\s*;\s*(?:or\s+)?/i)
    .map(cleanReferencedComponentName)
    .filter(Boolean);

  if (names.length === 0) {
    return null;
  }

  return {
    logic: names.length > 1 ? 'ONE_OF' : 'ALL',
    requiredCreditPoints,
    components: names.map((name) => ({
      type,
      name,
      requiredCreditPoints,
    })),
  };
}

function emptyToNull(
  value: string | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeText(value);

  if (
    !normalized ||
    /^none$/i.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function parseYear(
  $: cheerio.CheerioAPI,
): number {
  const bodyText = normalizeText(
    $('body').text(),
  );

  const match = bodyText.match(
    /\b(20\d{2})\s+Handbooks\b/i,
  );

  if (!match) {
    throw new Error(
      'Could not determine USYD handbook year.',
    );
  }

  return Number(match[1]);
}

function parseComponentType(
  name: string,
): UsydComponentType {
  const normalized =
    name.toLowerCase();

  if (
    normalized.includes(
      'major',
    )
  ) {
    return 'MAJOR';
  }

  if (
    normalized.includes(
      'minor',
    )
  ) {
    return 'MINOR';
  }

  if (
    normalized.includes(
      'program',
    )
  ) {
    return 'PROGRAM';
  }

  if (
    normalized.includes(
      'stream',
    )
  ) {
    return 'STREAM';
  }

  return 'OTHER';
}

function parseRequiredCreditPoints(
  text: string,
): number | null {
  const match = text.match(
    /(?:requires|is)\s+(\d+(?:\.\d+)?)\s+credit points/i,
  );

  if (!match) {
    return null;
  }

  const value =
    Number(match[1]);

  return Number.isFinite(
    value,
  )
    ? value
    : null;
}

function parseRuleCreditPoints(
  text: string,
): number | null {
  const matches =
    [
      ...text.matchAll(
        /\b(\d+(?:\.\d+)?)\s+credit points\b/gi,
      ),
    ];

  if (
    matches.length ===
    0
  ) {
    return null;
  }

  /*
   * Handle rows such as:
   *
   * 6 credit points of core units and
   * 6 credit points of Mathematics units
   * or Data Science units
   *
   * This is a 12 CP requirement.
   *
   * Only sum when there are exactly two
   * explicit CP clauses joined by "and".
   * This avoids changing rows that already
   * state an overall total plus sub-parts.
   */
  if (
    matches.length ===
    2
  ) {
    const firstEnd =
      matches[0].index! +
      matches[0][0].length;

    const secondStart =
      matches[1].index!;

    const between =
      text
        .slice(
          firstEnd,
          secondStart,
        )
        .toLowerCase();

    if (
      /\band\b/.test(
        between,
      )
    ) {
      return (
        Number(
          matches[0][1],
        ) +
        Number(
          matches[1][1],
        )
      );
    }
  }

  const value =
    Number(
      matches[0][1],
    );

  return Number.isFinite(
    value,
  )
    ? value
    : null;
}

function parseLevel(
  text: string,
): number | null {
    const match = text.match(
    /\b([1-9])000(?:-|\s+)level\b/i,
  );

  if (!match) {
    return null;
  }

  return (
    Number(match[1]) *
    1000
  );
}

function parseFormalRequirement(
  text: string,
  order: number,
): UsydFormalRequirement {
  const normalized =
    normalizeText(text);

  const lower =
    normalized.toLowerCase();

  let groupKind:
    UsydFormalRequirement['groupKind'] =
    'OTHER';

  if (
    /methodology\s+or\s+application/i.test(
      lower,
    ) ||
    /application\s+or\s+interdisciplinary project/i.test(
      lower,
    )
  ) {
    groupKind = 'COMBINED';
  } else if (
    /methodology units?/i.test(
      lower,
    )
  ) {
    groupKind = 'METHODOLOGY';
  } else if (
    /application units?/i.test(
      lower,
    )
  ) {
    groupKind = 'APPLICATION';
  } else if (
    /interdisciplinary project/i.test(
      lower,
    )
  ) {
    groupKind =
      'INTERDISCIPLINARY_PROJECT';
  } else if (
    /\bselective(?: units?)?\b/i.test(
      lower,
    )
  ) {
    groupKind =
      'SELECTIVE';
  } else if (
    /core units?/i.test(
      lower,
    )
  ) {
    groupKind =
      'CORE';
  } else if (
    /\bfood science units?\b/i.test(
      lower,
    )
  ) {
    groupKind =
      'UNITS';
  } else if (
    /\b\d000-level units\b/i.test(
      lower,
    )
  ) {
    groupKind =
      'UNITS';
  }

  return {
    order,
    rawText:
      normalized,

    requiredCreditPoints:
      parseRuleCreditPoints(
        normalized,
      ),

    level:
      parseLevel(
        normalized,
      ),

    groupKind,

    componentReferenceRule:
      parseUsydComponentReferenceRule(
        normalized,
      ),

    conditionalRule: null,

    subrules: [],

    notes: [],
  };
}

function extractRule(
  text: string,
  target:
    | 'A'
    | 'P'
    | 'C'
    | 'N',
): string | null {
  const normalized =
    normalizeText(text);

  if (!normalized) {
    return null;
  }

  const markerRegex =
    new RegExp(
      `(?:^|\\s)${target}\\s+`,
    );

  const markerMatch =
    markerRegex.exec(
      normalized,
    );

  if (!markerMatch) {
    return null;
  }

  const valueStart =
    markerMatch.index +
    markerMatch[0].length;

  const remainder =
    normalized.slice(
      valueStart,
    );

  const nextMarker =
    remainder.match(
      /\s(?:A|P|C|N)\s+/,
    );

  const value =
    nextMarker &&
      nextMarker.index !==
      undefined
      ? remainder.slice(
        0,
        nextMarker.index,
      )
      : remainder;

  return emptyToNull(
    value,
  );
}

function parseUnitRow(
  $: cheerio.CheerioAPI,
  row: Parameters<
    cheerio.CheerioAPI
  >[0],
  sourceUrl: string,
): UsydRequirementUnit | null {
  const cells = $(row)
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
    2
  ) {
    return null;
  }

  const match =
    cells[0].match(
      /^([A-Z]{4}\d{4})\s+(.+)$/,
    );

  if (!match) {
    return null;
  }

  const code =
    match[1];

  const name =
    match[2];

  const creditPoints =
    Number(
      cells[1],
    );

  const ruleText =
    cells[2] ?? '';

  const anchor = $(row)
    .find('a[href]')
    .filter(
      (_, element) =>
        normalizeText(
          $(element).text(),
        ).includes(
          code,
        ),
    )
    .first();

  let sourceUnitUrl:
    string | null =
    null;

  const href =
    anchor.attr(
      'href',
    );

  if (href) {
    try {
      sourceUnitUrl =
        new URL(
          href,
          sourceUrl,
        ).toString();
    } catch {
      sourceUnitUrl =
        null;
    }
  }

  return {
    code,
    name,

    creditPoints:
      Number.isFinite(
        creditPoints,
      )
        ? creditPoints
        : null,

    assumedKnowledge:
      extractRule(
        ruleText,
        'A',
      ),

    prerequisite:
      extractRule(
        ruleText,
        'P',
      ),

    corequisite:
      extractRule(
        ruleText,
        'C',
      ),

    prohibition:
      extractRule(
        ruleText,
        'N',
      ),

    sourceUrl:
      sourceUnitUrl,
  };
}

function createPhysicalGroup(
  name: string,
  level: number | null,
): UsydRequirementGroup {
  return {
    name,
    level,

    logic:
      /selective|methodology|application|project/i.test(
        name,
      )
        ? 'ANY'
        : 'UNKNOWN',

    requiredCreditPoints:
      null,

    units: [],
  };
}

function cloneGroup(
  group: UsydRequirementGroup,
  requiredCreditPoints:
    number | null,
): UsydRequirementGroup {
  return {
    name:
      group.name,

    level:
      group.level,

    logic:
      group.logic,

    requiredCreditPoints,

    units:
      [...group.units],
  };
}

function isComponentHeading(
  text: string,
): boolean {
  return /\b(major|minor|program|stream)$/i.test(
    text,
  );
}

function isMainRequirementRow(
  text: string,
): boolean {
  return /^\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)\)/i.test(
    text,
  );
}

function isSubruleRow(
  text: string,
): boolean {
  return /^\([a-hj-uw-z]\)/i.test(
    text,
  );
}

function isNoteRow(
  text: string,
): boolean {
  return (
    /^[*†‡]/.test(
      text,
    ) ||
    /^note\b/i.test(
      text,
    ) ||
    /^notes\b/i.test(
      text,
    )
  );
}

function findRequirementForNote(
  component:
    UsydComponentRequirement,
  noteText: string,
  fallback:
    UsydFormalRequirement | null,
): UsydFormalRequirement | null {
  const markerMatch =
    noteText.match(
      /^([*†‡]+)/,
    );

  if (
    markerMatch
  ) {
    const marker =
      markerMatch[1];

    const matchingRequirement =
      [
        ...component.formalRequirements,
      ]
        .reverse()
        .find(
          (requirement) =>
            requirement.rawText.includes(
              marker,
            ),
        );

    if (
      matchingRequirement
    ) {
      return matchingRequirement;
    }
  }

  return fallback;
}

function isUnitTableHeader(
  text: string,
): boolean {
  return (
    text.includes(
      'Unit of study',
    ) &&
    text.includes(
      'Credit points',
    ) &&
    text.includes(
      'Prerequisites',
    )
  );
}

function parseComponents(
  $: cheerio.CheerioAPI,
): UsydComponentRequirement[] {
  const components:
    UsydComponentRequirement[] =
    [];

  const requirementTables =
    $('table').filter(
      (_, element) => {
        const text =
          normalizeText(
            $(element).text(),
          );

        return /(?:requires|is)\s+\d+(?:\.\d+)?\s+credit points/i.test(
          text,
        );
      },
    );

  requirementTables.each(
    (_, table) => {
      let currentComponent:
        UsydComponentRequirement | null =
        null;

      let currentRequirement:
        UsydFormalRequirement | null =
        null;

      let requirementOrder =
        0;

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
                  (
                    _,
                    cell,
                  ) =>
                    normalizeText(
                      $(
                        cell,
                      ).text(),
                    ),
                )
                .get();

            if (
              cells.length ===
              0
            ) {
              return;
            }

            const rowText =
              normalizeText(
                cells.join(
                  ' ',
                ),
              );

            if (
              isUnitTableHeader(
                rowText,
              )
            ) {
              currentComponent =
                null;

              currentRequirement =
                null;

              return;
            }

            /*
             * Subrules must be checked
             * before component headings.
             *
             * Example:
             *
             * (b) 6 credit points of
             * MEDS coded units for
             * students in the Medical
             * Science stream
             *
             * This is not a new stream
             * component.
             */
            if (
              currentComponent &&
              currentRequirement &&
              isSubruleRow(
                rowText,
              )
            ) {
              currentRequirement
                .subrules
                .push(
                  rowText,
                );

              return;
            }

            /*
             * Notes must also be checked
             * before component headings.
             */
            if (
              currentComponent &&
              isNoteRow(
                rowText,
              )
            ) {
              const targetRequirement =
                findRequirementForNote(
                  currentComponent,
                  rowText,
                  currentRequirement,
                );

              if (
                targetRequirement
              ) {
                targetRequirement
                  .notes
                  .push(
                    rowText,
                  );
              }

              return;
            }

            if (
              cells.length ===
              1 &&
              isComponentHeading(
                rowText,
              )
            ) {
              currentComponent =
              {
                name:
                  rowText,

                type:
                  parseComponentType(
                    rowText,
                  ),

                requiredCreditPoints:
                  null,

                summary:
                  null,

                formalRequirements:
                  [],

                requirementGroups:
                  [],
              };

              components.push(
                currentComponent,
              );

              currentRequirement =
                null;

              requirementOrder =
                0;

              return;
            }

            if (
              currentComponent &&
              /(?:requires|is)\s+\d+(?:\.\d+)?\s+credit points/i.test(
                rowText,
              )
            ) {
              currentComponent
                .requiredCreditPoints =
                parseRequiredCreditPoints(
                  rowText,
                );

              currentComponent
                .summary =
                rowText;

              currentRequirement =
                null;

              return;
            }

            if (
              currentComponent &&
              isMainRequirementRow(
                rowText,
              )
            ) {
              requirementOrder +=
                1;

              currentRequirement =
                parseFormalRequirement(
                  rowText,
                  requirementOrder,
                );

              currentComponent
                .formalRequirements
                .push(
                  currentRequirement,
                );

              return;
            }
          },
        );
    },
  );

  return components;
}

function findUnitTable(
  $: cheerio.CheerioAPI,
) {
  return $('table')
    .filter(
      (_, element) => {
        const rows =
          $(element)
            .find('tr')
            .toArray();

        return rows.some(
          (row) => {
            const text =
              normalizeText(
                $(row).text(),
              );

            return isUnitTableHeader(
              text,
            );
          },
        );
      },
    )
    .first();
}

function parsePhysicalGroups(
  $: cheerio.CheerioAPI,
  unitTable:
    ReturnType<
      cheerio.CheerioAPI
    >,
  sourceUrl: string,
): UsydRequirementGroup[] {
  const physicalGroups:
    UsydRequirementGroup[] =
    [];

  const rows =
    unitTable
      .find('tr')
      .toArray();

  const headerIndex =
    rows.findIndex(
      (row) => {
        const text =
          normalizeText(
            $(row).text(),
          );

        return isUnitTableHeader(
          text,
        );
      },
    );

  if (
    headerIndex < 0
  ) {
    throw new Error(
      'Unit-of-study table was found but its header row could not be located.',
    );
  }

  let currentLevel:
    number | null =
    null;

  let currentGroup:
    UsydRequirementGroup | null =
    null;

  function ensureLevelGroup():
    UsydRequirementGroup {
    if (
      currentGroup
    ) {
      return currentGroup;
    }

    currentGroup =
      createPhysicalGroup(
        'Units',
        currentLevel,
      );

    physicalGroups.push(
      currentGroup,
    );

    return currentGroup;
  }

  for (
    const row
    of rows.slice(
      headerIndex + 1,
    )
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
      cells.length ===
      0
    ) {
      continue;
    }

    const rowText =
      normalizeText(
        cells.join(
          ' ',
        ),
      );

    if (
      cells.length ===
      1 &&
      /\b\d000-level units of study\b/i.test(
        rowText,
      )
    ) {
      currentLevel =
        parseLevel(
          rowText,
        );

      currentGroup =
        null;

      continue;
    }

    if (
      cells.length ===
      1 &&
      !/^[A-Z]{4}\d{4}\b/.test(
        rowText,
      )
    ) {
      if (
        currentGroup &&
        /^selective units$/i.test(
          currentGroup.name,
        ) &&
        /^choose a unit not in chosen major[.]?$/i.test(
          rowText,
        )
      ) {
        continue;
      }

      currentGroup =
        createPhysicalGroup(
          rowText,
          currentLevel,
        );

      physicalGroups.push(
        currentGroup,
      );

      continue;
    }

    const unit =
      parseUnitRow(
        $,
        row,
        sourceUrl,
      );

    if (
      !unit
    ) {
      continue;
    }

    const targetGroup =
      ensureLevelGroup();

    targetGroup.units.push(
      unit,
    );
  }

  return physicalGroups;
}

function findByNameAndLevel(
  groups:
    UsydRequirementGroup[],
  level:
    number | null,
  matcher:
    RegExp,
): UsydRequirementGroup | null {
  return (
    groups.find(
      (group) =>
        (
          level ===
          null ||
          group.level ===
          level
        ) &&
        matcher.test(
          group.name,
        ),
    ) ?? null
  );
}

function combineGroups(
  groups:
    UsydRequirementGroup[],
  requiredCreditPoints:
    number | null,
): UsydRequirementGroup | null {
  if (
    groups.length ===
    0
  ) {
    return null;
  }

  const units =
    new Map<
      string,
      UsydRequirementUnit
    >();

  for (
    const group
    of groups
  ) {
    for (
      const unit
      of group.units
    ) {
      if (
        !units.has(
          unit.code,
        )
      ) {
        units.set(
          unit.code,
          unit,
        );
      }
    }
  }

  return {
    name:
      groups
        .map(
          (group) =>
            group.name,
        )
        .join(
          ' OR ',
        ),

    level:
      groups[0]
        .level,

    logic:
      'ANY',

    requiredCreditPoints,

    units:
      [
        ...units.values(),
      ],
  };
}

/**
 * Maps a formal "units according to the
 * following rules" requirement to the
 * physical pools named by its subrules.
 *
 * Example:
 *
 * Formal:
 * (iii) 6cp of 2000-level units according
 * to the following rules:
 *   (a) ... biochemistry units or
 *   (b) ... MEDS coded units ...
 *
 * Physical groups:
 * - Biochemistry
 * - MEDS coded
 *
 * Result:
 * Biochemistry OR MEDS coded
 */
function mapSubrulePools(
  requirement:
    UsydFormalRequirement,
  physicalGroups:
    UsydRequirementGroup[],
): UsydRequirementGroup | null {
  if (
    requirement.subrules.length ===
    0
  ) {
    return null;
  }

  const level =
    requirement.level;

  const subruleText =
    requirement.subrules
      .map(
        (subrule) =>
          normalizeText(
            subrule,
          ).toLowerCase(),
      )
      .join(' ');

  const matches =
    physicalGroups.filter(
      (group) => {
        if (
          level !==
          null &&
          group.level !==
          level
        ) {
          return false;
        }

        const groupName =
          normalizeText(
            group.name,
          ).toLowerCase();

        if (
          !groupName
        ) {
          return false;
        }

        /*
         * Avoid accidentally matching
         * generic physical headings such
         * as "Core" against unrelated
         * explanatory text.
         */
        if (
          /^(core|units|selective)$/i.test(
            groupName,
          )
        ) {
          return false;
        }

        return subruleText.includes(
          groupName,
        );
      },
    );

  return combineGroups(
    matches,
    requirement.requiredCreditPoints,
  );
}

function mapSplitCoreChoiceRequirement(
  requirement: UsydFormalRequirement,
  physicalGroups: UsydRequirementGroup[],
): UsydRequirementGroup[] | null {
  const text = requirement.rawText;

  const isSplitRule =
    /\b6\s+credit points\b.*\bcore units\b.*\band\b.*\b6\s+credit points\b.*\bmathematics units\b.*\bor\b.*\bdata science units\b/i.test(
      text,
    );

  if (!isSplitRule) {
    return null;
  }

  const level = requirement.level;

  const core =
    findByNameAndLevel(
      physicalGroups,
      level,
      /^core units$/i,
    );

  const mathematics =
    findByNameAndLevel(
      physicalGroups,
      level,
      /^mathematics units$/i,
    );

  const dataScience =
    findByNameAndLevel(
      physicalGroups,
      level,
      /^data science units$/i,
    );

  if (
    !core ||
    !mathematics ||
    !dataScience
  ) {
    return null;
  }

  const choice =
    combineGroups(
      [
        mathematics,
        dataScience,
      ],
      6,
    );

  if (!choice) {
    return null;
  }

  return [
    cloneGroup(
      core,
      6,
    ),
    choice,
  ];
}

/**
 * Normalizes a physical handbook heading so it can be compared with
 * wording inside a formal requirement.
 *
 * Examples:
 * - "Experimental design" -> "experimental design"
 * - "Core mathematics" -> "core mathematics"
 * - "Minor Selective" -> "minor selective"
 */
function normalizePhysicalGroupName(
  value: string,
): string {
  let normalized = normalizeText(value)
    .toLowerCase()
    .replace(/\bunits? of study\b/g, '')
    .replace(/\bunits?\b/g, '')
    .replace(/\bfrom\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  /*
   * USYD sometimes reverses the same pool wording:
   * - formal: "core mathematics"
   * - heading: "Mathematics - Core"
   *
   * Canonicalise "X core" to "core X" so the names compare.
   */
  const trailingCore = normalized.match(
    /^(.+?)\s+core$/,
  );

  if (trailingCore) {
    normalized = `core ${trailingCore[1]}`;
  }

  return normalized;
}

/**
 * Finds a specifically named physical pool mentioned by a formal rule.
 *
 * This is deliberately a fallback for descriptive headings such as:
 * - Experimental design
 * - Taxonomy
 * - Breadth
 * - Disciplinary selective
 * - Core mathematics
 * - Core probability
 * - Core computational
 * - Pharmacology
 * - List 1 / List 2
 *
 * Generic headings such as Core, Selective and Units are excluded here
 * because those still need component-aware handling in mapFormalRequirement.
 */
function mapNamedPhysicalGroup(
  requirement: UsydFormalRequirement,
  physicalGroups: UsydRequirementGroup[],
): UsydRequirementGroup | null {
  const requirementText = normalizeText(
    requirement.rawText,
  )
    .toLowerCase()
    .replace(/\bunits? of study\b/g, '')
    .replace(/\bunits?\b/g, '')
    .replace(/\bfrom\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const candidates = physicalGroups
    .filter(
      (group) =>
        requirement.level === null ||
        group.level === requirement.level,
    )
    .map(
      (group) => ({
        group,
        normalizedName:
          normalizePhysicalGroupName(
            group.name,
          ),
      }),
    )
    .filter(
      ({ normalizedName }) => {
        if (
          normalizedName.length === 0 ||
          /^(core|selective|units)$/.test(
            normalizedName,
          )
        ) {
          return false;
        }

        if (
          requirementText.includes(
            normalizedName,
          )
        ) {
          return true;
        }

        /*
         * USYD sometimes reverses a named core pool between the
         * formal rule and the physical heading:
         *
         * - formal:  "computer science core units"
         * - heading: "Computer Science - Core"
         *
         * normalizePhysicalGroupName() canonicalises the heading to
         * "core computer science", so also test the reverse wording.
         */
        const corePrefix =
          normalizedName.match(
            /^core\s+(.+)$/,
          );

        if (corePrefix) {
          return requirementText.includes(
            `${corePrefix[1]} core`,
          );
        }

        return false;
      },
    )
    .sort(
      (a, b) =>
        b.normalizedName.length -
        a.normalizedName.length,
    );

  if (
    candidates.length === 0
  ) {
    return null;
  }

  /*
   * If a formal rule explicitly names multiple physical pools joined by
   * OR, expose the complete choice instead of silently selecting only
   * the longest matching heading.
   *
   * Example:
   * "core mathematics or core probability units"
   */
  if (
    candidates.length > 1 &&
    /\bor\b/i.test(
      requirement.rawText,
    )
  ) {
    const uniqueCandidates =
      candidates.filter(
        (candidate, index, all) =>
          all.findIndex(
            (other) =>
              other.group.name ===
                candidate.group.name &&
              other.group.level ===
                candidate.group.level,
          ) === index,
      );

    const combined = combineGroups(
      uniqueCandidates.map(
        (candidate) =>
          candidate.group,
      ),
      requirement.requiredCreditPoints,
    );

    if (combined) {
      return combined;
    }
  }

  /*
   * If the level is unknown, only accept a unique best-name match.
   * This avoids silently choosing between the same heading repeated at
   * multiple levels.
   */
  if (
    requirement.level === null &&
    candidates.length > 1 &&
    candidates[0].normalizedName ===
      candidates[1].normalizedName
  ) {
    return null;
  }

  return candidates[0].group;
}

/**
 * Handles requirements that explicitly allow either a disciplinary
 * selective pool or an interdisciplinary-project selective pool.
 *
 * Example:
 * "6 credit points of 3000-level major disciplinary selective or
 * interdisciplinary project units"
 */
function mapDisciplinaryProjectChoice(
  requirement: UsydFormalRequirement,
  physicalGroups: UsydRequirementGroup[],
): UsydRequirementGroup | null {
  const text = requirement.rawText.toLowerCase();

  if (
    !/disciplinary selective\s+or\s+interdisciplinary project/i.test(
      text,
    )
  ) {
    return null;
  }

  const level = requirement.level;

  const disciplinary =
    findByNameAndLevel(
      physicalGroups,
      level,
      /^(?:major\s+)?disciplinary selective$/i,
    );

  const projectSelective =
    findByNameAndLevel(
      physicalGroups,
      level,
      /^interdisciplinary project selective$/i,
    );

  if (
    !disciplinary ||
    !projectSelective
  ) {
    return null;
  }

  return combineGroups(
    [
      disciplinary,
      projectSelective,
    ],
    requirement.requiredCreditPoints,
  );
}

/**
 * Preserves stream-dependent alternative-core semantics instead of relying
 * only on the flattened ANY group used by the structural representation.
 *
 * Examples:
 *
 * Genetics and Genomics:
 * - default -> Core
 * - Animal and Veterinary Biosciences stream -> matching alternative core
 * - Medical Science stream -> matching alternative core
 *
 * Nutrition Science:
 * - default -> Core
 * - Medical Science stream -> matching alternative core
 */
function parseConditionalAlternativeCoreRule(
  requirement: UsydFormalRequirement,
  physicalGroups: UsydRequirementGroup[],
): UsydConditionalRequirementRule | null {
  if (
    requirement.subrules.length === 0 ||
    !requirement.subrules.some(
      (subrule) =>
        /alternative core/i.test(
          subrule,
        ),
    )
  ) {
    return null;
  }

  const level =
    requirement.level;

  const branches:
    UsydConditionalRequirementRule['branches'] =
    [];

  for (
    const subrule
    of requirement.subrules
  ) {
    const normalizedSubrule =
      normalizeText(
        subrule,
      );

    const branchCreditPoints =
      parseRuleCreditPoints(
        normalizedSubrule,
      ) ??
      requirement.requiredCreditPoints;

    const streamMatch =
      normalizedSubrule.match(
        /for students in the (.+?) stream\b/i,
      );

    let physicalGroup:
      UsydRequirementGroup | null =
      null;

    /*
     * Conditional stream branch.
     */
    if (streamMatch) {
      const streamName =
        normalizeText(
          streamMatch[1],
        );

      /*
       * First try a physical heading that explicitly
       * contains the stream name.
       *
       * Example:
       * "Alternative core for the Medical Science stream"
       */
      physicalGroup =
        physicalGroups.find(
          (group) => {
            if (
              level !== null &&
              group.level !== level
            ) {
              return false;
            }

            const groupName =
              normalizePhysicalGroupName(
                group.name,
              );

            return (
              groupName.startsWith(
                'alternative core',
              ) &&
              groupName.includes(
                streamName.toLowerCase(),
              )
            );
          },
        ) ?? null;

      /*
       * Some USYD tables use only:
       *
       * "Alternative core"
       *
       * even though the formal requirement says that
       * pool applies specifically to a named stream.
       *
       * Only use this fallback when exactly one generic
       * Alternative core exists at the required level.
       */
      if (!physicalGroup) {
        const genericAlternativeCores =
          physicalGroups.filter(
            (group) => {
              if (
                level !== null &&
                group.level !== level
              ) {
                return false;
              }

              return /^alternative core$/i.test(
                normalizeText(
                  group.name,
                ),
              );
            },
          );

        if (
          genericAlternativeCores.length ===
          1
        ) {
          physicalGroup =
            genericAlternativeCores[0];
        }
      }

      if (!physicalGroup) {
        continue;
      }

      branches.push({
        condition: {
          componentType:
            'STREAM',

          componentName:
            streamName,
        },

        rawText:
          normalizedSubrule,

        requirementGroup:
          cloneGroup(
            physicalGroup,
            branchCreditPoints,
          ),
      });

      continue;
    }

    /*
     * Default branch.
     */
    if (
      /\bcore units?\b/i.test(
        normalizedSubrule,
      ) &&
      !/alternative core/i.test(
        normalizedSubrule,
      )
    ) {
      physicalGroup =
        findByNameAndLevel(
          physicalGroups,
          level,
          /^core(?: units?)?$/i,
        );

      if (!physicalGroup) {
        continue;
      }

      branches.push({
        condition:
          null,

        rawText:
          normalizedSubrule,

        requirementGroup:
          cloneGroup(
            physicalGroup,
            branchCreditPoints,
          ),
      });
    }
  }

  /*
   * A conditional rule requires at least:
   *
   * - one default branch
   * - one conditional branch
   */
  if (
    branches.length <
    2
  ) {
    return null;
  }

  return {
    requiredCreditPoints:
      requirement.requiredCreditPoints,

    branches,
  };
}

/**
 * Maps conditional core / alternative-core subrules.
 *
 * Example:
 * - Core
 * - Alternative core for the Animal and Veterinary Biosciences stream
 * - Alternative core for the Medical Science stream
 *
 * The exact conditional wording remains preserved in requirement.subrules.
 */
function mapAlternativeCoreSubrulePools(
  requirement: UsydFormalRequirement,
  physicalGroups: UsydRequirementGroup[],
): UsydRequirementGroup | null {
  if (
    !requirement.subrules.some(
      (subrule) =>
        /alternative core/i.test(
          subrule,
        ),
    )
  ) {
    return null;
  }

  const level = requirement.level;

  const matches = physicalGroups.filter(
    (group) => {
      if (
        level !== null &&
        group.level !== level
      ) {
        return false;
      }

      const name =
        normalizePhysicalGroupName(
          group.name,
        );

      return (
        name === 'core' ||
        name.startsWith(
          'alternative core',
        )
      );
    },
  );

  return combineGroups(
    matches,
    requirement.requiredCreditPoints,
  );
}

/**
 * Maps discipline wording that USYD expresses as a coded-unit heading.
 * Keep this small and explicit so we do not guess arbitrary code prefixes.
 */
function mapDisciplineAliasPool(
  requirement: UsydFormalRequirement,
  physicalGroups: UsydRequirementGroup[],
): UsydRequirementGroup | null {
  const text =
    requirement.rawText.toLowerCase();

  const aliases: Array<{
    requirementMatcher: RegExp;
    headingMatcher: RegExp;
  }> = [
    {
      requirementMatcher:
        /\bpharmacology units?\b/i,
      headingMatcher:
        /^pcol coded$/i,
    },
  ];

  for (const alias of aliases) {
    if (
      !alias.requirementMatcher.test(
        text,
      )
    ) {
      continue;
    }

    const matches =
      physicalGroups.filter(
        (group) =>
          alias.headingMatcher.test(
            normalizeText(
              group.name,
            ),
          ),
      );

    if (matches.length === 1) {
      return matches[0];
    }
  }

  return null;
}

/**
 * Handles a formal requirement that contains two explicit named pools
 * inside one numbered rule.
 *
 * Example:
 * 12 credit points of 1000-level units consisting of:
 * a. 6 credit points of mathematics core units of study; and
 * b. 6 credit points of computer science selective units of study.
 *
 * This must become two 6 CP groups rather than one flattened 12 CP pool.
 */
function mapEmbeddedSplitNamedPoolsRequirement(
  requirement: UsydFormalRequirement,
  physicalGroups: UsydRequirementGroup[],
): UsydRequirementGroup[] | null {
  const text = requirement.rawText;

  const clauseMatches = [
    ...text.matchAll(
      /(?:^|[;:]|\b(?:a|b)\.)\s*(\d+(?:\.\d+)?)\s+credit points\s+of\s+([^;]+?)(?=;|\band\s+b\.|$)/gi,
    ),
  ];

  if (clauseMatches.length !== 2) {
    return null;
  }

  const clauseCreditPoints =
    clauseMatches.map(
      (match) => Number(match[1]),
    );

  if (
    clauseCreditPoints.some(
      (value) => !Number.isFinite(value),
    )
  ) {
    return null;
  }

  const totalCreditPoints =
    clauseCreditPoints.reduce(
      (total, value) => total + value,
      0,
    );

  if (
    requirement.requiredCreditPoints !== null &&
    totalCreditPoints !== requirement.requiredCreditPoints
  ) {
    return null;
  }

  const mappedGroups: UsydRequirementGroup[] = [];

  for (
    let index = 0;
    index < clauseMatches.length;
    index += 1
  ) {
    const clauseText =
      clauseMatches[index][2];

    const clauseRequirement: UsydFormalRequirement = {
      ...requirement,
      rawText: clauseText,
      requiredCreditPoints:
        clauseCreditPoints[index],
      subrules: [],
      notes: [],
    };

    const mapped =
      mapNamedPhysicalGroup(
        clauseRequirement,
        physicalGroups,
      );

    if (!mapped) {
      return null;
    }

    mappedGroups.push(
      cloneGroup(
        mapped,
        clauseCreditPoints[index],
      ),
    );
  }

  return mappedGroups;
}

/**
 * USYD Medical Science publishes MEDS3888 inside the physical "Major core"
 * pool, while the formal rules separate it as a 6 CP interdisciplinary
 * project and require the remaining 18 CP as ordinary 3000-level core.
 *
 * Keep this narrowly keyed to MEDS3888 so other subject areas are not changed.
 */
function mapMedicalScienceSharedMajorCore(
  requirement: UsydFormalRequirement,
  physicalGroups: UsydRequirementGroup[],
): UsydRequirementGroup | null {
  if (requirement.level !== 3000) {
    return null;
  }

  const majorCore =
    findByNameAndLevel(
      physicalGroups,
      3000,
      /^major core$/i,
    );

  if (
    !majorCore ||
    !majorCore.units.some(
      (unit) => unit.code === 'MEDS3888',
    )
  ) {
    return null;
  }

  if (
    requirement.groupKind ===
      'INTERDISCIPLINARY_PROJECT'
  ) {
    return {
      ...majorCore,
      name: 'Core interdisciplinary project',
      logic: 'ANY',
      requiredCreditPoints:
        requirement.requiredCreditPoints,
      units: majorCore.units.filter(
        (unit) => unit.code === 'MEDS3888',
      ),
    };
  }

  if (
    requirement.groupKind === 'CORE' &&
    requirement.requiredCreditPoints === 18
  ) {
    return {
      ...majorCore,
      requiredCreditPoints: 18,
      units: majorCore.units.filter(
        (unit) => unit.code !== 'MEDS3888',
      ),
    };
  }

  return null;
}

/**
 * Maps stream-specific selective requirements to their matching physical
 * handbook pools.
 *
 * Example:
 * - formal:   "6 credit points of units from Selective - Psychology"
 * - physical: "Stream selective - Psychology"
 *
 * These rules have no level in the formal wording, so allowing the normal
 * generic SELECTIVE fallback would incorrectly select the unrelated
 * 3000-level "Selective" pool.
 */
function mapStreamSelectivePool(
  requirement: UsydFormalRequirement,
  physicalGroups: UsydRequirementGroup[],
): UsydRequirementGroup | null {
  const match = requirement.rawText.match(
    /\bunits\s+from\s+selective\s*-\s*(.+)$/i,
  );

  if (!match) {
    return null;
  }

  const selectiveName = normalizeText(
    match[1],
  )
    .replace(/[.;]+$/g, '')
    .trim();

  if (!selectiveName) {
    return null;
  }

  const expectedName =
    `stream selective - ${selectiveName}`.toLowerCase();

  return (
    physicalGroups.find(
      (group) =>
        normalizeText(
          group.name,
        ).toLowerCase() === expectedName,
    ) ?? null
  );
}

function mapFormalRequirement(
  requirement:
    UsydFormalRequirement,
  physicalGroups:
    UsydRequirementGroup[],
  componentType:
    UsydComponentType,
): UsydRequirementGroup | null {
  const level =
    requirement.level;

  const requirementText =
    requirement.rawText.toLowerCase();

  const streamSelectivePool =
    mapStreamSelectivePool(
      requirement,
      physicalGroups,
    );

  if (streamSelectivePool) {
    return streamSelectivePool;
  }

  const medicalScienceSharedMajorCore =
    mapMedicalScienceSharedMajorCore(
      requirement,
      physicalGroups,
    );

  if (medicalScienceSharedMajorCore) {
    return medicalScienceSharedMajorCore;
  }

  const disciplinaryProjectChoice =
    mapDisciplinaryProjectChoice(
      requirement,
      physicalGroups,
    );

  if (
    disciplinaryProjectChoice
  ) {
    return disciplinaryProjectChoice;
  }

  const alternativeCoreSubrules =
    mapAlternativeCoreSubrulePools(
      requirement,
      physicalGroups,
    );

  if (
    alternativeCoreSubrules
  ) {
    return alternativeCoreSubrules;
  }

  const disciplineAliasPool =
    mapDisciplineAliasPool(
      requirement,
      physicalGroups,
    );

  if (
    disciplineAliasPool
  ) {
    return disciplineAliasPool;
  }

  const namedPhysicalGroup =
    mapNamedPhysicalGroup(
      requirement,
      physicalGroups,
    );

  if (
    namedPhysicalGroup
  ) {
    return namedPhysicalGroup;
  }

  switch (
  requirement.groupKind
  ) {
    case 'CORE': {
      /*
       * Some USYD requirements define an
       * alternative core pool for students
       * in a particular stream. Preserve the
       * raw conditional subrules, while the
       * normalized group exposes both valid
       * physical pools.
       */
      if (
        requirement.subrules.some(
          (subrule) =>
            /alternative core/i.test(
              subrule,
            ),
        )
      ) {
        const core =
          findByNameAndLevel(
            physicalGroups,
            level,
            /^core(?: units?)?$/i,
          );

        const alternativeCore =
          findByNameAndLevel(
            physicalGroups,
            level,
            /^alternative core$/i,
          );

        if (
          core &&
          alternativeCore
        ) {
          return combineGroups(
            [
              core,
              alternativeCore,
            ],
            requirement.requiredCreditPoints,
          );
        }
      }

      let group:
        UsydRequirementGroup | null =
        null;

      if (
        componentType ===
        'MAJOR'
      ) {
        group =
          findByNameAndLevel(
            physicalGroups,
            level,
            /^major core$/i,
          );
      }

      if (
        componentType ===
        'MINOR' &&
        !group
      ) {
        group =
          findByNameAndLevel(
            physicalGroups,
            level,
            /^minor core$/i,
          );
      }

      group ??=
        findByNameAndLevel(
          physicalGroups,
          level,
          /^core(?: units?)?$/i,
        );

      /*
       * Some tables expose one physical "Major core" pool even though
       * the formal minor requirement calls the same units simply "core".
       * Health is the current 2026 example at both 1000 and 2000 level.
       * Prefer an explicit Minor core/Core first, then safely reuse Major core.
       */
      if (
        componentType ===
          'MINOR' &&
        !group
      ) {
        group =
          findByNameAndLevel(
            physicalGroups,
            level,
            /^major core$/i,
          );
      }

      return group;
    }

    case 'SELECTIVE': {
      let group:
        UsydRequirementGroup | null =
        null;

      /*
       * Some USYD minors split their
       * selective requirement into
       * separate depth and breadth
       * pools.
       */
      if (
        componentType ===
        'MINOR' &&
        /\bdepth\b/i.test(
          requirementText,
        )
      ) {
        group =
          findByNameAndLevel(
            physicalGroups,
            level,
            /^minor selective depth$/i,
          );

        if (
          group
        ) {
          return group;
        }
      }

      if (
        componentType ===
        'MINOR' &&
        /\bbreadth\b/i.test(
          requirementText,
        )
      ) {
        group =
          findByNameAndLevel(
            physicalGroups,
            level,
            /^minor selective breadth$/i,
          );

        if (
          group
        ) {
          return group;
        }
      }

      if (
        componentType ===
        'MINOR'
      ) {
        group =
          findByNameAndLevel(
            physicalGroups,
            level,
            /^minor selective$/i,
          );
      }

      if (
        componentType ===
        'MAJOR' &&
        !group
      ) {
        group =
          findByNameAndLevel(
            physicalGroups,
            level,
            /^major selective$/i,
          );
      }

      group ??=
        findByNameAndLevel(
          physicalGroups,
          level,
          /^selective(?: units?)?$/i,
        );

      return group;
    }

  case 'INTERDISCIPLINARY_PROJECT':
    return (
      findByNameAndLevel(
        physicalGroups,
        level,
        /^core interdisciplinary project$/i,
      ) ??
      findByNameAndLevel(
        physicalGroups,
        level,
        /^selective interdisciplinary project$/i,
      ) ??
      findByNameAndLevel(
        physicalGroups,
        level,
        /^interdisciplinary projects?$/i,
      ) ??
      findByNameAndLevel(
        physicalGroups,
        level,
        /^interdisciplinary project units?$/i,
      ) ??
      findByNameAndLevel(
        physicalGroups,
        level,
        /^interdisciplinary project selective$/i,
      )
    );

    case 'METHODOLOGY':
      return findByNameAndLevel(
        physicalGroups,
        level,
        /^methodology$/i,
      );

    case 'APPLICATION':
      return findByNameAndLevel(
        physicalGroups,
        level,
        /^application$/i,
      );

    case 'UNITS': {
      const subruleGroup =
        mapSubrulePools(
          requirement,
          physicalGroups,
        );

      if (
        subruleGroup
      ) {
        return subruleGroup;
      }

      const namedGroup =
        physicalGroups.find(
          (group) =>
            (
              level ===
              null ||
              group.level ===
              level
            ) &&
            requirement.rawText
              .toLowerCase()
              .includes(
                group.name.toLowerCase(),
              ),
        ) ?? null;

      if (
        namedGroup
      ) {
        return namedGroup;
      }

      return findByNameAndLevel(
        physicalGroups,
        level,
        /^units$/i,
      );
    }

    case 'COMBINED': {
      const matches =
        physicalGroups.filter(
          (group) =>
            (
              level ===
              null ||
              group.level ===
              level
            ) &&
            (
              /^methodology$/i.test(
                group.name,
              ) ||
              /^application$/i.test(
                group.name,
              ) ||
              /selective interdisciplinary project/i.test(
                group.name,
              )
            ),
        );

      return combineGroups(
        matches,
        requirement.requiredCreditPoints,
      );
    }

    default:
      return null;
  }
}

function normalizeComponentGroups(
  component:
    UsydComponentRequirement,
  physicalGroups:
    UsydRequirementGroup[],
): UsydRequirementGroup[] {
  const result:
    UsydRequirementGroup[] =
    [];

  for (
    const requirement
    of component.formalRequirements
  ) {
    requirement.conditionalRule =
      parseConditionalAlternativeCoreRule(
        requirement,
        physicalGroups,
      );

    const splitGroups =
      mapSplitCoreChoiceRequirement(
        requirement,
        physicalGroups,
      );

    if (splitGroups) {
      result.push(
        ...splitGroups,
      );

      continue;
    }

    const embeddedSplitGroups =
      mapEmbeddedSplitNamedPoolsRequirement(
        requirement,
        physicalGroups,
      );

    if (embeddedSplitGroups) {
      result.push(
        ...embeddedSplitGroups,
      );

      continue;
    }

    const mapped =
      mapFormalRequirement(
        requirement,
        physicalGroups,
        component.type,
      );

    if (
      !mapped
    ) {
      continue;
    }

    if (
      requirement.groupKind ===
      'COMBINED' ||
      (
        requirement.groupKind ===
        'UNITS' &&
        requirement.subrules.length >
        0
      )
    ) {
      result.push(
        mapped,
      );

      continue;
    }

    result.push(
      cloneGroup(
        mapped,
        requirement.requiredCreditPoints,
      ),
    );
  }

  /*
   * Pathology publishes two separate 6 CP formal 2000-level core
   * requirements, but both refer to the same physical Core pool.
   *
   * Preserve the total requirement as one 12 CP group so downstream
   * planner logic cannot satisfy both requirements with the same 6 CP unit.
   */
  if (
    /^pathology minor$/i.test(
      component.name,
    )
  ) {
    const pathologyCoreIndexes =
      result
        .map(
          (group, index) => ({
            group,
            index,
          }),
        )
        .filter(
          ({ group }) =>
            group.level === 2000 &&
            /^core$/i.test(
              group.name,
            ) &&
            group.requiredCreditPoints === 6,
        );

    if (
      pathologyCoreIndexes.length === 2
    ) {
      const first =
        pathologyCoreIndexes[0];

      const second =
        pathologyCoreIndexes[1];

      const sameUnits =
        first.group.units.length ===
          second.group.units.length &&
        first.group.units.every(
          (unit) =>
            second.group.units.some(
              (other) =>
                other.code === unit.code,
            ),
        );

      if (sameUnits) {
        const merged =
          cloneGroup(
            first.group,
            12,
          );

        const filteredResult =
          result.filter(
            (_, index) =>
              index !== first.index &&
              index !== second.index,
          );

        filteredResult.splice(
          first.index,
          0,
          merged,
        );

        return filteredResult;
      }
    }
  }

  return result;
}

export async function fetchUsydSubjectAreaTable(
  sourceUrl: string,
): Promise<UsydSubjectAreaTable> {
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

  const name =
    normalizeText(
      $('h1')
        .first()
        .text(),
    );

  if (
    !name
  ) {
    throw new Error(
      `Could not determine USYD subject area name from ${sourceUrl}`,
    );
  }

  const tableName =
    emptyToNull(
      $('h2')
        .filter(
          (_, element) =>
            /unit of study table/i.test(
              normalizeText(
                $(
                  element,
                ).text(),
              ),
            ),
        )
        .first()
        .text(),
    );

  const year =
    parseYear(
      $,
    );

  const components =
    parseComponents(
      $,
    );

  const unitTable =
    findUnitTable(
      $,
    );

  if (
    unitTable.length ===
    0
  ) {
    throw new Error(
      `Could not find unit-of-study table for ${name}`,
    );
  }

  const physicalGroups =
    parsePhysicalGroups(
      $,
      unitTable,
      sourceUrl,
    );

  for (
    const component
    of components
  ) {
    component.requirementGroups =
      normalizeComponentGroups(
        component,
        physicalGroups,
      );
  }

  return {
    name,
    tableName,
    year,
    components,
    sourceUrl,
  };
}