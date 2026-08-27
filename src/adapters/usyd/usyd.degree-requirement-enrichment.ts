import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const AST_FILE = path.join(
  DATA_DIR,
  'usyd-degree-requirement-ast.v2.json',
);

const ROOT_FILE = path.join(
  DATA_DIR,
  'usyd-degree-root-semantics.v2.json',
);

type UnknownRecord = Record<string, unknown>;

type TableRef =
  | 'A'
  | 'S'
  | 'D'
  | 'O';

type ComponentRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM'
  | 'SECOND_MAJOR';

export type UsydFormalRequirementNode =
  | {
      nodeType: 'GROUP';
      logic: 'ALL' | 'ANY';
      children: UsydFormalRequirementNode[];
    }
  | {
      nodeType: 'COMPONENT';
      role: ComponentRole;
      creditPoints: number | null;
      tables: TableRef[];
      qualifier: string | null;
    }
  | {
      nodeType: 'CREDIT_POINTS';
      creditPoints: number;
      qualifier: 'EXACT' | 'MINIMUM' | 'MAXIMUM';
      category: string | null;
      tables: TableRef[];
    }
  | {
      nodeType: 'CONDITIONAL';
      condition:
        | 'DALYELL_ENROLLED'
        | 'DALYELL_NOT_ENROLLED'
        | 'PREVIOUSLY_DALYELL'
        | 'STREAM_ENROLLED';
      requirement: UsydFormalRequirementNode;
    }
  | {
      nodeType: 'RAW';
      raw: string;
      reason: string[];
    };

interface AstClause {
  degreeCode: string;
  degreeTitle: string;
  sourcePath: string;
  sourceIndex: number;
  raw: string;
  parseStatus:
    | 'AUTHORITATIVE'
    | 'RAW_FALLBACK'
    | 'NON_REQUIREMENT';
  ast: UnknownRecord | null;
  reasons: string[];
}

interface AstDataset {
  clauses: AstClause[];
}

interface RootDegree {
  degreeCode: string;
  degreeTitle: string;
  canonicalRootId: string;
}

interface RootDataset {
  degrees: RootDegree[];
}

export interface EnrichedClause {
  degreeCode: string;
  degreeTitle: string;
  sourcePath: string;
  sourceIndex: number;
  raw: string;

  status:
    | 'AUTHORITATIVE'
    | 'RAW_FALLBACK'
    | 'NON_REQUIREMENT';

  source:
    | 'AST_V2'
    | 'ENRICHMENT_V2';

  node:
    UsydFormalRequirementNode | UnknownRecord | null;

  reasons: string[];
}

export interface UsydDegreeRequirementEnrichmentDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    degrees: number;
    clauses: number;

    inheritedAuthoritative: number;
    newlyAuthoritative: number;
    rawFallback: number;
    nonRequirement: number;

    enrichedMajorOrProgram: number;
    enrichedMinorOrSecondMajor: number;
    enrichedTableAOrTableS: number;
    enrichedDalyellConditions: number;
    enrichedStreamConditions: number;

    rejectedAmbiguousDalyellClauses: number;

    missingClauseMappings: number;
    duplicateClauseMappings: number;
  };

  clauses:
    EnrichedClause[];

  coverage: {
    rootSelection: 'COMPLETE';
    safeClauseSemantics: 'ENRICHED';
    complexNestedResolutions: 'RAW_PRESERVED_WHEN_UNSAFE';
    formalDegreeSemantics: 'PARTIAL_ENRICHED';
  };
}

async function readJson<T>(
  filePath: string,
): Promise<T> {
  const raw =
    await fs.readFile(
      filePath,
      'utf8',
    );

  return JSON.parse(
    raw,
  ) as T;
}

