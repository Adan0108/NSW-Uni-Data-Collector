import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const MASTER_FILE = path.join(
  DATA_DIR,
  'usyd-master-global.json',
);

const RELATIONSHIP_FILE = path.join(
  DATA_DIR,
  'usyd-degree-component-relationships.final.json',
);

type UnknownRecord = Record<string, unknown>;

export type UsydRequirementSemanticClass =
  | 'COMPONENT_CHOICE'
  | 'UNIT_REQUIREMENT'
  | 'CREDIT_POINT_REQUIREMENT'
  | 'TABLE_REFERENCE'
  | 'ELECTIVE_REQUIREMENT'
  | 'HONOURS_REQUIREMENT'
  | 'DALYELL_REQUIREMENT'
  | 'PLACEMENT_REQUIREMENT'
  | 'MIXED_REQUIREMENT'
  | 'OTHER';

export type UsydRequirementLogicHint =
  | 'ALL'
  | 'ANY'
  | 'UNKNOWN';

export interface UsydDegreeRequirementSourceClause {
  degreeCode: string;
  degreeTitle: string;

  sourcePath: string;
  sourceIndex: number;

  raw: string;

  semanticClass:
    UsydRequirementSemanticClass;

  logicHint:
    UsydRequirementLogicHint;

  creditPoints: number[];

  tableReferences:
    Array<'A' | 'S' | 'D' | 'O'>;

  componentRoles: Array<
    'MAJOR'
    | 'MINOR'
    | 'PROGRAM'
    | 'STREAM'
    | 'SECOND_MAJOR'
  >;

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

  authoritative:
    false;
}

export interface UsydDegreeRequirementSemanticAudit {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    degrees: number;
    clauses: number;

    componentChoiceClauses: number;
    unitRequirementClauses: number;
    creditPointRequirementClauses: number;
    tableReferenceClauses: number;
    mixedRequirementClauses: number;

    clausesWithAnd: number;
    clausesWithOr: number;
    clausesWithNestedNumbering: number;
    conditionalClauses: number;

    knownSemanticRiskClauses: number;

    degreesWithoutExtractedClauses: number;

    relationshipLayerPresent: boolean;
  };

  degreesWithoutExtractedClauses:
    Array<{
      degreeCode: string;
      degreeTitle: string;
    }>;

  clauses:
    UsydDegreeRequirementSourceClause[];

  coverage: {
    sourceClauseInventory: 'COMPLETE';
    semanticClassification: 'DIAGNOSTIC_ONLY';
    formalAst: 'NOT_YET_BUILT';
    degreeRequirementSemantics: 'NOT_YET_COMPLETE';
  };
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function readJson(
  filePath: string,
): Promise<unknown> {
  const raw =
    await fs.readFile(
      filePath,
      'utf8',
    );

  return JSON.parse(raw) as unknown;
}

function normalize(
  value: string,
): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stringValue(
  value: unknown,
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null;
  }

  const normalized =
    normalize(value);

  return normalized
    ? normalized
    : null;
}

function firstString(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (
    const key
    of keys
  ) {
    const value =
      stringValue(
        record[key],
      );

    if (value) {
      return value;
    }
  }

  return null;
}

function loadDegrees(
  master: unknown,
): UnknownRecord[] {
  if (
    !isRecord(master)
  ) {
    throw new Error(
      'USYD master must be an object.',
    );
  }

  const directKeys = [
    'degrees',
    'standaloneDegrees',
    'degreeRecords',
  ];

  for (
    const key
    of directKeys
  ) {
    if (
      Array.isArray(
        master[key],
      )
    ) {
      return (
        master[key] as unknown[]
      ).filter(isRecord);
    }
  }

  if (
    isRecord(
      master.data,
    )
  ) {
    for (
      const key
      of directKeys
    ) {
      if (
        Array.isArray(
          master.data[key],
        )
      ) {
        return (
          master.data[key] as unknown[]
        ).filter(isRecord);
      }
    }
  }

  throw new Error(
    'Could not locate degree records in usyd-master-global.json.',
  );
}

