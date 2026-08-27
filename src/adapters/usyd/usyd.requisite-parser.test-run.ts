import fs from 'node:fs/promises';
import path from 'node:path';

import {
  formatUsydRequisiteTree,
  parseUsydRequisite,
  type UsydParsedRequisite,
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

interface RuleRecord {
  code: string;

  unitName: string;

  ruleType: RuleType;

  rawText: string;

  parsed:
    UsydParsedRequisite;
}

function divider():
void {
  console.log(
    '================================',
  );
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
 * NODE WALKERS
 * ------------------------------------------------
 */

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
    'CREDIT_POINT_SELECTION'
  ) {
    walkNode(
      node.selection,
      callback,
    );

    return;
  }

  if (
    node.type ===
    'MARK'
  ) {
    walkNode(
      node.scope,
      callback,
    );
  }
}

function hasNodeType(
  node:
    UsydRequisiteNode | null,
  type:
    UsydRequisiteNode['type'],
): boolean {
  let found =
    false;

  walkNode(
    node,
    (
      current,
    ) => {
      if (
        current.type ===
        type
      ) {
        found =
          true;
      }
    },
  );

  return found;
}

function countNodeTypes(
  node:
    UsydRequisiteNode | null,
  counts:
    Map<
      string,
      number
    >,
): void {
  walkNode(
    node,
    (
      current,
    ) => {
      counts.set(
        current.type,
        (
          counts.get(
            current.type,
          ) ??
          0
        ) +
          1,
      );

      if (
        current.type ===
        'LOGIC'
      ) {
        counts.set(
          current.operator,
          (
            counts.get(
              current.operator,
            ) ??
            0
          ) +
            1,
        );
      }
    },
  );
}

/**
 * ------------------------------------------------
 * PRINT SAMPLE
 * ------------------------------------------------
 */

function printRule(
  record:
    RuleRecord,
): void {
  console.log(
    `${record.code} — ${record.unitName}`,
  );

  console.log(
    `Type: ${record.ruleType}`,
  );

  console.log(
    `Raw: ${record.rawText}`,
  );

  console.log(
    `Units: ${
      record.parsed.unitCodes.join(
        ', ',
      ) ||
      'NONE'
    }`,
  );

  console.log(
    `Patterns: ${
      record.parsed.unitPatterns.join(
        ', ',
      ) ||
      'NONE'
    }`,
  );

  console.log(
    'Tree:',
  );

  console.log(
    formatUsydRequisiteTree(
      record.parsed.root,
      '  ',
    ),
  );

  console.log('');
}

function printSampleGroup(
  title: string,
  records:
    RuleRecord[],
  limit:
    number,
): void {
  divider();

  console.log(
    title,
  );

  divider();

  if (
    records.length ===
    0
  ) {
    console.log(
      'NONE',
    );

    return;
  }

  for (
    const record
    of records.slice(
      0,
      limit,
    )
  ) {
    printRule(
      record,
    );
  }
}

/**
 * ------------------------------------------------
 * TARGETED REAL UNIT AUDIT
 * ------------------------------------------------
 */

