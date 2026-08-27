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
      'USYD unit output does not contain units.',
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

function countNodeTypes(
  records:
    RuleRecord[],
): Map<string, number> {
  const counts =
    new Map<
      string,
      number
    >();

  for (
    const record
    of records
  ) {
    walkNode(
      record.root,
      (
        node,
      ) => {
        counts.set(
          node.type,
          (
            counts.get(
              node.type,
            ) ??
            0
          ) +
            1,
        );
      },
    );
  }

  return counts;
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
          match[
            0
          ],
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
            match[
              0
            ].toUpperCase(),
        )
        .filter(
          (value) =>
            value.includes(
              'X',
            ),
        ),
    ),
  ].sort();
}

/**
 * ------------------------------------------------
 * V4 REGRESSION CASES
 * ------------------------------------------------
 */

function runSyntheticRegression():
number {
  divider();

  console.log(
    'V4 SYNTHETIC REGRESSION',
  );

  divider();

  const cases:
    Array<{
      raw: string;

      expected:
        string[];
    }> =
    [
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
          'Distinction level results in COMP2123',

        expected:
          [
            'GRADE >= DISTINCTION',
            'UNIT COMP2123',
          ],
      },

      {
        raw:
          'Distinction result in ENGG1810',

        expected:
          [
            'GRADE >= DISTINCTION',
            'UNIT ENGG1810',
          ],
      },

      {
        raw:
          'Distinction level results in (INFO1110 or INFO1910 or ENGG1810)',

        expected:
          [
            'GRADE >= DISTINCTION',
            'UNIT INFO1110',
            'UNIT INFO1910',
            'UNIT ENGG1810',
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
          '75% or above in DATA1002',

        expected:
          [
            'MARK >= 75',
            'UNIT DATA1002',
          ],
      },

      {
        raw:
          'CHNS2602 with a mark of 75% Distinction or above',

        expected:
          [
            'MARK >= 75',
            'UNIT CHNS2602',
          ],
      },

      {
        raw:
          'HSC Chinese and Literature',

        expected:
          [
            'EXTERNAL_ENTRY | HSC Chinese and Literature',
          ],
      },

      {
        raw:
          'Chinese native speakers',

        expected:
          [
            'EXTERNAL_ENTRY',
          ],
      },

      {
        raw:
          'Chinese background speakers',

        expected:
          [
            'EXTERNAL_ENTRY',
          ],
      },

      {
        raw:
          'equivalent',

        expected:
          [
            'EQUIVALENT_STUDY',
          ],
      },

      {
        raw:
          'A WAM of 70 and an average mark of 70 or above from 12 credit points from (ANAT2008 or ANAT2X10)',

        expected:
          [
            'WAM >= 70',
            'MARK >= 70',
            'UNIT ANAT2008',
            'UNIT_PATTERN ANAT2X10',
          ],
      },

      /**
       * Existing regression.
       */
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

    if (
      missing.length >
      0
    ) {
      failures +=
        1;

      console.log(
        `FAIL: ${test.raw}`,
      );

      console.log(
        `Missing: ${missing.join(', ')}`,
      );

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
 * REAL TARGETS
 * ------------------------------------------------
 */

function printTargets(
  records:
    RuleRecord[],
): void {
  const targets =
    [
      'ANAT3904',
      'BCMB2901',
      'CHEM1112',
      'CHEM1912',
      'CHNS1101',
      'CHNS2602',
      'CHNS3603',
      'CHNS3605',
      'CHNS3606',
      'CHNS3608',
      'COMP2823',
      'COMP2922',
      'COMP3608',
      'COMP3927',
      'COMP3988',
      'COMP4328',
      'DATA2901',
      'ECMT2950',
      'PHYS2911',
    ];

  divider();

  console.log(
    'TARGETED REAL V4 AUDIT',
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
        formatUsydRequisiteTree(
          record.root,
          '  ',
        ),
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
    'USYD REQUISITE PARSER V4 AUDIT',
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

        containsText:
          parsed.containsUnparsedText,

        unitCodes:
          parsed.unitCodes,

        unitPatterns:
          parsed.unitPatterns,
      });
    }
  }

  /**
   * ------------------------------------------------
   * TEXT COUNTS
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
    `V3 TEXT rules: 185`,
  );

  console.log(
    `V4 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `Reduction from V3: ${
      185 -
      textRules.length
    }`,
  );

  /**
   * ------------------------------------------------
   * NODE COUNTS
   * ------------------------------------------------
   */

  const nodeCounts =
    countNodeTypes(
      records,
    );

  divider();

  console.log(
    'NODE COUNTS',
  );

  divider();

  for (
    const [
      type,
      count,
    ]
    of [
      ...nodeCounts.entries(),
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
      `${type}: ${count}`,
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
    `Missing exact-unit rules: ${missingExact.length}`,
  );

  console.log(
    `Missing wildcard-pattern rules: ${missingPatterns.length}`,
  );

  if (
    missingExact.length >
    0
  ) {
    console.log('');

    console.log(
      'MISSING EXACT REFERENCES',
    );

    for (
      const item
      of missingExact.slice(
        0,
        30,
      )
    ) {
      console.log(
        item,
      );
    }
  }

  if (
    missingPatterns.length >
    0
  ) {
    console.log('');

    console.log(
      'MISSING WILDCARD REFERENCES',
    );

    for (
      const item
      of missingPatterns.slice(
        0,
        30,
      )
    ) {
      console.log(
        item,
      );
    }
  }

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
    'REMAINING V4 TEXT RULE SAMPLES',
  );

  divider();

  for (
    const record
    of textRules.slice(
      0,
      70,
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
      formatUsydRequisiteTree(
        record.root,
        '  ',
      ),
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
   * STRUCTURAL CHECKS
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
    `Rules without root: ${noRoots.length}`,
  );

  console.log(
    `Duplicate code/type records: ${duplicateCodeTypes}`,
  );

  console.log(
    `Synthetic failures: ${syntheticFailures}`,
  );

  console.log(
    `Missing exact references: ${missingExact.length}`,
  );

  console.log(
    `Missing wildcard references: ${missingPatterns.length}`,
  );

  /**
   * ------------------------------------------------
   * FINAL
   * ------------------------------------------------
   */

  const hardFailure =
    units.length !==
      3011 ||
    records.length !==
      3189 ||
    noRoots.length >
      0 ||
    duplicateCodeTypes >
      0 ||
    syntheticFailures >
      0 ||
    missingExact.length >
      0 ||
    missingPatterns.length >
      0;

  divider();

  console.log(
    'FINAL REQUISITE PARSER V4 AUDIT',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V3 TEXT rules: 185`,
  );

  console.log(
    `V4 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `TEXT reduction: ${
      185 -
      textRules.length
    }`,
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
      'NEXT: rerun semantic invariant audit and classify remaining V4 families.',
    );
  } else {
    console.log(
      'SEMANTIC STATUS: TEXT CLEAN',
    );

    console.log(
      'NEXT: semantic invariant audit before Prisma mapping.',
    );
  }
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