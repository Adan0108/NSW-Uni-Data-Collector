import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydDegreeComponentEvidence,
  type UsydDegreeComponentEvidence,
} from './usyd.degree-component-audit';

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

type UnknownRecord =
  Record<string, unknown>;

export interface UsydComponentCandidateDiagnostic {
  index: number;
  name: string | null;
  type: string | null;
  handbook: string | null;
  sourceUrl: string | null;
  overviewUrl: string | null;
  tableUrl: string | null;
  score: number | null;
  raw: unknown;
}

export interface UsydDegreeComponentResolutionIssue {
  evidence: UsydDegreeComponentEvidence;
  candidates: UsydComponentCandidateDiagnostic[];
}

export interface UsydDegreeComponentResolutionAudit {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  ambiguousCount: number;
  unresolvedCount: number;

  ambiguous: UsydDegreeComponentResolutionIssue[];
  unresolved: UsydDegreeComponentResolutionIssue[];
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

function tokenSet(
  value: string,
): Set<string> {
  return new Set(
    normalize(
      value,
    )
      .split(
        ' ',
      )
      .filter(
        Boolean,
      ),
  );
}

function similarity(
  left: string,
  right: string,
): number {
  const a =
    tokenSet(
      left,
    );

  const b =
    tokenSet(
      right,
    );

  if (
    a.size ===
      0 ||
    b.size ===
      0
  ) {
    return 0;
  }

  let intersection =
    0;

  for (
    const token
    of a
  ) {
    if (
      b.has(
        token,
      )
    ) {
      intersection +=
        1;
    }
  }

  const union =
    new Set(
      [
        ...a,
        ...b,
      ],
    ).size;

  return union ===
    0
    ? 0
    : intersection /
      union;
}

function candidateFromComponent(
  component: unknown,
  index: number,
  score:
    number | null = null,
): UsydComponentCandidateDiagnostic {
  if (
    !isRecord(
      component,
    )
  ) {
    return {
      index,
      name:
        null,
      type:
        null,
      handbook:
        null,
      sourceUrl:
        null,
      overviewUrl:
        null,
      tableUrl:
        null,
      score,
      raw:
        component,
    };
  }

  return {
    index,

    name:
      stringValue(
        component,
        [
          'name',
          'title',
          'componentName',
        ],
      ),

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

    score,
    raw:
      component,
  };
}

function exactCandidates(
  components:
    unknown[],
  evidence:
    UsydDegreeComponentEvidence,
): UsydComponentCandidateDiagnostic[] {
  return evidence
    .matchedComponentIndexes
    .map(
      (
        index,
      ) =>
        candidateFromComponent(
          components[
            index
          ],
          index,
        ),
    );
}

function fuzzyCandidates(
  components:
    unknown[],
  evidence:
    UsydDegreeComponentEvidence,
): UsydComponentCandidateDiagnostic[] {
  const wantedName =
    evidence
      .componentName;

  if (
    !wantedName
  ) {
    return [];
  }

  const wantedType =
    evidence
      .componentType;

  const scored:
    UsydComponentCandidateDiagnostic[] =
    [];

  components.forEach(
    (
      component,
      index,
    ) => {
      if (
        !isRecord(
          component,
        )
      ) {
        return;
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

      if (
        !name
      ) {
        return;
      }

      const type =
        stringValue(
          component,
          [
            'type',
            'componentType',
          ],
        )
          ?.toUpperCase() ??
        null;

      /**
       * Prefer same-type candidates, but still allow a name match if
       * the discovery record has no usable type.
       */
      if (
        wantedType &&
        type &&
        type !==
          wantedType
      ) {
        return;
      }

      const score =
        similarity(
          wantedName,
          name,
        );

      if (
        score <=
        0
      ) {
        return;
      }

      scored.push(
        candidateFromComponent(
          component,
          index,
          score,
        ),
      );
    },
  );

  return scored
    .sort(
      (
        left,
        right,
      ) =>
        (
          right.score ??
          0
        ) -
        (
          left.score ??
          0
        ),
    )
    .slice(
      0,
      10,
    );
}

async function readComponents():
Promise<unknown[]> {
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
    !isRecord(
      master,
    ) ||
    !Array.isArray(
      master.components,
    )
  ) {
    throw new Error(
      'USYD master does not contain a components array.',
    );
  }

  return master
    .components;
}

export async function auditUsydDegreeComponentResolution():
Promise<UsydDegreeComponentResolutionAudit> {
  const [
    evidenceAudit,
    components,
  ] =
    await Promise.all(
      [
        auditUsydDegreeComponentEvidence(),
        readComponents(),
      ],
    );

  const ambiguousEvidence =
    evidenceAudit
      .evidence
      .filter(
        (
          evidence,
        ) =>
          evidence.kind ===
            'NAMED_COMPONENT' &&
          evidence.status ===
            'AMBIGUOUS',
      );

  const unresolvedEvidence =
    evidenceAudit
      .evidence
      .filter(
        (
          evidence,
        ) =>
          evidence.kind ===
            'NAMED_COMPONENT' &&
          evidence.status ===
            'UNRESOLVED',
      );

  const ambiguous =
    ambiguousEvidence.map(
      (
        evidence,
      ) => ({
        evidence,

        candidates:
          exactCandidates(
            components,
            evidence,
          ),
      }),
    );

  const unresolved =
    unresolvedEvidence.map(
      (
        evidence,
      ) => ({
        evidence,

        candidates:
          fuzzyCandidates(
            components,
            evidence,
          ),
      }),
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date()
        .toISOString(),

    ambiguousCount:
      ambiguous.length,

    unresolvedCount:
      unresolved.length,

    ambiguous,

    unresolved,
  };
}
