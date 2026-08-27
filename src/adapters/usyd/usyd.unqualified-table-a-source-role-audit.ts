import fs from 'node:fs/promises';
import path from 'node:path';

import axios from 'axios';
import * as cheerio from 'cheerio';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const ROLE_COVERAGE_FILE = path.join(
  DATA_DIR,
  'usyd-unqualified-table-a-role-coverage-audit.json',
);

const COMPONENT_FILE = path.join(
  DATA_DIR,
  'usyd-components-complete.json',
);

const QUALIFIED_TABLE_A_FILE = path.join(
  DATA_DIR,
  'usyd-qualified-table-a-degree-component-choices.json',
);

type UnknownRecord = Record<string, unknown>;

type ComponentRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM';

type TableAScope =
  | 'ARTS'
  | 'BUSINESS'
  | 'COMPUTING'
  | 'SCIENCE'
  | 'CONSERVATORIUM'
  | 'ENGINEERING';

interface RoleCoverageRecord {
  scope: TableAScope;
  role: ComponentRole;
  sourceHandbook: string;
  candidateCount: number;
  candidateNames: string[];
  degrees: string[];
}

interface ComponentRecord {
  index: number;
  name: string;
  type: string;
  handbook: string;
  sourceUrl: string | null;
  overviewUrl: string | null;
  tableUrl: string | null;
}

interface QualifiedChoice {
  tableName: string;
  requestedComponentType: string;
  candidates: Array<{
    componentName: string;
    componentHandbook: string;
    sourceUrl: string | null;
  }>;
}

export interface UsydSourceRoleEvidence {
  name: string;
  requestedRole: ComponentRole;
  sourceType: string;
  sourceUrl: string | null;

  fetchStatus:
    | 'FETCHED'
    | 'NO_URL'
    | 'FETCH_FAILED';

  roleEvidence:
    | 'EXPLICIT'
    | 'NOT_FOUND';

  evidence: string[];
}

export interface UsydUnqualifiedTableASourceRoleAuditRecord {
  scope: TableAScope;
  role: ComponentRole;

  seedStrategy: string;
  seedFamilies: number;

  explicitRoleFamilies: number;
  noExplicitRoleEvidence: number;
  fetchFailures: number;
  noUrl: number;

  authoritativeNames: string[];

  evidence:
    UsydSourceRoleEvidence[];
}

export interface UsydUnqualifiedTableASourceRoleAuditDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    requestedPairs: number;
    pairsWithAnyExplicitRoleEvidence: number;
    pairsWithZeroExplicitRoleEvidence: number;
    totalAuthoritativeNames: number;
    fetchFailures: number;
  };

  records:
    UsydUnqualifiedTableASourceRoleAuditRecord[];
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

function asString(
  value: unknown,
): string | null {
  return (
    typeof value === 'string' &&
    value.trim()
  )
    ? value.trim()
    : null;
}

function firstString(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value =
      asString(
        record[key],
      );

    if (value) {
      return value;
    }
  }

  return null;
}

async function readJson(
  filePath: string,
): Promise<unknown> {
  const raw =
    await fs.readFile(
      filePath,
      'utf8',
    );

  return JSON.parse(
    raw,
  ) as unknown;
}

async function loadRoleCoverage():
Promise<RoleCoverageRecord[]> {
  const value =
    await readJson(
      ROLE_COVERAGE_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(
      value.records,
    )
  ) {
    throw new Error(
      'USYD unqualified Table A role coverage audit is missing records[].',
    );
  }

  return value.records as
    RoleCoverageRecord[];
}