function degreeCode(
  degree: UnknownRecord,
): string {
  return (
    firstString(
      degree,
      [
        'code',
        'degreeCode',
        'awardCode',
        'courseCode',
      ],
    ) ??
    'UNKNOWN'
  );
}

function degreeTitle(
  degree: UnknownRecord,
): string {
  return (
    firstString(
      degree,
      [
        'title',
        'name',
        'degreeTitle',
        'awardTitle',
      ],
    ) ??
    degreeCode(degree)
  );
}

/**
 * Requirement source extraction intentionally preserves raw source text.
 *
 * We only recurse through keys that look requirement/rule/resolution related.
 * This avoids pulling descriptions, marketing copy, or unrelated page text.
 */
function extractRequirementStrings(
  degree: UnknownRecord,
): Array<{
  path: string;
  raw: string;
}> {
  const output:
    Array<{
      path: string;
      raw: string;
    }> =
    [];

  const allowedRootKeys =
    new Set([
      'requirements',
      'requirement',
      'courseRequirements',
      'courseRequirement',
      'awardRequirements',
      'awardRequirement',
      'resolutions',
      'courseResolutions',
      'rules',
      'courseRules',
      'completionRequirements',
      'requirementsText',
      'requirementText',
    ]);

  const walk =
    (
      value: unknown,
      pathParts: string[],
    ) => {
      if (
        typeof value ===
        'string'
      ) {
        const raw =
          normalize(value);

        if (
          raw.length >=
          8
        ) {
          output.push({
            path:
              pathParts.join('.'),

            raw,
          });
        }

        return;
      }

      if (
        Array.isArray(value)
      ) {
        value.forEach(
          (
            item,
            index,
          ) => {
            walk(
              item,
              [
                ...pathParts,
                String(index),
              ],
            );
          },
        );

        return;
      }

      if (
        !isRecord(value)
      ) {
        return;
      }

      for (
        const [
          key,
          child,
        ]
        of Object.entries(
          value,
        )
      ) {
        walk(
          child,
          [
            ...pathParts,
            key,
          ],
        );
      }
    };

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      degree,
    )
  ) {
    if (
      allowedRootKeys.has(
        key,
      ) ||
      /requirement|resolution|course.?rule/i.test(
        key,
      )
    ) {
      walk(
        value,
        [
          key,
        ],
      );
    }
  }

  const seen =
    new Set<string>();

  return output.filter(
    (item) => {
      const key =
        `${item.path}|${item.raw}`;

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);
      return true;
    },
  );
}

function extractCreditPoints(
  raw: string,
): number[] {
  const values:
    number[] = [];

  const patterns = [
    /\b(\d{1,3})\s*credit points?\b/gi,
    /\b(\d{1,3})\s*cp\b/gi,
  ];

  for (
    const pattern
    of patterns
  ) {
    for (
      const match
      of raw.matchAll(
        pattern,
      )
    ) {
      const parsed =
        Number(
          match[1],
        );

      if (
        Number.isFinite(
          parsed,
        )
      ) {
        values.push(
          parsed,
        );
      }
    }
  }

  return [
    ...new Set(values),
  ];
}

function extractTableReferences(
  raw: string,
): Array<
  'A'
  | 'S'
  | 'D'
  | 'O'
> {
  const refs:
    Array<
      'A'
      | 'S'
      | 'D'
      | 'O'
    > =
    [];

  for (
    const match
    of raw.matchAll(
      /\bTable\s+([ASDO])\b/gi,
    )
  ) {
    refs.push(
      match[1]
        .toUpperCase() as
        'A'
        | 'S'
        | 'D'
        | 'O',
    );
  }

  return [
    ...new Set(refs),
  ];
}