function normalize(
  value: string,
): string {
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tableRefs(
  raw: string,
): TableRef[] {
  const out:
    TableRef[] =
    [];

  for (
    const match
    of raw.matchAll(
      /\bTable\s+([ASDO])\b/gi,
    )
  ) {
    out.push(
      match[1]
        .toUpperCase() as
        TableRef,
    );
  }

  return [
    ...new Set(out),
  ];
}

function cpNear(
  raw: string,
  label: RegExp,
): number | null {
  const match =
    raw.match(
      label,
    );

  if (!match) {
    return null;
  }

  const value =
    Number(
      match[1],
    );

  return Number.isFinite(
    value,
  )
    ? value
    : null;
}

function majorOrProgram(
  raw: string,
): UsydFormalRequirementNode | null {
  if (
    !/\bmajor\b/i.test(raw) ||
    !/\bprogram\b/i.test(raw) ||
    !/\bor\b/i.test(raw)
  ) {
    return null;
  }

  const majorCp =
    cpNear(
      raw,
      /\bmajor\s*\(\s*(\d{1,3})\s*(?:credit points?|cp)?\s*\)/i,
    );

  const programCp =
    cpNear(
      raw,
      /\b(\d{1,3})\s*(?:credit points?|cp)\s+[^.;]{0,50}\bprogram\b/i,
    );

  const tables =
    tableRefs(
      raw,
    );

  return {
    nodeType:
      'GROUP',

    logic:
      'ANY',

    children: [
      {
        nodeType:
          'COMPONENT',

        role:
          'MAJOR',

        creditPoints:
          majorCp,

        tables,

        qualifier:
          null,
      },
      {
        nodeType:
          'COMPONENT',

        role:
          'PROGRAM',

        creditPoints:
          programCp,

        tables,

        qualifier:
          /embedded major/i.test(
            raw,
          )
            ? 'EMBEDDED_MAJOR'
            : null,
      },
    ],
  };
}

function minorOrSecondMajor(
  raw: string,
): UsydFormalRequirementNode | null {
  if (
    !/\bminor\b/i.test(raw) ||
    !/\bsecond major\b/i.test(raw) ||
    !/\bor\b/i.test(raw)
  ) {
    return null;
  }

  const minorCp =
    cpNear(
      raw,
      /\bminor\s*\(\s*(\d{1,3})\s*(?:credit points?|cp)?\s*\)/i,
    );

  const majorCp =
    cpNear(
      raw,
      /\bsecond major\s*\(\s*(\d{1,3})\s*(?:credit points?|cp)?\s*\)/i,
    );

  const tables =
    tableRefs(
      raw,
    );

  return {
    nodeType:
      'GROUP',

    logic:
      'ANY',

    children: [
      {
        nodeType:
          'COMPONENT',

        role:
          'MINOR',

        creditPoints:
          minorCp,

        tables,

        qualifier:
          null,
      },
      {
        nodeType:
          'COMPONENT',

        role:
          'SECOND_MAJOR',

        creditPoints:
          majorCp,

        tables,

        qualifier:
          null,
      },
    ],
  };
}

function simpleTableAOrS(
  raw: string,
): UsydFormalRequirementNode | null {
  if (
    !/\bTable A\b/i.test(raw) ||
    !/\bTable S\b/i.test(raw) ||
    !/\bor\b/i.test(raw)
  ) {
    return null;
  }

  const lower =
    raw.toLowerCase();

  const roles:
    ComponentRole[] =
    [];

  if (
    /\bsecond major\b/.test(
      lower,
    )
  ) {
    roles.push(
      'SECOND_MAJOR',
    );
  }

  const withoutSecond =
    lower.replace(
      /\bsecond major\b/g,
      '',
    );

  if (
    /\bmajor\b/.test(
      withoutSecond,
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
    roles.length !==
    1
  ) {
    return null;
  }

  if (
    /\belective\b|\bcore\b|\bstream\b|\bdalyell\b/i.test(
      raw,
    )
  ) {
    return null;
  }

  const role =
    roles[0];

  return {
    nodeType:
      'COMPONENT',

    role,

    creditPoints:
      cpNear(
        raw,
        new RegExp(
          `\\b${role === 'SECOND_MAJOR' ? 'second major' : role.toLowerCase()}\\s*\\(\\s*(\\d{1,3})\\s*(?:credit points?|cp)?\\s*\\)`,
          'i',
        ),
      ),

    tables: [
      'A',
      'S',
    ],

    qualifier:
      'TABLE_A_OR_TABLE_S',
  };
}

/**
 * V2 safety rule:
 * Dalyell enrichment is only allowed when the ENTIRE clause is the Dalyell
 * condition itself. If the phrase appears inside a broader elective/table/
 * resolution sentence, leave the clause RAW.
 */
function dalyellCondition(
  raw: string,
): UsydFormalRequirementNode | null {
  const text =
    normalize(
      raw,
    );

  if (
    text.length >
    420
  ) {
    return null;
  }

  const startsNotEnrolled =
    /^for students not enrolled in the dalyell stream[,:\s]/i.test(
      text,
    );

  const startsEnrolled =
    /^for students enrolled in the dalyell stream[,:\s]/i.test(
      text,
    );

  const startsPrevious =
    /^(students|for students) previously but no longer enrolled in the dalyell stream\b/i.test(
      text,
    );

  if (
    !startsNotEnrolled &&
    !startsEnrolled &&
    !startsPrevious
  ) {
    return null;
  }

  /**
   * Reject clauses that continue into a new resolution section or contain
   * unrelated global totals. These were false positives in V1.
   */
  if (
    /\bto qualify for the award\b/i.test(
      text,
    ) ||
    /\bin these resolutions\b/i.test(
      text,
    ) ||
    /\bcomprising\b/i.test(
      text,
    ) ||
    /\btotal of?\s+\d{2,3}\s+credit points\b/i.test(
      text,
    )
  ) {
    return null;
  }

  const tables =
    tableRefs(
      text,
    );

  const cpMatch =
    text.match(
      /\b(?:minimum of\s+|at least\s+)?(\d{1,3})\s*(?:credit points?|cp)/i,
    );

  const cp =
    cpMatch
      ? Number(
          cpMatch[1],
        )
      : null;

  if (
    startsNotEnrolled
  ) {
    if (
      cp === null
    ) {
      return null;
    }

    return {
      nodeType:
        'CONDITIONAL',

      condition:
        'DALYELL_NOT_ENROLLED',

      requirement: {
        nodeType:
          'CREDIT_POINTS',

        creditPoints:
          cp,

        qualifier:
          /minimum of|at least/i.test(
            text,
          )
            ? 'MINIMUM'
            : 'EXACT',

        category:
          /open learning environment/i.test(
            text,
          )
            ? 'OPEN_LEARNING_ENVIRONMENT'
            : null,

        tables,
      },
    };
  }

  if (
    startsEnrolled
  ) {
    if (
      cp === null
    ) {
      return null;
    }

    return {
      nodeType:
        'CONDITIONAL',

      condition:
        'DALYELL_ENROLLED',

      requirement: {
        nodeType:
          'CREDIT_POINTS',

        creditPoints:
          cp,

        qualifier:
          /minimum of|at least/i.test(
            text,
          )
            ? 'MINIMUM'
            : 'EXACT',

        category:
          'DALYELL',

        tables:
          tables.length >
          0
            ? tables
            : ['D'],
      },
    };
  }

  if (
    startsPrevious
  ) {
    return {
      nodeType:
        'CONDITIONAL',

      condition:
        'PREVIOUSLY_DALYELL',

      requirement: {
        nodeType:
          'RAW',

        raw:
          text,

        reason: [
          'DALYELL_TRANSITION_EXCEPTION',
        ],
      },
    };
  }

  return null;
}

function streamCondition(
  raw: string,
): UsydFormalRequirementNode | null {
  const text =
    normalize(
      raw,
    );

  if (
    !/^if enrolled in a stream[,:\s]/i.test(
      text,
    )
  ) {
    return null;
  }

  if (
    text.length >
    420
  ) {
    return null;
  }

  return {
    nodeType:
      'CONDITIONAL',

    condition:
      'STREAM_ENROLLED',

    requirement: {
      nodeType:
        'COMPONENT',

      role:
        'STREAM',

      creditPoints:
        null,

      tables:
        tableRefs(
          text,
        ),

      qualifier:
        'COMPLETE_STREAM_REQUIREMENTS',
    },
  };
}

function canTryEnrichment(
  clause: AstClause,
): boolean {
  if (
    clause.parseStatus !==
    'RAW_FALLBACK'
  ) {
    return false;
  }

  if (
    /\(\s*1\s*\).*\(\s*2\s*\)/s.test(
      clause.raw,
    )
  ) {
    return false;
  }

  if (
    clause.raw.length >
    900
  ) {
    return false;
  }

  return true;
}

function enrich(
  clause: AstClause,
): UsydFormalRequirementNode | null {
  if (
    !canTryEnrichment(
      clause,
    )
  ) {
    return null;
  }

  const parsers = [
    dalyellCondition,
    streamCondition,
    minorOrSecondMajor,
    majorOrProgram,
    simpleTableAOrS,
  ];

  for (
    const parser
    of parsers
  ) {
    const node =
      parser(
        clause.raw,
      );

    if (node) {
      return node;
    }
  }

  return null;
}

function keyFor(
  item: {
    degreeCode: string;
    sourcePath: string;
    sourceIndex: number;
    raw: string;
  },
): string {
  return [
    item.degreeCode,
    item.sourcePath,
    item.sourceIndex,
    normalize(
      item.raw,
    ),
  ].join('|');
}

function isAmbiguousDalyellClause(
  raw: string,
): boolean {
  const text =
    normalize(
      raw,
    );

  const hasDalyellPhrase =
    /for students enrolled in the dalyell stream/i.test(
      text,
    );

  if (
    !hasDalyellPhrase
  ) {
    return false;
  }

  return (
    !/^for students enrolled in the dalyell stream[,:\s]/i.test(
      text,
    ) ||
    /\bto qualify for the award\b/i.test(
      text,
    ) ||
    /\bin these resolutions\b/i.test(
      text,
    ) ||
    /\bcomprising\b/i.test(
      text,
    ) ||
    text.length >
    420
  );
}

export async function buildUsydDegreeRequirementEnrichmentV2():
Promise<UsydDegreeRequirementEnrichmentDataset> {
  const [
    ast,
    roots,
  ] =
    await Promise.all([
      readJson<AstDataset>(
        AST_FILE,
      ),
      readJson<RootDataset>(
        ROOT_FILE,
      ),
    ]);

  if (
    !Array.isArray(
      ast.clauses,
    )
  ) {
    throw new Error(
      'AST V2 is missing clauses[].',
    );
  }

  if (
    !Array.isArray(
      roots.degrees,
    ) ||
    roots.degrees.length !==
    109
  ) {
    throw new Error(
      'Root semantics V2 must contain all 109 degrees.',
    );
  }

  const output:
    EnrichedClause[] =
    [];

  let newlyAuthoritative =
    0;

  let enrichedMajorOrProgram =
    0;

  let enrichedMinorOrSecondMajor =
    0;

  let enrichedTableAOrTableS =
    0;

  let enrichedDalyellConditions =
    0;

  let enrichedStreamConditions =
    0;

  let rejectedAmbiguousDalyellClauses =
    0;

  for (
    const clause
    of ast.clauses
  ) {
    if (
      clause.parseStatus ===
      'NON_REQUIREMENT'
    ) {
      output.push({
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

        status:
          'NON_REQUIREMENT',

        source:
          'AST_V2',

        node:
          null,

        reasons:
          [...clause.reasons],
      });

      continue;
    }

    if (
      clause.parseStatus ===
      'AUTHORITATIVE'
    ) {
      output.push({
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

        status:
          'AUTHORITATIVE',

        source:
          'AST_V2',

        node:
          clause.ast,

        reasons:
          [],
      });

      continue;
    }

    const node =
      enrich(
        clause,
      );

    if (!node) {
      if (
        isAmbiguousDalyellClause(
          clause.raw,
        )
      ) {
        rejectedAmbiguousDalyellClauses +=
          1;
      }

      output.push({
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

        status:
          'RAW_FALLBACK',

        source:
          'AST_V2',

        node:
          clause.ast,

        reasons:
          [...clause.reasons],
      });

      continue;
    }

    newlyAuthoritative +=
      1;

    if (
      node.nodeType ===
      'GROUP'
    ) {
      const roles =
        node.children
          .filter(
            (
              child,
            ): child is Extract<
              UsydFormalRequirementNode,
              {
                nodeType: 'COMPONENT';
              }
            > =>
              child.nodeType ===
              'COMPONENT',
          )
          .map(
            (child) =>
              child.role,
          );

      if (
        roles.includes(
          'MAJOR',
        ) &&
        roles.includes(
          'PROGRAM',
        )
      ) {
        enrichedMajorOrProgram +=
          1;
      }

      if (
        roles.includes(
          'MINOR',
        ) &&
        roles.includes(
          'SECOND_MAJOR',
        )
      ) {
        enrichedMinorOrSecondMajor +=
          1;
      }
    }

    if (
      node.nodeType ===
        'COMPONENT' &&
      node.qualifier ===
        'TABLE_A_OR_TABLE_S'
    ) {
      enrichedTableAOrTableS +=
        1;
    }

    if (
      node.nodeType ===
      'CONDITIONAL'
    ) {
      if (
        node.condition ===
          'STREAM_ENROLLED'
      ) {
        enrichedStreamConditions +=
          1;
      } else {
        enrichedDalyellConditions +=
          1;
      }
    }

    output.push({
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

      status:
        'AUTHORITATIVE',

      source:
        'ENRICHMENT_V2',

      node,

      reasons:
        [],
    });
  }

  const sourceKeys =
    ast.clauses.map(
      keyFor,
    );

  const outputKeys =
    output.map(
      keyFor,
    );

  const sourceSet =
    new Set(
      sourceKeys,
    );

  const outputSet =
    new Set(
      outputKeys,
    );

  const missingClauseMappings =
    [
      ...sourceSet,
    ].filter(
      (key) =>
        !outputSet.has(
          key,
        ),
    ).length;

  const duplicateClauseMappings =
    outputKeys.length -
    outputSet.size;

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      degrees:
        roots.degrees.length,

      clauses:
        output.length,

      inheritedAuthoritative:
        output.filter(
          (item) =>
            item.status ===
              'AUTHORITATIVE' &&
            item.source ===
              'AST_V2',
        ).length,

      newlyAuthoritative,

      rawFallback:
        output.filter(
          (item) =>
            item.status ===
            'RAW_FALLBACK',
        ).length,

      nonRequirement:
        output.filter(
          (item) =>
            item.status ===
            'NON_REQUIREMENT',
        ).length,

      enrichedMajorOrProgram,

      enrichedMinorOrSecondMajor,

      enrichedTableAOrTableS,

      enrichedDalyellConditions,

      enrichedStreamConditions,

      rejectedAmbiguousDalyellClauses,

      missingClauseMappings,

      duplicateClauseMappings,
    },

    clauses:
      output,

    coverage: {
      rootSelection:
        'COMPLETE',

      safeClauseSemantics:
        'ENRICHED',

      complexNestedResolutions:
        'RAW_PRESERVED_WHEN_UNSAFE',

      formalDegreeSemantics:
        'PARTIAL_ENRICHED',
    },
  };
}

export async function writeUsydDegreeRequirementEnrichmentV2():
Promise<void> {
  const result =
    await buildUsydDegreeRequirementEnrichmentV2();

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
        'Refusing to write requirement enrichment V2.',
        `missing=${result.counts.missingClauseMappings}`,
        `duplicates=${result.counts.duplicateClauseMappings}`,
      ].join(' '),
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-degree-requirement-enriched.v2.json',
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
    '[USYD degree requirement enrichment V2] PASS',
  );

  console.log(
    `Inherited authoritative: ${result.counts.inheritedAuthoritative}`,
  );

  console.log(
    `Newly authoritative: ${result.counts.newlyAuthoritative}`,
  );

  console.log(
    `Raw fallback: ${result.counts.rawFallback}`,
  );

  console.log(
    `Rejected ambiguous Dalyell clauses: ${result.counts.rejectedAmbiguousDalyellClauses}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