async function loadComponents():
Promise<ComponentRecord[]> {
  const value =
    await readJson(
      COMPONENT_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(
      value.components,
    )
  ) {
    throw new Error(
      'USYD complete component catalogue is missing components[].',
    );
  }

  const output:
    ComponentRecord[] = [];

  value.components.forEach(
    (item, index) => {
      if (!isRecord(item)) {
        return;
      }

      const name =
        firstString(
          item,
          [
            'name',
            'title',
            'componentName',
          ],
        );

      const type =
        firstString(
          item,
          [
            'type',
            'componentType',
          ],
        );

      const handbook =
        firstString(
          item,
          [
            'handbook',
            'handbookCategory',
            'category',
          ],
        );

      if (
        !name ||
        !type ||
        !handbook
      ) {
        return;
      }

      output.push({
        index,
        name,
        type:
          type.toUpperCase(),
        handbook:
          handbook.toUpperCase(),

        sourceUrl:
          firstString(
            item,
            [
              'sourceUrl',
              'url',
            ],
          ),

        overviewUrl:
          firstString(
            item,
            [
              'overviewUrl',
            ],
          ),

        tableUrl:
          firstString(
            item,
            [
              'tableUrl',
              'unitTableUrl',
              'unitOfStudyTableUrl',
            ],
          ),
      });
    },
  );

  return output;
}

async function loadQualifiedChoices():
Promise<QualifiedChoice[]> {
  const value =
    await readJson(
      QUALIFIED_TABLE_A_FILE,
    );

  if (
    !isRecord(value) ||
    !Array.isArray(
      value.choices,
    )
  ) {
    throw new Error(
      'USYD qualified Table A choice file is missing choices[].',
    );
  }

  return value.choices as
    QualifiedChoice[];
}

