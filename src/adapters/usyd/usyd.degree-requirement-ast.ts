import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const AUDIT_FILE = path.join(
  DATA_DIR,
  'usyd-degree-requirement-semantic-audit.json',
);

type ComponentRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM'
  | 'SECOND_MAJOR';

type TableRef =
  | 'A'
  | 'S'
  | 'D'
  | 'O';

type RequirementLogic =
  | 'ALL'
  | 'ANY';

export type UsydRequirementAstNode =
  | {
      nodeType: 'GROUP';
      logic: RequirementLogic;
      children: UsydRequirementAstNode[];
    }
  | {
      nodeType: 'COMPONENT';
      role: ComponentRole;
      creditPoints: number | null;
      tables: TableRef[];
    }
  | {
      nodeType: 'CREDIT_POINTS';
      creditPoints: number;
      qualifier:
        | 'EXACT'
        | 'MINIMUM'
        | 'MAXIMUM';
    }
  | {
      nodeType: 'SUBJECT';
      code: string;
    }
  | {
      nodeType: 'TABLE';
      table: TableRef;
    }
  | {
      nodeType: 'RAW';
      raw: string;
      reason: string[];
    };

interface SourceClause {
  degreeCode: string;
  degreeTitle: string;
  sourcePath: string;
  sourceIndex: number;
  raw: string;
  semanticClass: string;
  logicHint:
    | 'ALL'
    | 'ANY'
    | 'UNKNOWN';
  creditPoints: number[];
  tableReferences: TableRef[];
  componentRoles: ComponentRole[];
  subjectCodes: string[];
  flags: {
    hasAnd: boolean;
    hasOr: boolean;
    hasNestedNumbering: boolean;
    hasConditionalLanguage: boolean;
    hasSectionReference: boolean;
    hasRawTableChoice: boolean;
    hasKnownSemanticRisk: boolean;
  };
  knownRiskReasons: string[];
}

interface AuditDataset {
  clauses: SourceClause[];
  counts: {
    degrees: number;
    clauses: number;
  };
}

export interface UsydRequirementAstClause {
  degreeCode: string;
  degreeTitle: string;
  sourcePath: string;
  sourceIndex: number;

  raw: string;

  parseStatus:
    | 'AUTHORITATIVE'
    | 'RAW_FALLBACK'
    | 'NON_REQUIREMENT';

  ast:
    UsydRequirementAstNode | null;

  reasons: string[];
}

export interface UsydDegreeRequirementAstDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    degrees: number;
    sourceClauses: number;

    authoritativeClauses: number;
    rawFallbackClauses: number;
    nonRequirementClauses: number;

    authoritativeComponentClauses: number;
    authoritativeCreditPointClauses: number;
    authoritativeSubjectClauses: number;
    authoritativeTableClauses: number;

    knownRiskRawFallbacks: number;

    missingClauseMappings: number;
    duplicateClauseMappings: number;
  };

  clauses:
    UsydRequirementAstClause[];

  coverage: {
    sourceClauseInventory: 'COMPLETE';
    clauseAstCoverage: 'COMPLETE';
    riskyClausePolicy: 'RAW_PRESERVED';
    sourceNoisePolicy: 'EXCLUDED_NOT_REQUIREMENT';
    degreeRootHierarchy: 'NOT_YET_BUILT';
    formalDegreeSemantics: 'PARTIAL_SAFE_CLAUSE_AST';
  };
}