function printTargetedUnits(
  records:
    RuleRecord[],
): void {
  const targets =
    [
      'AERO2703',
      'AERO3261',
      'AERO3760',
      'AERO4701',
      'AMED3001',
      'AMED3901',
      'AMME2000',
      'ANAT3004',
      'ANAT3904',
      'ARIN3610',
      'ARIN3611',
      'ASNS2666',
      'ASNS3618',
      'AVBS4002',
      'CHNS3633',
    ];

  divider();

  console.log(
    'TARGETED REAL RULE REGRESSION AUDIT',
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

    if (
      matches.length ===
      0
    ) {
      console.log(
        `${code}: NOT PRESENT`,
      );

      console.log('');

      continue;
    }

    for (
      const record
      of matches
    ) {
      printRule(
        record,
      );
    }
  }
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
    'SYNTHETIC REGRESSION TESTS',
  );

  divider();

  const cases:
    Array<{
      raw: string;

      expectedText:
        string[];
    }> =
    [
      {
        raw:
          'COMP2017',

        expectedText:
          [
            'UNIT COMP2017',
          ],
      },

      {
        raw:
          'COMP2017 and (COMP2123 or COMP2823)',

        expectedText:
          [
            'AND',
            'UNIT COMP2017',
            'OR',
            'UNIT COMP2123',
            'UNIT COMP2823',
          ],
      },

      {
        raw:
          'AMME2000 and [AMME2200 or (AMME2261 and AMME2262)]',

        expectedText:
          [
            'UNIT AMME2000',
            'UNIT AMME2200',
            'UNIT AMME2261',
            'UNIT AMME2262',
          ],
      },

      {
        raw:
          '{(MATH1X61 or MATH1971) or [(MATH1X21 or MATH1931) and MATH1X02]}',

        expectedText:
          [
            'UNIT_PATTERN MATH1X61',
            'UNIT MATH1971',
            'UNIT_PATTERN MATH1X21',
            'UNIT MATH1931',
            'UNIT_PATTERN MATH1X02',
          ],
      },

      {
        raw:
          '6 credit points from BIOL1XXX',

        expectedText:
          [
            'CREDIT_POINTS 6',
            'BIOL1XXX',
          ],
      },

      {
        raw:
          '12 credit points from (IMMU2101 or MEDS2004 or MEDS2003)',

        expectedText:
          [
            'CREDIT_POINT_SELECTION 12',
            'UNIT IMMU2101',
            'UNIT MEDS2004',
            'UNIT MEDS2003',
          ],
      },

      {
        raw:
          '12 credit points at 2000 level in ARIN',

        expectedText:
          [
            'CREDIT_POINTS 12',
            'LEVELS 2',
            'SCOPE ARIN',
          ],
      },

      {
        raw:
          '12 credit points at 1000 level in Asian Studies or Sociology or Politics',

        expectedText:
          [
            'CREDIT_POINTS 12',
            'LEVELS 1',
            'Asian Studies or Sociology or Politics',
          ],
      },

      {
        raw:
          '48 credit points of 2000-level or 3000-level units',

        expectedText:
          [
            'CREDIT_POINTS 48',
            'LEVELS 2,3',
          ],
      },

      {
        raw:
          'A WAM of 70 and a mark of 70 or above',

        expectedText:
          [
            'WAM >= 70',
            'MARK >= 70',
          ],
      },

      {
        raw:
          'a mark of 65 or above in (ANAT2009)',

        expectedText:
          [
            'MARK >= 65',
            'UNIT ANAT2009',
          ],
      },

      {
        raw:
          'AERO3260 or AERO8260 or equivalent study at another institution',

        expectedText:
          [
            'UNIT AERO3260',
            'UNIT AERO8260',
            'EQUIVALENT_STUDY',
          ],
      },

      {
        raw:
          'Departmental permission',

        expectedText:
          [
            'PERMISSION',
          ],
      },
    ];

  let failures =
    0;

  for (
    const testCase
    of cases
  ) {
    const parsed =
      parseUsydRequisite(
        testCase.raw,
      );

    const formatted =
      formatUsydRequisiteTree(
        parsed?.root ??
          null,
      );

    const missing =
      testCase.expectedText.filter(
        (expected) =>
          !formatted.includes(
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
        `FAIL: ${testCase.raw}`,
      );

      console.log(
        `Missing: ${missing.join(', ')}`,
      );

      console.log(
        formatted,
      );

      console.log('');

      continue;
    }

    console.log(
      `PASS: ${testCase.raw}`,
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
 * MAIN
 * ------------------------------------------------
 */

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD REQUISITE PARSER V2 AUDIT',
  );

  divider();

  const file =
    await readUnitFile();

  console.log(
    `Units loaded: ${file.units.length}`,
  );

  const records:
    RuleRecord[] =
    [];

  for (
    const unit
    of file.units
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

        unitName:
          unit.name,

        ruleType:
          rule.type,

        rawText:
          rule.value,

        parsed,
      });
    }
  }

  /**
   * ------------------------------------------------
   * RULE COUNTS
   * ------------------------------------------------
   */

  const prerequisiteCount =
    records.filter(
      (record) =>
        record.ruleType ===
        'PREREQUISITE',
    ).length;

  const corequisiteCount =
    records.filter(
      (record) =>
        record.ruleType ===
        'COREQUISITE',
    ).length;

  const prohibitionCount =
    records.filter(
      (record) =>
        record.ruleType ===
        'PROHIBITION',
    ).length;

  divider();

  console.log(
    'RULE COUNTS',
  );

  divider();

  console.log(
    `Total P/C/N rules: ${records.length}`,
  );

  console.log(
    `Prerequisites: ${prerequisiteCount}`,
  );

  console.log(
    `Corequisites: ${corequisiteCount}`,
  );

  console.log(
    `Prohibitions: ${prohibitionCount}`,
  );

  /**
   * ------------------------------------------------
   * NODE COUNTS
   * ------------------------------------------------
   */

  const nodeCounts =
    new Map<
      string,
      number
    >();

  for (
    const record
    of records
  ) {
    countNodeTypes(
      record.parsed.root,
      nodeCounts,
    );
  }

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
   * PATTERN COUNTS
   * ------------------------------------------------
   */

  const withText =
    records.filter(
      (record) =>
        record.parsed
          .containsUnparsedText,
    );

  const withUnitPatterns =
    records.filter(
      (record) =>
        record.parsed
          .unitPatterns.length >
        0,
    );

  const withCreditPointSelection =
    records.filter(
      (record) =>
        hasNodeType(
          record.parsed.root,
          'CREDIT_POINT_SELECTION',
        ),
    );

  const withWam =
    records.filter(
      (record) =>
        hasNodeType(
          record.parsed.root,
          'WAM',
        ),
    );

  const withMark =
    records.filter(
      (record) =>
        hasNodeType(
          record.parsed.root,
          'MARK',
        ),
    );

  const withEquivalentStudy =
    records.filter(
      (record) =>
        hasNodeType(
          record.parsed.root,
          'EQUIVALENT_STUDY',
        ),
    );

  const withEligibility =
    records.filter(
      (record) =>
        hasNodeType(
          record.parsed.root,
          'ELIGIBILITY',
        ),
    );

  divider();

  console.log(
    'PATTERN COUNTS',
  );

  divider();

  console.log(
    `Rules with wildcard unit patterns: ${withUnitPatterns.length}`,
  );

  console.log(
    `Rules with credit-point selection: ${withCreditPointSelection.length}`,
  );

  console.log(
    `Rules with WAM: ${withWam.length}`,
  );

  console.log(
    `Rules with mark condition: ${withMark.length}`,
  );

  console.log(
    `Rules with equivalent-study condition: ${withEquivalentStudy.length}`,
  );

  console.log(
    `Rules with eligibility condition: ${withEligibility.length}`,
  );

  console.log(
    `Rules still containing TEXT: ${withText.length}`,
  );

  /**
   * ------------------------------------------------
   * TARGETED REAL EXAMPLES
   * ------------------------------------------------
   */

  printTargetedUnits(
    records,
  );

  /**
   * ------------------------------------------------
   * REMAINING TEXT REVIEW
   * ------------------------------------------------
   */

  printSampleGroup(
    'REMAINING TEXT / SEMANTIC REVIEW SAMPLES',
    withText,
    50,
  );

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

  const noRoot =
    records.filter(
      (record) =>
        !record.parsed.root,
    );

  const duplicateCodeType =
    records.length -
    new Set(
      records.map(
        (record) =>
          `${record.code}|${record.ruleType}`,
      ),
    ).size;

  const rulesWithNoExtractedReference =
    records.filter(
      (record) =>
        record.parsed.unitCodes.length ===
          0 &&
        record.parsed.unitPatterns.length ===
          0 &&
        !hasNodeType(
          record.parsed.root,
          'CREDIT_POINTS',
        ) &&
        !hasNodeType(
          record.parsed.root,
          'CREDIT_POINT_SELECTION',
        ) &&
        !hasNodeType(
          record.parsed.root,
          'MARK',
        ) &&
        !hasNodeType(
          record.parsed.root,
          'WAM',
        ) &&
        !hasNodeType(
          record.parsed.root,
          'PERMISSION',
        ) &&
        !hasNodeType(
          record.parsed.root,
          'ELIGIBILITY',
        ) &&
        !hasNodeType(
          record.parsed.root,
          'EQUIVALENT_STUDY',
        ),
    );

  divider();

  console.log(
    'STRUCTURAL VALIDATION',
  );

  divider();

  console.log(
    `Rules without root: ${noRoot.length}`,
  );

  console.log(
    `Duplicate code/type records: ${duplicateCodeType}`,
  );

  console.log(
    `Synthetic regression failures: ${syntheticFailures}`,
  );

  console.log(
    `Rules containing only unresolved textual semantics: ${rulesWithNoExtractedReference.length}`,
  );

  /**
   * ------------------------------------------------
   * FINAL
   * ------------------------------------------------
   */

  const hardFailure =
    file.units.length !==
      3011 ||
    records.length !==
      3189 ||
    noRoot.length >
      0 ||
    duplicateCodeType >
      0 ||
    syntheticFailures >
      0;

  divider();

  console.log(
    'FINAL REQUISITE PARSER V2 AUDIT',
  );

  divider();

  console.log(
    `Units: ${file.units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `Rules still containing TEXT: ${withText.length}`,
  );

  console.log(
    `Previous TEXT count: 979`,
  );

  console.log(
    `TEXT reduction: ${
      979 -
      withText.length
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
    withText.length >
    0
  ) {
    console.log(
      'SEMANTIC STATUS: REVIEW REQUIRED',
    );

    console.log(
      'NEXT: classify remaining TEXT patterns. Do not map to Prisma yet.',
    );
  } else {
    console.log(
      'SEMANTIC STATUS: CLEAN',
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