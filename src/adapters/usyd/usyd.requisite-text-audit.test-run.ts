import fs from 'node:fs/promises';
import path from 'node:path';

import {
  parseUsydRequisite,
  type UsydRequisiteNode,
} from './usyd.requisite-parser';

import type {
  UsydUnit,
} from './usyd.types';

/**
 * ------------------------------------------------
 * USYD REMAINING REQUISITE TEXT AUDIT
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * Requisite parser V2 reduced rules containing generic
 * TEXT from:
 *
 * 979
 *
 * to:
 *
 * 337
 *
 * Before implementing parser V3, classify EVERY remaining
 * TEXT fragment across the 3011 successful units.
 *
 * This prevents us from fixing only the examples we happen
 * to see in console output.
 *
 * NO WEB REQUESTS.
 * NO PRISMA WRITES.
 * NO PARSER MUTATION.
 */

const HANDBOOK_YEAR =
  2026;

const UNIT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
    'usyd-units.json',
  );

/**
 * ------------------------------------------------
 * TYPES
 * ------------------------------------------------
 */

interface UnitFileShape {
  university?: string;

  handbookYear?: number;

  inventoryCount?: number;

  successfulCount?: number;

  failedCount?: number;

  units: UsydUnit[];
}

type RuleType =
  | 'PREREQUISITE'
  | 'COREQUISITE'
  | 'PROHIBITION';

type TextCategory =
  | 'MARK_CONDITION'
  | 'PASSED_UNIT'
  | 'WAM_OR_AVERAGE'
  | 'CREDIT_POINT_CONDITION'
  | 'JUNIOR_CREDIT_POINTS'
  | 'LEVEL_LIST'
  | 'HSC_CONDITION'
  | 'ELIGIBILITY'
  | 'EQUIVALENT_STUDY'
  | 'KNOWLEDGE_CONDITION'
  | 'COURSE_OR_DEGREE_CONDITION'
  | 'TABLE_REFERENCE'
  | 'SUBJECT_SCOPE'
  | 'UNIT_EXPRESSION'
  | 'OTHER';

interface TextFragmentRecord {
  unitCode: string;

  unitName: string;

  ruleType: RuleType;

  rawRule: string;

  text: string;

  category: TextCategory;
}

/**
 * ------------------------------------------------
 * HELPERS
 * ------------------------------------------------
 */

