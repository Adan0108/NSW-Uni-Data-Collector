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
 * USYD REQUISITE PARSER V6.1 FINAL TARGET AUDIT
 * ------------------------------------------------
 *
 * V6.1 is NOT another broad parser version.
 *
 * It targets meaning-changing V6 leftovers only.
 *
 * HARD INVARIANTS
 *
 * - 3011 units
 * - 3189 P/C/N rules
 * - no missing exact refs
 * - no missing wildcard refs
 * - no syntax-only TEXT
 * - no synthetic regression failures
 *
 * We do NOT require TEXT = 0.
 */

const HANDBOOK_YEAR =
  2026;

const EXPECTED_UNIT_COUNT =
  3011;

const EXPECTED_RULE_COUNT =
  3189;

const V6_TEXT_BASELINE =
  98;

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

  containsText:
    boolean;

  unitCodes:
    string[];

  unitPatterns:
    string[];
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
    'V6.1 SYNTHETIC REGRESSION',
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
          'MTRX exact remains exact',

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
          'Direct minimum BUSS mark',

        raw:
          'a minimum of 65% in BUSS1020',

        required:
          [
            'MARK >= 65',
            'UNIT BUSS1020',
          ],

        forbidden:
          [
            'TEXT |',
          ],
      },

      {
        name:
          'ECOS nested minimum',

        raw:
          'Minimum of ((65% in ECOS2901) or (85% in ECOS2001)) and minimum of 65% in (ECOS2903 or MATH2070 or MATH2970)',

        required:
          [
            'AND',
            'MARK >= 65',
            'UNIT ECOS2901',
            'MARK >= 85',
            'UNIT ECOS2001',
            'UNIT ECOS2903',
            'UNIT MATH2070',
            'UNIT MATH2970',
          ],

        forbidden:
          [
            'SUBJECT_SCOPE | Minimum of',
          ],
      },

      {
        name:
          'Three ECOS minimum clauses',

        raw:
          'Minimum of ((65% in ECOS2901) or (85% in ECOS2001)) and minimum of ((65% in ECOS2902) or (85% in ECOS2002)) and minimum of 65% in (ECOS2903 or MATH2070 or MATH2970)',

        required:
          [
            'UNIT ECOS2901',
            'UNIT ECOS2001',
            'UNIT ECOS2902',
            'UNIT ECOS2002',
            'UNIT ECOS2903',
          ],

        forbidden:
          [
            'SUBJECT_SCOPE | Minimum of',
          ],
      },

      {
        name:
          'Dalyell membership',

        raw:
          'must be in the Dalyell stream',

        required:
          [
            'ELIGIBILITY | must be in the Dalyell stream',
          ],

        forbidden:
          [
            'TEXT |',
          ],
      },

      {
        name:
          'Alternate GOVT CP word order',

        raw:
          '12 at 2000 or 3000 level credit points from Government and International Relations',

        required:
          [
            'CREDIT_POINTS 12',
            'LEVELS 2,3',
            'SCOPE Government and International Relations',
          ],

        forbidden:
          [
            'TEXT | 12 at 2000',
          ],
      },

      {
        name:
          'GCST reversed level CP',

        raw:
          '12 1000-level credit points from Gender and Cultural Studies',

        required:
          [
            'CREDIT_POINTS 12',
            'LEVELS 1',
            'SCOPE Gender and Cultural Studies',
          ],
      },

      {
        name:
          'GEOS grouped CP',

        raw:
          '24 credit points of 1000-level units of study, including (GEOS1003 or GEOS1903) and (GEOS2114 or GEOS2914)',

        required:
          [
            'CREDIT_POINTS 24',
            'LEVELS 1',
            'UNIT GEOS1003',
            'UNIT GEOS1903',
            'UNIT GEOS2114',
            'UNIT GEOS2914',
          ],
      },

      {
        name:
          'Either Intermediate Geoscience',

        raw:
          'Either 12 credit points of Intermediate Geoscience units or ((GEOS2115 or GEOS2915) and (BIOL2018 or BIOL2918))',

        required:
          [
            'CREDIT_POINTS 12',
            'SCOPE Intermediate Geoscience units',
            'UNIT GEOS2115',
            'UNIT GEOS2915',
            'UNIT BIOL2018',
            'UNIT BIOL2918',
          ],
      },

      {
        name:
          'GEOS typo mark',

        raw:
          'A mark or 75 or above in (GEOS2X21 or AREC2005 or GOVT2228)',

        required:
          [
            'MARK >= 75',
            'UNIT_PATTERN GEOS2X21',
            'UNIT AREC2005',
            'UNIT GOVT2228',
          ],

        forbidden:
          [
            'TEXT | A mark',
          ],
      },

      {
        name:
          'HSC mark parentheses',

        raw:
          'HSC Beginners course (with a mark above 70) or GRMN1122 or GRMN1002',

        required:
          [
            'EXTERNAL_ENTRY | HSC Beginners course with a mark above 70',
            'UNIT GRMN1122',
            'UNIT GRMN1002',
          ],
      },

      {
        name:
          'Continuers external entry',

        raw:
          'FRNC2604 or French Continuers 80% or more, or IB Standard or Higher Level grade 5 or more',

        required:
          [
            'UNIT FRNC2604',
            'EXTERNAL_ENTRY | French Continuers 80% or more,',
            'EXTERNAL_ENTRY | IB Standard or higher Level grade 5 or more',
          ],
      },

      /**
       * Previous critical regressions.
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
          'CHNS2650 equivalent',

        raw:
          '12 credit points at 1000 level of Chinese Language units or at least a year of Modern Standard Chinese at tertiary level (or equivalent)',

        required:
          [
            'CREDIT_POINTS 12',
            'LEVELS 1',
            'EQUIVALENT_STUDY',
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
          item,
        ) =>
          tree.includes(
            item,
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
      'ECMT2950',

      'ECOS3901',
      'ECOS3902',
      'ECOS3903',
      'ECOS3904',

      'ENGD3001',
      'ENGD3003',

      'FRNC3001',

      'GCST2609',

      'GEOS2111',
      'GEOS2124',
      'GEOS2924',
      'GEOS3014',
      'GEOS3914',
      'GEOS3924',

      'GOVT3655',
      'GOVT3901',

      'GRMN2003',
      'GRMN3005',

      /**
       * Intentionally expected to remain raw fallback if
       * cohort semantics are not safely structured.
       */
      'IBUS3600',
      'INFS3600',
    ];

  divider();

  console.log(
    'TARGETED V6.1 REAL RULE REVIEW',
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
    'USYD REQUISITE PARSER V6.1 AUDIT',
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

  /**
   * ------------------------------------------------
   * COUNTS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'V6.1 COUNTS',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V6 TEXT baseline: ${V6_TEXT_BASELINE}`,
  );

  console.log(
    `V6.1 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `TEXT reduction from V6: ${
      V6_TEXT_BASELINE -
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
   * REMAINING TEXT SAMPLE
   * ------------------------------------------------
   */

  divider();

  console.log(
    'REMAINING V6.1 TEXT RULES — FIRST 50',
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

  /**
   * ------------------------------------------------
   * FINAL
   * ------------------------------------------------
   */

  divider();

  console.log(
    'FINAL REQUISITE PARSER V6.1 AUDIT',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V6 TEXT baseline: ${V6_TEXT_BASELINE}`,
  );

  console.log(
    `V6.1 TEXT rules: ${textRules.length}`,
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
      'NEXT: fix only the failing V6.1 regression. Do not continue to final freeze audit.',
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
    'NEXT: update final semantic audit baseline to the actual V6.1 TEXT count, classify remaining findings as MUST_FIX or SAFE_RAW_FALLBACK, then freeze the parser.',
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