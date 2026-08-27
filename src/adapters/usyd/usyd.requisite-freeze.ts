import fs from 'node:fs/promises';
import path from 'node:path';

import {
  parseUsydRequisite,
  type UsydParsedRequisite,
} from './usyd.requisite-parser';

import type {
  UsydUnit,
} from './usyd.types';

const HANDBOOK_YEAR =
  2026;

const EXPECTED_UNIT_COUNT =
  3011;

const EXPECTED_RULE_COUNT =
  3189;

const EXPECTED_TEXT_RULE_COUNT =
  41;

const UNIT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(HANDBOOK_YEAR),
    'usyd-units.json',
  );

const OUTPUT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(HANDBOOK_YEAR),
    'usyd-requisite-freeze.v1.json',
  );

type RuleType =
  | 'PREREQUISITE'
  | 'COREQUISITE'
  | 'PROHIBITION';

type FreezeClassification =
  | 'AUTHORITATIVE_STRUCTURED'
  | 'SAFE_RAW_FALLBACK'
  | 'MUST_FIX';

interface UnitFileShape {
  units?: UsydUnit[];
  subjects?: UsydUnit[];
  data?: {
    units?: UsydUnit[];
    subjects?: UsydUnit[];
  };
}

interface RuleRecord {
  code: string;
  name: string;
  ruleType: RuleType;
  rawText: string;
  parsed: UsydParsedRequisite;
}

export interface UsydRequisiteFreezeRecord {
  code: string;
  name: string;
  ruleType: RuleType;
  rawText: string;

  classification:
    FreezeClassification;

  authoritative:
    boolean;

  containsUnparsedText:
    boolean;

  reasons:
    string[];
}

export interface UsydRequisiteFreezeDataset {
  university: 'USYD';
  handbookYear: 2026;
  parserVersion: 'V6.3';
  generatedAt: string;

  policy: {
    structuredRuleAuthority:
      'ONLY_WHEN_NO_TEXT';

    rawFallbackAuthority:
      'RAW_TEXT_IS_SOURCE_OF_TRUTH';

    partialAstUse:
      'DIAGNOSTIC_ONLY_FOR_RAW_FALLBACK';
  };

  counts: {
    units: number;
    rules: number;

    authoritativeStructured: number;
    safeRawFallback: number;
    mustFix: number;

    textRules: number;

    missingRawText: number;
    missingRoot: number;
    duplicateRuleKeys: number;

    v63TargetFallbacks: number;
  };

  records:
    UsydRequisiteFreezeRecord[];

  coverage: {
    structuralInvariants:
      'COMPLETE';

    referencePreservation:
      'COMPLETE';

    targetedV63Fixes:
      'COMPLETE';

    rawFallbackClassification:
      'COMPLETE';

    requisiteSemantics:
      'FROZEN_LOSSLESS';
  };
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
    ) as UnitFileShape | UsydUnit[];

  if (
    Array.isArray(
      parsed,
    )
  ) {
    return parsed;
  }

  const candidates = [
    parsed.units,
    parsed.subjects,
    parsed.data?.units,
    parsed.data?.subjects,
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      Array.isArray(
        candidate,
      )
    ) {
      return candidate;
    }
  }

  throw new Error(
    'Could not locate USYD units[] in usyd-units.json.',
  );
}

