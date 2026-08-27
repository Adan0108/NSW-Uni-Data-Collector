import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const QUALIFIED_FILE = path.join(
  DATA_DIR,
  'usyd-qualified-table-a-degree-component-choices.json',
);

const AUTHORITATIVE_FILE = path.join(
  DATA_DIR,
  'usyd-unqualified-table-a-authoritative-role-catalog.json',
);

type UnknownRecord = Record<string, unknown>;

type Scope =
  | 'ARTS'
  | 'BUSINESS'
  | 'COMPUTING'
  | 'ECONOMICS'
  | 'SCIENCE'
  | 'OTHER';

interface QualifiedCandidate {
  componentName: string;
  componentHandbook?: string;
  sourceUrl?: string | null;
  [key: string]: unknown;
}

interface QualifiedChoice {
  degreeCode: string;
  tableName: string;
  requestedComponentType: string;
  candidates: QualifiedCandidate[];
  [key: string]: unknown;
}

interface QualifiedDataset extends UnknownRecord {
  choices: QualifiedChoice[];
}

interface AuthoritativePool {
  scope: string;
  role: string;
  names: string[];
}

interface AuthoritativeDataset extends UnknownRecord {
  pools: AuthoritativePool[];
}

export interface QualifiedPoolReconciliation {
  degreeCode: string;
  tableName: string;
  scope: Scope;
  role: string;

  originalCount: number;
  authoritativeCount: number | null;

  keptCount: number;
  removedCount: number;
  missingCount: number;

  removedNames: string[];
  missingNames: string[];

  status:
    | 'MATCH'
    | 'CORRECTED'
    | 'NO_AUTHORITATIVE_CATALOG';
}

export interface QualifiedReconciliationResult {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    originalPools: number;
    reconciledPools: number;

    matchedPools: number;
    correctedPools: number;
    noCatalogPools: number;

    removedCandidateOccurrences: number;
    missingCandidateOccurrences: number;
  };

  reconciliation:
    QualifiedPoolReconciliation[];

  reconciled:
    QualifiedDataset;
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

