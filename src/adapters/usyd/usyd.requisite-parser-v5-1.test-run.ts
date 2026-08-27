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
 * USYD REQUISITE PARSER V5.1 AUDIT
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * V5.1 is a cleanup pass.
 *
 * It should:
 *
 * - preserve all V5 parsing behaviour
 * - remove syntax-only TEXT residue
 * - preserve every exact unit reference
 * - preserve every wildcard unit reference
 *
 * Most important new invariant:
 *
 * STRAY_SYNTAX_TEXT = 0
 */

const HANDBOOK_YEAR =
  2026;

const EXPECTED_UNITS =
  3011;

const EXPECTED_RULES =
  3189;

const V5_TEXT_BASELINE =
  156;

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

interface StraySyntaxRecord {
  code: string;

  ruleType: RuleType;

  rawText: string;

  textAtom: string;

  tree: string;
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
      'USYD unit output does not contain units.',
    );
  }

  return parsed.units;
}

function isSyntaxOnlyText(
  value: string,
): boolean {
  const normalized =
    value.trim();

  if (
    !normalized
  ) {
    return true;
  }

  return /^[()\[\]{},:;]+$/.test(
    normalized,
  );
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

function extractExactUnits(
  value: string,
): string[] {
  return [
    ...new Set(
      [
        ...value.matchAll(
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
  value: string,
): string[] {
  return [
    ...new Set(
      [
        ...value.matchAll(
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
    'V5.1 SYNTHETIC REGRESSION',
  );

  divider();

  const cases:
    Array<{
      raw: string;

      expected:
        string[];

      forbidden?:
        string[];
    }> =
    [
      {
        raw:
          '6 credit points from BCMB2X02',

        expected:
          [
            'CREDIT_POINT_SELECTION 6 | FROM',
            'UNIT_PATTERN BCMB2X02',
          ],
      },

      {
        raw:
          '6 credit points of CHEM2XXX',

        expected:
          [
            'CREDIT_POINT_SELECTION 6 | OF',
            'UNIT_PATTERN CHEM2XXX',
          ],
      },

      {
        raw:
          '12 credit points from (BIOL2XXX or IMMU2X11 or GEGE2X01)',

        expected:
          [
            'CREDIT_POINT_SELECTION 12 | FROM',
            'UNIT_PATTERN BIOL2XXX',
            'UNIT_PATTERN IMMU2X11',
            'UNIT_PATTERN GEGE2X01',
          ],

        forbidden:
          [
            'TEXT | )',
          ],
      },

      {
        raw:
          'Completion of 96 credit points including 6 credit points from (BCMB2X01 or MEDS2003) and 6 credit points from BCMB2X02',

        expected:
          [
            'CREDIT_POINTS 96',
            'UNIT_PATTERN BCMB2X01',
            'UNIT MEDS2003',
            'CREDIT_POINT_SELECTION 6 | FROM',
            'UNIT_PATTERN BCMB2X02',
          ],

        forbidden:
          [
            'TEXT | )',
            'TEXT | (',
          ],
      },

      {
        raw:
          'Minimum of 65% in (ECOS2903 or MATH2070 or MATH2970)',

        expected:
          [
            'MARK >= 65',
            'UNIT ECOS2903',
            'UNIT MATH2070',
            'UNIT MATH2970',
          ],

        forbidden:
          [
            'TEXT | )',
          ],
      },

      {
        raw:
          '(65% in ECOS2901) or (85% in ECOS2001)',

        expected:
          [
            'MARK >= 65',
            'UNIT ECOS2901',
            'MARK >= 85',
            'UNIT ECOS2001',
          ],

        forbidden:
          [
            'TEXT | )',
          ],
      },

      {
        raw:
          '24 credit points of 1000-level units of study, including (GEOS1003 or GEOS1903) and (GEOS2114 or GEOS2914)',

        expected:
          [
            'CREDIT_POINTS 24',
            'UNIT GEOS1003',
            'UNIT GEOS1903',
            'UNIT GEOS2114',
            'UNIT GEOS2914',
          ],

        forbidden:
          [
            'TEXT | )',
          ],
      },

      {
        raw:
          'an additional 6 credit points of CHEM2XXX',

        expected:
          [
            'CREDIT_POINT_SELECTION 6 | OF',
            'UNIT_PATTERN CHEM2XXX',
          ],
      },

      {
        raw:
          'Distinction in CHNS3602',

        expected:
          [
            'GRADE >= DISTINCTION',
            'UNIT CHNS3602',
          ],
      },

      {
        raw:
          '75 or above in CHEM1011',

        expected:
          [
            'MARK >= 75',
            'UNIT CHEM1011',
          ],
      },

      {
        raw:
          'A WAM of 70',

        expected:
          [
            'WAM >= 70',
          ],
      },

      {
        raw:
          'AMME2000 and [AMME2200 or (AMME2261 and AMME2262)]',

        expected:
          [
            'UNIT AMME2000',
            'UNIT AMME2200',
            'UNIT AMME2261',
            'UNIT AMME2262',
          ],

        forbidden:
          [
            'TEXT | )',
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
      test.expected.filter(
        (expected) =>
          !tree.includes(
            expected,
          ),
      );

    const forbiddenFound =
      (
        test.forbidden ??
        []
      ).filter(
        (forbidden) =>
          tree.includes(
            forbidden,
          ),
      );

    if (
      missing.length >
        0 ||
      forbiddenFound.length >
        0
    ) {
      failures +=
        1;

      console.log(
        `FAIL: ${test.raw}`,
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
        forbiddenFound.length >
        0
      ) {
        console.log(
          `Forbidden: ${forbiddenFound.join(', ')}`,
        );
      }

      console.log(
        tree,
      );

      console.log('');

      continue;
    }

    console.log(
      `PASS: ${test.raw}`,
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
  const targets =
    [
      'AERO3760',
      'AMED3002',
      'ANHS2605',
      'ANSC3888',
      'ANSC4100',
      'BCMB3888',
      'ECOS3901',
      'ECOS3902',
      'ECOS3903',
      'ECOS3904',
      'GEOS2124',
      'GEOS2924',
      'GRMN2003',
      'GRMN3005',
      'ICLS2626',
      'INFS3600',
    ];

  divider();

  console.log(
    'TARGETED REAL V5.1 AUDIT',
  );

  divider();

  for (
    const code
    of targets
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
    'USYD REQUISITE PARSER V5.1 AUDIT',
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

  /**
   * ------------------------------------------------
   * TEXT COUNT
   * ------------------------------------------------
   */

  const textRules =
    records.filter(
      (record) =>
        record.containsText,
    );

  divider();

  console.log(
    'RULE COUNTS',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V5 TEXT baseline: ${V5_TEXT_BASELINE}`,
  );

  console.log(
    `V5.1 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `Difference from V5: ${
      V5_TEXT_BASELINE -
      textRules.length
    }`,
  );

  /**
   * ------------------------------------------------
   * STRAY SYNTAX AUDIT
   * ------------------------------------------------
   */

  const straySyntax:
    StraySyntaxRecord[] =
    [];

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
          node.type !==
          'TEXT'
        ) {
          return;
        }

        if (
          !isSyntaxOnlyText(
            node.rawText,
          )
        ) {
          return;
        }

        straySyntax.push({
          code:
            record.code,

          ruleType:
            record.ruleType,

          rawText:
            record.rawText,

          textAtom:
            node.rawText,

          tree:
            record.tree,
        });
      },
    );
  }

  divider();

  console.log(
    'STRAY SYNTAX TEXT',
  );

  divider();

  console.log(
    `STRAY_SYNTAX_TEXT: ${straySyntax.length}`,
  );

  if (
    straySyntax.length >
    0
  ) {
    console.log('');

    for (
      const item
      of straySyntax.slice(
        0,
        30,
      )
    ) {
      console.log(
        `${item.code} ${item.ruleType}`,
      );

      console.log(
        `TEXT: "${item.textAtom}"`,
      );

      console.log(
        `Raw: ${item.rawText}`,
      );

      console.log(
        item.tree,
      );

      console.log('');
    }
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
        (code) =>
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
        (pattern) =>
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
    'REFERENCE PRESERVATION',
  );

  divider();

  console.log(
    `Missing exact references: ${missingExact.length}`,
  );

  console.log(
    `Missing wildcard references: ${missingPatterns.length}`,
  );

  /**
   * ------------------------------------------------
   * TARGETS
   * ------------------------------------------------
   */

  printTargets(
    records,
  );

  /**
   * ------------------------------------------------
   * REMAINING TEXT SAMPLES
   * ------------------------------------------------
   */

  divider();

  console.log(
    'REMAINING V5.1 TEXT RULE SAMPLES',
  );

  divider();

  for (
    const record
    of textRules.slice(
      0,
      60,
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
   * SYNTHETIC REGRESSION
   * ------------------------------------------------
   */

  const syntheticFailures =
    runSyntheticRegression();

  /**
   * ------------------------------------------------
   * STRUCTURAL VALIDATION
   * ------------------------------------------------
   */

  const noRoots =
    records.filter(
      (record) =>
        !record.root,
    );

  const duplicateCodeTypes =
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
    `Expected units: ${EXPECTED_UNITS}`,
  );

  console.log(
    `Actual units: ${units.length}`,
  );

  console.log(
    `Expected P/C/N rules: ${EXPECTED_RULES}`,
  );

  console.log(
    `Actual P/C/N rules: ${records.length}`,
  );

  console.log(
    `Rules without root: ${noRoots.length}`,
  );

  console.log(
    `Duplicate code/type records: ${duplicateCodeTypes}`,
  );

  console.log(
    `Synthetic failures: ${syntheticFailures}`,
  );

  console.log(
    `STRAY_SYNTAX_TEXT: ${straySyntax.length}`,
  );

  console.log(
    `Missing exact references: ${missingExact.length}`,
  );

  console.log(
    `Missing wildcard references: ${missingPatterns.length}`,
  );

  /**
   * ------------------------------------------------
   * HARD FAILURE
   * ------------------------------------------------
   */

  const hardFailure =
    units.length !==
      EXPECTED_UNITS ||
    records.length !==
      EXPECTED_RULES ||
    noRoots.length >
      0 ||
    duplicateCodeTypes >
      0 ||
    syntheticFailures >
      0 ||
    straySyntax.length >
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
    'FINAL REQUISITE PARSER V5.1 AUDIT',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V5 TEXT baseline: ${V5_TEXT_BASELINE}`,
  );

  console.log(
    `V5.1 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `STRAY_SYNTAX_TEXT: ${straySyntax.length}`,
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

  if (
    textRules.length >
    0
  ) {
    console.log(
      'SEMANTIC STATUS: REVIEW REQUIRED',
    );

    console.log(
      'NEXT: update semantic invariant baseline to V5.1 and rerun semantic audit.',
    );

    return;
  }

  console.log(
    'SEMANTIC STATUS: TEXT CLEAN',
  );

  console.log(
    'NEXT: run semantic invariant audit before Prisma mapping.',
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