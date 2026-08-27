import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydComponentRoleCoverage,
  type UsydComponentRoleCoverageRecord,
} from './usyd.component-role-coverage-audit';

const HANDBOOK_YEAR =
  2026;

const MASTER_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
    'usyd-master-global.json',
  );

export type UsydSupplementalComponentType =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM';

export interface UsydSupplementalComponentEvidence {
  degreeCode: string;
  degreeTitle: string;
  rawText: string;
  sourceUrl: string | null;
  resolutionsUrl: string | null;
}

export interface UsydSupplementalComponent {
  name: string;
  type: UsydSupplementalComponentType;
  handbook: string;

  /**
   * Credit-point value explicitly stated by the degree resolution.
   * Null only if the named requirement is explicit but no CP value
   * can be extracted safely.
   */
  requiredCreditPoints: number | null;

  /**
   * These records exist because the global component-family discovery
   * does not contain the exact handbook+name+role entity required by
   * the degree resolutions.
   */
  supplemental: true;

  /**
   * Evidence source, never an inferred component table.
   */
  evidenceKind:
    | 'MISSING_ROLE_SAME_NAME_EXISTS'
    | 'MISSING_COMPONENT_FAMILY'
    | 'ONLY_OTHER_HANDBOOK';

  evidence: UsydSupplementalComponentEvidence[];
}

export interface UsydSupplementalComponentDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  sourceNamedEvidenceCount: number;

  uniqueSupplementalComponents: number;

  countsByReason: {
    missingRole: number;
    missingFamily: number;
    onlyOtherHandbook: number;
  };

  components: UsydSupplementalComponent[];
}

type UsydSupplementalEvidenceKind =
  UsydSupplementalComponent['evidenceKind'];

function isSupplementalEvidenceKind(
  value:
    UsydComponentRoleCoverageRecord['status'],
): value is UsydSupplementalEvidenceKind {
  return (
    value ===
      'MISSING_ROLE_SAME_NAME_EXISTS' ||
    value ===
      'MISSING_COMPONENT_FAMILY' ||
    value ===
      'ONLY_OTHER_HANDBOOK'
  );
}

type UnknownRecord =
  Record<string, unknown>;

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
  key: string,
): string | null {
  const value =
    record[key];

  return (
    typeof value === 'string' &&
    value.trim()
  )
    ? value.trim()
    : null;
}

async function readDegreeSourceMap():
Promise<Map<
  string,
  {
    sourceUrl: string | null;
    resolutionsUrl: string | null;
  }
>> {
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
    !Array.isArray(
      master.degrees,
    )
  ) {
    throw new Error(
      'USYD master does not contain degrees[].',
    );
  }

  const map =
    new Map<
      string,
      {
        sourceUrl: string | null;
        resolutionsUrl: string | null;
      }
    >();

  for (
    const degree
    of master.degrees
  ) {
    if (
      !isRecord(
        degree,
      )
    ) {
      continue;
    }

    const code =
      stringValue(
        degree,
        'code',
      );

    if (
      !code
    ) {
      continue;
    }

    map.set(
      code,
      {
        sourceUrl:
          stringValue(
            degree,
            'sourceUrl',
          ),

        resolutionsUrl:
          stringValue(
            degree,
            'resolutionsUrl',
          ),
      },
    );
  }

  return map;
}