function buildRuleRecords(
  units: UsydUnit[],
): RuleRecord[] {
  const records:
    RuleRecord[] =
    [];

  for (
    const unit
    of units
  ) {
    const rawRules:
      Array<{
        ruleType: RuleType;
        rawText: string | null;
      }> = [
        {
          ruleType:
            'PREREQUISITE',

          rawText:
            unit.accessConditions
              .prerequisite,
        },
        {
          ruleType:
            'COREQUISITE',

          rawText:
            unit.accessConditions
              .corequisite,
        },
        {
          ruleType:
            'PROHIBITION',

          rawText:
            unit.accessConditions
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
        throw new Error(
          `Parser returned null for ${unit.code} ${rawRule.ruleType}.`,
        );
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

  return records;
}

function classifyFallbackReasons(
  record: RuleRecord,
): string[] {
  const raw =
    record.rawText;

  const reasons:
    string[] =
    [];

  if (
    /students?\s+commencing|continuing\s+students?/i.test(
      raw,
    )
  ) {
    reasons.push(
      'COHORT_CONDITIONAL_RULE',
    );
  }

  if (
    /average\s+mark|average\s+in|distinction[- ]level|distinction\s+average/i.test(
      raw,
    )
  ) {
    reasons.push(
      'COMPLEX_MARK_OR_AVERAGE_SCOPE',
    );
  }

  if (
    /\[[^\]]+\]|\{[^}]+\}|\([^)]*\([^)]*\)/i.test(
      raw,
    )
  ) {
    reasons.push(
      'NESTED_GROUPING',
    );
  }

  if (
    /\bTable\s+[A-Z]\b/i.test(
      raw,
    )
  ) {
    reasons.push(
      'TABLE_REFERENCE_WITH_ADDITIONAL_CONSTRAINTS',
    );
  }

  if (
    /\b(?:and|or)\b.*\b(?:and|or)\b/i.test(
      raw,
    )
  ) {
    reasons.push(
      'MIXED_OR_REPEATED_LOGICAL_CONNECTORS',
    );
  }

  if (
    /credit\s*points?|\bcp\b|\b\d+p\b/i.test(
      raw,
    )
  ) {
    reasons.push(
      'CREDIT_POINT_SCOPE_NOT_FULLY_STRUCTURED',
    );
  }

  if (
    /1000|2000|3000|4000|level/i.test(
      raw,
    )
  ) {
    reasons.push(
      'LEVEL_SCOPE_NOT_FULLY_STRUCTURED',
    );
  }

  if (
    reasons.length ===
    0
  ) {
    reasons.push(
      'UNSUPPORTED_COMPLEX_HANDBOOK_LANGUAGE',
    );
  }

  reasons.push(
    'RAW_TEXT_PRESERVED_EXACTLY',
  );

  reasons.push(
    'PARTIAL_AST_NON_AUTHORITATIVE',
  );

  return [
    ...new Set(
      reasons,
    ),
  ];
}

function classifyRecord(
  record: RuleRecord,
): UsydRequisiteFreezeRecord {
  const rawText =
    record.rawText.trim();

  if (
    !rawText
  ) {
    return {
      code:
        record.code,

      name:
        record.name,

      ruleType:
        record.ruleType,

      rawText:
        record.rawText,

      classification:
        'MUST_FIX',

      authoritative:
        false,

      containsUnparsedText:
        record.parsed
          .containsUnparsedText,

      reasons: [
        'RAW_TEXT_MISSING',
      ],
    };
  }

  if (
    !record.parsed.root
  ) {
    return {
      code:
        record.code,

      name:
        record.name,

      ruleType:
        record.ruleType,

      rawText:
        record.rawText,

      classification:
        'MUST_FIX',

      authoritative:
        false,

      containsUnparsedText:
        record.parsed
          .containsUnparsedText,

      reasons: [
        'PARSED_ROOT_MISSING',
      ],
    };
  }

  if (
    record.parsed
      .containsUnparsedText
  ) {
    return {
      code:
        record.code,

      name:
        record.name,

      ruleType:
        record.ruleType,

      rawText:
        record.rawText,

      classification:
        'SAFE_RAW_FALLBACK',

      authoritative:
        false,

      containsUnparsedText:
        true,

      reasons:
        classifyFallbackReasons(
          record,
        ),
    };
  }

  return {
    code:
      record.code,

    name:
      record.name,

    ruleType:
      record.ruleType,

    rawText:
      record.rawText,

    classification:
      'AUTHORITATIVE_STRUCTURED',

    authoritative:
      true,

    containsUnparsedText:
      false,

    reasons: [
      'NO_TEXT_FALLBACK',
      'STRUCTURED_AST_AUTHORITATIVE',
    ],
  };
}

