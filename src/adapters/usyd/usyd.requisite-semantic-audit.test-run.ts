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

/**
 * ------------------------------------------------
 * USYD REQUISITE FINAL SEMANTIC INVARIANT AUDIT
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * Parser V6 has passed structural/reference validation:
 *
 * - 3011 successful units
 * - 3189 P/C/N rules
 * - 98 rules still contain TEXT
 * - 0 missing exact unit references
 * - 0 missing wildcard references
 * - 0 stray syntax TEXT
 *
 * V6 is now considered structurally stable.
 *
 * This audit does NOT attempt to make TEXT count zero.
 *
 * Instead it checks whether remaining fallback rules contain
 * semantic patterns that require review before we freeze the
 * requisite parser.
 *
 * This audit looks for:
 *
 * 1. raw exact unit references lost by the parse tree
 * 2. raw wildcard references lost by the parse tree
 * 3. suspicious CREDIT_POINTS scopes
 * 4. raw level information lost by the parse tree
 * 5. suspicious standalone LEVEL nodes
 * 6. mark / average semantics still in TEXT
 * 7. external-entry semantics still in TEXT
 * 8. bracket / parser residue
 * 9. remaining generic TEXT rules
 *
 * Semantic findings are REVIEW findings.
 *
 * Hard failure means:
 *
 * - dataset count changed unexpectedly
 * - rule count changed unexpectedly
 * - V6 TEXT baseline changed unexpectedly
 * - missing parse root
 * - duplicate rule record
 * - lost exact unit reference
 * - lost wildcard unit reference
 *
 * NO WEB REQUESTS.
 * NO PRISMA WRITES.
 * NO PARSER MUTATION.
 */

const HANDBOOK_YEAR =
  2026;

const EXPECTED_UNIT_COUNT =
  3011;

const EXPECTED_RULE_COUNT =
  3189;

const EXPECTED_V6_2_TEXT_RULE_COUNT =
  56;

const UNIT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(HANDBOOK_YEAR),
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

interface RuleRecord {
  code: string;

  name: string;

  ruleType: RuleType;

  rawText: string;

  parsed:
    UsydParsedRequisite;
}

type IssueType =
  | 'MISSING_UNIT_REFERENCE'
  | 'MISSING_UNIT_PATTERN'
  | 'SUSPICIOUS_CP_SCOPE'
  | 'RAW_LEVEL_NOT_CAPTURED'
  | 'SUSPICIOUS_LEVEL_NODE'
  | 'SUSPICIOUS_MARK_TEXT'
  | 'SUSPICIOUS_EXTERNAL_ENTRY'
  | 'BRACKET_RESIDUE'
  | 'TEXT_REMAINS';

interface SemanticIssue {
  type: IssueType;

  code: string;

  name: string;

  ruleType: RuleType;

  rawText: string;

  detail: string;

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
      'USYD unit output does not contain a units array.',
    );
  }

  return parsed.units;
}

/**
 * ------------------------------------------------
 * TREE WALKER
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

/**
 * ------------------------------------------------
 * RAW REFERENCES
 * ------------------------------------------------
 */

function extractRawExactUnits(
  rawText: string,
): string[] {
  const results =
    [
      ...rawText.matchAll(
        /\b[A-Z]{4}\d{4}\b/g,
      ),
    ].map(
      (match) =>
        match[0],
    );

  return [
    ...new Set(
      results,
    ),
  ].sort();
}

/**
 * IMPORTANT:
 *
 * Only the code suffix determines whether a reference
 * is a wildcard.
 *
 * MTRX2700
 * ----^^^^
 * suffix = 2700
 * => exact unit
 *
 * MATH1X61
 * ----^^^^
 * suffix contains X
 * => wildcard
 */
function extractRawUnitPatterns(
  rawText: string,
): string[] {
  const references =
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
      );

  return [
    ...new Set(
      references,
    ),
  ].sort();
}

/**
 * ------------------------------------------------
 * RAW LEVELS
 * ------------------------------------------------
 */