function preferredUrl(
  component: ComponentRecord,
): string | null {
  return (
    component.overviewUrl ??
    component.sourceUrl ??
    component.tableUrl
  );
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

function rolePatterns(
  role: ComponentRole,
): RegExp[] {
  switch (role) {
    case 'MAJOR':
      return [
        /\bmajor and minor requirements\b/i,
        /\bmajor\/minor\b/i,
        /\bmajor requirements\b/i,
        /\bthe .{0,120} major\b/i,
        /\bmajor in\b/i,
      ];

    case 'MINOR':
      return [
        /\bmajor and minor requirements\b/i,
        /\bmajor\/minor\b/i,
        /\bminor requirements\b/i,
        /\bthe .{0,120} minor\b/i,
        /\bminor in\b/i,
        /\bminor from\b/i,
      ];

    case 'PROGRAM':
      return [
        /\bprogram requirements\b/i,
        /\bthe .{0,120} program\b/i,
        /\bprogram in\b/i,
        /\bprogram comprising\b/i,
      ];
  }
}

function extractRoleEvidence(
  html: string,
  role: ComponentRole,
): string[] {
  const $ =
    cheerio.load(
      html,
    );

  const patterns =
    rolePatterns(
      role,
    );

  const candidates:
    string[] = [];

  $(
    'h1,h2,h3,h4,h5,h6,caption,th,p,li',
  ).each(
    (
      _index,
      element,
    ) => {
      const text =
        normalizeText(
          $(element).text(),
        );

      if (
        !text ||
        text.length >
        1000
      ) {
        return;
      }

      if (
        patterns.some(
          (pattern) =>
            pattern.test(
              text,
            ),
        )
      ) {
        candidates.push(
          text,
        );
      }
    },
  );

  return [
    ...new Set(
      candidates,
    ),
  ].slice(
    0,
    12,
  );
}

async function fetchEvidence(
  component: ComponentRecord,
  requestedRole: ComponentRole,
): Promise<UsydSourceRoleEvidence> {
  const url =
    preferredUrl(
      component,
    );

  if (!url) {
    return {
      name:
        component.name,

      requestedRole,

      sourceType:
        component.type,

      sourceUrl:
        null,

      fetchStatus:
        'NO_URL',

      roleEvidence:
        'NOT_FOUND',

      evidence: [],
    };
  }

  try {
    const response =
      await axios.get<string>(
        url,
        {
          timeout:
            30000,

          headers: {
            'User-Agent':
              'Mozilla/5.0',
          },
        },
      );

    const evidence =
      extractRoleEvidence(
        response.data,
        requestedRole,
      );

    return {
      name:
        component.name,

      requestedRole,

      sourceType:
        component.type,

      sourceUrl:
        url,

      fetchStatus:
        'FETCHED',

      roleEvidence:
        evidence.length >
        0
          ? 'EXPLICIT'
          : 'NOT_FOUND',

      evidence,
    };
  } catch {
    return {
      name:
        component.name,

      requestedRole,

      sourceType:
        component.type,

      sourceUrl:
        url,

      fetchStatus:
        'FETCH_FAILED',

      roleEvidence:
        'NOT_FOUND',

      evidence: [],
    };
  }
}

function dedupeSeeds(
  seeds: ComponentRecord[],
): ComponentRecord[] {
  const map =
    new Map<
      string,
      ComponentRecord
    >();

  for (const seed of seeds) {
    const key =
      `${seed.name}|${preferredUrl(seed) ?? 'NO_URL'}`;

    if (!map.has(key)) {
      map.set(
        key,
        seed,
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function seedComponentsForPair(
  pair: RoleCoverageRecord,
  components: ComponentRecord[],
  qualifiedChoices: QualifiedChoice[],
): {
  strategy: string;
  seeds: ComponentRecord[];
} {
  /**
   * IMPORTANT V2 FIX:
   *
   * A non-empty exact-role catalogue can still be incomplete.
   * Therefore MINOR/PROGRAM audits for Arts/Business/Science use the
   * full source-family universe, not only already-labelled MINOR/PROGRAM
   * records.
   */
  if (
    pair.scope === 'ARTS' ||
    pair.scope === 'BUSINESS' ||
    pair.scope === 'SCIENCE'
  ) {
    const sourceFamilies =
      components.filter(
        (component) =>
          component.handbook ===
            pair.sourceHandbook &&
          component.type ===
            'MAJOR',
      );

    return {
      strategy:
        'ALL_SOURCE_MAJOR_FAMILIES_AS_ROLE_AUDIT_SEEDS',

      seeds:
        dedupeSeeds(
          sourceFamilies,
        ),
    };
  }

  /**
   * Computing must NOT use all ENGINEERING families.
   * Reuse the already-proven qualified Bachelor of Computing Table A
   * MAJOR pool (4 canonical families) as the source family universe.
   */
  if (
    pair.scope ===
    'COMPUTING'
  ) {
    const computingChoice =
      qualifiedChoices.find(
        (choice) =>
          choice.tableName ===
            'Table A for the Bachelor of Computing' &&
          choice.requestedComponentType ===
            'MAJOR',
      );

    if (!computingChoice) {
      throw new Error(
        'Could not find authoritative qualified Computing MAJOR pool.',
      );
    }

    const names =
      new Set(
        computingChoice.candidates.map(
          (candidate) =>
            candidate.componentName,
        ),
      );

    const sourceFamilies =
      components.filter(
        (component) =>
          component.handbook ===
            'ENGINEERING' &&
          names.has(
            component.name,
          ),
      );

    return {
      strategy:
        'QUALIFIED_COMPUTING_MAJOR_POOL_AS_ROLE_AUDIT_SEEDS',

      seeds:
        dedupeSeeds(
          sourceFamilies,
        ),
    };
  }

  /**
   * Conservatorium PROGRAM records already represent program families.
   * For MINOR, use all Conservatorium source records rather than the
   * single aggregate "Bachelor of Music - Minors" record.
   */
  if (
    pair.scope ===
    'CONSERVATORIUM'
  ) {
    const sourceFamilies =
      components.filter(
        (component) =>
          component.handbook ===
            'CONSERVATORIUM',
      );

    return {
      strategy:
        pair.role ===
          'MINOR'
          ? 'ALL_CONSERVATORIUM_SOURCE_RECORDS_FOR_MINOR_DISCOVERY'
          : 'ALL_CONSERVATORIUM_SOURCE_RECORDS_FOR_PROGRAM_CONFIRMATION',

      seeds:
        dedupeSeeds(
          sourceFamilies,
        ),
    };
  }

  /**
   * ENGINEERING/MAJOR remains diagnostic. Keep current ENGINEERING
   * MAJOR source-family universe, but do not call it final until the
   * specific Project Management/Engineering Table A ownership is
   * separately verified.
   */
  if (
    pair.scope ===
    'ENGINEERING'
  ) {
    return {
      strategy:
        'ENGINEERING_MAJOR_SOURCE_FAMILIES_DIAGNOSTIC',

      seeds:
        dedupeSeeds(
          components.filter(
            (component) =>
              component.handbook ===
                'ENGINEERING' &&
              component.type ===
                'MAJOR',
          ),
        ),
    };
  }

  return {
    strategy:
      'EXACT_ROLE_FALLBACK',

    seeds:
      dedupeSeeds(
        components.filter(
          (component) =>
            component.handbook ===
              pair.sourceHandbook &&
            component.type ===
              pair.role,
        ),
      ),
  };
}

export async function auditUsydUnqualifiedTableASourceRoles():
Promise<UsydUnqualifiedTableASourceRoleAuditDataset> {
  const [
    pairs,
    components,
    qualifiedChoices,
  ] =
    await Promise.all([
      loadRoleCoverage(),
      loadComponents(),
      loadQualifiedChoices(),
    ]);

  const records:
    UsydUnqualifiedTableASourceRoleAuditRecord[] =
    [];

  for (const pair of pairs) {
    const seeded =
      seedComponentsForPair(
        pair,
        components,
        qualifiedChoices,
      );

    const evidence:
      UsydSourceRoleEvidence[] =
      [];

    for (
      const seed
      of seeded.seeds
    ) {
      evidence.push(
        await fetchEvidence(
          seed,
          pair.role,
        ),
      );
    }

    const authoritativeNames =
      [
        ...new Set(
          evidence
            .filter(
              (item) =>
                item.roleEvidence ===
                'EXPLICIT',
            )
            .map(
              (item) =>
                item.name,
            ),
        ),
      ].sort();

    records.push({
      scope:
        pair.scope,

      role:
        pair.role,

      seedStrategy:
        seeded.strategy,

      seedFamilies:
        seeded.seeds.length,

      explicitRoleFamilies:
        authoritativeNames.length,

      noExplicitRoleEvidence:
        evidence.filter(
          (item) =>
            item.fetchStatus ===
              'FETCHED' &&
            item.roleEvidence ===
              'NOT_FOUND',
        ).length,

      fetchFailures:
        evidence.filter(
          (item) =>
            item.fetchStatus ===
            'FETCH_FAILED',
        ).length,

      noUrl:
        evidence.filter(
          (item) =>
            item.fetchStatus ===
            'NO_URL',
        ).length,

      authoritativeNames,

      evidence,
    });
  }

  records.sort(
    (left, right) =>
      left.scope.localeCompare(
        right.scope,
      ) ||
      left.role.localeCompare(
        right.role,
      ),
  );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      requestedPairs:
        records.length,

      pairsWithAnyExplicitRoleEvidence:
        records.filter(
          (record) =>
            record.explicitRoleFamilies >
            0,
        ).length,

      pairsWithZeroExplicitRoleEvidence:
        records.filter(
          (record) =>
            record.explicitRoleFamilies ===
            0,
        ).length,

      totalAuthoritativeNames:
        records.reduce(
          (sum, record) =>
            sum +
            record.authoritativeNames.length,
          0,
        ),

      fetchFailures:
        records.reduce(
          (sum, record) =>
            sum +
            record.fetchFailures,
          0,
        ),
    },

    records,
  };
}
