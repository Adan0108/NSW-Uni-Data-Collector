import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const SIGNAL_AUDIT_FILE = path.join(
  DATA_DIR,
  'usyd-unqualified-table-a-signal-audit.json',
);

const STAGE2_FILE = path.join(
  DATA_DIR,
  'usyd-degree-component-relationships.stage2.json',
);

type UnknownRecord = Record<string, unknown>;

type SafeSemanticClass =
  | 'DIRECT_TABLE_A_COMPONENT_CHOICE'
  | 'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE'
  | 'CROSS_FACULTY_TABLE_A_COMPONENT_CHOICE';

type ComponentRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM';

type TableAScope =
  | 'ARTS'
  | 'BUSINESS'
  | 'COMPUTING'
  | 'ECONOMICS'
  | 'SCIENCE'
  | 'CONSERVATORIUM'
  | 'ENGINEERING'
  | 'ARCHITECTURE'
  | 'MEDICINE_HEALTH';

interface SignalRecord {
  degreeCode: string | null;
  degreeTitle: string | null;
  degreeHandbook: string | null;
  componentType:
    | ComponentRole
    | 'STREAM'
    | null;
  tableNames: string[];
  raw: string;
  semanticClass: string;
  reason: string;
}

interface SignalAuditRoot {
  counts?: {
    directTableAComponentChoice?: number;
    tableAOrTableSComponentChoice?: number;
    crossFacultyTableAComponentChoice?: number;
  };
  records?: SignalRecord[];
}

interface ExistingQualifiedChoice {
  degreeCode: string;
  tableName: string;
  requestedComponentType: string;
}

export interface UsydUnqualifiedTableAScopeAuditRecord {
  degreeCode: string;
  degreeTitle: string;
  componentType: ComponentRole;

  semanticClass:
    SafeSemanticClass;

  raw: string;

  explicitScopes:
    TableAScope[];

  existingQualifiedScopes:
    TableAScope[];

  inferredScopeCandidates:
    TableAScope[];

  resolution:
    | 'EXACT_SCOPE'
    | 'MULTI_SCOPE_EXPLICIT'
    | 'ALREADY_COVERED_BY_QUALIFIED_POOL'
    | 'AMBIGUOUS_SCOPE'
    | 'NO_SCOPE_EVIDENCE';

  resolvedScopes:
    TableAScope[];

  dedupAgainstQualified:
    boolean;
}

export interface UsydUnqualifiedTableAScopeAuditDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    semanticSafeSignals: number;
    typedEligibleSignals: number;
    safeButUntypedSignals: number;
    degrees: number;

    exactScope: number;
    multiScopeExplicit: number;
    alreadyCoveredByQualifiedPool: number;
    ambiguousScope: number;
    noScopeEvidence: number;
  };

  excludedSafeButUntyped:
    Array<{
      degreeCode: string | null;
      degreeTitle: string | null;
      semanticClass: SafeSemanticClass;
      raw: string;
      componentType: null;
    }>;

  records:
    UsydUnqualifiedTableAScopeAuditRecord[];
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
  const raw = await fs.readFile(
    filePath,
    'utf8',
  );

  return JSON.parse(raw) as unknown;
}

function tableNameToScope(
  tableName: string,
): TableAScope | null {
  const lower =
    tableName.toLowerCase();

  if (
    lower.includes(
      'bachelor of science',
    )
  ) {
    return 'SCIENCE';
  }

  if (
    lower.includes(
      'bachelor of arts',
    )
  ) {
    return 'ARTS';
  }

  if (
    lower.includes(
      'bachelor of commerce',
    )
  ) {
    return 'BUSINESS';
  }

  if (
    lower.includes(
      'bachelor of computing',
    ) ||
    lower.includes(
      'advanced computing',
    )
  ) {
    return 'COMPUTING';
  }

  if (
    lower.includes(
      'bachelor of economics',
    )
  ) {
    return 'ECONOMICS';
  }

  return null;
}

