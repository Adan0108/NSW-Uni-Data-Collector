import fs from 'node:fs/promises';
import path from 'node:path';

import {
  formatUsydRequisiteTree,
  parseUsydRequisite,
  type UsydRequisiteNode,
} from './usyd.requisite-parser';

import type {
  UsydUnit,
} from './usyd.types';

/**
 * ------------------------------------------------
 * USYD REQUISITE PARSER V6 AUDIT
 * ------------------------------------------------
 *
 * V6 is the final major semantic grammar pass.
 *
 * Hard invariants:
 *
 * - units = 3011
 * - rules = 3189
 * - exact refs lost = 0
 * - wildcard refs lost = 0
 * - stray syntax = 0
 * - synthetic regression failures = 0
 */

const HANDBOOK_YEAR =
  2026;

const EXPECTED_UNIT_COUNT =
  3011;

const EXPECTED_RULE_COUNT =
  3189;

const V5_1_TEXT_BASELINE =
  151;

const UNIT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(HANDBOOK_YEAR),
    'usyd-units.json',
  );

interface UnitFileShape {
  units: UsydUnit[];
}

type RuleType =
  | 'PREREQUISITE'
  | 'COREQUISITE'
  | 'PROHIBITION';

interface RuleRecord {
  code: string;

  name: string;

  ruleType: RuleType;

  rawText: string;

  root:
    UsydRequisiteNode | null;

  tree: string;

  containsText: boolean;

  unitCodes: string[];

  unitPatterns: string[];
}

function divider():
void {
  console.log(
    '================================',
  );
}

async function readUnits():
Promise<UsydUnit[]> {
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
      'USYD unit file does not contain units.',
    );
  }

  return parsed.units;
}

function walkNode(
  node:
    UsydRequisiteNode | null,
  callback:
    (
      node:
        UsydRequisiteNode,
    ) => void,
): void {
  if (
    !node
  ) {
    return;
  }

  callback(
    node,
  );

  if (
    node.type ===
    'LOGIC'
  ) {
    for (
      const child
      of node.children
    ) {
      walkNode(
        child,
        callback,
      );
    }

    return;
  }

  if (
    node.type ===
      'MARK' ||
    node.type ===
      'GRADE'
  ) {
    walkNode(
      node.scope,
      callback,
    );

    return;
  }

  if (
    node.type ===
    'CREDIT_POINT_SELECTION'
  ) {
    walkNode(
      node.selection,
      callback,
    );
  }
}

function isSyntaxOnlyText(
  value: string,
): boolean {
  return /^[()\[\]{},:;]+$/.test(
    value.trim(),
  );
}

function extractExactUnits(
  rawText: string,
): string[] {
  return [
    ...new Set(
      [
        ...rawText.matchAll(
          /\b[A-Z]{4}\d{4}\b/g,
        ),
      ].map(
        (match) =>
          match[0],
      ),
    ),
  ].sort();
}

function extractPatterns(
  rawText: string,
): string[] {
  return [
    ...new Set(
      [
        ...rawText.matchAll(
          /\b[A-Z]{4}[0-9X]{3,4}\b/g,
        ),
      ]
        .map(
          (match) =>
            match[0]
              .toUpperCase(),
        )
        .filter(
          (value) =>
            value
              .slice(
                4,
              )
              .includes(
                'X',
              ),
        ),
    ),
  ].sort();
}

/**
 * ------------------------------------------------
 * SYNTHETIC REGRESSION
 * ------------------------------------------------
 */