function extractRawLevels(
  rawText: string,
): number[] {
  const levels:
    number[] =
    [];

  /**
   * Standard:
   *
   * 1000 level
   * 2000-level
   */
  for (
    const match
    of rawText.matchAll(
      /\b([1-9])000(?:-|\s*)level\b/gi,
    )
  ) {
    levels.push(
      Number(
        match[1],
      ),
    );
  }

  /**
   * Grouped:
   *
   * 1000 or 2000 or 3000 level
   * 2000 or 3000 level
   */
  const grouped =
    rawText.match(
      /\b((?:[1-9]000\s*(?:,|or|\/)\s*)+)([1-9]000)\s*-?\s*level\b/i,
    );

  if (
    grouped
  ) {
    const combined =
      `${grouped[1]} ${grouped[2]}`;

    for (
      const match
      of combined.matchAll(
        /\b([1-9])000\b/g,
      )
    ) {
      levels.push(
        Number(
          match[1],
        ),
      );
    }
  }

  /**
   * Range:
   *
   * 1000-3000 level
   */
  const range =
    rawText.match(
      /\b([1-9])000\s*-\s*([1-9])000\s+level\b/i,
    );

  if (
    range
  ) {
    const start =
      Number(
        range[1],
      );

    const end =
      Number(
        range[2],
      );

    for (
      let level =
        start;
      level <=
      end;
      level +=
        1
    ) {
      levels.push(
        level,
      );
    }
  }

  return [
    ...new Set(
      levels,
    ),
  ].sort();
}

function extractParsedLevels(
  root:
    UsydRequisiteNode | null,
): number[] {
  const levels:
    number[] =
    [];

  walkNode(
    root,
    (
      node,
    ) => {
      if (
        node.type ===
        'CREDIT_POINTS'
      ) {
        levels.push(
          ...node.levels,
        );
      }

      if (
        node.type ===
        'LEVEL'
      ) {
        levels.push(
          ...node.levels,
        );
      }
    },
  );

  return [
    ...new Set(
      levels,
    ),
  ].sort();
}

/**
 * ------------------------------------------------
 * ISSUE CREATION
 * ------------------------------------------------
 */

function createIssue(
  record:
    RuleRecord,
  type:
    IssueType,
  detail:
    string,
): SemanticIssue {
  return {
    type,

    code:
      record.code,

    name:
      record.name,

    ruleType:
      record.ruleType,

    rawText:
      record.rawText,

    detail,

    tree:
      formatUsydRequisiteTree(
        record.parsed.root,
        '  ',
      ),
  };
}

/**
 * ------------------------------------------------
 * AUDIT ONE RULE
 * ------------------------------------------------
 */