function extractComponentRoles(
  raw: string,
): UsydDegreeRequirementSourceClause['componentRoles'] {
  const roles:
    UsydDegreeRequirementSourceClause['componentRoles'] =
    [];

  const lower =
    raw.toLowerCase();

  if (
    /\bsecond major\b/.test(
      lower,
    )
  ) {
    roles.push(
      'SECOND_MAJOR',
    );
  }

  if (
    /\bmajor\b/.test(
      lower.replace(
        /\bsecond major\b/g,
        '',
      ),
    )
  ) {
    roles.push(
      'MAJOR',
    );
  }

  if (
    /\bminor\b/.test(
      lower,
    )
  ) {
    roles.push(
      'MINOR',
    );
  }

  if (
    /\bprogram\b/.test(
      lower,
    )
  ) {
    roles.push(
      'PROGRAM',
    );
  }

  if (
    /\bstream\b/.test(
      lower,
    )
  ) {
    roles.push(
      'STREAM',
    );
  }

  return roles;
}

function extractSubjectCodes(
  raw: string,
): string[] {
  return [
    ...new Set(
      (
        raw.match(
          /\b[A-Z]{4}\d{4}\b/g,
        ) ??
        []
      ),
    ),
  ];
}

function logicHint(
  raw: string,
): UsydRequirementLogicHint {
  const hasAnd =
    /\band\b/i.test(
      raw,
    );

  const hasOr =
    /\bor\b/i.test(
      raw,
    );

  if (
    hasOr &&
    !hasAnd
  ) {
    return 'ANY';
  }

  if (
    hasAnd &&
    !hasOr
  ) {
    return 'ALL';
  }

  return 'UNKNOWN';
}

function semanticClass(
  raw: string,
  componentRoles:
    UsydDegreeRequirementSourceClause['componentRoles'],
  subjectCodes: string[],
  creditPoints: number[],
  tableReferences:
    UsydDegreeRequirementSourceClause['tableReferences'],
): UsydRequirementSemanticClass {
  const lower =
    raw.toLowerCase();

  const signals =
    [
      componentRoles.length >
        0,
      subjectCodes.length >
        0,
      creditPoints.length >
        0,
      tableReferences.length >
        0,
      /\belective/i.test(
        lower,
      ),
      /\bhonours?\b/i.test(
        lower,
      ),
      /\bdalyell\b/i.test(
        lower,
      ),
      /\bplacement\b|\bclinical\b|\bpracticum\b/i.test(
        lower,
      ),
    ].filter(Boolean).length;

  if (
    signals >
    1
  ) {
    return 'MIXED_REQUIREMENT';
  }

  if (
    componentRoles.length >
    0
  ) {
    return 'COMPONENT_CHOICE';
  }

  if (
    subjectCodes.length >
    0
  ) {
    return 'UNIT_REQUIREMENT';
  }

  if (
    creditPoints.length >
    0
  ) {
    return 'CREDIT_POINT_REQUIREMENT';
  }

  if (
    tableReferences.length >
    0
  ) {
    return 'TABLE_REFERENCE';
  }

  if (
    /\belective/i.test(
      lower,
    )
  ) {
    return 'ELECTIVE_REQUIREMENT';
  }

  if (
    /\bhonours?\b/i.test(
      lower,
    )
  ) {
    return 'HONOURS_REQUIREMENT';
  }

  if (
    /\bdalyell\b/i.test(
      lower,
    )
  ) {
    return 'DALYELL_REQUIREMENT';
  }

  if (
    /\bplacement\b|\bclinical\b|\bpracticum\b/i.test(
      lower,
    )
  ) {
    return 'PLACEMENT_REQUIREMENT';
  }

  return 'OTHER';
}

