import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const V1_FILE = path.join(
  DATA_DIR,
  'usyd-degree-root-semantics.v1.json',
);

type RootStatus =
  | 'AUTHORITATIVE_SINGLE_ROOT'
  | 'REVIEW_MULTI_ROOT';

interface SourceRoot {
  id: string;
  sourcePath: string;
  sourceIndex: number;
  parseStatus:
    | 'AUTHORITATIVE'
    | 'RAW_FALLBACK'
    | 'NON_REQUIREMENT';
  raw: string;
  childCount: number;
}

interface V1Degree {
  degreeCode: string;
  degreeTitle: string;
  sourceRootIds: string[];
  semanticStatus: RootStatus;
  rootLogic:
    | 'SOURCE_ROOT'
    | 'UNKNOWN';
  semanticRoot: unknown;
  sourceRoots: SourceRoot[];
}

interface V1Dataset {
  degrees: V1Degree[];
}

export interface UsydDegreeSemanticRootV2 {
  degreeCode: string;
  degreeTitle: string;

  sourceRootIds: string[];

  semanticStatus:
    | 'AUTHORITATIVE_SINGLE_ROOT'
    | 'AUTHORITATIVE_RESOLVED_MULTI_ROOT';

  rootLogic: 'SOURCE_ROOT';

  semanticRoot: {
    nodeType: 'SOURCE_ROOT';
    sourceNodeId: string;
  };

  canonicalRootId: string;

  excludedRootIds: string[];

  resolutionReason:
    | 'ORIGINAL_SINGLE_ROOT'
    | 'STRAY_SUBCLAUSE_ROOT'
    | 'LABEL_FRAGMENT_ROOT'
    | 'CONNECTOR_FRAGMENT_ROOT';

  sourceRoots: SourceRoot[];
}

export interface UsydDegreeRootSemanticsV2Dataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    degrees: number;

    originalSingleRootDegrees: number;
    resolvedMultiRootDegrees: number;

    unresolvedMultiRootDegrees: number;

    excludedLabelFragments: number;
    excludedConnectorFragments: number;
    excludedStraySubclauses: number;

    missingCanonicalRoots: number;
    duplicateDegreeCodes: number;
  };

  degrees:
    UsydDegreeSemanticRootV2[];

  coverage: {
    degreeRootSelection: 'COMPLETE';
    multiRootResolution: 'COMPLETE';
    rootLogic: 'SOURCE_ROOT_ONLY';
    formalDegreeSemantics: 'ROOT_SELECTION_COMPLETE_CLAUSE_SEMANTICS_PARTIAL';
  };
}