function auditRule(
  record:
    RuleRecord,
): SemanticIssue[] {
  const issues:
    SemanticIssue[] =
    [];

  /**
   * ------------------------------------------------
   * 1. EXACT UNIT REFERENCES
   * ------------------------------------------------
   */

  const rawUnits =
    extractRawExactUnits(
      record.rawText,
    );

  const parsedUnits =
    new Set(
      record.parsed.unitCodes,
    );

  const missingUnits =
    rawUnits.filter(
      (code) =>
        !parsedUnits.has(
          code,
        ),
    );

  if (
    missingUnits.length >
    0
  ) {
    issues.push(
      createIssue(
        record,
        'MISSING_UNIT_REFERENCE',
        `Missing exact units: ${missingUnits.join(', ')}`,
      ),
    );
  }

  /**
   * ------------------------------------------------
   * 2. WILDCARD UNIT REFERENCES
   * ------------------------------------------------
   */

  const rawPatterns =
    extractRawUnitPatterns(
      record.rawText,
    );

  const parsedPatterns =
    new Set(
      record.parsed.unitPatterns,
    );

  const missingPatterns =
    rawPatterns.filter(
      (pattern) =>
        !parsedPatterns.has(
          pattern,
        ),
    );

  if (
    missingPatterns.length >
    0
  ) {
    issues.push(
      createIssue(
        record,
        'MISSING_UNIT_PATTERN',
        `Missing wildcard patterns: ${missingPatterns.join(', ')}`,
      ),
    );
  }

  /**
   * ------------------------------------------------
   * 3. CREDIT POINT SCOPE QUALITY
   * ------------------------------------------------
   *
   * Suspicious examples:
   *
   * "any 1000 or units in"
   *
   * "units of study including a minimum..."
   *
   * "including a minimum of 12 credit points from..."
   *
   * Those usually mean nested requirement structure
   * has been kept inside a flat scope string.
   */

  walkNode(
    record.parsed.root,
    (
      node,
    ) => {
      if (
        node.type !==
        'CREDIT_POINTS'
      ) {
        return;
      }

      if (
        !node.scope
      ) {
        return;
      }

      const scope =
        normalizeText(
          node.scope,
        );

      const suspicious =
        /\b(?:including|credit points?|at least|minimum of)\b/i.test(
          scope,
        ) ||
        /\b(?:1000|2000|3000|4000)-?level\s+or\s+units?\b/i.test(
          scope,
        ) ||
        /\bany\s+[1-9]000\s+or\s+units?\b/i.test(
          scope,
        ) ||
        /\bfrom\s*$/i.test(
          scope,
        ) ||
        /\bof\s*$/i.test(
          scope,
        ) ||
        /\bin\s*$/i.test(
          scope,
        );

      if (
        suspicious
      ) {
        issues.push(
          createIssue(
            record,
            'SUSPICIOUS_CP_SCOPE',
            `Suspicious CREDIT_POINTS scope: "${scope}"`,
          ),
        );
      }
    },
  );

  /**
   * ------------------------------------------------
   * 4. LEVEL LOSS
   * ------------------------------------------------
   */

  const rawLevels =
    extractRawLevels(
      record.rawText,
    );

  const parsedLevels =
    new Set(
      extractParsedLevels(
        record.parsed.root,
      ),
    );

  const missingLevels =
    rawLevels.filter(
      (level) =>
        !parsedLevels.has(
          level,
        ),
    );

  if (
    missingLevels.length >
    0
  ) {
    issues.push(
      createIssue(
        record,
        'RAW_LEVEL_NOT_CAPTURED',
        `Raw levels missing from tree: ${missingLevels.join(', ')}`,
      ),
    );
  }

  /**
   * ------------------------------------------------
   * 5. SUSPICIOUS LEVEL NODE
   * ------------------------------------------------
   */

  walkNode(
    record.parsed.root,
    (
      node,
    ) => {
      if (
        node.type !==
        'LEVEL'
      ) {
        return;
      }

      if (
        node.scope &&
        /^(?:in|from|of)\b/i.test(
          node.scope,
        )
      ) {
        issues.push(
          createIssue(
            record,
            'SUSPICIOUS_LEVEL_NODE',
            `LEVEL scope begins with relation: "${node.scope}"`,
          ),
        );
      }

      if (
        node.scope &&
        /\bcredit points?\b/i.test(
          node.scope,
        )
      ) {
        issues.push(
          createIssue(
            record,
            'SUSPICIOUS_LEVEL_NODE',
            `LEVEL scope still contains credit-point grammar: "${node.scope}"`,
          ),
        );
      }
    },
  );

  /**
   * ------------------------------------------------
   * REMAINING TEXT ANALYSIS
   * ------------------------------------------------
   */

  if (
    record.parsed.containsUnparsedText
  ) {
    const textAtoms:
      string[] =
      [];

    walkNode(
      record.parsed.root,
      (
        node,
      ) => {
        if (
          node.type ===
          'TEXT'
        ) {
          const text =
            normalizeText(
              node.rawText,
            );

          if (
            text
          ) {
            textAtoms.push(
              text,
            );
          }
        }
      },
    );

    /**
     * ------------------------------------------------
     * 6. MARK EXPRESSIONS STILL IN TEXT
     * ------------------------------------------------
     *
     * Keep this deliberately conservative.
     *
     * "credit points" by itself is NOT a mark signal.
     */

    const markText =
      textAtoms.filter(
        (text) =>
          (
            /\b(?:mark|average|distinction)\b/i.test(
              text,
            ) &&
            (
              /\b\d+(?:\.\d+)?%?\b/.test(
                text,
              ) ||
              /\bdistinction\b/i.test(
                text,
              )
            )
          ) ||
          /\bCredit\s+or\s+greater\b/i.test(
            text,
          ),
      );

    if (
      markText.length >
      0
    ) {
      issues.push(
        createIssue(
          record,
          'SUSPICIOUS_MARK_TEXT',
          `Mark/average semantics remain in TEXT: ${markText.join(' || ')}`,
        ),
      );
    }

    /**
     * ------------------------------------------------
     * 7. EXTERNAL ENTRY STILL SPLIT
     * ------------------------------------------------
     *
     * Do not classify generic discipline names containing
     * "Literature" as external-entry requirements.
     */

    const externalText =
      textAtoms.filter(
        (text) =>
          /\b(?:HSC|IB|Continuers|Extension|Beginners|native|near-native|background speakers?)\b/i.test(
            text,
          ),
      );

    if (
      externalText.length >
      0
    ) {
      issues.push(
        createIssue(
          record,
          'SUSPICIOUS_EXTERNAL_ENTRY',
          `External-entry semantics remain in TEXT: ${externalText.join(' || ')}`,
        ),
      );
    }

    /**
     * ------------------------------------------------
     * 8. BRACKET / PARSER RESIDUE
     * ------------------------------------------------
     *
     * Any remaining parentheses/brackets in generic TEXT
     * deserve review after V6.
     */

    const bracketText =
      textAtoms.filter(
        (text) =>
          /[()[\]{}]/.test(
            text,
          ),
      );

    if (
      bracketText.length >
      0
    ) {
      issues.push(
        createIssue(
          record,
          'BRACKET_RESIDUE',
          `Bracketed expression remains in TEXT: ${bracketText.join(' || ')}`,
        ),
      );
    }

    /**
     * ------------------------------------------------
     * 9. ANY TEXT REMAINS
     * ------------------------------------------------
     *
     * TEXT itself is not failure.
     *
     * Remaining TEXT rules will be classified into:
     *
     * - MUST_FIX
     * - SAFE_RAW_FALLBACK
     */

    issues.push(
      createIssue(
        record,
        'TEXT_REMAINS',
        `Rule still contains ${textAtoms.length} TEXT atom(s).`,
      ),
    );
  }

  return issues;
}

