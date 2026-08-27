import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  UsydTableSRole,
  UsydTableSRoleSourceAudit,
  UsydTableSRoleSourceEvidence,
} from './usyd.table-s-role-source-audit';

import type {
  UsydTableSUnresolvedRoleAudit,
  UsydTableSUnresolvedRoleEvidence,
} from './usyd.table-s-unresolved-role-audit';

const HANDBOOK_YEAR =
  2026;

const DATA_DIR =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
  );

const COMPONENT_FILE =
  path.join(
    DATA_DIR,
    'usyd-components-complete.json',
  );

const SOURCE_ROLE_AUDIT_FILE =
  path.join(
    DATA_DIR,
    'usyd-table-s-role-source-audit.json',
  );

const UNRESOLVED_ROLE_AUDIT_FILE =
  path.join(
    DATA_DIR,
    'usyd-table-s-unresolved-role-audit.json',
  );

type UnknownRecord =
  Record<string, unknown>;

interface ExistingComponent {
  index: number;
  name: string;
  type: string;
  handbook: string;
  sourceUrl: string | null;
  overviewUrl: string | null;
  tableUrl: string | null;
}

export interface UsydTableSAuthoritativeRole {
  name: string;

  type:
    UsydTableSRole;

  handbook:
    'INTERDISCIPLINARY';

  authoritative:
    true;

  evidenceSource:
    | 'TABLE_S_OVERVIEW'
    | 'TABLE_S_UNIT_TABLE';

  evidenceUrl:
    string;

  requirementsText:
    string | null;

  evidenceText:
    string[];

  existingSourceComponentIndexes:
    number[];

  /**
   * True when the role is explicitly supported by handbook evidence
   * but is absent as that exact role from source-discovery components.
   */
  supplementalRole:
    boolean;
}

export interface UsydTableSRoleContradiction {
  name: string;

  sourceCatalogTypes:
    string[];

  sourceProvenRoles:
    UsydTableSRole[];

  evidenceUrl:
    string;

  status:
    'SOURCE_TYPE_NOT_PROVEN_BY_AUTHORITATIVE_EVIDENCE';
}

export interface UsydTableSAuthoritativeRoleCatalog {
  university:
    'USYD';

  handbookYear:
    2026;

  generatedAt:
    string;

  counts: {
    sourceFamilies: number;
    authoritativeRoles: number;
    authoritativeMajors: number;
    authoritativeMinors: number;
    authoritativePrograms: number;
    supplementalRoles: number;
    contradictions: number;
    unresolvedFamilies: number;
  };

  roles:
    UsydTableSAuthoritativeRole[];

  contradictions:
    UsydTableSRoleContradiction[];

  unresolvedFamilies:
    Array<
      | UsydTableSRoleSourceEvidence
      | UsydTableSUnresolvedRoleEvidence
    >;
}

function isRecord(
  value: unknown,
): value is UnknownRecord {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value,
    )
  );
}