function normalize(
  value: string,
): string {
  return value
    .toLowerCase()
    .replace(
      /&/g,
      'and',
    )
    .replace(
      /[’']/g,
      '',
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

function parseCreditPoints(
  record:
    UsydComponentRoleCoverageRecord,
): number | null {
  const escapedName =
    record.requestedName
      .replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );

  const typeWord =
    record.requestedType
      .toLowerCase();

  /**
   * Standard form:
   *   a major (48 credit points) in X
   *   a program in Economics (72 credit points)
   */
  const beforeName =
    new RegExp(
      `\\b${typeWord}\\b\\s*\\(\\s*(\\d+(?:\\.\\d+)?)\\s+credit\\s+points?\\s*\\)\\s+in\\s+${escapedName}\\b`,
      'i',
    );

  const afterName =
    new RegExp(
      `\\b${typeWord}\\b\\s+in\\s+${escapedName}\\s*\\(\\s*(\\d+(?:\\.\\d+)?)\\s+credit\\s+points?\\s*\\)`,
      'i',
    );

  const creditPointBeforeRole =
    new RegExp(
      `\\b(\\d+(?:\\.\\d+)?)\\s+credit\\s+point\\s+${typeWord}\\s+in\\s+${escapedName}\\b`,
      'i',
    );

  for (
    const regex
    of [
      beforeName,
      afterName,
      creditPointBeforeRole,
    ]
  ) {
    const match =
      record.rawText.match(
        regex,
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

  /**
   * Targeted shared-name form:
   *
   *   a minor (36 credit points) or a major (48 credit points)
   *   in Physical Activity and Health
   *
   * Match the requested role independently.
   */
  const roleAnywhere =
    new RegExp(
      `\\b${typeWord}\\b\\s*\\(\\s*(\\d+(?:\\.\\d+)?)\\s+credit\\s+points?\\s*\\)`,
      'i',
    );

  if (
    normalize(
      record.rawText,
    ).includes(
      normalize(
        record.requestedName,
      ),
    )
  ) {
    const match =
      record.rawText.match(
        roleAnywhere,
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

function reasonRank(
  value:
    UsydSupplementalComponent['evidenceKind'],
): number {
  switch (
    value
  ) {
    case 'MISSING_COMPONENT_FAMILY':
      return 3;

    case 'MISSING_ROLE_SAME_NAME_EXISTS':
      return 2;

    case 'ONLY_OTHER_HANDBOOK':
      return 1;
  }
}

export async function collectUsydSupplementalComponents():
Promise<UsydSupplementalComponentDataset> {
  const [
    audit,
    degreeSourceMap,
  ] =
    await Promise.all(
      [
        auditUsydComponentRoleCoverage(),
        readDegreeSourceMap(),
      ],
    );

  const relevant =
    audit.records.filter(
      (
        record,
      ): record is UsydComponentRoleCoverageRecord & {
        status:
          UsydSupplementalEvidenceKind;
      } =>
        isSupplementalEvidenceKind(
          record.status,
        ),
    );

  const grouped =
    new Map<
      string,
      UsydSupplementalComponent
    >();

  for (
    const record
    of relevant
  ) {
    if (
      !record.degreeHandbook
    ) {
      throw new Error(
        `Cannot create supplemental component without handbook: ${record.degreeCode} ${record.requestedName}`,
      );
    }

    const key =
      [
        record.degreeHandbook,
        record.requestedType,
        normalize(
          record.requestedName,
        ),
      ].join(
        '|',
      );

    const source =
      degreeSourceMap.get(
        record.degreeCode,
      );

    const evidence:
      UsydSupplementalComponentEvidence =
      {
        degreeCode:
          record.degreeCode,

        degreeTitle:
          record.degreeTitle,

        rawText:
          record.rawText,

        sourceUrl:
          source
            ?.sourceUrl ??
          null,

        resolutionsUrl:
          source
            ?.resolutionsUrl ??
          null,
      };

    const requiredCreditPoints =
      parseCreditPoints(
        record,
      );

    const existing =
      grouped.get(
        key,
      );

    if (
      !existing
    ) {
      grouped.set(
        key,
        {
          name:
            record.requestedName,

          type:
            record.requestedType,

          handbook:
            record.degreeHandbook,

          requiredCreditPoints,

          supplemental:
            true,

          evidenceKind:
            record.status,

          evidence:
            [
              evidence,
            ],
        },
      );

      continue;
    }

    if (
      existing.requiredCreditPoints !==
        null &&
      requiredCreditPoints !==
        null &&
      existing.requiredCreditPoints !==
        requiredCreditPoints
    ) {
      throw new Error(
        `Conflicting CP evidence for ${key}: ${existing.requiredCreditPoints} vs ${requiredCreditPoints}.`,
      );
    }

    if (
      existing.requiredCreditPoints ===
        null &&
      requiredCreditPoints !==
        null
    ) {
      existing.requiredCreditPoints =
        requiredCreditPoints;
    }

    if (
      reasonRank(
        record.status,
      ) >
      reasonRank(
        existing.evidenceKind,
      )
    ) {
      existing.evidenceKind =
        record.status;
    }

    const evidenceKey =
      `${evidence.degreeCode}|${evidence.rawText}`;

    const alreadyExists =
      existing.evidence.some(
        (
          item,
        ) =>
          `${item.degreeCode}|${item.rawText}` ===
          evidenceKey,
      );

    if (
      !alreadyExists
    ) {
      existing.evidence.push(
        evidence,
      );
    }
  }

  const components =
    [
      ...grouped.values(),
    ].sort(
      (
        left,
        right,
      ) =>
        left.handbook.localeCompare(
          right.handbook,
        ) ||
        left.name.localeCompare(
          right.name,
        ) ||
        left.type.localeCompare(
          right.type,
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

    sourceNamedEvidenceCount:
      audit.namedEvidenceCount,

    uniqueSupplementalComponents:
      components.length,

    countsByReason: {
      missingRole:
        components.filter(
          (
            component,
          ) =>
            component.evidenceKind ===
            'MISSING_ROLE_SAME_NAME_EXISTS',
        ).length,

      missingFamily:
        components.filter(
          (
            component,
          ) =>
            component.evidenceKind ===
            'MISSING_COMPONENT_FAMILY',
        ).length,

      onlyOtherHandbook:
        components.filter(
          (
            component,
          ) =>
            component.evidenceKind ===
            'ONLY_OTHER_HANDBOOK',
        ).length,
    },

    components,
  };
}