function knownRisks(
  degreeCodeValue: string,
  raw: string,
): string[] {
  const risks:
    string[] = [];

  if (
    /\bmajor\b.*\bor\b.*\bprogram\b/i.test(
      raw,
    ) ||
    /\bprogram\b.*\bor\b.*\bmajor\b/i.test(
      raw,
    )
  ) {
    risks.push(
      'MAJOR_OR_PROGRAM_BRANCH',
    );
  }

  if (
    /\bminor\b.*\bor\b.*\bsecond major\b/i.test(
      raw,
    )
  ) {
    risks.push(
      'MINOR_OR_SECOND_MAJOR_BRANCH',
    );
  }

  if (
    /\bTable A\b.*\bor\b.*\bTable S\b/i.test(
      raw,
    )
  ) {
    risks.push(
      'TABLE_A_OR_TABLE_S',
    );
  }

  if (
    /\bTable A\b.*\bor\b.*\bTable D\b/i.test(
      raw,
    ) ||
    /\bTable D\b.*\bor\b.*\bTable A\b/i.test(
      raw,
    )
  ) {
    risks.push(
      'TABLE_D_CONDITIONAL_BRANCH',
    );
  }

  if (
    /\bstream\b/i.test(
      raw,
    )
  ) {
    risks.push(
      'STREAM_SEMANTICS',
    );
  }

  if (
    /\bprogram\b/i.test(
      raw,
    ) &&
    /\bpsychology\b/i.test(
      raw,
    )
  ) {
    risks.push(
      'PSYCHOLOGY_PROGRAM_SPECIFICITY',
    );
  }

  if (
    degreeCodeValue ===
      'BPARTNUR-02' &&
    /\b7\s*\(\s*3\s*\)/i.test(
      raw,
    )
  ) {
    risks.push(
      'ARTS_NURSING_NESTED_NUMBERING',
    );
  }

  if (
    /\bif\b|\bwhere\b|\bunless\b|\bsubject to\b/i.test(
      raw,
    )
  ) {
    risks.push(
      'CONDITIONAL_LANGUAGE',
    );
  }

  return risks;
}

