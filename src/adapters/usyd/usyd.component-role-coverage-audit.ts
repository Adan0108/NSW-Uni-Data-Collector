import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydDegreeComponentEvidence,
  type UsydDegreeComponentEvidence,
} from './usyd.degree-component-audit';

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

const MASTER_FILE =
  path.join(
    DATA_DIR,
    'usyd-master-global.json',
  );

const COMPLETE_COMPONENT_FILE =
  path.join(
    DATA_DIR,
    'usyd-components-complete.json',
  );

type UnknownRecord =
  Record<string, unknown>;

export type UsydComponentRoleType =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM';

export interface UsydComponentRoleCandidate {
  index: number;
  name: string;
  type: string | null;
  handbook: string | null;
  sourceUrl: string | null;
  overviewUrl: string | null;
  tableUrl: string | null;
}

export interface UsydComponentRoleCoverageRecord {
  degreeCode: string;
  degreeTitle: string;
  degreeHandbook: string | null;

  requestedName: string;
  requestedType: UsydComponentRoleType;

  rawText: string;

  sameHandbookExactType: UsydComponentRoleCandidate[];
  sameHandbookSameNameOtherType: UsydComponentRoleCandidate[];
  otherHandbookExactType: UsydComponentRoleCandidate[];

  status:
    | 'RESOLVED_SAME_HANDBOOK'
    | 'MISSING_ROLE_SAME_NAME_EXISTS'
    | 'MISSING_COMPONENT_FAMILY'
    | 'ONLY_OTHER_HANDBOOK';
}

export interface UsydComponentRoleCoverageAudit {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  namedEvidenceCount: number;

  resolvedSameHandbookCount: number;
  missingRoleCount: number;
  missingFamilyCount: number;
  onlyOtherHandbookCount: number;

