import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const STAGE1_FILE = path.join(
  DATA_DIR,
  'usyd-degree-component-relationships.stage1.json',
);

type UnknownRecord = Record<string, unknown>;

type ComponentRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM'
  | null;

export type UnqualifiedTableASemanticClass =
  | 'DIRECT_TABLE_A_COMPONENT_CHOICE'
  | 'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE'
  | 'CROSS_FACULTY_TABLE_A_COMPONENT_CHOICE'
  | 'STREAM_CONTEXT'
  | 'NON_COMPONENT_UNIT_REFERENCE'
  | 'SUSPICIOUS_PROGRAM_SCOPE'
  | 'UNTYPED_COMPONENT_CLAUSE'
  | 'REVIEW';

export interface UsydUnqualifiedTableASignalAuditRecord {
  degreeCode: string | null;
  degreeTitle: string | null;
  degreeHandbook: string | null;
  componentType: ComponentRole;
  tableNames: string[];
  raw: string;
  semanticClass: UnqualifiedTableASemanticClass;
  reason: string;
}

export interface UsydUnqualifiedTableASignalAuditDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    signals: number;
    degrees: number;
    directTableAComponentChoice: number;
    tableAOrTableSComponentChoice: number;
    crossFacultyTableAComponentChoice: number;
    streamContext: number;
    nonComponentUnitReference: number;
    suspiciousProgramScope: number;
    untypedComponentClause: number;
    review: number;
  };

  byComponentType: Record<string, number>;
  bySemanticClass: Record<string, number>;
  records: UsydUnqualifiedTableASignalAuditRecord[];
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
    const value = asString(
      record[key],
    );

    if (value) {
      return value;
    }
  }

  return null;
}

function stringArray(
  value: unknown,
): string[] {
  if (Array.isArray(value)) {
    return value
      .map(asString)
      .filter(
        (
          item,
        ): item is string =>
          item !== null,
      );
  }

  const single = asString(
    value,
  );

  return single
    ? [single]
    : [];
}

function firstStringArray(
  record: UnknownRecord,
  keys: string[],
): string[] {
  for (const key of keys) {
    const values =
      stringArray(
        record[key],
      );

    if (values.length > 0) {
      return values;
    }
  }

  return [];
}

function normalizeRole(
  value: string | null,
): ComponentRole {
  if (!value) {
    return null;
  }

  const normalized =
    value.trim().toUpperCase();

  if (
    normalized === 'MAJOR' ||
    normalized === 'MINOR' ||
    normalized === 'PROGRAM' ||
    normalized === 'STREAM'
  ) {
    return normalized;
  }

  return null;
}

function isUnqualifiedTableAName(
  tableName: string,
): boolean {
  const normalized =
    tableName
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  if (
    normalized.includes(
      'table a for the bachelor',
    )
  ) {
    return false;
  }

  return (
    normalized === 'table a' ||
    normalized === 'science table a' ||
    normalized ===
      'arts and social sciences table a' ||
    normalized ===
      'arts & social sciences table a' ||
    normalized ===
      'bachelor of science table a' ||
    normalized.includes(
      'science table a',
    ) ||
    normalized.includes(
      'arts and social sciences table a',
    ) ||
    normalized.includes(
      'arts & social sciences table a',
    )
  );
}

function hasTableAOrS(
  raw: string,
): boolean {
  return (
    /table a\s*,?\s*(?:or|\/)\s*table s/i.test(
      raw,
    ) ||
    /table s\s*,?\s*(?:or|\/)\s*table a/i.test(
      raw,
    )
  );
}

function looksLikeUnitRequirement(
  raw: string,
): boolean {
  return (
    /\b(?:core|elective|selective|studio|ensemble|performance|project|units?)\s+(?:units?\s+)?of study\b/i.test(
      raw,
    ) ||
    /\bcredit points of\b.*\bunits?\b/i.test(
      raw,
    ) ||
    /\bunits? of study\b/i.test(
      raw,
    ) ||
    /\bdegree core\b/i.test(
      raw,
    ) ||
    /\bprincipal study area units\b/i.test(
      raw,
    ) ||
    /\btable a degree core\b/i.test(
      raw,
    )
  );
}

