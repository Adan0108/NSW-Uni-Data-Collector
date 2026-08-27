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

const COMPLETE_COMPONENT_FILE =
  path.join(
    DATA_DIR,
    'usyd-components-complete.json',
  );

type UnknownRecord =
  Record<string, unknown>;

export type UsydDegreeComponentRelationshipKind =
  | 'EXPLICIT_NAMED';

export interface UsydDegreeComponentRelationshipEvidence {
  rawText: string;
  evidenceKind:
    | 'NAMED_COMPONENT';
}

export interface UsydDegreeComponentRelationship {
  degreeCode: string;
  degreeTitle: string;
  degreeHandbook: string | null;

  componentKey: string;
  componentName: string;
  componentType:
    | 'MAJOR'
    | 'MINOR'
    | 'PROGRAM'
    | 'STREAM';
  componentHandbook: string;

  relationshipKind:
    'EXPLICIT_NAMED';

  authoritative:
    true;

  evidence:
    UsydDegreeComponentRelationshipEvidence[];
}

export interface UsydDegreeComponentGenericSignal {
  degreeCode: string;
  degreeTitle: string;
  degreeHandbook: string | null;

  componentType:
    | 'MAJOR'
    | 'MINOR'
    | 'PROGRAM'
    | 'STREAM'
    | null;

  tableName: string | null;

  rawText: string;

  /**
   * Generic signals are deliberately NOT relationships yet.
   * They require a later explicit table/pool ownership resolver.
   */
  authoritative:
    false;
}

export interface UsydDegreeComponentRelationshipDataset {
  university:
    'USYD';

  handbookYear:
    2026;

  generatedAt:
    string;

  counts: {
    namedEvidenceRecords: number;
    authoritativeRelationships: number;
    genericSignals: number;
    unresolvedNamedEvidence: number;
  };

  relationships:
    UsydDegreeComponentRelationship[];

  genericSignals:
    UsydDegreeComponentGenericSignal[];

  unresolvedNamedEvidence:
    UsydDegreeComponentEvidence[];
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

function makeComponentKey(
  handbook: string,
  type: string,
  name: string,
): string {
  return [
    handbook.toUpperCase(),
    type.toUpperCase(),
    normalize(
      name,
    ),
  ].join(
    '|',
  );
}

async function loadLogicalComponentKeys():
Promise<Set<string>> {
  const raw =
    await fs.readFile(
      COMPLETE_COMPONENT_FILE,
      'utf8',
    );

  const dataset =
    JSON.parse(
      raw,
    ) as unknown;

  if (
    !isRecord(
      dataset,
    ) ||
    !Array.isArray(
      dataset.components,
    )
  ) {
    throw new Error(
      'Complete USYD component catalogue does not contain components[].',
    );
  }

  const keys =
    new Set<string>();

  for (
    const component
    of dataset.components
  ) {
    if (
      !isRecord(
        component,
      )
    ) {
      continue;
    }

    const handbook =
      stringValue(
        component,
        [
          'handbook',
          'handbookCategory',
          'category',
        ],
      );

    const type =
      stringValue(
        component,
        [
          'type',
          'componentType',
        ],
      );

    const name =
      stringValue(
        component,
        [
          'name',
          'title',
          'componentName',
        ],
      );

    if (
      !handbook ||
      !type ||
      !name
    ) {
      continue;
    }

    keys.add(
      makeComponentKey(
        handbook,
        type,
        name,
      ),
    );
  }

  return keys;
}

function dedupeEvidence(
  values:
    UsydDegreeComponentRelationshipEvidence[],
): UsydDegreeComponentRelationshipEvidence[] {
  return [
    ...new Map(
      values.map(
        (
          item,
        ) => [
          `${item.evidenceKind}|${item.rawText}`,
          item,
        ],
      ),
    ).values(),
  ];
}

export async function collectUsydDegreeComponentRelationshipsStage1():
Promise<UsydDegreeComponentRelationshipDataset> {
  const [
    evidenceAudit,
    componentKeys,
  ] =
    await Promise.all(
      [
        auditUsydDegreeComponentEvidence(),
        loadLogicalComponentKeys(),
      ],
    );

  const relationshipMap =
    new Map<
      string,
      UsydDegreeComponentRelationship
    >();

  const unresolvedNamedEvidence:
    UsydDegreeComponentEvidence[] =
    [];

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

  for (
    const evidence
    of namedEvidence
  ) {
    const handbook =
      evidence
        .handbookCategory;

    const name =
      evidence
        .componentName;

    const type =
      evidence
        .componentType;

    if (
      !handbook ||
      !name ||
      !type
    ) {
      unresolvedNamedEvidence.push(
        evidence,
      );

      continue;
    }

    const componentKey =
      makeComponentKey(
        handbook,
        type,
        name,
      );

    if (
      !componentKeys.has(
        componentKey,
      )
    ) {
      unresolvedNamedEvidence.push(
        evidence,
      );

      continue;
    }

    const relationshipKey =
      `${evidence.degreeCode}|${componentKey}`;

    const existing =
      relationshipMap.get(
        relationshipKey,
      );

    const relationshipEvidence:
      UsydDegreeComponentRelationshipEvidence =
      {
        rawText:
          evidence.rawText,

        evidenceKind:
          'NAMED_COMPONENT',
      };

    if (
      existing
    ) {
      existing.evidence =
        dedupeEvidence(
          [
            ...existing.evidence,
            relationshipEvidence,
          ],
        );

      continue;
    }

    relationshipMap.set(
      relationshipKey,
      {
        degreeCode:
          evidence.degreeCode,

        degreeTitle:
          evidence.degreeTitle,

        degreeHandbook:
          handbook,

        componentKey,

        componentName:
          name,

        componentType:
          type,

        componentHandbook:
          handbook,

        relationshipKind:
          'EXPLICIT_NAMED',

        authoritative:
          true,

        evidence:
          [
            relationshipEvidence,
          ],
      },
    );
  }

  const genericSignals =
    evidenceAudit
      .evidence
      .filter(
        (
          item,
        ) =>
          item.status ===
            'GENERIC',
      )
      .map(
        (
          item,
        ): UsydDegreeComponentGenericSignal => ({
          degreeCode:
            item.degreeCode,

          degreeTitle:
            item.degreeTitle,

          degreeHandbook:
            item.handbookCategory,

          componentType:
            item.componentType,

          tableName:
            item.tableName,

          rawText:
            item.rawText,

          authoritative:
            false,
        }),
      );

  const dedupedGenericSignals =
    [
      ...new Map(
        genericSignals.map(
          (
            item,
          ) => [
            [
              item.degreeCode,
              item.componentType ??
                '',
              item.tableName ??
                '',
              item.rawText,
            ].join(
              '|',
            ),
            item,
          ],
        ),
      ).values(),
    ];

  const relationships =
    [
      ...relationshipMap.values(),
    ].sort(
      (
        left,
        right,
      ) =>
        left.degreeCode.localeCompare(
          right.degreeCode,
        ) ||
        left.componentKey.localeCompare(
          right.componentKey,
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

    counts: {
      namedEvidenceRecords:
        namedEvidence.length,

      authoritativeRelationships:
        relationships.length,

      genericSignals:
        dedupedGenericSignals.length,

      unresolvedNamedEvidence:
        unresolvedNamedEvidence.length,
    },

    relationships,

    genericSignals:
      dedupedGenericSignals,

    unresolvedNamedEvidence,
  };
}