function runSyntheticRegression():
number {
  divider();

  console.log(
    'V6 SYNTHETIC REGRESSION',
  );

  divider();

  const cases:
    Array<{
      name: string;

      raw: string;

      required:
        string[];

      forbidden?:
        string[];
    }> =
    [
      /**
       * CRITICAL:
       * Exact MTRX must NOT become wildcard.
       */
      {
        name:
          'Exact MTRX + wildcard MATH',

        raw:
          'MTRX1701 or MATH1X61',

        required:
          [
            'UNIT MTRX1701',
            'UNIT_PATTERN MATH1X61',
          ],
      },

      /**
       * Multi-level.
       */
      {
        name:
          '1000-3000 level selection',

        raw:
          '12 credit points at 1000 or 2000 or 3000 level from Germanic Studies',

        required:
          [
            'CREDIT_POINTS 12',
            'LEVELS 1,2,3',
            'SCOPE Germanic Studies',
          ],

        forbidden:
          [
            'TEXT | 2000',
          ],
      },

      {
        name:
          '2000 or 3000 Government',

        raw:
          '12 credit points at 2000 or 3000 level from Government and International Relations',

        required:
          [
            'CREDIT_POINTS 12',
            'LEVELS 2,3',
            'SCOPE Government and International Relations',
          ],
      },

      /**
       * Subject names containing AND.
       */
      {
        name:
          'Arabic Language and Cultures',

        raw:
          '12 credit points at 1000 level in Arabic Language and Cultures',

        required:
          [
            'CREDIT_POINTS 12',
            'LEVELS 1',
            'SCOPE Arabic Language and Cultures',
          ],

        forbidden:
          [
            'TEXT | Cultures',
          ],
      },

      {
        name:
          'International Comparative Literary Studies',

        raw:
          '12 credit points at 1000 level in International and Comparative Literary Studies',

        required:
          [
            'CREDIT_POINTS 12',
            'SCOPE International and Comparative Literary Studies',
          ],
      },

      /**
       * CP grouped scope.
       */
      {
        name:
          'Grouped subject selection',

        raw:
          '6 credit points at 2000 level from (History or Archaeology or Philosophy or Ancient Greek or Latin)',

        required:
          [
            'CREDIT_POINT_SELECTION 6 | FROM',
            'SUBJECT_SCOPE | History',
            'SUBJECT_SCOPE | Archaeology',
            'SUBJECT_SCOPE | Philosophy',
            'SUBJECT_SCOPE | Ancient Greek',
            'SUBJECT_SCOPE | Latin',
          ],
      },

      /**
       * Equivalent study.
       */
      {
        name:
          'CHNS2650 equivalent study',

        raw:
          '12 credit points at 1000 level of Chinese Language units or at least a year of Modern Standard Chinese at tertiary level (or equivalent)',

        required:
          [
            'CREDIT_POINTS 12',
            'LEVELS 1',
            'EQUIVALENT_STUDY',
          ],
      },

      /**
       * Previous V5.1 regressions.
       */
      {
        name:
          'CP wildcard',

        raw:
          '6 credit points from BCMB2X02',

        required:
          [
            'CREDIT_POINT_SELECTION 6 | FROM',
            'UNIT_PATTERN BCMB2X02',
          ],
      },

      {
        name:
          'Nested unit selection',

        raw:
          '12 credit points from (BIOL2XXX or IMMU2X11 or GEGE2X01)',

        required:
          [
            'CREDIT_POINT_SELECTION 12 | FROM',
            'UNIT_PATTERN BIOL2XXX',
            'UNIT_PATTERN IMMU2X11',
            'UNIT_PATTERN GEGE2X01',
          ],
      },

      {
        name:
          'Grouped marks',

        raw:
          '(65% in ECOS2901) or (85% in ECOS2001)',

        required:
          [
            'MARK >= 65',
            'UNIT ECOS2901',
            'MARK >= 85',
            'UNIT ECOS2001',
          ],
      },

      {
        name:
          'Distinction',

        raw:
          'Distinction in CHNS3602',

        required:
          [
            'GRADE >= DISTINCTION',
            'UNIT CHNS3602',
          ],
      },

      {
        name:
          'Credit or greater',

        raw:
          'Credit or greater in (GEOS2124 or GEOS2924)',

        required:
          [
            'GRADE >= CREDIT',
            'UNIT GEOS2124',
            'UNIT GEOS2924',
          ],
      },
    ];

  let failures =
    0;

  for (
    const test
    of cases
  ) {
    const parsed =
      parseUsydRequisite(
        test.raw,
      );

    const tree =
      formatUsydRequisiteTree(
        parsed?.root ??
          null,
      );

    const missing =
      test.required.filter(
        (value) =>
          !tree.includes(
            value,
          ),
      );

    const forbidden =
      (
        test.forbidden ??
        []
      ).filter(
        (value) =>
          tree.includes(
            value,
          ),
      );

    if (
      missing.length >
        0 ||
      forbidden.length >
        0
    ) {
      failures +=
        1;

      console.log(
        `FAIL: ${test.name}`,
      );

      console.log(
        `Raw: ${test.raw}`,
      );

      if (
        missing.length >
        0
      ) {
        console.log(
          `Missing: ${missing.join(', ')}`,
        );
      }

      if (
        forbidden.length >
        0
      ) {
        console.log(
          `Forbidden: ${forbidden.join(', ')}`,
        );
      }

      console.log(
        tree,
      );

      console.log('');

      continue;
    }

    console.log(
      `PASS: ${test.name}`,
    );
  }

  console.log('');

  console.log(
    `Synthetic failures: ${failures}`,
  );

  return failures;
}