function detectExplicitScopes(
  raw: string,
): TableAScope[] {
  const scopes =
    new Set<TableAScope>();

  const lower =
    raw.toLowerCase();

  if (
    /science table a|bachelor of science(?: and bachelor of advanced studies)? table a|table a for the bachelor of science/i.test(
      raw,
    )
  ) {
    scopes.add(
      'SCIENCE',
    );
  }

  if (
    /arts (?:and|&) social sciences table a|table a for the bachelor of arts/i.test(
      raw,
    )
  ) {
    scopes.add(
      'ARTS',
    );
  }

  if (
    /table a for the bachelor of commerce/i.test(
      raw,
    )
  ) {
    scopes.add(
      'BUSINESS',
    );
  }

  if (
    /table a for the bachelor of (?:advanced )?computing/i.test(
      raw,
    )
  ) {
    scopes.add(
      'COMPUTING',
    );
  }

  if (
    /table a for the bachelor of economics/i.test(
      raw,
    )
  ) {
    scopes.add(
      'ECONOMICS',
    );
  }

  if (
    /table a for the bachelor of music/i.test(
      raw,
    )
  ) {
    scopes.add(
      'CONSERVATORIUM',
    );
  }

  if (
    lower.includes(
      'science table a',
    ) &&
    (
      lower.includes(
        'arts and social sciences table a',
      ) ||
      lower.includes(
        'arts & social sciences table a',
      )
    )
  ) {
    scopes.add(
      'SCIENCE',
    );
    scopes.add(
      'ARTS',
    );
  }

  return [
    ...scopes,
  ];
}

/**
 * Source-grounded combined Engineering overrides.
 *
 * The Engineering Honours combined-course resolutions explicitly state
 * that the major/program is taken from Table A of the NON-ENGINEERING
 * component:
 *
 * - BHENGART-05 -> Bachelor of Arts Table A
 * - BHENGCOM-05 -> Bachelor of Commerce Table A
 *
 * Do not infer these from the degree title alone.
 */
function sourceGroundedDegreeScopeOverride(
  degreeCode: string,
): TableAScope | null {
  switch (degreeCode) {
    case 'BHENGART-05':
      return 'ARTS';

    case 'BHENGCOM-05':
      return 'BUSINESS';

    default:
      return null;
  }
}

function titleScopeHints(
  degreeTitle: string,
): TableAScope[] {
  const scopes =
    new Set<TableAScope>();

  const lower =
    degreeTitle.toLowerCase();

  if (
    lower.includes(
      'science',
    ) ||
    lower.includes(
      'psychology',
    ) ||
    lower.includes(
      'mathematical sciences',
    )
  ) {
    scopes.add(
      'SCIENCE',
    );
  }

  if (
    lower.includes(
      'arts',
    ) ||
    lower.includes(
      'languages',
    ) ||
    lower.includes(
      'international studies',
    ) ||
    lower.includes(
      'media and communications',
    ) ||
    lower.includes(
      'education',
    )
  ) {
    scopes.add(
      'ARTS',
    );
  }

  if (
    lower.includes(
      'commerce',
    )
  ) {
    scopes.add(
      'BUSINESS',
    );
  }

  if (
    lower.includes(
      'computing',
    )
  ) {
    scopes.add(
      'COMPUTING',
    );
  }

  if (
    lower.includes(
      'economics',
    )
  ) {
    scopes.add(
      'ECONOMICS',
    );
  }

  if (
    lower.includes(
      'music',
    )
  ) {
    scopes.add(
      'CONSERVATORIUM',
    );
  }

  if (
    lower.includes(
      'project management',
    ) ||
    lower.includes(
      'engineering',
    )
  ) {
    scopes.add(
      'ENGINEERING',
    );
  }

  if (
    lower.includes(
      'architecture',
    ) ||
    lower.includes(
      'design',
    )
  ) {
    scopes.add(
      'ARCHITECTURE',
    );
  }

  return [
    ...scopes,
  ];
}

function uniqueScopes(
  values:
    TableAScope[],
): TableAScope[] {
  return [
    ...new Set(
      values,
    ),
  ].sort();
}

function isSafeSignal(
  value: string,
): value is SafeSemanticClass {
  return (
    value ===
      'DIRECT_TABLE_A_COMPONENT_CHOICE' ||
    value ===
      'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE' ||
    value ===
      'CROSS_FACULTY_TABLE_A_COMPONENT_CHOICE'
  );
}

function isSafeRole(
  value: SignalRecord['componentType'],
): value is ComponentRole {
  return (
    value ===
      'MAJOR' ||
    value ===
      'MINOR' ||
    value ===
      'PROGRAM'
  );
}

