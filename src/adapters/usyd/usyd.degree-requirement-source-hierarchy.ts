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

type UnknownRecord = Record<string, unknown>;

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
  ast: unknown;
  reasons: string[];
}

interface AstDataset {
  counts: {
    degrees: number;
    sourceClauses: number;
  };
  clauses: AstClause[];
}

export interface UsydRequirementHierarchyNode {
  id: string;

  degreeCode: string;
  degreeTitle: string;

  sourcePath: string;
  sourceIndex: number;

  raw: string;

  parseStatus:
    AstClause['parseStatus'];

  ast: unknown;

  reasons: string[];

  duplicateOf:
    string | null;

  parentId:
    string | null;

  childIds:
    string[];

  depth: number;

  hierarchyRole:
    | 'ROOT'
    | 'CONTAINER'
    | 'LEAF'
    | 'DUPLICATE'
    | 'NON_REQUIREMENT';
}

export interface UsydDegreeRequirementHierarchy {
  degreeCode: string;
  degreeTitle: string;

  rootIds: string[];

  activeNodeIds: string[];

  duplicateNodeIds: string[];

  nonRequirementNodeIds: string[];
}

export interface UsydDegreeRequirementHierarchyDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    degrees: number;
    sourceClauses: number;

    activeRequirementNodes: number;
    exactDuplicateNodes: number;
    nonRequirementNodes: number;

    roots: number;
    containers: number;
    leaves: number;

    parentLinks: number;

    degreesWithMultipleRoots: number;
    degreesWithSingleRoot: number;
    degreesWithNoRequirementRoot: number;

    orphanActiveNodes: number;

    missingNodeMappings: number;
    duplicateNodeIds: number;
  };

  degrees:
    UsydDegreeRequirementHierarchy[];

  nodes:
    UsydRequirementHierarchyNode[];

  coverage: {
    exactDuplicateDedup: 'COMPLETE';
    sourceContainmentHierarchy: 'COMPLETE_DIAGNOSTIC';
    requirementRootSelection: 'SOURCE_ROOTS_ONLY';
    semanticRootLogic: 'NOT_YET_ASSIGNED';
    formalDegreeSemantics: 'NOT_YET_COMPLETE';
  };
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

function canonical(
  value: string,
): string {
  return normalize(value)
    .toLocaleLowerCase(
      'en-AU',
    );
}