async function readV1():
Promise<V1Dataset> {
  const raw =
    await fs.readFile(
      V1_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as V1Dataset;

  if (
    !Array.isArray(
      parsed.degrees,
    )
  ) {
    throw new Error(
      'Degree root semantics V1 is missing degrees[]. Run the V1 writer first.',
    );
  }

  return parsed;
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

function canonicalRootForMulti(
  degree: V1Degree,
): {
  canonical: SourceRoot;
  excluded: SourceRoot[];
  reason:
    | 'STRAY_SUBCLAUSE_ROOT'
    | 'LABEL_FRAGMENT_ROOT'
    | 'CONNECTOR_FRAGMENT_ROOT';
} {
  const roots =
    degree.sourceRoots;

  if (
    roots.length !==
    2
  ) {
    throw new Error(
      `${degree.degreeCode}: expected exactly 2 review roots, got ${roots.length}.`,
    );
  }

  const rawRequirements =
    roots.find(
      (root) =>
        root.sourcePath ===
        'rawRequirements',
    );

  if (!rawRequirements) {
    throw new Error(
      `${degree.degreeCode}: multi-root review has no rawRequirements root.`,
    );
  }

  const other =
    roots.find(
      (root) =>
        root.id !==
        rawRequirements.id,
    );

  if (!other) {
    throw new Error(
      `${degree.degreeCode}: could not identify secondary root.`,
    );
  }

  const otherRaw =
    normalize(
      other.raw,
    );

  if (
    /^(above;\s*and|above|and|or)$/i.test(
      otherRaw,
    )
  ) {
    return {
      canonical:
        rawRequirements,

      excluded:
        [other],

      reason:
        'CONNECTOR_FRAGMENT_ROOT',
    };
  }

  if (
    degree.degreeCode ===
      'BHECONOH-02' &&
    /^Economics$/i.test(
      otherRaw,
    )
  ) {
    return {
      canonical:
        rawRequirements,

      excluded:
        [other],

      reason:
        'LABEL_FRAGMENT_ROOT',
    };
  }

  if (
    /^Table\s+[ASDO]\s*;?$/i.test(
      otherRaw,
    )
  ) {
    return {
      canonical:
        rawRequirements,

      excluded:
        [other],

      reason:
        'STRAY_SUBCLAUSE_ROOT',
    };
  }

  throw new Error(
    [
      `${degree.degreeCode}: unrecognised secondary root; refusing to guess.`,
      `Path=${other.sourcePath}`,
      `Raw=${other.raw}`,
    ].join(' '),
  );
}

export async function buildUsydDegreeRootSemanticsV2():
Promise<UsydDegreeRootSemanticsV2Dataset> {
  const v1 =
    await readV1();

  const output:
    UsydDegreeSemanticRootV2[] =
    [];

  let excludedLabelFragments =
    0;

  let excludedConnectorFragments =
    0;

  let excludedStraySubclauses =
    0;

  let missingCanonicalRoots =
    0;

  for (
    const degree
    of v1.degrees
  ) {
    if (
      degree.semanticStatus ===
      'AUTHORITATIVE_SINGLE_ROOT'
    ) {
      const root =
        degree.sourceRoots[0];

      if (!root) {
        missingCanonicalRoots +=
          1;

        continue;
      }

      output.push({
        degreeCode:
          degree.degreeCode,

        degreeTitle:
          degree.degreeTitle,

        sourceRootIds:
          [...degree.sourceRootIds],

        semanticStatus:
          'AUTHORITATIVE_SINGLE_ROOT',

        rootLogic:
          'SOURCE_ROOT',

        semanticRoot: {
          nodeType:
            'SOURCE_ROOT',

          sourceNodeId:
            root.id,
        },

        canonicalRootId:
          root.id,

        excludedRootIds:
          [],

        resolutionReason:
          'ORIGINAL_SINGLE_ROOT',

        sourceRoots:
          [...degree.sourceRoots],
      });

      continue;
    }

    const resolved =
      canonicalRootForMulti(
        degree,
      );

    switch (
      resolved.reason
    ) {
      case 'LABEL_FRAGMENT_ROOT':
        excludedLabelFragments +=
          resolved.excluded.length;
        break;

      case 'CONNECTOR_FRAGMENT_ROOT':
        excludedConnectorFragments +=
          resolved.excluded.length;
        break;

      case 'STRAY_SUBCLAUSE_ROOT':
        excludedStraySubclauses +=
          resolved.excluded.length;
        break;
    }

    output.push({
      degreeCode:
        degree.degreeCode,

      degreeTitle:
        degree.degreeTitle,

      sourceRootIds:
        [...degree.sourceRootIds],

      semanticStatus:
        'AUTHORITATIVE_RESOLVED_MULTI_ROOT',

      rootLogic:
        'SOURCE_ROOT',

      semanticRoot: {
        nodeType:
          'SOURCE_ROOT',

        sourceNodeId:
          resolved.canonical.id,
      },

      canonicalRootId:
        resolved.canonical.id,

      excludedRootIds:
        resolved.excluded.map(
          (root) =>
            root.id,
        ),

      resolutionReason:
        resolved.reason,

      sourceRoots:
        [...degree.sourceRoots],
    });
  }

  const degreeCodes =
    output.map(
      (degree) =>
        degree.degreeCode,
    );

  const duplicateDegreeCodes =
    degreeCodes.length -
    new Set(
      degreeCodes,
    ).size;

  const originalSingleRootDegrees =
    output.filter(
      (degree) =>
        degree.semanticStatus ===
        'AUTHORITATIVE_SINGLE_ROOT',
    ).length;

  const resolvedMultiRootDegrees =
    output.filter(
      (degree) =>
        degree.semanticStatus ===
        'AUTHORITATIVE_RESOLVED_MULTI_ROOT',
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
        output.length,

      originalSingleRootDegrees,

      resolvedMultiRootDegrees,

      unresolvedMultiRootDegrees:
        0,

      excludedLabelFragments,

      excludedConnectorFragments,

      excludedStraySubclauses,

      missingCanonicalRoots,

      duplicateDegreeCodes,
    },

    degrees:
      output.sort(
        (
          left,
          right,
        ) =>
          left.degreeCode.localeCompare(
            right.degreeCode,
          ),
      ),

    coverage: {
      degreeRootSelection:
        'COMPLETE',

      multiRootResolution:
        'COMPLETE',

      rootLogic:
        'SOURCE_ROOT_ONLY',

      formalDegreeSemantics:
        'ROOT_SELECTION_COMPLETE_CLAUSE_SEMANTICS_PARTIAL',
    },
  };
}

export async function writeUsydDegreeRootSemanticsV2():
Promise<void> {
  const result =
    await buildUsydDegreeRootSemanticsV2();

  if (
    result.counts
      .unresolvedMultiRootDegrees !==
      0 ||
    result.counts
      .missingCanonicalRoots !==
      0 ||
    result.counts
      .duplicateDegreeCodes !==
      0
  ) {
    throw new Error(
      [
        'Refusing to write degree root semantics V2.',
        `unresolvedMulti=${result.counts.unresolvedMultiRootDegrees}`,
        `missingCanonical=${result.counts.missingCanonicalRoots}`,
        `duplicateDegreeCodes=${result.counts.duplicateDegreeCodes}`,
      ].join(' '),
    );
  }

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-degree-root-semantics.v2.json',
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
    '[USYD degree root semantics V2] PASS',
  );

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Original single-root degrees: ${result.counts.originalSingleRootDegrees}`,
  );

  console.log(
    `Resolved multi-root degrees: ${result.counts.resolvedMultiRootDegrees}`,
  );

  console.log(
    `Unresolved multi-root degrees: ${result.counts.unresolvedMultiRootDegrees}`,
  );

  console.log(
    `Excluded label fragments: ${result.counts.excludedLabelFragments}`,
  );

  console.log(
    `Excluded connector fragments: ${result.counts.excludedConnectorFragments}`,
  );

  console.log(
    `Excluded stray subclauses: ${result.counts.excludedStraySubclauses}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