  records: UsydComponentRoleCoverageRecord[];
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

function stringValue(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value =
      record[key];

    if (
      typeof value === 'string' &&
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
    .replace(/&/g, 'and')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCandidate(
  component: unknown,
  index: number,
): UsydComponentRoleCandidate | null {
  if (!isRecord(component)) {
    return null;
  }

  const name =
    stringValue(
      component,
      [
        'name',
        'title',
        'componentName',
      ],
    );

  if (!name) {
    return null;
  }

  return {
    index,
    name,

    type:
      stringValue(
        component,
        [
          'type',
          'componentType',
        ],
      ),

    handbook:
      stringValue(
        component,
        [
          'handbook',
          'handbookCategory',
          'category',
        ],
      ),

    sourceUrl:
      stringValue(
        component,
        [
          'sourceUrl',
          'url',
        ],
      ),

    overviewUrl:
      stringValue(
        component,
        [
          'overviewUrl',
        ],
      ),

    tableUrl:
      stringValue(
        component,
        [
          'tableUrl',
          'unitTableUrl',
          'unitOfStudyTableUrl',
        ],
      ),
  };
}

async function loadComponents():
Promise<unknown[]> {
  /**
   * Prefer the audited merged catalogue once it exists.
   * Before that stage, fall back to the 358-component Stage 1 master.
   */
  try {
    const raw =
      await fs.readFile(
        COMPLETE_COMPONENT_FILE,
        'utf8',
      );

    const merged =
      JSON.parse(
        raw,
      ) as unknown;

    if (
      isRecord(
        merged,
      ) &&
      Array.isArray(
        merged.components,
      )
    ) {
      return merged.components;
    }
  } catch (
    error
  ) {
    const code =
      isRecord(
        error,
      )
        ? error['code']
        : null;

    if (
      code !==
      'ENOENT'
    ) {
      throw error;
    }
  }

  const raw =
    await fs.readFile(
      MASTER_FILE,
      'utf8',
    );

  const master =
    JSON.parse(
      raw,
    ) as unknown;

  if (
    !isRecord(master) ||
    !Array.isArray(master.components)
  ) {
    throw new Error(
      'USYD master does not contain components[].',
    );
  }

  return master.components;
}

function classify(
  evidence: UsydDegreeComponentEvidence,
  components: unknown[],
): UsydComponentRoleCoverageRecord {
  const requestedName =
    evidence.componentName;

  const requestedType =
    evidence.componentType;

  if (
    !requestedName ||
    !requestedType
  ) {
    throw new Error(
      'Named component evidence is missing name/type.',
    );
  }

  const requestedNameKey =
    normalize(requestedName);

  const degreeHandbook =
    evidence.handbookCategory;

  const allSameName:
    UsydComponentRoleCandidate[] =
    [];

  components.forEach(
    (
      component,
      index,
    ) => {
      const candidate =
        getCandidate(
          component,
          index,
        );

      if (
        !candidate ||
        normalize(candidate.name) !==
          requestedNameKey
      ) {
        return;
      }

      allSameName.push(
        candidate,
      );
    },
  );

  const sameHandbook =
    allSameName.filter(
      (
        candidate,
      ) =>
        degreeHandbook !==
          null &&
        candidate.handbook ===
          degreeHandbook,
    );

  const sameHandbookExactType =
    sameHandbook.filter(
      (
        candidate,
      ) =>
        candidate.type
          ?.toUpperCase() ===
        requestedType,
    );

  const sameHandbookSameNameOtherType =
    sameHandbook.filter(
      (
        candidate,
      ) =>
        candidate.type
          ?.toUpperCase() !==
        requestedType,
    );

  const otherHandbookExactType =
    allSameName.filter(
      (
        candidate,
      ) =>
        candidate.handbook !==
          degreeHandbook &&
        candidate.type
          ?.toUpperCase() ===
          requestedType,
    );

  let status:
    UsydComponentRoleCoverageRecord['status'];

  if (
    sameHandbookExactType.length >
    0
  ) {
    status =
      'RESOLVED_SAME_HANDBOOK';
  } else if (
    sameHandbookSameNameOtherType.length >
    0
  ) {
    status =
      'MISSING_ROLE_SAME_NAME_EXISTS';
  } else if (
    allSameName.length ===
    0
  ) {
    status =
      'MISSING_COMPONENT_FAMILY';
  } else {
    status =
      'ONLY_OTHER_HANDBOOK';
  }

  return {
    degreeCode:
      evidence.degreeCode,

    degreeTitle:
      evidence.degreeTitle,

    degreeHandbook,

    requestedName,

    requestedType,

    rawText:
      evidence.rawText,

    sameHandbookExactType,

    sameHandbookSameNameOtherType,

    otherHandbookExactType,

    status,
  };
}

export async function auditUsydComponentRoleCoverage():
Promise<UsydComponentRoleCoverageAudit> {
  const [
    evidenceAudit,
    components,
  ] =
    await Promise.all(
      [
        auditUsydDegreeComponentEvidence(),
        loadComponents(),
      ],
    );

  const namedEvidence =
    evidenceAudit
      .evidence
      .filter(
        (
          item,
        ) =>
          item.kind ===
            'NAMED_COMPONENT' &&
          item.componentName !==
            null &&
          item.componentType !==
            null,
      );

  const records =
    namedEvidence.map(
      (
        evidence,
      ) =>
        classify(
          evidence,
          components,
        ),
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date()
        .toISOString(),

    namedEvidenceCount:
      records.length,

    resolvedSameHandbookCount:
      records.filter(
        (
          record,
        ) =>
          record.status ===
          'RESOLVED_SAME_HANDBOOK',
      ).length,

    missingRoleCount:
      records.filter(
        (
          record,
        ) =>
          record.status ===
          'MISSING_ROLE_SAME_NAME_EXISTS',
      ).length,

    missingFamilyCount:
      records.filter(
        (
          record,
        ) =>
          record.status ===
          'MISSING_COMPONENT_FAMILY',
      ).length,

    onlyOtherHandbookCount:
      records.filter(
        (
          record,
        ) =>
          record.status ===
          'ONLY_OTHER_HANDBOOK',
      ).length,

    records,
  };
}
