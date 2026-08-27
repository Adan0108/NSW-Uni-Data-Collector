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
 * USYD REQUISITE PARSER V6.2 AUDIT
 * ------------------------------------------------
 *
 * FINAL targeted parser version.
 *
 * HARD REQUIREMENTS
 *
 * - Units = 3011
 * - P/C/N rules = 3189
 * - Missing exact refs = 0
 * - Missing wildcard refs = 0
 * - Stray syntax = 0
 * - Synthetic failures = 0
 *
 * TEXT is allowed.
 */

const HANDBOOK_YEAR =
  2026;

const EXPECTED_UNIT_COUNT =
  3011;

const EXPECTED_RULE_COUNT =
  3189;

const V6_1_TEXT_BASELINE =
  72;

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
    'EXCEPT'
  ) {
    walkNode(
      node.base,
      callback,
    );

    walkNode(
      node.exclusions,
      callback,
    );

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
  return /^[()\[\]{},:;.]+$/.test(
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
        (
          match,
        ) =>
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
          (
            match,
          ) =>
            match[0]
              .toUpperCase(),
        )
        .filter(
          (
            value,
          ) =>
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
    'V6.2 SYNTHETIC REGRESSION',
  );

  divider();

  const tests:
    Array<{
      name: string;

      raw: string;

      required:
        string[];

      forbidden?:
        string[];
    }> =
    [
      {
        name:
          'Exact MTRX remains exact',

        raw:
          'MTRX1701 or MATH1X61',

        required:
          [
            'UNIT MTRX1701',
            'UNIT_PATTERN MATH1X61',
          ],
      },

      {
        name:
          'Direct mark over CP pattern',

        raw:
          'A mark of 65 or greater in 12 credit points of MATH2XXX units of study',

        required:
          [
            'MARK >= 65',
            'CREDIT_POINT_SELECTION 12 | OF',
            'UNIT_PATTERN MATH2XXX',
          ],

        forbidden:
          [
            'TEXT |',
          ],
      },

      {
        name:
          'Average mark over grouped CP',

        raw:
          'An average mark of 65 or above in 12 credit points from (MATH2X21 or MATH2X22 or MATH2X23 or MATH2X80)',

        required:
          [
            'MARK >= 65',
            'CREDIT_POINT_SELECTION 12 | FROM',
            'UNIT_PATTERN MATH2X21',
            'UNIT_PATTERN MATH2X22',
            'UNIT_PATTERN MATH2X23',
            'UNIT_PATTERN MATH2X80',
          ],

        forbidden:
          [
            'TEXT |',
          ],
      },

      {
        name:
          'Mark over grouped CP',

        raw:
          'A mark of 65 or above in 12 credit points from (MATH2XXX or STAT2XXX or DATA2X02)',

        required:
          [
            'MARK >= 65',
            'CREDIT_POINT_SELECTION 12 | FROM',
            'UNIT_PATTERN MATH2XXX',
            'UNIT_PATTERN STAT2XXX',
            'UNIT_PATTERN DATA2X02',
          ],

        forbidden:
          [
            'TEXT |',
          ],
      },

      {
        name:
          'Missing in typo before CP',

        raw:
          'a mark of 65 or greater 6 credit points from (MATH2X22 or MATH2X61)',

        required:
          [
            'MARK >= 65',
            'CREDIT_POINT_SELECTION 6 | FROM',
            'UNIT_PATTERN MATH2X22',
            'UNIT_PATTERN MATH2X61',
          ],

        forbidden:
          [
            'TEXT |',
          ],
      },

      {
        name:
          'MATH except',

        raw:
          '6 credit points of MATH1XXX except (MATH1XX5 or MATH1050 or MATH1111)',

        required:
          [
            'EXCEPT',
            'CREDIT_POINT_SELECTION 6 | OF',
            'UNIT_PATTERN MATH1XXX',
            'UNIT_PATTERN MATH1XX5',
            'UNIT MATH1050',
            'UNIT MATH1111',
          ],

        forbidden:
          [
            'TEXT |',
          ],
      },

      {
        name:
          'MATH2980 mark alternative propagation',

        raw:
          'MATH1961 or MATH1971 or MATH1964 or (a mark of 65 or more in MATH1061 or MATH1064)',

        required:
          [
            'UNIT MATH1961',
            'UNIT MATH1971',
            'UNIT MATH1964',
            'MARK >= 65',
            'UNIT MATH1061',
            'UNIT MATH1064',
          ],

        forbidden:
          [
            'TEXT | a mark',
          ],
      },

      /**
       * Previous V6.1 invariants.
       */
      {
        name:
          'Direct minimum BUSS',

        raw:
          'a minimum of 65% in BUSS1020',

        required:
          [
            'MARK >= 65',
            'UNIT BUSS1020',
          ],
      },

      {
        name:
          'Dalyell',

        raw:
          'must be in the Dalyell stream',

        required:
          [
            'ELIGIBILITY | must be in the Dalyell stream',
          ],
      },

      {
        name:
          'GOVT alternate CP',

        raw:
          '12 at 2000 or 3000 level credit points from Government and International Relations',

        required:
          [
            'CREDIT_POINTS 12',
            'LEVELS 2,3',
            'SCOPE Government and International Relations',
          ],
      },

      {
        name:
          'CHNS equivalent',

        raw:
          '12 credit points at 1000 level of Chinese Language units or at least a year of Modern Standard Chinese at tertiary level (or equivalent)',

        required:
          [
            'CREDIT_POINTS 12',
            'EQUIVALENT_STUDY',
          ],
      },

      {
        name:
          'Trailing punctuation',

        raw:
          '75 or above in PHYS1003.',

        required:
          [
            'MARK >= 75',
            'UNIT PHYS1003',
          ],

        forbidden:
          [
            'TEXT | .',
          ],
      },
    ];

  let failures =
    0;

  for (
    const test
    of tests
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
        (
          required,
        ) =>
          !tree.includes(
            required,
          ),
      );

    const forbidden =
      (
        test.forbidden ??
        []
      ).filter(
        (
          value,
        ) =>
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
  const codes =
    [
      'BCMB3904',

      'CPAT3901',
      'CPAT3902',

      'MATH2069',
      'MATH2980',

      'MATH3961',
      'MATH3963',
      'MATH3968',
      'MATH3969',
      'MATH3975',
      'MATH3977',
      'MATH3978',
      'MATH3979',

      'MATH4061',
      'MATH4063',
      'MATH4068',
      'MATH4069',

      'MATH4071',
      'MATH4074',
      'MATH4077',
      'MATH4078',
      'MATH4079',

      'PHSI3909',

      /**
       * Expected possible SAFE RAW FALLBACK.
       */
      'IBUS3600',
      'INFS3600',
      'MKTG3600',
      'NURS1004',
    ];

  divider();

  console.log(
    'TARGETED V6.2 REAL RULE REVIEW',
  );

  divider();

  for (
    const code
    of codes
  ) {
    const matches =
      records.filter(
        (
          record,
        ) =>
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
    'USYD REQUISITE PARSER V6.2 AUDIT',
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
          parsed.containsUnparsedText,

        unitCodes:
          parsed.unitCodes,

        unitPatterns:
          parsed.unitPatterns,
      });
    }
  }

  const textRules =
    records.filter(
      (
        record,
      ) =>
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
   * REFERENCES
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
    const expectedExact =
      extractExactUnits(
        record.rawText,
      );

    const actualExact =
      new Set(
        record.unitCodes,
      );

    const lostExact =
      expectedExact.filter(
        (
          code,
        ) =>
          !actualExact.has(
            code,
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

    const expectedPatterns =
      extractPatterns(
        record.rawText,
      );

    const actualPatterns =
      new Set(
        record.unitPatterns,
      );

    const lostPatterns =
      expectedPatterns.filter(
        (
          pattern,
        ) =>
          !actualPatterns.has(
            pattern,
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

  divider();

  console.log(
    'V6.2 COUNTS',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V6.1 TEXT baseline: ${V6_1_TEXT_BASELINE}`,
  );

  console.log(
    `V6.2 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `TEXT reduction from V6.1: ${
      V6_1_TEXT_BASELINE -
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

  printTargets(
    records,
  );

  divider();

  console.log(
    'REMAINING V6.2 TEXT RULES — FIRST 50',
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

  const syntheticFailures =
    runSyntheticRegression();

  const noRoots =
    records.filter(
      (
        record,
      ) =>
        !record.root,
    );

  const duplicateRules =
    records.length -
    new Set(
      records.map(
        (
          record,
        ) =>
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
    'FINAL REQUISITE PARSER V6.2 AUDIT',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V6.1 TEXT baseline: ${V6_1_TEXT_BASELINE}`,
  );

  console.log(
    `V6.2 TEXT rules: ${textRules.length}`,
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

    console.log(
      'NEXT: fix only the failing V6.2 regression. Do not freeze the parser.',
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    'REFERENCE/STRUCTURAL STATUS: PASS',
  );

  console.log(
    'SEMANTIC STATUS: FINAL FREEZE AUDIT REQUIRED',
  );

  console.log(
    'NEXT: update the semantic audit baseline to the actual V6.2 TEXT count, run the final freeze audit, then classify remaining TEXT as SAFE_RAW_FALLBACK or MUST_FIX.',
  );
}

main().catch(
  (
    error,
  ) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);