async function readAst():
Promise<AstDataset> {
  const raw =
    await fs.readFile(
      AST_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as AstDataset;

  if (
    !Array.isArray(
      parsed.clauses,
    )
  ) {
    throw new Error(
      'AST V2 is missing clauses[]. Run the AST V2 writer first.',
    );
  }

  return parsed;
}

function nodeId(
  clause: AstClause,
): string {
  return [
    clause.degreeCode,
    clause.sourceIndex,
    Buffer
      .from(
        canonical(
          clause.sourcePath,
        ),
      )
      .toString(
        'base64url',
      )
      .slice(
        0,
        18,
      ),
  ].join(':');
}

function exactDuplicateKey(
  clause: AstClause,
): string {
  return [
    clause.degreeCode,
    canonical(
      clause.raw,
    ),
  ].join('|');
}

function sourceSpecificity(
  clause: AstClause,
): number {
  /**
   * Prefer the more specific sourcePath and lower sourceIndex as the
   * canonical representative for exact duplicate raw clauses.
   */
  return (
    clause.sourcePath
      .split('.')
      .length *
      100000
  ) -
  clause.sourceIndex;
}

function chooseCanonicalDuplicate(
  clauses: AstClause[],
): AstClause {
  return [
    ...clauses,
  ].sort(
    (
      left,
      right,
    ) =>
      sourceSpecificity(
        right,
      ) -
      sourceSpecificity(
        left,
      ) ||
      left.sourceIndex -
        right.sourceIndex,
  )[0];
}

function containmentScore(
  parent: AstClause,
  child: AstClause,
): number {
  const parentRaw =
    canonical(
      parent.raw,
    );

  const childRaw =
    canonical(
      child.raw,
    );

  if (
    parentRaw ===
    childRaw
  ) {
    return -1;
  }

  if (
    childRaw.length <
    12
  ) {
    /**
     * Tiny fragments such as "with a stream" are too ambiguous to
     * establish containment safely from text alone.
     */
    return -1;
  }

  if (
    !parentRaw.includes(
      childRaw,
    )
  ) {
    return -1;
  }

  /**
   * Smallest containing parent wins. This creates:
   * full resolution -> subsection -> atomic subclause
   * where the source extraction actually provides those layers.
   */
  return (
    parentRaw.length -
    childRaw.length
  );
}

function findParent(
  child: AstClause,
  candidates: AstClause[],
): AstClause | null {
  const possible =
    candidates
      .filter(
        (candidate) =>
          candidate !==
            child &&
          candidate.degreeCode ===
            child.degreeCode &&
          candidate.parseStatus !==
            'NON_REQUIREMENT',
      )
      .map(
        (candidate) => ({
          candidate,
          score:
            containmentScore(
              candidate,
              child,
            ),
        }),
      )
      .filter(
        (item) =>
          item.score >=
          0,
      )
      .sort(
        (
          left,
          right,
        ) =>
          left.score -
            right.score ||
          left.candidate
            .sourceIndex -
          right.candidate
            .sourceIndex,
      );

  return (
    possible[0]
      ?.candidate ??
    null
  );
}

function computeDepth(
  id: string,
  nodes:
    Map<
      string,
      UsydRequirementHierarchyNode
    >,
): number {
  let depth =
    0;

  let current =
    nodes.get(
      id,
    );

  const seen =
    new Set<string>();

  while (
    current?.parentId
  ) {
    if (
      seen.has(
        current.id,
      )
    ) {
      throw new Error(
        `Cycle detected in requirement hierarchy at ${current.id}.`,
      );
    }

    seen.add(
      current.id,
    );

    depth +=
      1;

    current =
      nodes.get(
        current.parentId,
      );
  }

  return depth;
}

export async function buildUsydDegreeRequirementSourceHierarchyV1():
Promise<UsydDegreeRequirementHierarchyDataset> {
  const ast =
    await readAst();

  const byDuplicateKey =
    new Map<
      string,
      AstClause[]
    >();

  for (
    const clause
    of ast.clauses
  ) {
    if (
      clause.parseStatus ===
      'NON_REQUIREMENT'
    ) {
      continue;
    }

    const key =
      exactDuplicateKey(
        clause,
      );

    const current =
      byDuplicateKey.get(
        key,
      ) ??
      [];

    current.push(
      clause,
    );

    byDuplicateKey.set(
      key,
      current,
    );
  }

  const canonicalByDuplicateKey =
    new Map<
      string,
      AstClause
    >();

  for (
    const [
      key,
      group,
    ]
    of byDuplicateKey
  ) {
    canonicalByDuplicateKey.set(
      key,
      chooseCanonicalDuplicate(
        group,
      ),
    );
  }

  const nodes =
    new Map<
      string,
      UsydRequirementHierarchyNode
    >();

  const clauseById =
    new Map<
      string,
      AstClause
    >();

  for (
    const clause
    of ast.clauses
  ) {
    const id =
      nodeId(
        clause,
      );

    if (
      nodes.has(
        id,
      )
    ) {
      throw new Error(
        `Duplicate generated hierarchy node id: ${id}`,
      );
    }

    clauseById.set(
      id,
      clause,
    );

    let duplicateOf:
      string | null =
      null;

    if (
      clause.parseStatus !==
      'NON_REQUIREMENT'
    ) {
      const canonicalClause =
        canonicalByDuplicateKey.get(
          exactDuplicateKey(
            clause,
          ),
        );

      if (
        canonicalClause &&
        canonicalClause !==
          clause
      ) {
        duplicateOf =
          nodeId(
            canonicalClause,
          );
      }
    }

    nodes.set(
      id,
      {
        id,

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
          clause.parseStatus,

        ast:
          clause.ast,

        reasons:
          [...clause.reasons],

        duplicateOf,

        parentId:
          null,

        childIds:
          [],

        depth:
          0,

        hierarchyRole:
          clause.parseStatus ===
            'NON_REQUIREMENT'
            ? 'NON_REQUIREMENT'
            : duplicateOf
              ? 'DUPLICATE'
              : 'LEAF',
      },
    );
  }

  const activeClauses =
    ast.clauses.filter(
      (clause) => {
        if (
          clause.parseStatus ===
          'NON_REQUIREMENT'
        ) {
          return false;
        }

        const canonicalClause =
          canonicalByDuplicateKey.get(
            exactDuplicateKey(
              clause,
            ),
          );

        return (
          canonicalClause ===
          clause
        );
      },
    );

  /**
   * Source containment links are diagnostic structure only.
   * They do not assert ALL/ANY semantics.
   */
  for (
    const child
    of activeClauses
  ) {
    const parent =
      findParent(
        child,
        activeClauses,
      );

    if (!parent) {
      continue;
    }

    const childId =
      nodeId(
        child,
      );

    const parentId =
      nodeId(
        parent,
      );

    const childNode =
      nodes.get(
        childId,
      );

    const parentNode =
      nodes.get(
        parentId,
      );

    if (
      !childNode ||
      !parentNode
    ) {
      throw new Error(
        'Internal hierarchy mapping failure.',
      );
    }

    childNode.parentId =
      parentId;

    parentNode.childIds.push(
      childId,
    );
  }

  for (
    const node
    of nodes.values()
  ) {
    if (
      node.hierarchyRole ===
        'NON_REQUIREMENT' ||
      node.hierarchyRole ===
        'DUPLICATE'
    ) {
      continue;
    }

    node.depth =
      computeDepth(
        node.id,
        nodes,
      );

    if (
      node.parentId ===
      null
    ) {
      node.hierarchyRole =
        'ROOT';
    } else if (
      node.childIds.length >
      0
    ) {
      node.hierarchyRole =
        'CONTAINER';
    } else {
      node.hierarchyRole =
        'LEAF';
    }
  }

  const degreeCodes =
    [
      ...new Set(
        ast.clauses.map(
          (clause) =>
            clause.degreeCode,
        ),
      ),
    ].sort();

  const degrees:
    UsydDegreeRequirementHierarchy[] =
    [];

  for (
    const code
    of degreeCodes
  ) {
    const degreeNodes =
      [
        ...nodes.values(),
      ].filter(
        (node) =>
          node.degreeCode ===
          code,
      );

    const title =
      degreeNodes[0]
        ?.degreeTitle ??
      code;

    const active =
      degreeNodes.filter(
        (node) =>
          node.hierarchyRole !==
            'DUPLICATE' &&
          node.hierarchyRole !==
            'NON_REQUIREMENT',
      );

    degrees.push({
      degreeCode:
        code,

      degreeTitle:
        title,

      rootIds:
        active
          .filter(
            (node) =>
              node.parentId ===
              null,
          )
          .map(
            (node) =>
              node.id,
          )
          .sort(),

      activeNodeIds:
        active
          .map(
            (node) =>
              node.id,
          )
          .sort(),

      duplicateNodeIds:
        degreeNodes
          .filter(
            (node) =>
              node.hierarchyRole ===
              'DUPLICATE',
          )
          .map(
            (node) =>
              node.id,
          )
          .sort(),

      nonRequirementNodeIds:
        degreeNodes
          .filter(
            (node) =>
              node.hierarchyRole ===
              'NON_REQUIREMENT',
          )
          .map(
            (node) =>
              node.id,
          )
          .sort(),
    });
  }

  const allNodes =
    [
      ...nodes.values(),
    ];

  const activeRequirementNodes =
    allNodes.filter(
      (node) =>
        node.hierarchyRole !==
          'DUPLICATE' &&
        node.hierarchyRole !==
          'NON_REQUIREMENT',
    );

  const rootNodes =
    activeRequirementNodes.filter(
      (node) =>
        node.hierarchyRole ===
        'ROOT',
    );

  const nodeIds =
    allNodes.map(
      (node) =>
        node.id,
    );

  const duplicateNodeIds =
    nodeIds.length -
    new Set(
      nodeIds,
    ).size;

  const mappedSourceKeys =
    new Set(
      allNodes.map(
        (node) =>
          [
            node.degreeCode,
            node.sourcePath,
            node.sourceIndex,
            canonical(
              node.raw,
            ),
          ].join('|'),
      ),
    );

  const sourceKeys =
    ast.clauses.map(
      (clause) =>
        [
          clause.degreeCode,
          clause.sourcePath,
          clause.sourceIndex,
          canonical(
            clause.raw,
          ),
        ].join('|'),
    );

  const missingNodeMappings =
    sourceKeys.filter(
      (key) =>
        !mappedSourceKeys.has(
          key,
        ),
    ).length;

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

      sourceClauses:
        ast.clauses.length,

      activeRequirementNodes:
        activeRequirementNodes.length,

      exactDuplicateNodes:
        allNodes.filter(
          (node) =>
            node.hierarchyRole ===
            'DUPLICATE',
        ).length,

      nonRequirementNodes:
        allNodes.filter(
          (node) =>
            node.hierarchyRole ===
            'NON_REQUIREMENT',
        ).length,

      roots:
        rootNodes.length,

      containers:
        activeRequirementNodes.filter(
          (node) =>
            node.hierarchyRole ===
            'CONTAINER',
        ).length,

      leaves:
        activeRequirementNodes.filter(
          (node) =>
            node.hierarchyRole ===
            'LEAF',
        ).length,

      parentLinks:
        activeRequirementNodes.filter(
          (node) =>
            node.parentId !==
            null,
        ).length,

      degreesWithMultipleRoots:
        degrees.filter(
          (degree) =>
            degree.rootIds.length >
            1,
        ).length,

      degreesWithSingleRoot:
        degrees.filter(
          (degree) =>
            degree.rootIds.length ===
            1,
        ).length,

      degreesWithNoRequirementRoot:
        degrees.filter(
          (degree) =>
            degree.rootIds.length ===
            0,
        ).length,

      orphanActiveNodes:
        activeRequirementNodes.filter(
          (node) =>
            node.parentId !==
              null &&
            !nodes.has(
              node.parentId,
            ),
        ).length,

      missingNodeMappings,

      duplicateNodeIds,
    },

    degrees,

    nodes:
      allNodes.sort(
        (
          left,
          right,
        ) =>
          left.degreeCode.localeCompare(
            right.degreeCode,
          ) ||
          left.sourceIndex -
            right.sourceIndex,
      ),

    coverage: {
      exactDuplicateDedup:
        'COMPLETE',

      sourceContainmentHierarchy:
        'COMPLETE_DIAGNOSTIC',

      requirementRootSelection:
        'SOURCE_ROOTS_ONLY',

      semanticRootLogic:
        'NOT_YET_ASSIGNED',

      formalDegreeSemantics:
        'NOT_YET_COMPLETE',
    },
  };
}