/**
 * ------------------------------------------------
 * TARGETED REAL RULES
 * ------------------------------------------------
 */

function printTargets(
  records:
    RuleRecord[],
): void {
  const targetCodes =
    [
      'CHNS2650',
      'ARBC2211',
      'ARBC3691',
      'ASNS2666',
      'CHNS3633',
      'GRMN2633',
      'GRMN2642',
      'GOVT3641',
      'GOVT3651',
      'GOVT3664',
      'GOVT3901',
      'ANHS3635',
      'ANHS3636',
      'ARCO2101',
      'ARCO2106',
      'ASNS2011',
      'ASNS3111',
      'EUST2020',
      'EUST2601',
      'EUST3006',
      'GEOS3908',
    ];

  divider();

  console.log(
    'TARGETED REAL V6 RULES',
  );

  divider();

  for (
    const code
    of targetCodes
  ) {
    const matches =
      records.filter(
        (record) =>
          record.code ===
          code,
      );

    for (
      const record
      of matches
    ) {
      console.log(
        `${record.code} — ${record.name}`,
      );

      console.log(
        `Type: ${record.ruleType}`,
      );

      console.log(
        `Raw: ${record.rawText}`,
      );

      console.log(
        record.tree,
      );

      console.log('');
    }
  }
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
    'USYD REQUISITE PARSER V6 AUDIT',
  );

  divider();

  const units =
    await readUnits();

  const records:
    RuleRecord[] =
    [];

  for (
    const unit
    of units
  ) {
    const rules:
      Array<{
        ruleType:
          RuleType;

        rawText:
          string | null;
      }> =
      [
        {
          ruleType:
            'PREREQUISITE',

          rawText:
            unit
              .accessConditions
              .prerequisite,
        },

        {
          ruleType:
            'COREQUISITE',

          rawText:
            unit
              .accessConditions
              .corequisite,
        },

        {
          ruleType:
            'PROHIBITION',

          rawText:
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
        !rule.rawText
      ) {
        continue;
      }

      const parsed =
        parseUsydRequisite(
          rule.rawText,
        );

      if (
        !parsed
      ) {
        continue;
      }

      records.push({
        code:
          unit.code,

        name:
          unit.name,

        ruleType:
          rule.ruleType,

        rawText:
          rule.rawText,

        root:
          parsed.root,

        tree:
          formatUsydRequisiteTree(
            parsed.root,
            '  ',
          ),

        containsText:
          parsed
            .containsUnparsedText,

        unitCodes:
          parsed.unitCodes,

        unitPatterns:
          parsed.unitPatterns,
      });
    }
  }

  const textRules =
    records.filter(
      (record) =>
        record.containsText,
    );

  /**
   * ------------------------------------------------
   * STRAY SYNTAX
   * ------------------------------------------------
   */

  let straySyntax =
    0;

  for (
    const record
    of records
  ) {
    walkNode(
      record.root,
      (
        node,
      ) => {
        if (
          node.type ===
            'TEXT' &&
          isSyntaxOnlyText(
            node.rawText,
          )
        ) {
          straySyntax +=
            1;
        }
      },
    );
  }

  /**
   * ------------------------------------------------
   * REFERENCE PRESERVATION
   * ------------------------------------------------
   */

  const missingExact:
    string[] =
    [];

  const missingPatterns:
    string[] =
    [];

  for (
    const record
    of records
  ) {
    const rawExact =
      extractExactUnits(
        record.rawText,
      );

    const parsedExact =
      new Set(
        record.unitCodes,
      );

    const lostExact =
      rawExact.filter(
        (value) =>
          !parsedExact.has(
            value,
          ),
      );

    if (
      lostExact.length >
      0
    ) {
      missingExact.push(
        `${record.code} ${record.ruleType}: ${lostExact.join(', ')}`,
      );
    }

    const rawPatterns =
      extractPatterns(
        record.rawText,
      );

    const parsedPatterns =
      new Set(
        record.unitPatterns,
      );

    const lostPatterns =
      rawPatterns.filter(
        (value) =>
          !parsedPatterns.has(
            value,
          ),
      );

    if (
      lostPatterns.length >
      0
    ) {
      missingPatterns.push(
        `${record.code} ${record.ruleType}: ${lostPatterns.join(', ')}`,
      );
    }
  }

  /**
   * ------------------------------------------------
   * COUNTS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'V6 COUNTS',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V5.1 TEXT baseline: ${V5_1_TEXT_BASELINE}`,
  );

  console.log(
    `V6 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `TEXT reduction: ${
      V5_1_TEXT_BASELINE -
      textRules.length
    }`,
  );

  console.log(
    `STRAY_SYNTAX_TEXT: ${straySyntax}`,
  );

  console.log(
    `Missing exact references: ${missingExact.length}`,
  );

  console.log(
    `Missing wildcard references: ${missingPatterns.length}`,
  );

  /**
   * ------------------------------------------------
   * REAL TARGETS
   * ------------------------------------------------
   */

  printTargets(
    records,
  );

  /**
   * ------------------------------------------------
   * REMAINING TEXT
   * ------------------------------------------------
   */

  divider();

  console.log(
    'REMAINING V6 TEXT RULES — FIRST 50',
  );

  divider();

  for (
    const record
    of textRules.slice(
      0,
      50,
    )
  ) {
    console.log(
      `${record.code} — ${record.name}`,
    );

    console.log(
      `Type: ${record.ruleType}`,
    );

    console.log(
      `Raw: ${record.rawText}`,
    );

    console.log(
      record.tree,
    );

    console.log('');
  }

  /**
   * ------------------------------------------------
   * SYNTHETIC
   * ------------------------------------------------
   */

  const syntheticFailures =
    runSyntheticRegression();

  /**
   * ------------------------------------------------
   * STRUCTURAL
   * ------------------------------------------------
   */

  const noRoots =
    records.filter(
      (record) =>
        !record.root,
    );

  const duplicateRules =
    records.length -
    new Set(
      records.map(
        (record) =>
          `${record.code}|${record.ruleType}`,
      ),
    ).size;

  divider();

  console.log(
    'STRUCTURAL VALIDATION',
  );

  divider();

  console.log(
    `Expected units: ${EXPECTED_UNIT_COUNT}`,
  );

  console.log(
    `Actual units: ${units.length}`,
  );

  console.log(
    `Expected P/C/N rules: ${EXPECTED_RULE_COUNT}`,
  );

  console.log(
    `Actual P/C/N rules: ${records.length}`,
  );

  console.log(
    `Rules without root: ${noRoots.length}`,
  );

  console.log(
    `Duplicate code/type records: ${duplicateRules}`,
  );

  console.log(
    `Synthetic failures: ${syntheticFailures}`,
  );

  console.log(
    `STRAY_SYNTAX_TEXT: ${straySyntax}`,
  );

  console.log(
    `Missing exact references: ${missingExact.length}`,
  );

  console.log(
    `Missing wildcard references: ${missingPatterns.length}`,
  );

  const hardFailure =
    units.length !==
      EXPECTED_UNIT_COUNT ||
    records.length !==
      EXPECTED_RULE_COUNT ||
    noRoots.length >
      0 ||
    duplicateRules >
      0 ||
    syntheticFailures >
      0 ||
    straySyntax >
      0 ||
    missingExact.length >
      0 ||
    missingPatterns.length >
      0;

  divider();

  console.log(
    'FINAL REQUISITE PARSER V6 AUDIT',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V5.1 TEXT baseline: ${V5_1_TEXT_BASELINE}`,
  );

  console.log(
    `V6 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `STRAY_SYNTAX_TEXT: ${straySyntax}`,
  );

  console.log(
    `Missing exact references: ${missingExact.length}`,
  );

  console.log(
    `Missing wildcard references: ${missingPatterns.length}`,
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
      'REFERENCE/STRUCTURAL STATUS: FAIL',
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    'REFERENCE/STRUCTURAL STATUS: PASS',
  );

  console.log(
    'SEMANTIC STATUS: FINAL AUDIT REQUIRED',
  );

  console.log(
    'NEXT: update semantic invariant baseline to actual V6 TEXT count and run the final semantic audit.',
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