function normalize(
  value: string,
): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readAudit():
Promise<AuditDataset> {
  const raw =
    await fs.readFile(
      AUDIT_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as AuditDataset;

  if (
    !Array.isArray(
      parsed.clauses,
    )
  ) {
    throw new Error(
      'Requirement semantic audit is missing clauses[].',
    );
  }

  return parsed;
}

function isSourceNoise(
  raw: string,
): boolean {
  const text =
    normalize(raw);

  return (
    /^https?:\/\/\S+$/i.test(
      text,
    ) ||
    /^www\.\S+$/i.test(
      text,
    )
  );
}

function qualifierForCreditPoint(
  raw: string,
  creditPoints: number,
): 'EXACT' | 'MINIMUM' | 'MAXIMUM' {
  const escaped =
    String(
      creditPoints,
    );

  if (
    new RegExp(
      `(?:minimum of|at least)\\s+${escaped}\\s+(?:credit points?|cp)`,
      'i',
    ).test(
      raw,
    )
  ) {
    return 'MINIMUM';
  }

  if (
    new RegExp(
      `(?:maximum of|up to(?:\\s+a\\s+maximum\\s+of)?)\\s+${escaped}\\s+(?:credit points?|cp)`,
      'i',
    ).test(
      raw,
    )
  ) {
    return 'MAXIMUM';
  }

  return 'EXACT';
}

function roleCreditPoints(
  raw: string,
  role: ComponentRole,
): number | null {
  const patterns:
    Record<
      ComponentRole,
      RegExp[]
    > =
    {
      MAJOR: [
        /\bmajor\s*\(\s*(\d{1,3})\s*(?:credit points?|cp)?\s*\)/i,
        /\b(\d{1,3})\s*(?:credit points?|cp)\s+(?:of\s+)?(?:a\s+)?(?:cognate\s+)?major\b/i,
      ],

      SECOND_MAJOR: [
        /\bsecond major\s*\(\s*(\d{1,3})\s*(?:credit points?|cp)?\s*\)/i,
        /\b(\d{1,3})\s*(?:credit points?|cp)\s+(?:of\s+)?(?:a\s+)?second major\b/i,
      ],

      MINOR: [
        /\bminor\s*\(\s*(\d{1,3})\s*(?:credit points?|cp)?\s*\)/i,
        /\b(\d{1,3})\s*(?:credit points?|cp)\s+(?:of\s+)?(?:a\s+)?minor\b/i,
      ],

      PROGRAM: [
        /\b(\d{1,3})\s*(?:credit points?|cp)\s+[^.;]{0,80}\bprogram\b/i,
        /\bprogram\s*\(\s*(\d{1,3})\s*(?:credit points?|cp)?\s*\)/i,
      ],

      STREAM: [
        /\bstream\s*\(\s*(\d{1,3})\s*(?:credit points?|cp)?\s*\)/i,
      ],
    };

  for (
    const pattern
    of patterns[
      role
    ]
  ) {
    const match =
      raw.match(
        pattern,
      );

    if (
      match
    ) {
      const value =
        Number(
          match[1],
        );

      if (
        Number.isFinite(
          value,
        )
      ) {
        return value;
      }
    }
  }

  return null;
}

function unsafeReasons(
  clause: SourceClause,
): string[] {
  const reasons:
    string[] =
    [];

  if (
    clause.flags
      .hasKnownSemanticRisk
  ) {
    reasons.push(
      ...clause
        .knownRiskReasons,
    );
  }

  if (
    clause.flags
      .hasNestedNumbering
  ) {
    reasons.push(
      'NESTED_NUMBERING',
    );
  }

  if (
    clause.flags
      .hasConditionalLanguage
  ) {
    reasons.push(
      'CONDITIONAL_LANGUAGE',
    );
  }

  if (
    clause.flags.hasAnd &&
    clause.flags.hasOr
  ) {
    reasons.push(
      'MIXED_AND_OR_PRECEDENCE',
    );
  }

  const lower =
    clause.raw.toLowerCase();

  /**
   * Safety gates discovered from V1 samples.
   * These phrases carry semantics that cannot be represented by a bare
   * CREDIT_POINTS/TABLE node.
   */
  if (
    /\bplacement\b|\bpracticum\b|\bclinical\b/.test(
      lower,
    )
  ) {
    reasons.push(
      'PLACEMENT_OR_CLINICAL_SEMANTICS',
    );
  }

  if (
    /\belective\b|\bselective\b|\bcore units?\b|\bhonours units?\b/.test(
      lower,
    ) &&
    clause.creditPoints.length >
      0
  ) {
    reasons.push(
      'QUALIFIED_CREDIT_POINT_BUCKET',
    );
  }

  if (
    /\bmake up\b.*\b(?:total|credit points?)\b/.test(
      lower,
    ) ||
    /\bbring the total\b/.test(
      lower,
    )
  ) {
    reasons.push(
      'RESIDUAL_CREDIT_POINT_TOTAL',
    );
  }

  if (
    /\bmaximum\b|\bminimum\b|\bat least\b|\bup to\b/.test(
      lower,
    ) &&
    clause.creditPoints.length >
      1
  ) {
    reasons.push(
      'MULTIPLE_CREDIT_POINT_CONSTRAINTS',
    );
  }

  if (
    /\bfrom part\s+\d\b|\bpart\s+[a-z0-9-]+\b/i.test(
      clause.raw,
    )
  ) {
    reasons.push(
      'PART_OR_SUBTABLE_CONSTRAINT',
    );
  }

  return [
    ...new Set(
      reasons,
    ),
  ];
}

function parseSafeComponentClause(
  clause: SourceClause,
): UsydRequirementAstNode | null {
  if (
    clause.componentRoles.length !==
    1
  ) {
    return null;
  }

  if (
    clause.subjectCodes.length >
    0
  ) {
    return null;
  }

  const role =
    clause.componentRoles[0];

  return {
    nodeType:
      'COMPONENT',

    role,

    creditPoints:
      roleCreditPoints(
        clause.raw,
        role,
      ),

    tables:
      [...clause.tableReferences],
  };
}

function parseSafeSubjectClause(
  clause: SourceClause,
): UsydRequirementAstNode | null {
  if (
    clause.subjectCodes.length ===
    0
  ) {
    return null;
  }

  if (
    clause.componentRoles.length >
      0 ||
    clause.tableReferences.length >
      0 ||
    clause.creditPoints.length >
      1
  ) {
    return null;
  }

  const subjects =
    clause.subjectCodes.map(
      (code) => ({
        nodeType:
          'SUBJECT' as const,

        code,
      }),
    );

  if (
    subjects.length ===
    1
  ) {
    return subjects[0];
  }

  if (
    clause.logicHint ===
    'UNKNOWN'
  ) {
    return null;
  }

  return {
    nodeType:
      'GROUP',

    logic:
      clause.logicHint,

    children:
      subjects,
  };
}

function parseSafeCreditPointClause(
  clause: SourceClause,
): UsydRequirementAstNode | null {
  if (
    clause.creditPoints.length !==
      1 ||
    clause.componentRoles.length >
      0 ||
    clause.subjectCodes.length >
      0 ||
    clause.tableReferences.length >
      0
  ) {
    return null;
  }

  const creditPoints =
    clause.creditPoints[0];

  return {
    nodeType:
      'CREDIT_POINTS',

    creditPoints,

    qualifier:
      qualifierForCreditPoint(
        clause.raw,
        creditPoints,
      ),
  };
}

function parseSafeTableClause(
  clause: SourceClause,
): UsydRequirementAstNode | null {
  if (
    clause.tableReferences.length !==
      1 ||
    clause.componentRoles.length >
      0 ||
    clause.subjectCodes.length >
      0 ||
    clause.creditPoints.length >
      0
  ) {
    return null;
  }

  /**
   * Table references containing a semantic bucket should not collapse to
   * a bare TABLE node.
   */
  if (
    /\belective\b|\bselective\b|\bcore\b|\bhonours\b|\bstream\b/i.test(
      clause.raw,
    )
  ) {
    return null;
  }

  return {
    nodeType:
      'TABLE',

    table:
      clause.tableReferences[0],
  };
}

function parseClause(
  clause: SourceClause,
): UsydRequirementAstClause {
  if (
    isSourceNoise(
      clause.raw,
    )
  ) {
    return {
      degreeCode:
        clause.degreeCode,

      degreeTitle:
        clause.degreeTitle,

      sourcePath:
        clause.sourcePath,

      sourceIndex:
        clause.sourceIndex,

      raw:
        clause.raw,

      parseStatus:
        'NON_REQUIREMENT',

      ast:
        null,

      reasons: [
        'SOURCE_URL',
      ],
    };
  }

  const risks =
    unsafeReasons(
      clause,
    );

  if (
    risks.length >
    0
  ) {
    return {
      degreeCode:
        clause.degreeCode,

      degreeTitle:
        clause.degreeTitle,

      sourcePath:
        clause.sourcePath,

      sourceIndex:
        clause.sourceIndex,

      raw:
        clause.raw,

      parseStatus:
        'RAW_FALLBACK',

      ast: {
        nodeType:
          'RAW',

        raw:
          clause.raw,

        reason:
          risks,
      },

      reasons:
        risks,
    };
  }

  const parsers = [
    parseSafeComponentClause,
    parseSafeSubjectClause,
    parseSafeCreditPointClause,
    parseSafeTableClause,
  ];

  for (
    const parser
    of parsers
  ) {
    const ast =
      parser(
        clause,
      );

    if (
      ast
    ) {
      return {
        degreeCode:
          clause.degreeCode,

        degreeTitle:
          clause.degreeTitle,

        sourcePath:
          clause.sourcePath,

        sourceIndex:
          clause.sourceIndex,

        raw:
          clause.raw,

        parseStatus:
          'AUTHORITATIVE',

        ast,

        reasons: [],
      };
    }
  }

  return {
    degreeCode:
      clause.degreeCode,

    degreeTitle:
      clause.degreeTitle,

    sourcePath:
      clause.sourcePath,

    sourceIndex:
      clause.sourceIndex,

    raw:
      clause.raw,

    parseStatus:
      'RAW_FALLBACK',

    ast: {
      nodeType:
        'RAW',

      raw:
        clause.raw,

      reason: [
        'UNSUPPORTED_SAFE_PATTERN',
      ],
    },

    reasons: [
      'UNSUPPORTED_SAFE_PATTERN',
    ],
  };
}

function mappingKey(
  clause: {
    degreeCode: string;
    sourcePath: string;
    sourceIndex: number;
    raw: string;
  },
): string {
  return [
    clause.degreeCode,
    clause.sourcePath,
    String(
      clause.sourceIndex,
    ),
    normalize(
      clause.raw,
    ),
  ].join('|');
}

export async function buildUsydDegreeRequirementAstV2():
Promise<UsydDegreeRequirementAstDataset> {
  const audit =
    await readAudit();

  const clauses =
    audit.clauses.map(
      parseClause,
    );

  const sourceKeys =
    audit.clauses.map(
      mappingKey,
    );

  const astKeys =
    clauses.map(
      mappingKey,
    );

  const sourceKeySet =
    new Set(
      sourceKeys,
    );

  const astKeySet =
    new Set(
      astKeys,
    );

  const missingClauseMappings =
    [
      ...sourceKeySet,
    ].filter(
      (key) =>
        !astKeySet.has(
          key,
        ),
    ).length;

  const duplicateClauseMappings =
    astKeys.length -
    astKeySet.size;

  const authoritative =
    clauses.filter(
      (clause) =>
        clause.parseStatus ===
        'AUTHORITATIVE',
    );

  const rawFallback =
    clauses.filter(
      (clause) =>
        clause.parseStatus ===
        'RAW_FALLBACK',
    );

  const nonRequirement =
    clauses.filter(
      (clause) =>
        clause.parseStatus ===
        'NON_REQUIREMENT',
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      degrees:
        audit.counts.degrees,

      sourceClauses:
        audit.counts.clauses,

      authoritativeClauses:
        authoritative.length,

      rawFallbackClauses:
        rawFallback.length,

      nonRequirementClauses:
        nonRequirement.length,

      authoritativeComponentClauses:
        authoritative.filter(
          (clause) =>
            clause.ast?.nodeType ===
            'COMPONENT',
        ).length,

      authoritativeCreditPointClauses:
        authoritative.filter(
          (clause) =>
            clause.ast?.nodeType ===
            'CREDIT_POINTS',
        ).length,

      authoritativeSubjectClauses:
        authoritative.filter(
          (clause) =>
            clause.ast?.nodeType ===
              'SUBJECT' ||
            (
              clause.ast?.nodeType ===
                'GROUP' &&
              clause.ast.children.every(
                (child) =>
                  child.nodeType ===
                  'SUBJECT',
              )
            ),
        ).length,

      authoritativeTableClauses:
        authoritative.filter(
          (clause) =>
            clause.ast?.nodeType ===
            'TABLE',
        ).length,

      knownRiskRawFallbacks:
        rawFallback.filter(
          (clause) =>
            clause.reasons.some(
              (reason) =>
                reason !==
                'UNSUPPORTED_SAFE_PATTERN',
            ),
        ).length,

      missingClauseMappings,

      duplicateClauseMappings,
    },

    clauses,

    coverage: {
      sourceClauseInventory:
        'COMPLETE',

      clauseAstCoverage:
        'COMPLETE',

      riskyClausePolicy:
        'RAW_PRESERVED',

      sourceNoisePolicy:
        'EXCLUDED_NOT_REQUIREMENT',

      degreeRootHierarchy:
        'NOT_YET_BUILT',

      formalDegreeSemantics:
        'PARTIAL_SAFE_CLAUSE_AST',
    },
  };
}

export async function writeUsydDegreeRequirementAstV2():
Promise<void> {
  const result =
    await buildUsydDegreeRequirementAstV2();

  if (
    result.counts
      .missingClauseMappings !==
      0 ||
    result.counts
      .duplicateClauseMappings !==
      0
  ) {
    throw new Error(
      [
        'Refusing to write AST V2.',
        `missing=${result.counts.missingClauseMappings}`,
        `duplicates=${result.counts.duplicateClauseMappings}`,
      ].join(' '),
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-degree-requirement-ast.v2.json',
    );

  const temporary =
    `${outputFile}.tmp`;

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
    outputFile,
  );

  console.log(
    '[USYD degree requirement AST V2] PASS',
  );

  console.log(
    `Source clauses: ${result.counts.sourceClauses}`,
  );

  console.log(
    `Authoritative clauses: ${result.counts.authoritativeClauses}`,
  );

  console.log(
    `Raw fallback clauses: ${result.counts.rawFallbackClauses}`,
  );

  console.log(
    `Non-requirement clauses: ${result.counts.nonRequirementClauses}`,
  );

  console.log(
    `Known-risk raw fallbacks: ${result.counts.knownRiskRawFallbacks}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