function divider():
void {
  console.log(
    '================================',
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

async function readUnitFile():
Promise<UnitFileShape> {
  const raw =
    await fs.readFile(
      UNIT_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as UnitFileShape;

  if (
    !Array.isArray(
      parsed.units,
    )
  ) {
    throw new Error(
      'USYD unit output does not contain a units array.',
    );
  }

  return parsed;
}

/**
 * ------------------------------------------------
 * TREE WALKER
 * ------------------------------------------------
 */

function collectTextAtoms(
  node:
    UsydRequisiteNode | null,
): string[] {
  if (
    !node
  ) {
    return [];
  }

  if (
    node.type ===
    'TEXT'
  ) {
    return [
      normalizeText(
        node.rawText,
      ),
    ];
  }

  if (
    node.type ===
    'LOGIC'
  ) {
    return node.children.flatMap(
      collectTextAtoms,
    );
  }

  if (
    node.type ===
    'CREDIT_POINT_SELECTION'
  ) {
    return collectTextAtoms(
      node.selection,
    );
  }

  if (
    node.type ===
    'MARK'
  ) {
    return collectTextAtoms(
      node.scope,
    );
  }

  return [];
}

/**
 * ------------------------------------------------
 * CATEGORY CLASSIFIER
 * ------------------------------------------------
 *
 * IMPORTANT:
 *
 * This classifier is diagnostic only.
 *
 * It does NOT claim these patterns have already been
 * semantically parsed correctly.
 */

function classifyText(
  rawText: string,
): TextCategory {
  const text =
    normalizeText(
      rawText,
    );

  /**
   * ------------------------------------------------
   * MARK
   * ------------------------------------------------
   *
   * Examples:
   *
   * a mark of 65 or above in ANAT2009
   * average mark of 70 or above from ...
   * mark of at least 70 from ...
   */

  if (
    /\b(?:average\s+)?mark\b/i.test(
      text,
    )
  ) {
    return 'MARK_CONDITION';
  }

  /**
   * ------------------------------------------------
   * PASSED UNIT
   * ------------------------------------------------
   *
   * Examples:
   *
   * must have passed AERO2705
   * have passed COMP2017
   */

  if (
    /\b(?:must\s+have\s+passed|have\s+passed|passed)\b/i.test(
      text,
    ) &&
    /\b[A-Z]{4}[0-9X]{4}\b/.test(
      text,
    )
  ) {
    return 'PASSED_UNIT';
  }

  /**
   * ------------------------------------------------
   * WAM / AVERAGE
   * ------------------------------------------------
   */

  if (
    /\bWAM\b/i.test(
      text,
    ) ||
    /\bannual\s+average\b/i.test(
      text,
    ) ||
    /\boverall\s+average\b/i.test(
      text,
    )
  ) {
    return 'WAM_OR_AVERAGE';
  }

  /**
   * ------------------------------------------------
   * JUNIOR CREDIT POINTS
   * ------------------------------------------------
   */

  if (
    /\bjunior\s+credit\s+points?\b/i.test(
      text,
    )
  ) {
    return 'JUNIOR_CREDIT_POINTS';
  }

  /**
   * ------------------------------------------------
   * GENERAL CREDIT POINT CONDITION
   * ------------------------------------------------
   */

  if (
    /\b\d+(?:\.\d+)?\s*(?:cp|credit\s+points?|credit\s+point)\b/i.test(
      text,
    )
  ) {
    return 'CREDIT_POINT_CONDITION';
  }

  /**
   * ------------------------------------------------
   * LEVEL ENUMERATION
   * ------------------------------------------------
   *
   * Examples:
   *
   * 2000
   * 1000 or 2000
   * 1000 or 2000 or 3000 level
   */

  if (
    /^(?:[1-9]000(?:\s*(?:or|,|\/)\s*)?)+\s*(?:level)?$/i.test(
      text,
    )
  ) {
    return 'LEVEL_LIST';
  }

  /**
   * ------------------------------------------------
   * HSC CONDITIONS
   * ------------------------------------------------
   *
   * Examples:
   *
   * HSC beginners
   * HSC continuers
   * HSC extension
   */

  if (
    /\bHSC\b/i.test(
      text,
    )
  ) {
    return 'HSC_CONDITION';
  }

  /**
   * ------------------------------------------------
   * ELIGIBILITY
   * ------------------------------------------------
   */

  if (
    /\b(?:eligible|eligibility|entry\s+to\s+this\s+unit|admission|enrolment)\b/i.test(
      text,
    )
  ) {
    return 'ELIGIBILITY';
  }

  /**
   * ------------------------------------------------
   * EQUIVALENT STUDY
   * ------------------------------------------------
   */

  if (
    /\bequivalent\s+(?:study|unit|units|qualification)\b/i.test(
      text,
    )
  ) {
    return 'EQUIVALENT_STUDY';
  }

  /**
   * ------------------------------------------------
   * KNOWLEDGE CONDITIONS
   * ------------------------------------------------
   */

  if (
    /\bknowledge\s+of\b/i.test(
      text,
    ) ||
    /\bassumed\s+knowledge\b/i.test(
      text,
    )
  ) {
    return 'KNOWLEDGE_CONDITION';
  }

  /**
   * ------------------------------------------------
   * COURSE / DEGREE CONDITIONS
   * ------------------------------------------------
   *
   * Examples:
   *
   * Bachelor of Science ...
   * Animal and Veterinary Bioscience years 1-3
   */

  if (
    /\bBachelor\b/i.test(
      text,
    ) ||
    /\bMaster\b/i.test(
      text,
    ) ||
    /\bHonours\b/i.test(
      text,
    ) ||
    /\byears?\s+[1-9](?:\s*-\s*[1-9])?\b/i.test(
      text,
    )
  ) {
    return 'COURSE_OR_DEGREE_CONDITION';
  }

  /**
   * ------------------------------------------------
   * HANDBOOK TABLE REFERENCE
   * ------------------------------------------------
   */

  if (
    /\bTable\s+[A-Z]\b/i.test(
      text,
    ) ||
    /\btable\s+of\s+units\b/i.test(
      text,
    )
  ) {
    return 'TABLE_REFERENCE';
  }

  /**
   * ------------------------------------------------
   * UNIT EXPRESSIONS
   * ------------------------------------------------
   *
   * This catches TEXT that still contains unit references.
   *
   * Examples:
   *
   * (BCMB2X01 or MEDS2003)
   *
   * These are strong candidates for parser V3.
   */

  if (
    /\b[A-Z]{4}[0-9X]{4}\b/.test(
      text,
    )
  ) {
    return 'UNIT_EXPRESSION';
  }

  /**
   * ------------------------------------------------
   * SUBJECT / DISCIPLINE SCOPE
   * ------------------------------------------------
   *
   * Examples:
   *
   * Anthropology
   * Ancient History
   * International Relations
   * Comparative Literary Studies
   *
   * We only classify reasonably simple textual fragments
   * here.
   */

  if (
    /^[A-Za-z][A-Za-z\s,&/'-]*$/.test(
      text,
    )
  ) {
    return 'SUBJECT_SCOPE';
  }

  return 'OTHER';
}

/**
 * ------------------------------------------------
 * NORMALISED PATTERN KEY
 * ------------------------------------------------
 *
 * Replace exact numbers/unit codes so structurally similar
 * fragments group together.
 */

function makePatternKey(
  value: string,
): string {
  return normalizeText(
    value,
  )
    /**
     * Unit references.
     */
    .replace(
      /\b[A-Z]{4}[0-9X]{4}\b/g,
      '<UNIT>',
    )

    /**
     * Percentages.
     */
    .replace(
      /\b\d+(?:\.\d+)?%/g,
      '<PERCENT>',
    )

    /**
     * Plain numeric values.
     */
    .replace(
      /\b\d+(?:\.\d+)?\b/g,
      '<NUMBER>',
    )

    .toLowerCase();
}

/**
 * ------------------------------------------------
 * MAIN
 * ------------------------------------------------
 */

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD REQUISITE REMAINING TEXT AUDIT',
  );

  divider();

  const file =
    await readUnitFile();

  console.log(
    `Units loaded: ${file.units.length}`,
  );

  const records:
    TextFragmentRecord[] =
    [];

  let totalRules =
    0;

  let rulesWithText =
    0;

  for (
    const unit
    of file.units
  ) {
    const rules:
      Array<{
        type:
          RuleType;

        raw:
          string | null;
      }> =
      [
        {
          type:
            'PREREQUISITE',

          raw:
            unit
              .accessConditions
              .prerequisite,
        },

        {
          type:
            'COREQUISITE',

          raw:
            unit
              .accessConditions
              .corequisite,
        },

        {
          type:
            'PROHIBITION',

          raw:
            unit
              .accessConditions
              .prohibition,
        },
      ];

    for (
      const rule
      of rules
    ) {
      if (
        !rule.raw
      ) {
        continue;
      }

      totalRules +=
        1;

      const parsed =
        parseUsydRequisite(
          rule.raw,
        );

      if (
        !parsed
      ) {
        continue;
      }

      const textAtoms =
        collectTextAtoms(
          parsed.root,
        );

      if (
        textAtoms.length >
        0
      ) {
        rulesWithText +=
          1;
      }

      for (
        const text
        of textAtoms
      ) {
        records.push({
          unitCode:
            unit.code,

          unitName:
            unit.name,

          ruleType:
            rule.type,

          rawRule:
            rule.raw,

          text,

          category:
            classifyText(
              text,
            ),
        });
      }
    }
  }

  /**
   * ------------------------------------------------
   * BASIC COUNTS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'BASIC COUNTS',
  );

  divider();

  console.log(
    `Total P/C/N rules: ${totalRules}`,
  );

  console.log(
    `Rules containing TEXT: ${rulesWithText}`,
  );

  console.log(
    `Total TEXT atoms: ${records.length}`,
  );

  /**
   * ------------------------------------------------
   * CATEGORY COUNTS
   * ------------------------------------------------
   */

  const categoryCounts =
    new Map<
      TextCategory,
      number
    >();

  const categoryRuleKeys =
    new Map<
      TextCategory,
      Set<string>
    >();

  for (
    const record
    of records
  ) {
    categoryCounts.set(
      record.category,
      (
        categoryCounts.get(
          record.category,
        ) ??
        0
      ) +
        1,
    );

    const keys =
      categoryRuleKeys.get(
        record.category,
      ) ??
      new Set<
        string
      >();

    keys.add(
      `${record.unitCode}|${record.ruleType}`,
    );

    categoryRuleKeys.set(
      record.category,
      keys,
    );
  }

  divider();

  console.log(
    'CATEGORY COUNTS',
  );

  divider();

  for (
    const [
      category,
      count,
    ]
    of [
      ...categoryCounts.entries(),
    ].sort(
      (
        left,
        right,
      ) =>
        right[
          1
        ] -
        left[
          1
        ],
    )
  ) {
    console.log(
      `${category}: ${count} atoms | ${
        categoryRuleKeys.get(
          category,
        )?.size ??
        0
      } rules`,
    );
  }

  /**
   * ------------------------------------------------
   * CATEGORY EXAMPLES
   * ------------------------------------------------
   */

  divider();

  console.log(
    'CATEGORY EXAMPLES',
  );

  divider();

  const categories =
    [
      ...new Set(
        records.map(
          (record) =>
            record.category,
        ),
      ),
    ].sort();

  for (
    const category
    of categories
  ) {
    console.log(
      `--- ${category} ---`,
    );

    const examples =
      records.filter(
        (record) =>
          record.category ===
          category,
      );

    const seen =
      new Set<
        string
      >();

    let printed =
      0;

    for (
      const example
      of examples
    ) {
      const key =
        example.text;

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

      console.log(
        `${example.unitCode} ${example.ruleType}`,
      );

      console.log(
        `TEXT: ${example.text}`,
      );

      console.log(
        `RAW: ${example.rawRule}`,
      );

      console.log('');

      printed +=
        1;

      if (
        printed >=
        8
      ) {
        break;
      }
    }
  }

  /**
   * ------------------------------------------------
   * MOST COMMON NORMALISED PATTERNS
   * ------------------------------------------------
   */

  const patternCounts =
    new Map<
      string,
      {
        count: number;

        category:
          TextCategory;

        example:
          TextFragmentRecord;
      }
    >();

  for (
    const record
    of records
  ) {
    const key =
      makePatternKey(
        record.text,
      );

    const existing =
      patternCounts.get(
        key,
      );

    if (
      existing
    ) {
      existing.count +=
        1;
    } else {
      patternCounts.set(
        key,
        {
          count:
            1,

          category:
            record.category,

          example:
            record,
        },
      );
    }
  }

  divider();

  console.log(
    'TOP NORMALISED TEXT PATTERNS',
  );

  divider();

  for (
    const [
      pattern,
      data,
    ]
    of [
      ...patternCounts.entries(),
    ]
      .sort(
        (
          left,
          right,
        ) =>
          right[
            1
          ].count -
          left[
            1
          ].count,
      )
      .slice(
        0,
        80,
      )
  ) {
    console.log(
      `${data.count}x | ${data.category}`,
    );

    console.log(
      `PATTERN: ${pattern}`,
    );

    console.log(
      `EXAMPLE: ${data.example.text}`,
    );

    console.log(
      `UNIT: ${data.example.unitCode}`,
    );

    console.log('');
  }

  /**
   * ------------------------------------------------
   * OTHER CATEGORY
   * ------------------------------------------------
   *
   * These are especially important because they did not
   * match even our diagnostic categories.
   */

  const otherRecords =
    records.filter(
      (record) =>
        record.category ===
        'OTHER',
    );

  divider();

  console.log(
    'OTHER / UNKNOWN TEXT FRAGMENTS',
  );

  divider();

  console.log(
    `OTHER atoms: ${otherRecords.length}`,
  );

  const otherSeen =
    new Set<
      string
    >();

  let otherPrinted =
    0;

  for (
    const record
    of otherRecords
  ) {
    if (
      otherSeen.has(
        record.text,
      )
    ) {
      continue;
    }

    otherSeen.add(
      record.text,
    );

    console.log(
      `${record.unitCode} — ${record.unitName}`,
    );

    console.log(
      `Type: ${record.ruleType}`,
    );

    console.log(
      `TEXT: ${record.text}`,
    );

    console.log(
      `RAW: ${record.rawRule}`,
    );

    console.log('');

    otherPrinted +=
      1;

    if (
      otherPrinted >=
      100
    ) {
      break;
    }
  }

  /**
   * ------------------------------------------------
   * HIGH-VALUE V3 CANDIDATES
   * ------------------------------------------------
   *
   * These categories have reasonably clear semantics and
   * are likely suitable for parser V3.
   */

  const highValueCategories:
    TextCategory[] =
    [
      'MARK_CONDITION',
      'PASSED_UNIT',
      'WAM_OR_AVERAGE',
      'CREDIT_POINT_CONDITION',
      'JUNIOR_CREDIT_POINTS',
      'LEVEL_LIST',
      'HSC_CONDITION',
      'ELIGIBILITY',
      'EQUIVALENT_STUDY',
      'KNOWLEDGE_CONDITION',
      'TABLE_REFERENCE',
      'UNIT_EXPRESSION',
    ];

  const highValueRules =
    new Set<
      string
    >();

  for (
    const record
    of records
  ) {
    if (
      highValueCategories.includes(
        record.category,
      )
    ) {
      highValueRules.add(
        `${record.unitCode}|${record.ruleType}`,
      );
    }
  }

  divider();

  console.log(
    'V3 OPPORTUNITY',
  );

  divider();

  console.log(
    `Rules containing TEXT now: ${rulesWithText}`,
  );

  console.log(
    `Rules with clearly classifiable V3 candidates: ${highValueRules.size}`,
  );

  console.log(
    `Rules needing broader/manual semantic handling: ${
      rulesWithText -
      highValueRules.size
    }`,
  );

  /**
   * ------------------------------------------------
   * STRUCTURAL CHECKS
   * ------------------------------------------------
   */

  const emptyTextAtoms =
    records.filter(
      (record) =>
        record.text.length ===
        0,
    );

  const invalidCategories =
    records.filter(
      (record) =>
        !record.category,
    );

  divider();

  console.log(
    'STRUCTURAL VALIDATION',
  );

  divider();

  console.log(
    `Expected P/C/N rules: 3189`,
  );

  console.log(
    `Actual P/C/N rules: ${totalRules}`,
  );

  console.log(
    `Expected rules with TEXT from V2: 337`,
  );

  console.log(
    `Actual rules with TEXT: ${rulesWithText}`,
  );

  console.log(
    `Empty TEXT atoms: ${emptyTextAtoms.length}`,
  );

  console.log(
    `Unclassified records: ${invalidCategories.length}`,
  );

  const hardFailure =
    file.units.length !==
      3011 ||
    totalRules !==
      3189 ||
    rulesWithText !==
      337 ||
    emptyTextAtoms.length >
      0 ||
    invalidCategories.length >
      0;

  divider();

  console.log(
    'FINAL REMAINING TEXT AUDIT',
  );

  divider();

  console.log(
    `Units: ${file.units.length}`,
  );

  console.log(
    `P/C/N rules: ${totalRules}`,
  );

  console.log(
    `Rules requiring semantic review: ${rulesWithText}`,
  );

  console.log(
    `TEXT atoms requiring classification: ${records.length}`,
  );

  console.log(
    `OTHER atoms: ${otherRecords.length}`,
  );

  console.log('');

  console.log(
    `RESULT: ${
      hardFailure
        ? 'FAIL'
        : 'PASS'
    }`,
  );

  if (
    hardFailure
  ) {
    console.log(
      'TEXT AUDIT STRUCTURE: FAIL',
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    'TEXT AUDIT STRUCTURE: CLEAN',
  );

  console.log(
    'NEXT: implement requisite parser V3 using category counts and common patterns.',
  );
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);