async function loadSignalAudit():
Promise<{
  records: SignalRecord[];
  semanticSafeSignals: number;
}> {
  const value =
    await readJson(
      SIGNAL_AUDIT_FILE,
    );

  if (
    !isRecord(
      value,
    ) ||
    !Array.isArray(
      value.records,
    )
  ) {
    throw new Error(
      'USYD unqualified Table A signal audit is missing records[].',
    );
  }

  const root =
    value as unknown as
      SignalAuditRoot;

  const semanticSafeSignals =
    (
      root.counts
        ?.directTableAComponentChoice ??
      0
    ) +
    (
      root.counts
        ?.tableAOrTableSComponentChoice ??
      0
    ) +
    (
      root.counts
        ?.crossFacultyTableAComponentChoice ??
      0
    );

  return {
    records:
      value.records as
        SignalRecord[],

    semanticSafeSignals,
  };
}

async function loadExistingQualified():
Promise<ExistingQualifiedChoice[]> {
  const value =
    await readJson(
      STAGE2_FILE,
    );

  if (
    !isRecord(
      value,
    )
  ) {
    throw new Error(
      'USYD Stage2 file must contain an object.',
    );
  }

  const choicePools =
    value.choicePools;

  if (
    !isRecord(
      choicePools,
    ) ||
    !Array.isArray(
      choicePools.qualifiedTableA,
    )
  ) {
    throw new Error(
      'USYD Stage2 file is missing choicePools.qualifiedTableA[].',
    );
  }

  return choicePools
    .qualifiedTableA as
      ExistingQualifiedChoice[];
}

function qualifiedScopesForDegree(
  degreeCode: string,
  existing:
    ExistingQualifiedChoice[],
): TableAScope[] {
  const scopes =
    existing
      .filter(
        (
          choice,
        ) =>
          choice.degreeCode ===
          degreeCode,
      )
      .map(
        (
          choice,
        ) =>
          tableNameToScope(
            choice.tableName,
          ),
      )
      .filter(
        (
          value,
        ): value is TableAScope =>
          value !== null,
      );

  return uniqueScopes(
    scopes,
  );
}

