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

  type: RuleType;

  raw: string;

  root:
    UsydRequisiteNode | null;

  containsText:
    boolean;
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

  const file =
    JSON.parse(
      raw,
    ) as UnitFileShape;

  if (
    !Array.isArray(
      file.units,
    )
  ) {
    throw new Error(
      'USYD unit output does not contain units.',
    );
  }

  return file.units;
}

function walk(
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
      walk(
        child,
        callback,
      );
    }

    return;
  }

  if (
    node.type ===
    'MARK'
  ) {
    walk(
      node.scope,
      callback,
    );

    return;
  }

  if (
    node.type ===
    'CREDIT_POINT_SELECTION'
  ) {
    walk(
      node.selection,
      callback,
    );
  }
}

function countTypes(
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
    walk(
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

        if (
          node.type ===
          'LOGIC'
        ) {
          counts.set(
            node.operator,
            (
              counts.get(
                node.operator,
              ) ??
              0
            ) +
              1,
          );
        }
      },
    );
  }

  return counts;
}

function runRegression():
number {
  divider();

  console.log(
    'V3 SYNTHETIC REGRESSION',
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
          'AERO2705 and must have passed AERO2705',

        expected:
          [
            'UNIT AERO2705',
            'PASSED_UNIT AERO2705',
          ],
      },

      {
        raw:
          'ANAT2008 and a mark of 65 or above in ANAT2009',

        expected:
          [
            'UNIT ANAT2008',
            'MARK >= 65',
            'UNIT ANAT2009',
          ],
      },

      {
        raw:
          'A WAM of 70 or above',

        expected:
          [
            'WAM >= 70',
          ],
      },

      {
        raw:
          'WAM >= 65',

        expected:
          [
            'WAM >= 65',
          ],
      },

      {
        raw:
          'a WAM greater than 65',

        expected:
          [
            'WAM >= 65',
          ],
      },

      {
        raw:
          '12 Junior credit points from Anthropology',

        expected:
          [
            'CREDIT_POINTS 12',
            'Junior',
          ],
      },

      {
        raw:
          'HSC Chinese Continuers',

        expected:
          [
            'EXTERNAL_ENTRY',
          ],
      },

      {
        raw:
          'IB Latin',

        expected:
          [
            'EXTERNAL_ENTRY',
          ],
      },

      {
        raw:
          'relevant prior experience commensurate to intermediate glass blowing',

        expected:
          [
            'PRIOR_EXPERIENCE',
          ],
      },

      {
        raw:
          'Knowledge of basic safety systems.',

        expected:
          [
            'KNOWLEDGE',
          ],
      },

      {
        raw:
          '12 credit points from (IMMU2101 or MEDS2004 or MEDS2003)',

        expected:
          [
            'CREDIT_POINT_SELECTION 12',
            'UNIT IMMU2101',
            'UNIT MEDS2004',
            'UNIT MEDS2003',
          ],
      },

      {
        raw:
          'A mark of at least 70 from (BIOL1XX7 or MBLG1XX1)',

        expected:
          [
            'MARK >= 70',
            'UNIT_PATTERN BIOL1XX7',
            'UNIT_PATTERN MBLG1XX1',
          ],
      },

      {
        raw:
          '75% or above from (DATA1002 or DATA1902)',

        expected:
          [
            'MARK >= 75',
            'UNIT DATA1002',
            'UNIT DATA1902',
          ],
      },

      {
        raw:
          'Minimum of 70% in (ECON1001 or BUSS1040)',

        expected:
          [
            'MARK >= 70',
            'UNIT ECON1001',
            'UNIT BUSS1040',
          ],
      },

      {
        raw:
          'Entry to this unit requires that students are eligible for Space Engineering',

        expected:
          [
            'ELIGIBILITY',
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

function printTargetedRules(
  records:
    RuleRecord[],
): void {
  const targets =
    [
      'ACCT3600',
      'AERO2705',
      'AERO3760',
      'AMED3002',
      'AMME4010',
      'AMME5104',
      'ANAT3006',
      'ANAT3904',
      'ANHS2618',
      'ARBC2613',
      'ASNS2626',
      'BCMB2901',
      'BIOL2924',
      'CHEM1912',
      'DATA2901',
      'ECMT2950',
      'EXSS2033',
      'MICR3988',
      'PHYS2911',
    ];

  divider();

  console.log(
    'TARGETED REAL V3 AUDIT',
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
        `Type: ${record.type}`,
      );

      console.log(
        `Raw: ${record.raw}`,
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

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD REQUISITE PARSER V3 AUDIT',
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
        type:
          RuleType;

        value:
          string | null;
      }> =
      [
        {
          type:
            'PREREQUISITE',

          value:
            unit
              .accessConditions
              .prerequisite,
        },

        {
          type:
            'COREQUISITE',

          value:
            unit
              .accessConditions
              .corequisite,
        },

        {
          type:
            'PROHIBITION',

          value:
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
        !rule.value
      ) {
        continue;
      }

      const parsed =
        parseUsydRequisite(
          rule.value,
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

        type:
          rule.type,

        raw:
          rule.value,

        root:
          parsed.root,

        containsText:
          parsed.containsUnparsedText,
      });
    }
  }

  /**
   * ------------------------------------------------
   * COUNTS
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
    `V2 rules containing TEXT: 337`,
  );

  console.log(
    `V3 rules containing TEXT: ${textRules.length}`,
  );

  console.log(
    `Reduction from V2: ${
      337 -
      textRules.length
    }`,
  );

  /**
   * ------------------------------------------------
   * NODE TYPES
   * ------------------------------------------------
   */

  const counts =
    countTypes(
      records,
    );

  divider();

  console.log(
    'NODE COUNTS',
  );

  divider();

  for (
    const [
      name,
      count,
    ]
    of [
      ...counts.entries(),
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
      `${name}: ${count}`,
    );
  }

  /**
   * ------------------------------------------------
   * TARGETS
   * ------------------------------------------------
   */

  printTargetedRules(
    records,
  );

  /**
   * ------------------------------------------------
   * REMAINING TEXT
   * ------------------------------------------------
   */

  divider();

  console.log(
    'REMAINING V3 TEXT RULE SAMPLES',
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
      `Type: ${record.type}`,
    );

    console.log(
      `Raw: ${record.raw}`,
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
    runRegression();

  /**
   * ------------------------------------------------
   * VALIDATION
   * ------------------------------------------------
   */

  const missingRoots =
    records.filter(
      (record) =>
        !record.root,
    );

  const duplicateCodeType =
    records.length -
    new Set(
      records.map(
        (record) =>
          `${record.code}|${record.type}`,
      ),
    ).size;

  divider();

  console.log(
    'STRUCTURAL VALIDATION',
  );

  divider();

  console.log(
    `Rules without root: ${missingRoots.length}`,
  );

  console.log(
    `Duplicate code/type records: ${duplicateCodeType}`,
  );

  console.log(
    `Synthetic failures: ${syntheticFailures}`,
  );

  const hardFailure =
    units.length !==
      3011 ||
    records.length !==
      3189 ||
    missingRoots.length >
      0 ||
    duplicateCodeType >
      0 ||
    syntheticFailures >
      0;

  divider();

  console.log(
    'FINAL REQUISITE PARSER V3 AUDIT',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `V2 TEXT rules: 337`,
  );

  console.log(
    `V3 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `TEXT reduction: ${
      337 -
      textRules.length
    }`,
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
      'STRUCTURAL STATUS: FAIL',
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    'STRUCTURAL STATUS: PASS',
  );

  if (
    textRules.length >
    0
  ) {
    console.log(
      'SEMANTIC STATUS: REVIEW REQUIRED',
    );

    console.log(
      'NEXT: audit remaining V3 TEXT plus malformed structured nodes.',
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