function scopeFromTableName(
  tableName: string,
): Scope {
  const lower =
    tableName.toLowerCase();

  if (
    lower.includes(
      'bachelor of arts',
    ) ||
    lower.includes(
      'arts and social sciences',
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

  if (
    lower.includes(
      'bachelor of science',
    ) ||
    lower.includes(
      'science table a',
    )
  ) {
    return 'SCIENCE';
  }

  return 'OTHER';
}

function canonical(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase(
      'en-AU',
    );
}

function findAuthoritativeNames(
  scope: Scope,
  role: string,
  pools: AuthoritativePool[],
): string[] | null {
  /**
   * Economics remains governed by the separate already-proven
   * Economics Table A authoritative role catalogue, so do not alter it
   * here.
   *
   * Computing MAJOR is also not part of this new central role catalogue;
   * its existing four-family qualified pool was already source-proven.
   */
  if (
    scope === 'ECONOMICS' ||
    scope === 'OTHER' ||
    (
      scope === 'COMPUTING' &&
      role === 'MAJOR'
    )
  ) {
    return null;
  }

  const match =
    pools.find(
      (pool) =>
        pool.scope ===
          scope &&
        pool.role ===
          role,
    );

  return match
    ? match.names
    : null;
}

export async function reconcileUsydQualifiedTableAChoices():
Promise<QualifiedReconciliationResult> {
  const [
    qualifiedRaw,
    authoritativeRaw,
  ] =
    await Promise.all([
      readJson(
        QUALIFIED_FILE,
      ),

      readJson(
        AUTHORITATIVE_FILE,
      ),
    ]);

  if (
    !isRecord(
      qualifiedRaw,
    ) ||
    !Array.isArray(
      qualifiedRaw.choices,
    )
  ) {
    throw new Error(
      'Qualified Table A choice file is missing choices[].',
    );
  }

  if (
    !isRecord(
      authoritativeRaw,
    ) ||
    !Array.isArray(
      authoritativeRaw.pools,
    )
  ) {
    throw new Error(
      'Authoritative Table A role catalog is missing pools[]. Run the V4 writer first.',
    );
  }

  const qualified =
    qualifiedRaw as
      QualifiedDataset;

  const authoritative =
    authoritativeRaw as
      AuthoritativeDataset;

  const reconciledChoices:
    QualifiedChoice[] =
    [];

  const reconciliation:
    QualifiedPoolReconciliation[] =
    [];

  for (
    const choice
    of qualified.choices
  ) {
    const scope =
      scopeFromTableName(
        choice.tableName,
      );

    const authoritativeNames =
      findAuthoritativeNames(
        scope,
        choice.requestedComponentType,
        authoritative.pools,
      );

    if (
      authoritativeNames ===
      null
    ) {
      reconciliation.push({
        degreeCode:
          choice.degreeCode,

        tableName:
          choice.tableName,

        scope,

        role:
          choice.requestedComponentType,

        originalCount:
          choice.candidates.length,

        authoritativeCount:
          null,

        keptCount:
          choice.candidates.length,

        removedCount:
          0,

        missingCount:
          0,

        removedNames:
          [],

        missingNames:
          [],

        status:
          'NO_AUTHORITATIVE_CATALOG',
      });

      reconciledChoices.push({
        ...choice,

        candidates:
          [...choice.candidates],
      });

      continue;
    }

    const authoritativeMap =
      new Map(
        authoritativeNames.map(
          (name) => [
            canonical(name),
            name,
          ],
        ),
      );

    const originalMap =
      new Map(
        choice.candidates.map(
          (candidate) => [
            canonical(
              candidate.componentName,
            ),
            candidate,
          ],
        ),
      );

    const kept =
      choice.candidates.filter(
        (candidate) =>
          authoritativeMap.has(
            canonical(
              candidate.componentName,
            ),
          ),
      );

    const removed =
      choice.candidates.filter(
        (candidate) =>
          !authoritativeMap.has(
            canonical(
              candidate.componentName,
            ),
          ),
      );

    const missing =
      authoritativeNames.filter(
        (name) =>
          !originalMap.has(
            canonical(name),
          ),
      );

    /**
     * This reconciliation is deliberately conservative:
     * - remove candidates proven not to belong to the current role pool;
     * - do NOT invent missing candidate objects here.
     *
     * Missing names are surfaced for later component-role supplementation.
     */
    reconciledChoices.push({
      ...choice,

      candidates:
        kept,
    });

    reconciliation.push({
      degreeCode:
        choice.degreeCode,

      tableName:
        choice.tableName,

      scope,

      role:
        choice.requestedComponentType,

      originalCount:
        choice.candidates.length,

      authoritativeCount:
        authoritativeNames.length,

      keptCount:
        kept.length,

      removedCount:
        removed.length,

      missingCount:
        missing.length,

      removedNames:
        removed.map(
          (candidate) =>
            candidate.componentName,
        ),

      missingNames:
        missing,

      status:
        removed.length ===
          0 &&
        missing.length ===
          0
          ? 'MATCH'
          : 'CORRECTED',
    });
  }

  const reconciled:
    QualifiedDataset =
    {
      ...qualified,

      choices:
        reconciledChoices,

      reconciliationMetadata: {
        source:
          'usyd-unqualified-table-a-authoritative-role-catalog.json',

        generatedAt:
          new Date().toISOString(),

        rule:
          'Candidates not present in the authoritative 2026 role pool are removed. Missing authoritative names are reported but not invented.',
      },
    };

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      originalPools:
        qualified.choices.length,

      reconciledPools:
        reconciledChoices.length,

      matchedPools:
        reconciliation.filter(
          (item) =>
            item.status ===
            'MATCH',
        ).length,

      correctedPools:
        reconciliation.filter(
          (item) =>
            item.status ===
            'CORRECTED',
        ).length,

      noCatalogPools:
        reconciliation.filter(
          (item) =>
            item.status ===
            'NO_AUTHORITATIVE_CATALOG',
        ).length,

      removedCandidateOccurrences:
        reconciliation.reduce(
          (
            sum,
            item,
          ) =>
            sum +
            item.removedCount,
          0,
        ),

      missingCandidateOccurrences:
        reconciliation.reduce(
          (
            sum,
            item,
          ) =>
            sum +
            item.missingCount,
          0,
        ),
    },

    reconciliation,

    reconciled,
  };
}

export async function writeUsydQualifiedTableAReconciliation():
Promise<void> {
  const result =
    await reconcileUsydQualifiedTableAChoices();

  const auditFile =
    path.join(
      DATA_DIR,
      'usyd-qualified-table-a-authoritative-reconciliation.json',
    );

  const reconciledFile =
    path.join(
      DATA_DIR,
      'usyd-qualified-table-a-degree-component-choices.reconciled.json',
    );

  const auditTmp =
    `${auditFile}.tmp`;

  const reconciledTmp =
    `${reconciledFile}.tmp`;

  await fs.writeFile(
    auditTmp,
    JSON.stringify(
      {
        university:
          result.university,

        handbookYear:
          result.handbookYear,

        generatedAt:
          result.generatedAt,

        counts:
          result.counts,

        reconciliation:
          result.reconciliation,
      },
      null,
      2,
    ),
    'utf8',
  );

  await fs.writeFile(
    reconciledTmp,
    JSON.stringify(
      result.reconciled,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    auditTmp,
    auditFile,
  );

  await fs.rename(
    reconciledTmp,
    reconciledFile,
  );

  console.log(
    '[USYD qualified Table A authoritative reconciliation] PASS',
  );

  console.log(
    `Pools: ${result.counts.originalPools}`,
  );

  console.log(
    `Matched: ${result.counts.matchedPools}`,
  );

  console.log(
    `Corrected: ${result.counts.correctedPools}`,
  );

  console.log(
    `No catalog: ${result.counts.noCatalogPools}`,
  );

  console.log(
    `Removed candidate occurrences: ${result.counts.removedCandidateOccurrences}`,
  );

  console.log(
    `Missing authoritative candidate occurrences: ${result.counts.missingCandidateOccurrences}`,
  );

  console.log(
    `Audit: ${auditFile}`,
  );

  console.log(
    `Reconciled: ${reconciledFile}`,
  );
}