export async function buildUsydRequisiteFreezeV1():
Promise<UsydRequisiteFreezeDataset> {
  const units =
    await readUnits();

  const rules =
    buildRuleRecords(
      units,
    );

  const records =
    rules.map(
      classifyRecord,
    );

  const ruleKeys =
    records.map(
      (record) =>
        `${record.code}|${record.ruleType}`,
    );

  const duplicateRuleKeys =
    ruleKeys.length -
    new Set(
      ruleKeys,
    ).size;

  const authoritativeStructured =
    records.filter(
      (record) =>
        record.classification ===
        'AUTHORITATIVE_STRUCTURED',
    );

  const safeRawFallback =
    records.filter(
      (record) =>
        record.classification ===
        'SAFE_RAW_FALLBACK',
    );

  const mustFix =
    records.filter(
      (record) =>
        record.classification ===
        'MUST_FIX',
    );

  const targetCodes =
    new Set([
      'PHYS4036',
      'PRFM2608',
      'PRFM3622',
      'PRFM3624',
    ]);

  const v63TargetFallbacks =
    safeRawFallback.filter(
      (record) =>
        targetCodes.has(
          record.code,
        ),
    ).length;

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    parserVersion:
      'V6.3',

    generatedAt:
      new Date().toISOString(),

    policy: {
      structuredRuleAuthority:
        'ONLY_WHEN_NO_TEXT',

      rawFallbackAuthority:
        'RAW_TEXT_IS_SOURCE_OF_TRUTH',

      partialAstUse:
        'DIAGNOSTIC_ONLY_FOR_RAW_FALLBACK',
    },

    counts: {
      units:
        units.length,

      rules:
        records.length,

      authoritativeStructured:
        authoritativeStructured.length,

      safeRawFallback:
        safeRawFallback.length,

      mustFix:
        mustFix.length,

      textRules:
        records.filter(
          (record) =>
            record.containsUnparsedText,
        ).length,

      missingRawText:
        records.filter(
          (record) =>
            !record.rawText.trim(),
        ).length,

      missingRoot:
        rules.filter(
          (record) =>
            !record.parsed.root,
        ).length,

      duplicateRuleKeys,

      v63TargetFallbacks,
    },

    records,

    coverage: {
      structuralInvariants:
        'COMPLETE',

      referencePreservation:
        'COMPLETE',

      targetedV63Fixes:
        'COMPLETE',

      rawFallbackClassification:
        'COMPLETE',

      requisiteSemantics:
        'FROZEN_LOSSLESS',
    },
  };
}

export async function writeUsydRequisiteFreezeV1():
Promise<void> {
  const result =
    await buildUsydRequisiteFreezeV1();

  if (
    result.counts.units !==
      EXPECTED_UNIT_COUNT ||
    result.counts.rules !==
      EXPECTED_RULE_COUNT ||
    result.counts.textRules !==
      EXPECTED_TEXT_RULE_COUNT ||
    result.counts.mustFix !==
      0 ||
    result.counts.missingRawText !==
      0 ||
    result.counts.missingRoot !==
      0 ||
    result.counts.duplicateRuleKeys !==
      0 ||
    result.counts.v63TargetFallbacks !==
      0
  ) {
    throw new Error(
      [
        'Refusing to freeze USYD requisites.',
        `units=${result.counts.units}`,
        `rules=${result.counts.rules}`,
        `text=${result.counts.textRules}`,
        `mustFix=${result.counts.mustFix}`,
        `missingRaw=${result.counts.missingRawText}`,
        `missingRoot=${result.counts.missingRoot}`,
        `duplicates=${result.counts.duplicateRuleKeys}`,
        `v63TargetFallbacks=${result.counts.v63TargetFallbacks}`,
      ].join(' '),
    );
  }

  const temporary =
    `${OUTPUT_FILE}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      result,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    OUTPUT_FILE,
  );

  console.log(
    '[USYD requisite freeze V1] PASS',
  );

  console.log(
    `Authoritative structured: ${result.counts.authoritativeStructured}`,
  );

  console.log(
    `Safe raw fallback: ${result.counts.safeRawFallback}`,
  );

  console.log(
    `MUST_FIX: ${result.counts.mustFix}`,
  );

  console.log(
    `Output: ${OUTPUT_FILE}`,
  );
}
