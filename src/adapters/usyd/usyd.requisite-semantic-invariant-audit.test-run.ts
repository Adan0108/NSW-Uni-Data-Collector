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
 * USYD REQUISITE SEMANTIC INVARIANT AUDIT
 * ------------------------------------------------
 *
 * PURPOSE
 *
 * Parser V6.3 must preserve the frozen structural invariants:
 *
 * - 3011 successful units
 * - 3189 P/C/N rules
 * - TEXT count is re-measured after the narrow V6.3 fixes
 * - 0 missing exact unit references
 * - 0 missing wildcard references
 *
 * However:
 *
 * "no TEXT" does NOT automatically mean semantically correct.
 *
 * This audit looks for:
 *
 * 1. raw unit references lost by the parse tree
 * 2. raw wildcard references lost by the parse tree
 * 3. suspicious CREDIT_POINTS scopes
 * 4. level information present in raw text but lost
 * 5. malformed standalone LEVEL nodes
 * 6. suspicious mark expressions
 * 7. suspicious external-entry expressions
 * 8. remaining generic TEXT families
 * 9. bracket / parser residue
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
  | 'RAW_FALLBACK_REFERENCE_ONLY'
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
          value.includes(
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
 * Collect references preserved anywhere in the parsed AST, not only in the
 * convenience `unitCodes` / `unitPatterns` indexes.
 *
 * This matters because some safe structured atoms keep a reference inside a
 * typed scope/rawText field. Reference-preservation auditing asks whether the
 * handbook reference survived the parse at all; semantic-quality checks below
 * separately decide whether the node shape itself is suspicious.
 */
function extractReferencesFromParsedTree(
  root: UsydRequisiteNode | null,
): {
  exactUnits: string[];
  unitPatterns: string[];
} {
  if (
    !root
  ) {
    return {
      exactUnits: [],
      unitPatterns: [],
    };
  }

  const serialized =
    JSON.stringify(
      root,
    );

  return {
    exactUnits:
      extractRawExactUnits(
        serialized,
      ),

    unitPatterns:
      extractRawUnitPatterns(
        serialized,
      ),
  };
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
   * 1000 or 2000 or 3000 level
   */
  const grouped =
    rawText.match(
      /\b((?:[1-9]000\s*(?:,|or|\/)\s*)+)([1-9]000)\s+level\b/i,
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
   *
   * Every exact ABCD1234 reference appearing in the raw
   * rule should still be discoverable from the parse.
   */

  const rawUnits =
    extractRawExactUnits(
      record.rawText,
    );

  const parsedTreeReferences =
    extractReferencesFromParsedTree(
      record.parsed.root,
    );

  const parsedUnits =
    new Set([
      ...record.parsed.unitCodes,
      ...parsedTreeReferences.exactUnits,
    ]);

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
    if (
      record.parsed
        .containsUnparsedText
    ) {
      issues.push(
        createIssue(
          record,
          'RAW_FALLBACK_REFERENCE_ONLY',
          `Exact unit references preserved by raw fallback only: ${missingUnits.join(', ')}`,
        ),
      );
    } else {
      issues.push(
        createIssue(
          record,
          'MISSING_UNIT_REFERENCE',
          `Missing exact units from authoritative parse: ${missingUnits.join(', ')}`,
        ),
      );
    }
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
    new Set([
      ...record.parsed.unitPatterns,
      ...parsedTreeReferences.unitPatterns,
    ]);

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
    if (
      record.parsed
        .containsUnparsedText
    ) {
      issues.push(
        createIssue(
          record,
          'RAW_FALLBACK_REFERENCE_ONLY',
          `Wildcard references preserved by raw fallback only: ${missingPatterns.join(', ')}`,
        ),
      );
    } else {
      issues.push(
        createIssue(
          record,
          'MISSING_UNIT_PATTERN',
          `Missing wildcard patterns from authoritative parse: ${missingPatterns.join(', ')}`,
        ),
      );
    }
  }

  /**
   * ------------------------------------------------
   * 3. CREDIT POINT SCOPE QUALITY
   * ------------------------------------------------
   *
   * Suspicious examples:
   *
   * "any 1000 or units in"
   * "1000-level or units"
   * "including a minimum of 12 credit points from"
   *
   * These suggest nested grammar has been incorrectly stored
   * inside a simple scope string.
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
          textAtoms.push(
            node.rawText,
          );
        }
      },
    );

    /**
     * ------------------------------------------------
     * 6. MARK EXPRESSIONS STILL IN TEXT
     * ------------------------------------------------
     */

    const markText =
      textAtoms.filter(
        (text) =>
          /\b(?:mark|average|distinction|credit)\b/i.test(
            text,
          ) &&
          (
            /\b\d+(?:\.\d+)?%?\b/.test(
              text,
            ) ||
            /\bdistinction\b/i.test(
              text,
            )
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
     */

    const externalText =
      textAtoms.filter(
        (text) =>
          /\b(?:HSC|IB|Literature|Continuers|Extension|Beginners|native|background speakers?)\b/i.test(
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
     * 8. BRACKET RESIDUE
     * ------------------------------------------------
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
 * TARGETED REAL RULE AUDIT
 * ------------------------------------------------
 */

function printTargetedRules(
  records:
    RuleRecord[],
): void {
  const targetCodes =
    [
      'AMED3002',
      'ANHS2605',
      'ANSC3106',
      'ARBC2211',
      'ARBC3200',
      'ASNS2666',
      'BCMB3888',
      'BIOL3888',
      'CHEM1112',
      'CHEM1912',
      'CHNS1101',
      'CHNS3633',
      'COMP2823',
      'COMP3608',
      'ECMT2950',
    ];

  divider();

  console.log(
    'TARGETED SEMANTIC REGRESSION',
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
    'USYD REQUISITE SEMANTIC INVARIANT AUDIT',
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
      'RAW_FALLBACK_REFERENCE_ONLY',
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
    `Total semantic issues: ${issues.length}`,
  );

  for (
    const type
    of issueTypes
  ) {
    console.log(
      `${type}: ${
        issues.filter(
          (issue) =>
            issue.type ===
            type,
        ).length
      }`,
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

  const rawFallbackReferenceOnly =
    issues.filter(
      (issue) =>
        issue.type ===
        'RAW_FALLBACK_REFERENCE_ONLY',
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
        ? 30
        : 15,
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
    'Previous V6.2 TEXT baseline: 45',
  );

  console.log(
    `Actual V6.3 TEXT rules: ${textRules.length}`,
  );

  console.log(
    `Rules without root: ${noRoot.length}`,
  );

  console.log(
    `Duplicate code/type records: ${duplicateRuleKeys}`,
  );

  /**
   * ------------------------------------------------
   * SUSPICIOUS SEMANTIC ISSUE COUNT
   * ------------------------------------------------
   *
   * TEXT_REMAINS is reported separately.
   *
   * Missing references are treated as hard failures rather
   * than semantic-review-only issues.
   */

  const suspiciousSemanticIssues =
    issues.filter(
      (issue) =>
        issue.type !==
          'TEXT_REMAINS' &&
        issue.type !==
          'MISSING_UNIT_REFERENCE' &&
        issue.type !==
          'MISSING_UNIT_PATTERN' &&
        issue.type !==
          'RAW_FALLBACK_REFERENCE_ONLY',
    );

  /**
   * ------------------------------------------------
   * V6.3 TARGETED FREEZE GUARDS
   * ------------------------------------------------
   */

  const v63TargetCodes =
    new Set([
      'PHYS4036',
      'PRFM2608',
      'PRFM3622',
      'PRFM3624',
    ]);

  const v63TargetRecords =
    records.filter(
      (record) =>
        v63TargetCodes.has(
          record.code,
        ),
    );

  const v63TargetsWithText =
    v63TargetRecords.filter(
      (record) =>
        record.parsed
          .containsUnparsedText,
    );

  const missingV63Targets =
    [
      ...v63TargetCodes,
    ].filter(
      (code) =>
        !v63TargetRecords.some(
          (record) =>
            record.code ===
            code,
        ),
    );

  divider();

  console.log(
    'V6.3 TARGETED FREEZE GUARDS',
  );

  divider();

  console.log(
    `Target rules found: ${v63TargetRecords.length}`,
  );

  console.log(
    `Target rules still containing TEXT: ${v63TargetsWithText.length}`,
  );

  console.log(
    `Missing target unit codes: ${missingV63Targets.length}`,
  );

  /**
   * ------------------------------------------------
   * FINAL
   * ------------------------------------------------
   *
   * Semantic issues are REVIEW, not structural failure.
   *
   * Hard failure only means:
   *
   * - dataset count changed unexpectedly
   * - rule count changed unexpectedly
   * - reference/coverage invariants changed unexpectedly
   * - missing parse root
   * - duplicate rule record
   * - lost exact unit reference
   * - lost wildcard reference
   */

  const hardFailure =
    units.length !==
      EXPECTED_UNIT_COUNT ||
    records.length !==
      EXPECTED_RULE_COUNT ||
    noRoot.length >
      0 ||
    duplicateRuleKeys >
      0 ||
    missingExact.length >
      0 ||
    missingPattern.length >
      0 ||
    v63TargetsWithText.length >
      0 ||
    missingV63Targets.length >
      0;

  divider();

  console.log(
    'FINAL V6.3.2 SEMANTIC INVARIANT AUDIT',
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
    `Raw-fallback-only reference diagnostics: ${rawFallbackReferenceOnly.length}`,
  );

  console.log(
    `Suspicious semantic issues: ${suspiciousSemanticIssues.length}`,
  );

  console.log(
    `V6.3 target rules with TEXT: ${v63TargetsWithText.length}`,
  );

  console.log('');

  console.log(
    'Reference preservation checks typed indexes plus all AST fields.',
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
    'REFERENCE/STRUCTURAL STATUS: CLEAN',
  );

  if (
    textRules.length >
      0 ||
    suspiciousSemanticIssues.length >
      0
  ) {
    console.log(
      'SEMANTIC STATUS: REVIEW REQUIRED',
    );

    console.log(
      'NEXT: review the remaining TEXT/raw-fallback rules only. Do not broaden grammar unless handbook meaning is still wrong.',
    );

    return;
  }

  console.log(
    'SEMANTIC STATUS: CLEAN',
  );

  console.log(
    'NEXT: requisite parser V6.3 is frozen and ready for final USYD master integration.',
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