export async function auditUsydUnqualifiedTableAScopeDedup():
Promise<UsydUnqualifiedTableAScopeAuditDataset> {
  const [
    signalAudit,
    existingQualified,
  ] =
    await Promise.all(
      [
        loadSignalAudit(),
        loadExistingQualified(),
      ],
    );

  const semanticSafeRecords =
    signalAudit.records.filter(
      (
        signal,
      ) =>
        isSafeSignal(
          signal.semanticClass,
        ),
    );

  const excludedSafeButUntyped =
    semanticSafeRecords
      .filter(
        (
          signal,
        ) =>
          !isSafeRole(
            signal.componentType,
          ),
      )
      .map(
        (
          signal,
        ) => ({
          degreeCode:
            signal.degreeCode,

          degreeTitle:
            signal.degreeTitle,

          semanticClass:
            signal.semanticClass as
              SafeSemanticClass,

          raw:
            signal.raw,

          componentType:
            null,
        }),
      );

  const records:
    UsydUnqualifiedTableAScopeAuditRecord[] =
    [];

  for (
    const signal
    of semanticSafeRecords
  ) {
    if (
      !isSafeRole(
        signal.componentType,
      ) ||
      !signal.degreeCode ||
      !signal.degreeTitle
    ) {
      continue;
    }

    const explicitScopes =
      detectExplicitScopes(
        signal.raw,
      );

    const existingQualifiedScopes =
      qualifiedScopesForDegree(
        signal.degreeCode,
        existingQualified,
      );

    const inferredScopeCandidates =
      titleScopeHints(
        signal.degreeTitle,
      );

    let resolution:
      UsydUnqualifiedTableAScopeAuditRecord['resolution'];

    let resolvedScopes:
      TableAScope[] =
      [];

    let dedupAgainstQualified =
      false;

    if (
      explicitScopes.length >
      1
    ) {
      resolution =
        'MULTI_SCOPE_EXPLICIT';

      resolvedScopes =
        explicitScopes;
    } else if (
      explicitScopes.length ===
      1
    ) {
      const explicit =
        explicitScopes[0];

      const matchingQualified =
        existingQualified.some(
          (
            choice,
          ) =>
            choice.degreeCode ===
              signal.degreeCode &&
            choice.requestedComponentType ===
              signal.componentType &&
            tableNameToScope(
              choice.tableName,
            ) ===
              explicit,
        );

      if (
        matchingQualified
      ) {
        resolution =
          'ALREADY_COVERED_BY_QUALIFIED_POOL';

        resolvedScopes = [
          explicit,
        ];

        dedupAgainstQualified =
          true;
      } else {
        resolution =
          'EXACT_SCOPE';

        resolvedScopes = [
          explicit,
        ];
      }
    } else if (
      existingQualifiedScopes.length ===
      1
    ) {
      const onlyScope =
        existingQualifiedScopes[0];

      const matchingQualified =
        existingQualified.some(
          (
            choice,
          ) =>
            choice.degreeCode ===
              signal.degreeCode &&
            choice.requestedComponentType ===
              signal.componentType &&
            tableNameToScope(
              choice.tableName,
            ) ===
              onlyScope,
        );

      if (
        matchingQualified
      ) {
        resolution =
          'ALREADY_COVERED_BY_QUALIFIED_POOL';

        resolvedScopes = [
          onlyScope,
        ];

        dedupAgainstQualified =
          true;
      } else {
        resolution =
          'EXACT_SCOPE';

        resolvedScopes = [
          onlyScope,
        ];
      }
    } else {
      const sourceOverride =
        sourceGroundedDegreeScopeOverride(
          signal.degreeCode,
        );

      if (
        sourceOverride
      ) {
        resolution =
          'EXACT_SCOPE';

        resolvedScopes = [
          sourceOverride,
        ];
      } else {
        const titleHints =
          uniqueScopes(
            inferredScopeCandidates,
          );

        if (
          titleHints.length ===
          1
        ) {
          resolution =
            'EXACT_SCOPE';

          resolvedScopes =
            titleHints;
        } else if (
          titleHints.length >
          1
        ) {
          resolution =
            'AMBIGUOUS_SCOPE';

          resolvedScopes =
            titleHints;
        } else {
          resolution =
            'NO_SCOPE_EVIDENCE';
        }
      }
    }

    records.push({
      degreeCode:
        signal.degreeCode,

      degreeTitle:
        signal.degreeTitle,

      componentType:
        signal.componentType,

      semanticClass:
        signal.semanticClass as
          SafeSemanticClass,

      raw:
        signal.raw,

      explicitScopes:
        uniqueScopes(
          explicitScopes,
        ),

      existingQualifiedScopes:
        uniqueScopes(
          existingQualifiedScopes,
        ),

      inferredScopeCandidates:
        uniqueScopes(
          inferredScopeCandidates,
        ),

      resolution,

      resolvedScopes:
        uniqueScopes(
          resolvedScopes,
        ),

      dedupAgainstQualified,
    });
  }

  records.sort(
    (
      left,
      right,
    ) =>
      left.degreeCode.localeCompare(
        right.degreeCode,
      ) ||
      left.componentType.localeCompare(
        right.componentType,
      ) ||
      left.raw.localeCompare(
        right.raw,
      ),
  );

  const countResolution =
    (
      resolution:
        UsydUnqualifiedTableAScopeAuditRecord['resolution'],
    ) =>
      records.filter(
        (
          record,
        ) =>
          record.resolution ===
          resolution,
      ).length;

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date()
        .toISOString(),

    counts: {
      semanticSafeSignals:
        signalAudit.semanticSafeSignals,

      typedEligibleSignals:
        records.length,

      safeButUntypedSignals:
        excludedSafeButUntyped.length,

      degrees:
        new Set(
          records.map(
            (
              record,
            ) =>
              record.degreeCode,
          ),
        ).size,

      exactScope:
        countResolution(
          'EXACT_SCOPE',
        ),

      multiScopeExplicit:
        countResolution(
          'MULTI_SCOPE_EXPLICIT',
        ),

      alreadyCoveredByQualifiedPool:
        countResolution(
          'ALREADY_COVERED_BY_QUALIFIED_POOL',
        ),

      ambiguousScope:
        countResolution(
          'AMBIGUOUS_SCOPE',
        ),

      noScopeEvidence:
        countResolution(
          'NO_SCOPE_EVIDENCE',
        ),
    },

    excludedSafeButUntyped,

    records,
  };
}