function looksLikeUntypedComponentClause(
  raw: string,
): boolean {
  return (
    /\b(?:a|one)\s+(?:\d+\s+credit point\s+)?(?:major|minor|program|stream)\b/i.test(
      raw,
    ) ||
    /\b(?:major|minor|program|stream)\s+(?:as|from|listed|defined)\b/i.test(
      raw,
    )
  );
}

function classify(
  componentType: ComponentRole,
  raw: string,
): {
  semanticClass:
    UnqualifiedTableASemanticClass;
  reason: string;
} {
  const lower =
    raw.toLowerCase();

  if (
    componentType === 'STREAM'
  ) {
    return {
      semanticClass:
        'STREAM_CONTEXT',

      reason:
        'STREAM requirements reference Table A/Table D context; this is not a generic Table A choice pool.',
    };
  }

  if (
    componentType === 'PROGRAM' &&
    /table a\s*,?\s*table s\s*,?\s*table o/i.test(
      raw,
    )
  ) {
    return {
      semanticClass:
        'SUSPICIOUS_PROGRAM_SCOPE',

      reason:
        'PROGRAM appears to span Table A/Table S/Table O; preserve for semantic review instead of generating a program pool.',
    };
  }

  if (
    /from either science table a or arts (?:and|&) social sciences table a/i.test(
      lower,
    )
  ) {
    return {
      semanticClass:
        'CROSS_FACULTY_TABLE_A_COMPONENT_CHOICE',

      reason:
        'The clause explicitly permits a curriculum component from either Science Table A or Arts and Social Sciences Table A.',
    };
  }

  if (
    componentType !== null &&
    hasTableAOrS(
      raw,
    )
  ) {
    return {
      semanticClass:
        'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE',

      reason:
        'The typed component can come from Table A or Table S; only the Table A side should be resolved here.',
    };
  }

  if (
    componentType !== null &&
    /\btable a\b/i.test(
      raw,
    )
  ) {
    return {
      semanticClass:
        'DIRECT_TABLE_A_COMPONENT_CHOICE',

      reason:
        'This is a typed curriculum-component reference to Table A.',
    };
  }

  /**
   * Untyped duplicate/raw clauses are common in Stage1.
   * Keep genuine component wording separate from unit requirements.
   */
  if (
    componentType === null &&
    looksLikeUntypedComponentClause(
      raw,
    ) &&
    !looksLikeUnitRequirement(
      raw,
    )
  ) {
    return {
      semanticClass:
        'UNTYPED_COMPONENT_CLAUSE',

      reason:
        'The text contains curriculum-component language, but Stage1 did not attach a reliable component type. Do not create a pool until deduplicated against a typed signal or parsed in formal degree semantics.',
    };
  }

  if (
    componentType === null &&
    (
      looksLikeUnitRequirement(
        raw,
      ) ||
      /\belective units from table a\b/i.test(
        raw,
      ) ||
      /\bselective units .* table a\b/i.test(
        raw,
      ) ||
      /\bcore units .* table a\b/i.test(
        raw,
      )
    )
  ) {
    return {
      semanticClass:
        'NON_COMPONENT_UNIT_REFERENCE',

      reason:
        'The clause describes units/core/selectives/electives rather than selecting a curriculum component.',
    };
  }

  return {
    semanticClass:
      'REVIEW',

    reason:
      'The signal does not match a safe automatic semantic class.',
  };
}

function increment(
  target: Record<string, number>,
  key: string,
): void {
  target[key] =
    (target[key] ?? 0) + 1;
}

async function readStage1():
Promise<UnknownRecord> {
  const raw =
    await fs.readFile(
      STAGE1_FILE,
      'utf8',
    );

  const value =
    JSON.parse(
      raw,
    ) as unknown;

  if (!isRecord(value)) {
    throw new Error(
      'Stage1 relationship file must contain a JSON object.',
    );
  }

  return value;
}