export async function auditUsydDegreeRequirementSemantics():
Promise<UsydDegreeRequirementSemanticAudit> {
  const [
    master,
    relationship,
  ] =
    await Promise.all([
      readJson(
        MASTER_FILE,
      ),
      readJson(
        RELATIONSHIP_FILE,
      ),
    ]);

  const degrees =
    loadDegrees(
      master,
    );

  const clauses:
    UsydDegreeRequirementSourceClause[] =
    [];

  const degreesWithoutExtractedClauses:
    UsydDegreeRequirementSemanticAudit['degreesWithoutExtractedClauses'] =
    [];

  for (
    const degree
    of degrees
  ) {
    const code =
      degreeCode(
        degree,
      );

    const title =
      degreeTitle(
        degree,
      );

    const extracted =
      extractRequirementStrings(
        degree,
      );

    if (
      extracted.length ===
      0
    ) {
      degreesWithoutExtractedClauses.push({
        degreeCode:
          code,

        degreeTitle:
          title,
      });

      continue;
    }

    extracted.forEach(
      (
        item,
        index,
      ) => {
        const cps =
          extractCreditPoints(
            item.raw,
          );

        const tables =
          extractTableReferences(
            item.raw,
          );

        const roles =
          extractComponentRoles(
            item.raw,
          );

        const subjects =
          extractSubjectCodes(
            item.raw,
          );

        const risks =
          knownRisks(
            code,
            item.raw,
          );

        const hasAnd =
          /\band\b/i.test(
            item.raw,
          );

        const hasOr =
          /\bor\b/i.test(
            item.raw,
          );

        clauses.push({
          degreeCode:
            code,

          degreeTitle:
            title,

          sourcePath:
            item.path,

          sourceIndex:
            index,

          raw:
            item.raw,

          semanticClass:
            semanticClass(
              item.raw,
              roles,
              subjects,
              cps,
              tables,
            ),

          logicHint:
            logicHint(
              item.raw,
            ),

          creditPoints:
            cps,

          tableReferences:
            tables,

          componentRoles:
            roles,

          subjectCodes:
            subjects,

          flags: {
            hasAnd,
            hasOr,

            hasNestedNumbering:
              /\(\s*[a-z0-9]+\s*\).*\(\s*[a-z0-9]+\s*\)/i.test(
                item.raw,
              ) ||
              /\b\d+\s*\(\s*\d+\s*\)/.test(
                item.raw,
              ),

            hasConditionalLanguage:
              /\bif\b|\bwhere\b|\bunless\b|\bsubject to\b/i.test(
                item.raw,
              ),

            hasSectionReference:
              /\bsection\s+\d+\b/i.test(
                item.raw,
              ),

            hasRawTableChoice:
              tables.length >
              1,

            hasKnownSemanticRisk:
              risks.length >
              0,
          },

          knownRiskReasons:
            risks,

          authoritative:
            false,
        });
      },
    );
  }

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      degrees:
        degrees.length,

      clauses:
        clauses.length,

      componentChoiceClauses:
        clauses.filter(
          (clause) =>
            clause.semanticClass ===
            'COMPONENT_CHOICE',
        ).length,

      unitRequirementClauses:
        clauses.filter(
          (clause) =>
            clause.semanticClass ===
            'UNIT_REQUIREMENT',
        ).length,

      creditPointRequirementClauses:
        clauses.filter(
          (clause) =>
            clause.semanticClass ===
            'CREDIT_POINT_REQUIREMENT',
        ).length,

      tableReferenceClauses:
        clauses.filter(
          (clause) =>
            clause.semanticClass ===
            'TABLE_REFERENCE',
        ).length,

      mixedRequirementClauses:
        clauses.filter(
          (clause) =>
            clause.semanticClass ===
            'MIXED_REQUIREMENT',
        ).length,

      clausesWithAnd:
        clauses.filter(
          (clause) =>
            clause.flags.hasAnd,
        ).length,

      clausesWithOr:
        clauses.filter(
          (clause) =>
            clause.flags.hasOr,
        ).length,

      clausesWithNestedNumbering:
        clauses.filter(
          (clause) =>
            clause.flags
              .hasNestedNumbering,
        ).length,

      conditionalClauses:
        clauses.filter(
          (clause) =>
            clause.flags
              .hasConditionalLanguage,
        ).length,

      knownSemanticRiskClauses:
        clauses.filter(
          (clause) =>
            clause.flags
              .hasKnownSemanticRisk,
        ).length,

      degreesWithoutExtractedClauses:
        degreesWithoutExtractedClauses.length,

      relationshipLayerPresent:
        isRecord(
          relationship,
        ),
    },

    degreesWithoutExtractedClauses,

    clauses:
      clauses.sort(
        (
          left,
          right,
        ) =>
          left.degreeCode.localeCompare(
            right.degreeCode,
          ) ||
          left.sourcePath.localeCompare(
            right.sourcePath,
          ) ||
          left.sourceIndex -
            right.sourceIndex,
      ),

    coverage: {
      sourceClauseInventory:
        'COMPLETE',

      semanticClassification:
        'DIAGNOSTIC_ONLY',

      formalAst:
        'NOT_YET_BUILT',

      degreeRequirementSemantics:
        'NOT_YET_COMPLETE',
    },
  };
}

export async function writeUsydDegreeRequirementSemanticAudit():
Promise<void> {
  const result =
    await auditUsydDegreeRequirementSemantics();

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-degree-requirement-semantic-audit.json',
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
    '[USYD degree requirement semantic audit V1] PASS',
  );

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Clauses: ${result.counts.clauses}`,
  );

  console.log(
    `Known semantic-risk clauses: ${result.counts.knownSemanticRiskClauses}`,
  );

  console.log(
    `Degrees without extracted clauses: ${result.counts.degreesWithoutExtractedClauses}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