/**
 * ------------------------------------------------
 * PRINT ISSUE GROUP
 * ------------------------------------------------
 */

function printIssueSamples(
  title:
    IssueType,
  issues:
    SemanticIssue[],
  limit =
    15,
): void {
  divider();

  console.log(
    title,
  );

  divider();

  const matches =
    issues.filter(
      (issue) =>
        issue.type ===
        title,
    );

  console.log(
    `Count: ${matches.length}`,
  );

  console.log('');

  for (
    const issue
    of matches.slice(
      0,
      limit,
    )
  ) {
    console.log(
      `${issue.code} — ${issue.name}`,
    );

    console.log(
      `Type: ${issue.ruleType}`,
    );

    console.log(
      `Issue: ${issue.detail}`,
    );

    console.log(
      `Raw: ${issue.rawText}`,
    );

    console.log(
      'Tree:',
    );

    console.log(
      issue.tree,
    );

    console.log('');
  }
}

/**
 * ------------------------------------------------
 * TARGETED V6 FINAL REVIEW
 * ------------------------------------------------
 *
 * These are examples of the remaining difficult families.
 *
 * We do not expect all of them to have zero TEXT.
 *
 * We inspect whether their fallback structure is safe enough
 * to preserve raw handbook meaning.
 */

function printTargetedRules(
  records:
    RuleRecord[],
): void {
  const targetCodes =
    [
      /**
       * Nested CP / mark.
       */
      'GEOS2124',
      'GEOS2924',
      'GEOS3014',
      'GEOS3914',
      'GEOS3924',

      /**
       * Cohort / conditional.
       */
      'IBUS3600',
      'INFS3600',

      /**
       * Complicated subject-selection grammar.
       */
      'ICLS2626',
      'ICLS3000',

      /**
       * Advanced CP / marks.
       */
      'LIFE4000',
      'LIFE4101',
      'MATH2069',
      'MATH2980',
      'MATH3961',
      'MATH3963',
      'MATH3968',

      /**
       * External-entry language rules.
       */
      'GRMN2003',
      'GRMN3005',

      /**
       * V6 regression targets.
       */
      'CHNS2650',
      'ARBC2211',
      'ARBC3691',
      'ASNS2666',
      'CHNS3633',
      'GOVT3641',
      'GOVT3651',
      'GOVT3664',
      'GOVT3901',
    ];

  divider();

  console.log(
    'TARGETED V6 FINAL SEMANTIC REVIEW',
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
        formatUsydRequisiteTree(
          record.parsed.root,
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
    'USYD REQUISITE FINAL SEMANTIC INVARIANT AUDIT',
  );

  divider();

  const units =
    await readUnits();

  const records:
    RuleRecord[] =
    [];

  /**
   * ------------------------------------------------
   * BUILD RULE RECORDS
   * ------------------------------------------------
   */

  for (
    const unit
    of units
  ) {
    const rawRules:
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
      const rawRule
      of rawRules
    ) {
      if (
        !rawRule.rawText
      ) {
        continue;
      }

      const parsed =
        parseUsydRequisite(
          rawRule.rawText,
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
          rawRule.ruleType,

        rawText:
          rawRule.rawText,

        parsed,
      });
    }
  }

  /**
   * ------------------------------------------------
   * AUDIT ALL RULES
   * ------------------------------------------------
   */

  const issues =
    records.flatMap(
      auditRule,
    );

  const issueTypes:
    IssueType[] =
    [
      'MISSING_UNIT_REFERENCE',
      'MISSING_UNIT_PATTERN',
      'SUSPICIOUS_CP_SCOPE',
      'RAW_LEVEL_NOT_CAPTURED',
      'SUSPICIOUS_LEVEL_NODE',
      'SUSPICIOUS_MARK_TEXT',
      'SUSPICIOUS_EXTERNAL_ENTRY',
      'BRACKET_RESIDUE',
      'TEXT_REMAINS',
    ];

  /**
   * ------------------------------------------------
   * AUDIT COUNTS
   * ------------------------------------------------
   */

  divider();

  console.log(
    'AUDIT COUNTS',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `Total audit findings: ${issues.length}`,
  );

  for (
    const type
    of issueTypes
  ) {
    const count =
      issues.filter(
        (issue) =>
          issue.type ===
          type,
      ).length;

    console.log(
      `${type}: ${count}`,
    );
  }

  /**
   * ------------------------------------------------
   * REFERENCE PRESERVATION
   * ------------------------------------------------
   */

  const missingExact =
    issues.filter(
      (issue) =>
        issue.type ===
        'MISSING_UNIT_REFERENCE',
    );

  const missingPattern =
    issues.filter(
      (issue) =>
        issue.type ===
        'MISSING_UNIT_PATTERN',
    );

  divider();

  console.log(
    'REFERENCE PRESERVATION',
  );

  divider();

  console.log(
    `Missing exact-unit rules: ${missingExact.length}`,
  );

  console.log(
    `Missing wildcard-pattern rules: ${missingPattern.length}`,
  );

  console.log(
    `Reference preservation: ${
      missingExact.length ===
        0 &&
      missingPattern.length ===
        0
        ? 'PASS'
        : 'FAIL'
    }`,
  );

  /**
   * ------------------------------------------------
   * TARGETED REAL RULES
   * ------------------------------------------------
   */

  printTargetedRules(
    records,
  );

  /**
   * ------------------------------------------------
   * ISSUE SAMPLES
   * ------------------------------------------------
   */

  for (
    const type
    of issueTypes
  ) {
    printIssueSamples(
      type,
      issues,
      type ===
        'TEXT_REMAINS'
        ? 40
        : 20,
    );
  }

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

  const duplicateRuleKeys =
    records.length -
    new Set(
      records.map(
        (record) =>
          `${record.code}|${record.ruleType}`,
      ),
    ).size;

  const textRules =
    records.filter(
      (record) =>
        record.parsed
          .containsUnparsedText,
    );

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
    `Expected V6.2 TEXT rules: ${EXPECTED_V6_2_TEXT_RULE_COUNT}`,
  );

  console.log(
    `Actual V6.2 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `Rules without root: ${noRoot.length}`,
  );

  console.log(
    `Duplicate code/type records: ${duplicateRuleKeys}`,
  );

  /**
   * ------------------------------------------------
   * SEMANTIC REVIEW FINDINGS
   * ------------------------------------------------
   *
   * TEXT_REMAINS is counted separately.
   *
   * Missing references are hard failures.
   *
   * Everything else is a semantic-review finding.
   */

  const suspiciousSemanticIssues =
    issues.filter(
      (issue) =>
        issue.type !==
          'TEXT_REMAINS' &&
        issue.type !==
          'MISSING_UNIT_REFERENCE' &&
        issue.type !==
          'MISSING_UNIT_PATTERN',
    );

  const textRemainIssues =
    issues.filter(
      (issue) =>
        issue.type ===
        'TEXT_REMAINS',
    );

  divider();

  console.log(
    'SEMANTIC REVIEW SUMMARY',
  );

  divider();

  console.log(
    `Rules with TEXT: ${textRules.length}`,
  );

  console.log(
    `TEXT_REMAINS findings: ${textRemainIssues.length}`,
  );

  console.log(
    `Suspicious semantic findings: ${suspiciousSemanticIssues.length}`,
  );

  /**
   * ------------------------------------------------
   * HARD FAILURE
   * ------------------------------------------------
   */

  const hardFailure =
    units.length !==
      EXPECTED_UNIT_COUNT ||
    records.length !==
      EXPECTED_RULE_COUNT ||
    textRules.length !==
      EXPECTED_V6_2_TEXT_RULE_COUNT ||
    noRoot.length >
      0 ||
    duplicateRuleKeys >
      0 ||
    missingExact.length >
      0 ||
    missingPattern.length >
      0;

  /**
   * ------------------------------------------------
   * FINAL
   * ------------------------------------------------
   */

  divider();

  console.log(
    'FINAL V6.2 SEMANTIC INVARIANT AUDIT',
  );

  divider();

  console.log(
    `Units: ${units.length}`,
  );

  console.log(
    `P/C/N rules: ${records.length}`,
  );

  console.log(
    `Rules with TEXT: ${textRules.length}`,
  );

  console.log(
    `Missing exact references: ${missingExact.length}`,
  );

  console.log(
    `Missing wildcard references: ${missingPattern.length}`,
  );

  console.log(
    `Suspicious semantic issues: ${suspiciousSemanticIssues.length}`,
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
      'NEXT: fix the structural/reference regression before any further semantic work.',
    );

    process.exitCode =
      1;

    return;
  }

  console.log(
    'REFERENCE/STRUCTURAL STATUS: CLEAN',
  );

  if (
    textRules.length >
      0 ||
    suspiciousSemanticIssues.length >
      0
  ) {
    console.log(
      'SEMANTIC STATUS: FINAL REVIEW REQUIRED',
    );

    console.log(
      'NEXT: classify remaining V6 findings as MUST_FIX or SAFE_RAW_FALLBACK. Do not add broad parser grammar unless a remaining rule changes handbook meaning.',
    );

    return;
  }

  console.log(
    'SEMANTIC STATUS: CLEAN',
  );

  console.log(
    'REQUISITE PARSER STATUS: READY TO FREEZE',
  );

  console.log(
    'NEXT: move to USYD normalization / Prisma mapping.',
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