function getGenericSignals(
  root: UnknownRecord,
): UnknownRecord[] {
  const candidates = [
    root.genericSignals,
    root.genericTableSignals,
    root.signals,
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value.filter(
        isRecord,
      );
    }
  }

  throw new Error(
    'Could not find genericSignals[] in usyd-degree-component-relationships.stage1.json.',
  );
}

export async function auditUsydUnqualifiedTableASignals():
Promise<UsydUnqualifiedTableASignalAuditDataset> {
  const root =
    await readStage1();

  const genericSignals =
    getGenericSignals(
      root,
    );

  const records:
    UsydUnqualifiedTableASignalAuditRecord[] =
    [];

  for (const signal of genericSignals) {
    const tableNames =
      firstStringArray(
        signal,
        [
          'tableNames',
          'tables',
          'tableName',
          'table',
        ],
      );

    if (
      !tableNames.some(
        isUnqualifiedTableAName,
      )
    ) {
      continue;
    }

    const raw =
      firstString(
        signal,
        [
          'raw',
          'rawText',
          'text',
          'evidence',
          'sourceText',
        ],
      );

    if (!raw) {
      continue;
    }

    const componentType =
      normalizeRole(
        firstString(
          signal,
          [
            'componentType',
            'type',
            'requestedComponentType',
          ],
        ),
      );

    const classification =
      classify(
        componentType,
        raw,
      );

    records.push({
      degreeCode:
        firstString(
          signal,
          [
            'degreeCode',
            'code',
          ],
        ),

      degreeTitle:
        firstString(
          signal,
          [
            'degreeTitle',
            'title',
          ],
        ),

      degreeHandbook:
        firstString(
          signal,
          [
            'degreeHandbook',
            'handbook',
          ],
        ),

      componentType,

      tableNames,

      raw,

      semanticClass:
        classification.semanticClass,

      reason:
        classification.reason,
    });
  }

  records.sort(
    (left, right) =>
      (left.degreeCode ?? '')
        .localeCompare(
          right.degreeCode ?? '',
        ) ||
      left.raw.localeCompare(
        right.raw,
      ),
  );

  const byComponentType:
    Record<string, number> =
    {};

  const bySemanticClass:
    Record<string, number> =
    {};

  for (const record of records) {
    increment(
      byComponentType,
      record.componentType ??
        'NONE',
    );

    increment(
      bySemanticClass,
      record.semanticClass,
    );
  }

  const countClass = (
    semanticClass:
      UnqualifiedTableASemanticClass,
  ) =>
    records.filter(
      (record) =>
        record.semanticClass ===
        semanticClass,
    ).length;

  return {
    university: 'USYD',
    handbookYear: 2026,
    generatedAt:
      new Date().toISOString(),

    counts: {
      signals:
        records.length,

      degrees:
        new Set(
          records
            .map(
              (record) =>
                record.degreeCode,
            )
            .filter(
              (
                value,
              ): value is string =>
                value !== null,
            ),
        ).size,

      directTableAComponentChoice:
        countClass(
          'DIRECT_TABLE_A_COMPONENT_CHOICE',
        ),

      tableAOrTableSComponentChoice:
        countClass(
          'TABLE_A_OR_TABLE_S_COMPONENT_CHOICE',
        ),

      crossFacultyTableAComponentChoice:
        countClass(
          'CROSS_FACULTY_TABLE_A_COMPONENT_CHOICE',
        ),

      streamContext:
        countClass(
          'STREAM_CONTEXT',
        ),

      nonComponentUnitReference:
        countClass(
          'NON_COMPONENT_UNIT_REFERENCE',
        ),

      suspiciousProgramScope:
        countClass(
          'SUSPICIOUS_PROGRAM_SCOPE',
        ),

      untypedComponentClause:
        countClass(
          'UNTYPED_COMPONENT_CLAUSE',
        ),

      review:
        countClass(
          'REVIEW',
        ),
    },

    byComponentType,
    bySemanticClass,
    records,
  };
}