function stringValue(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (
    const key
    of keys
  ) {
    const value =
      record[
        key
      ];

    if (
      typeof value ===
        'string' &&
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function normalize(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /[’']/g,
      '',
    )
    .replace(
      /&/g,
      'and',
    )
    .replace(
      /[^a-z0-9]+/g,
      ' ',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function uniqueStrings(
  values: string[],
): string[] {
  return [
    ...new Set(
      values.filter(
        (
          value,
        ) =>
          value.trim()
            .length >
          0,
      ),
    ),
  ];
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

async function loadSourceRoleAudit():
Promise<UsydTableSRoleSourceAudit> {
  const value =
    await readJson(
      SOURCE_ROLE_AUDIT_FILE,
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
      'USYD Table S role source audit is missing records[]. Run usyd.table-s-role-source-audit.run.ts first.',
    );
  }

  return value as unknown as
    UsydTableSRoleSourceAudit;
}

async function loadUnresolvedRoleAudit():
Promise<UsydTableSUnresolvedRoleAudit> {
  const value =
    await readJson(
      UNRESOLVED_ROLE_AUDIT_FILE,
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
      'USYD Table S unresolved-role audit is missing records[]. Run usyd.table-s-unresolved-role-audit.run.ts first.',
    );
  }

  return value as unknown as
    UsydTableSUnresolvedRoleAudit;
}

async function loadExistingComponents():
Promise<ExistingComponent[]> {
  const value =
    await readJson(
      COMPONENT_FILE,
    );

  if (
    !isRecord(
      value,
    ) ||
    !Array.isArray(
      value.components,
    )
  ) {
    throw new Error(
      'USYD complete component catalogue is missing components[].',
    );
  }

  const output:
    ExistingComponent[] =
    [];

  value.components.forEach(
    (
      item,
      index,
    ) => {
      if (
        !isRecord(
          item,
        )
      ) {
        return;
      }

      const name =
        stringValue(
          item,
          [
            'name',
            'title',
            'componentName',
          ],
        );

      const type =
        stringValue(
          item,
          [
            'type',
            'componentType',
          ],
        );

      const handbook =
        stringValue(
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
          stringValue(
            item,
            [
              'sourceUrl',
              'url',
            ],
          ),

        overviewUrl:
          stringValue(
            item,
            [
              'overviewUrl',
            ],
          ),

        tableUrl:
          stringValue(
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

function isTableSSubjectArea(
  component:
    ExistingComponent,
): boolean {
  const haystack =
    [
      component.sourceUrl ??
        '',
      component.overviewUrl ??
        '',
      component.tableUrl ??
        '',
    ]
      .join(
        ' ',
      )
      .toLowerCase();

  return haystack.includes(
    '/handbooks/interdisciplinary-studies/table-s/subject-areas/',
  );
}

interface FamilyRoleEvidence {
  familyName: string;
  roles: UsydTableSRole[];
  evidenceSource:
    | 'TABLE_S_OVERVIEW'
    | 'TABLE_S_UNIT_TABLE';
  evidenceUrl: string;
  requirementsText: string | null;
  evidenceText: string[];
}

function buildAuthoritativeFamilyEvidence(
  sourceAudit:
    UsydTableSRoleSourceAudit,
  unresolvedAudit:
    UsydTableSUnresolvedRoleAudit,
): {
  evidence:
    FamilyRoleEvidence[];
  unresolved:
    Array<
      | UsydTableSRoleSourceEvidence
      | UsydTableSUnresolvedRoleEvidence
    >;
} {
  const evidence:
    FamilyRoleEvidence[] =
    [];

  const unresolved:
    Array<
      | UsydTableSRoleSourceEvidence
      | UsydTableSUnresolvedRoleEvidence
    > =
    [];

  for (
    const record
    of sourceAudit.records
  ) {
    if (
      record.status ===
      'SUPPORTED'
    ) {
      evidence.push({
        familyName:
          record.familyName,

        roles:
          record.explicitRoles,

        evidenceSource:
          'TABLE_S_OVERVIEW',

        evidenceUrl:
          record.overviewUrl,

        requirementsText:
          record.requirementsText,

        evidenceText:
          record.evidenceText,
      });

      continue;
    }

    if (
      record.status ===
      'FETCH_FAILED'
    ) {
      unresolved.push(
        record,
      );
    }
  }

  for (
    const record
    of unresolvedAudit.records
  ) {
    if (
      record.status ===
      'RESOLVED'
    ) {
      evidence.push({
        familyName:
          record.familyName,

        roles:
          record.explicitRoles,

        evidenceSource:
          'TABLE_S_UNIT_TABLE',

        evidenceUrl:
          record.unitTableUrls[0] ??
          record.overviewUrl,

        requirementsText:
          null,

        evidenceText:
          record.evidenceText,
      });

      continue;
    }

    unresolved.push(
      record,
    );
  }

  return {
    evidence,
    unresolved,
  };
}

export async function collectUsydTableSAuthoritativeRoleCatalog():
Promise<UsydTableSAuthoritativeRoleCatalog> {
  const [
    sourceAudit,
    unresolvedAudit,
    components,
  ] =
    await Promise.all(
      [
        loadSourceRoleAudit(),
        loadUnresolvedRoleAudit(),
        loadExistingComponents(),
      ],
    );

  if (
    sourceAudit.counts.fetchFailed >
    0
  ) {
    throw new Error(
      `Cannot build authoritative Table S roles while ${sourceAudit.counts.fetchFailed} overview fetch(es) failed.`,
    );
  }

  if (
    unresolvedAudit.counts.fetchFailed >
    0
  ) {
    throw new Error(
      `Cannot build authoritative Table S roles while ${unresolvedAudit.counts.fetchFailed} unresolved family fetch(es) failed.`,
    );
  }

  const {
    evidence:
      familyEvidence,
    unresolved:
      unresolvedFamilies,
  } =
    buildAuthoritativeFamilyEvidence(
      sourceAudit,
      unresolvedAudit,
    );

  const tableSComponents =
    components.filter(
      isTableSSubjectArea,
    );

  const componentsByName =
    new Map<
      string,
      ExistingComponent[]
    >();

  for (
    const component
    of tableSComponents
  ) {
    const key =
      normalize(
        component.name,
      );

    const existing =
      componentsByName.get(
        key,
      );

    if (
      existing
    ) {
      existing.push(
        component,
      );
    } else {
      componentsByName.set(
        key,
        [
          component,
        ],
      );
    }
  }

  const roles:
    UsydTableSAuthoritativeRole[] =
    [];

  const contradictions:
    UsydTableSRoleContradiction[] =
    [];

  for (
    const family
    of familyEvidence
  ) {
    const existingComponents =
      componentsByName.get(
        normalize(
          family.familyName,
        ),
      ) ??
      [];

    const existingTypes =
      [
        ...new Set(
          existingComponents.map(
            (
              component,
            ) =>
              component.type,
          ),
        ),
      ].sort();

    for (
      const role
      of family.roles
    ) {
      const matchingIndexes =
        existingComponents
          .filter(
            (
              component,
            ) =>
              component.type ===
              role,
          )
          .map(
            (
              component,
            ) =>
              component.index,
          );

      roles.push({
        name:
          family.familyName,

        type:
          role,

        handbook:
          'INTERDISCIPLINARY',

        authoritative:
          true,

        evidenceSource:
          family.evidenceSource,

        evidenceUrl:
          family.evidenceUrl,

        requirementsText:
          family.requirementsText,

        evidenceText:
          uniqueStrings(
            family.evidenceText,
          ),

        existingSourceComponentIndexes:
          matchingIndexes,

        supplementalRole:
          matchingIndexes.length ===
          0,
      });
    }

    const unprovenSourceTypes =
      existingTypes.filter(
        (
          type,
        ) =>
          (
            type ===
              'MAJOR' ||
            type ===
              'MINOR' ||
            type ===
              'PROGRAM'
          ) &&
          !family.roles.includes(
            type as
              UsydTableSRole,
          ),
      );

    if (
      unprovenSourceTypes.length >
      0
    ) {
      contradictions.push({
        name:
          family.familyName,

        sourceCatalogTypes:
          existingTypes,

        sourceProvenRoles:
          family.roles,

        evidenceUrl:
          family.evidenceUrl,

        status:
          'SOURCE_TYPE_NOT_PROVEN_BY_AUTHORITATIVE_EVIDENCE',
      });
    }
  }

  roles.sort(
    (
      left,
      right,
    ) =>
      left.name.localeCompare(
        right.name,
      ) ||
      left.type.localeCompare(
        right.type,
      ),
  );

  contradictions.sort(
    (
      left,
      right,
    ) =>
      left.name.localeCompare(
        right.name,
      ),
  );

  const countRole =
    (
      role:
        UsydTableSRole,
    ) =>
      roles.filter(
        (
          item,
        ) =>
          item.type ===
          role,
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
      sourceFamilies:
        sourceAudit
          .counts
          .familiesInspected,

      authoritativeRoles:
        roles.length,

      authoritativeMajors:
        countRole(
          'MAJOR',
        ),

      authoritativeMinors:
        countRole(
          'MINOR',
        ),

      authoritativePrograms:
        countRole(
          'PROGRAM',
        ),

      supplementalRoles:
        roles.filter(
          (
            item,
          ) =>
            item.supplementalRole,
        ).length,

      contradictions:
        contradictions.length,

      unresolvedFamilies:
        unresolvedFamilies.length,
    },

    roles,

    contradictions,

    unresolvedFamilies,
  };
}