export async function writeUsydDegreeRequirementSourceHierarchyV1():
Promise<void> {
  const result =
    await buildUsydDegreeRequirementSourceHierarchyV1();

  if (
    result.counts
      .missingNodeMappings !==
      0 ||
    result.counts
      .duplicateNodeIds !==
      0 ||
    result.counts
      .orphanActiveNodes !==
      0 ||
    result.counts
      .degreesWithNoRequirementRoot !==
      0
  ) {
    throw new Error(
      [
        'Refusing to write requirement hierarchy.',
        `missingMappings=${result.counts.missingNodeMappings}`,
        `duplicateNodeIds=${result.counts.duplicateNodeIds}`,
        `orphans=${result.counts.orphanActiveNodes}`,
        `degreesWithoutRoot=${result.counts.degreesWithNoRequirementRoot}`,
      ].join(' '),
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-degree-requirement-source-hierarchy.v1.json',
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
    '[USYD degree requirement source hierarchy V1] PASS',
  );

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Source clauses: ${result.counts.sourceClauses}`,
  );

  console.log(
    `Active requirement nodes: ${result.counts.activeRequirementNodes}`,
  );

  console.log(
    `Exact duplicate nodes: ${result.counts.exactDuplicateNodes}`,
  );

  console.log(
    `Non-requirement nodes: ${result.counts.nonRequirementNodes}`,
  );

  console.log(
    `Roots: ${result.counts.roots}`,
  );

  console.log(
    `Parent links: ${result.counts.parentLinks}`,
  );

  console.log(
    `Degrees with multiple roots: ${result.counts.degreesWithMultipleRoots}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
