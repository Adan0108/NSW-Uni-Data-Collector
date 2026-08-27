import fs from 'node:fs/promises';
import path from 'node:path';

const HANDBOOK_YEAR = 2026;

const MASTER_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(HANDBOOK_YEAR),
    'usyd-master-global.json',
  );

type UnknownRecord =
  Record<string, unknown>;

export type UsydDegreeComponentEvidenceKind =
  | 'NAMED_COMPONENT'
  | 'GENERIC_TABLE_REFERENCE'
  | 'GENERIC_COMPONENT_REFERENCE';

export interface UsydDegreeComponentEvidence {
  degreeCode: string;
  degreeTitle: string;
  handbookCategory: string | null;

  kind: UsydDegreeComponentEvidenceKind;

  rawText: string;

  componentName: string | null;
  componentType:
    | 'MAJOR'
    | 'MINOR'
    | 'PROGRAM'
    | 'STREAM'
    | null;

  tableName: string | null;

  matchedComponentIndexes: number[];

  status:
    | 'RESOLVED'
    | 'AMBIGUOUS'
    | 'UNRESOLVED'
    | 'GENERIC';
}

export interface UsydDegreeComponentAuditResult {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  degreeCount: number;
  componentCount: number;

  evidenceCount: number;
  resolvedNamedCount: number;
  ambiguousNamedCount: number;
  unresolvedNamedCount: number;
  genericCount: number;

  evidence: UsydDegreeComponentEvidence[];
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
  value: unknown,
): string | null {
  return (
    typeof value === 'string' &&
    value.trim()
  )
    ? value.trim()
    : null;
}

function normalizeName(
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

function flattenRequirementTexts(
  value: unknown,
  output: string[],
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      flattenRequirementTexts(
        item,
        output,
      );
    }

    return;
  }

  if (!isRecord(value)) {
    return;
  }

  for (const key of [
    'rawText',
    'rawRequirements',
    'rawAwardRequirements',
    'text',
  ]) {
    const text =
      stringValue(value[key]);

    if (text) {
      output.push(text);
    }
  }

  for (const nested of Object.values(value)) {
    if (
      typeof nested === 'object' &&
      nested !== null
    ) {
      flattenRequirementTexts(
        nested,
        output,
      );
    }
  }
}

function uniqueStrings(
  values: string[],
): string[] {
  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

function getComponentName(
  component: unknown,
): string | null {
  return isRecord(component)
    ? stringValue(component.name)
    : null;
}

function getComponentType(
  component: unknown,
):
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM'
  | null {
  if (!isRecord(component)) {
    return null;
  }

  const raw =
    stringValue(component.type)?.toUpperCase();

  if (
    raw === 'MAJOR' ||
    raw === 'MINOR' ||
    raw === 'PROGRAM' ||
    raw === 'STREAM'
  ) {
    return raw;
  }

  return null;
}

function buildComponentIndex(
  components: unknown[],
): Map<
  string,
  number[]
> {
  const index =
    new Map<
      string,
      number[]
    >();

  components.forEach(
    (
      component,
      componentIndex,
    ) => {
      const name =
        getComponentName(component);

      if (!name) {
        return;
      }

      const key =
        normalizeName(name);

      const current =
        index.get(key) ?? [];

      current.push(componentIndex);

      index.set(
        key,
        current,
      );
    },
  );

  return index;
}

function cleanNamedComponent(
  value: string,
): string | null {
  let cleaned =
    value
      .replace(
        /\(\s*\d+(?:\.\d+)?\s+credit\s+points?\s*\)\s*$/i,
        '',
      )
      .replace(
        /[,;:]+$/g,
        '',
      )
      .trim();

  /**
   * These are grammatical continuations, not component names.
   */
  cleaned =
    cleaned.replace(
      /\s+(?:as|from|listed|specified|defined|according|has\s+been|who|that|where)\b.*$/i,
      '',
    )
    .trim();

  if (
    !cleaned ||
    /^(?:its|their|the|this|that|current|a|an)\b/i.test(
      cleaned,
    ) ||
    /\b(?:faculty handbooks?|current degree|requirements?|units? of study)\b/i.test(
      cleaned,
    )
  ) {
    return null;
  }

  return cleaned;
}

function extractNamedReferences(
  rawText: string,
): Array<{
  componentType:
    | 'MAJOR'
    | 'MINOR'
    | 'PROGRAM'
    | 'STREAM';
  componentName: string;
}> {
  const output:
    Array<{
      componentType:
        | 'MAJOR'
        | 'MINOR'
        | 'PROGRAM'
        | 'STREAM';
      componentName: string;
    }> =
    [];

  /**
   * Targeted shared-name form:
   *
   *   a minor (36 credit points) or a major (48 credit points)
   *   in Physical Activity and Health
   *
   * The normal "<type> in <name>" matcher only sees the second role.
   * Here both roles clearly apply to the same named component family,
   * so preserve both explicitly.
   */
  const sharedNameRoleRegex =
    /\b(?:a|one|the|second)?\s*(major|minor|program|stream)(?:\s*\(\s*\d+(?:\.\d+)?\s+credit\s+points?\s*\))?\s+or\s+(?:a|one|the|second)?\s*(major|minor|program|stream)(?:\s*\(\s*\d+(?:\.\d+)?\s+credit\s+points?\s*\))?\s+in\s+(.+?)(?=(?:\s*[,;]?\s+(?:as|from|listed|specified|defined|according|has\s+been|who|that|where)\b)|(?:\s+or\s*,?\s*where\b)|[.;]|$)/gi;

  for (
    const match
    of rawText.matchAll(
      sharedNameRoleRegex,
    )
  ) {
    const firstType =
      match[1]
        ?.toUpperCase();

    const secondType =
      match[2]
        ?.toUpperCase();

    const componentName =
      cleanNamedComponent(
        match[3] ?? '',
      );

    if (
      !componentName
    ) {
      continue;
    }

    for (
      const rawType
      of [
        firstType,
        secondType,
      ]
    ) {
      if (
        rawType !==
          'MAJOR' &&
        rawType !==
          'MINOR' &&
        rawType !==
          'PROGRAM' &&
        rawType !==
          'STREAM'
      ) {
        continue;
      }

      output.push({
        componentType:
          rawType,
        componentName,
      });
    }
  }

  /**
   * Normal explicit "<type> in <name>" statements.
   *
   * Stop before grammar such as:
   * - "as listed..."
   * - "from Table A..."
   * - "has been completed..."
   * - "or, where..."
   *
   * This prevents false names such as:
   * "their current degree..." or
   * "Sociology has been completed, a minor".
   */
  const regex =
    /\b(?:a|one|the|second)?\s*(major|minor|program|stream)(?:\s*\(\s*\d+(?:\.\d+)?\s+credit\s+points?\s*\))?\s+in\s+(.+?)(?=(?:\s*[,;]?\s+(?:as|from|listed|specified|defined|according|has\s+been|who|that|where)\b)|(?:\s+or\s*,?\s*where\b)|[.;]|$)/gi;

  for (
    const match
    of rawText.matchAll(
      regex,
    )
  ) {
    const rawType =
      match[1]
        ?.toUpperCase();

    if (
      rawType !==
        'MAJOR' &&
      rawType !==
        'MINOR' &&
      rawType !==
        'PROGRAM' &&
      rawType !==
        'STREAM'
    ) {
      continue;
    }

    const componentName =
      cleanNamedComponent(
        match[2] ?? '',
      );

    if (
      !componentName
    ) {
      continue;
    }

    output.push({
      componentType:
        rawType,
      componentName,
    });
  }

  /**
   * The targeted shared-name matcher and the normal matcher can both
   * emit the second role. Deduplicate only identical role/name pairs.
   */
  return [
    ...new Map(
      output.map(
        (
          item,
        ) => [
          `${item.componentType}|${normalizeName(item.componentName)}`,
          item,
        ],
      ),
    ).values(),
  ];
}

function extractGenericComponentReferences(
  rawText: string,
): Array<{
  componentType:
    | 'MAJOR'
    | 'MINOR'
    | 'PROGRAM'
    | 'STREAM';
  rawText: string;
  tableNames: string[];
}> {
  const output:
    Array<{
      componentType:
        | 'MAJOR'
        | 'MINOR'
        | 'PROGRAM'
        | 'STREAM';
      rawText: string;
      tableNames: string[];
    }> =
    [];

  /**
   * Capture only the local requirement clause, not the whole
   * resolution paragraph. This is important because the same
   * paragraph can mention Table A, S, O and D for different purposes.
   */
  const regex =
    /\b(?:a|one|the|second)?\s*(major|minor|program|stream)\b[^.;]*/gi;

  for (
    const match
    of rawText.matchAll(
      regex,
    )
  ) {
    const type =
      match[1]
        ?.toUpperCase();

    if (
      type !==
        'MAJOR' &&
      type !==
        'MINOR' &&
      type !==
        'PROGRAM' &&
      type !==
        'STREAM'
    ) {
      continue;
    }

    const text =
      match[0]
        .trim();

    /**
     * Named relationships are handled separately and are already
     * authoritative. Do not duplicate them here.
     */
    if (
      /\b(?:major|minor|program|stream)(?:\s*\([^)]*\))?\s+in\s+/i.test(
        text,
      )
    ) {
      continue;
    }

    output.push({
      componentType:
        type,

      rawText:
        text,

      tableNames:
        extractTableReferences(
          text,
        ),
    });
  }

  return output;
}

function extractTableReferences(
  rawText: string,
): string[] {
  const output:
    string[] =
    [];

  /**
   * Extract one table reference at a time.
   *
   * Critical rule:
   * "Table A for the Bachelor of Commerce, Table S, Table O ..."
   * must become:
   *   - Table A for the Bachelor of Commerce
   *   - Table S
   *   - Table O
   *
   * and NEVER one giant Table A label containing S/O/D.
   */
  const regex =
    /\bTable\s+([A-Z])(?:\s+for\s+the\s+(.+?))?(?=(?:\s*[,;]?\s*(?:(?:or|and)\s+)?Table\s+[A-Z]\b)|(?:\s*[,;]?\s+(?:or|and)\s+for\s+students\b)|[.;:]|$)/gi;

  for (
    const match
    of rawText.matchAll(
      regex,
    )
  ) {
    const letter =
      match[1]
        ?.toUpperCase();

    if (
      !letter
    ) {
      continue;
    }

    const qualifier =
      cleanTableQualifier(
        match[2] ??
        '',
      );

    output.push(
      qualifier
        ? `Table ${letter} for the ${qualifier}`
        : `Table ${letter}`,
    );
  }

  if (
    /\bShared Pool for Undergraduate Degrees\b/i.test(
      rawText,
    )
  ) {
    output.push(
      'Shared Pool for Undergraduate Degrees',
    );
  }

  return uniqueStrings(
    output,
  );
}

function cleanTableQualifier(
  value: string,
): string {
  return value
    .replace(
      /\s+/g,
      ' ',
    )
    .replace(
      /\s+(?:as\s+(?:set\s+out|specified|defined).*)$/i,
      '',
    )
    .replace(
      /\s*\([^)]*(?:Table\s+A|Table\s+S|Table\s+O|Table\s+D)[^)]*\)\s*$/i,
      '',
    )
    .replace(
      /\s*,?\s+(?:or|and)\s*$/i,
      '',
    )
    .trim();
}

export async function auditUsydDegreeComponentEvidence():
Promise<UsydDegreeComponentAuditResult> {
  const raw =
    await fs.readFile(
      MASTER_FILE,
      'utf8',
    );

  const master =
    JSON.parse(raw) as unknown;

  if (!isRecord(master)) {
    throw new Error(
      'Invalid USYD master JSON.',
    );
  }

  const degrees =
    Array.isArray(master.degrees)
      ? master.degrees
      : [];

  const components =
    Array.isArray(master.components)
      ? master.components
      : [];

  const componentIndex =
    buildComponentIndex(
      components,
    );

  const evidence:
    UsydDegreeComponentEvidence[] =
    [];

  for (const degree of degrees) {
    if (!isRecord(degree)) {
      continue;
    }

    const degreeCode =
      stringValue(degree.code);

    const degreeTitle =
      stringValue(degree.title);

    if (
      !degreeCode ||
      !degreeTitle
    ) {
      continue;
    }

    const handbookCategory =
      stringValue(
        degree.handbookCategory,
      );

    const texts:
      string[] =
      [];

    flattenRequirementTexts(
      degree.requirements,
      texts,
    );

    const rawRequirements =
      stringValue(
        degree.rawRequirements,
      );

    if (rawRequirements) {
      texts.push(rawRequirements);
    }

    for (const rawText of uniqueStrings(texts)) {
      for (
        const named
        of extractNamedReferences(rawText)
      ) {
        const key =
          normalizeName(
            named.componentName,
          );

        const candidateIndexes =
          componentIndex.get(key) ?? [];

        const typeMatched =
          candidateIndexes.filter(
            (index) =>
              getComponentType(
                components[index],
              ) ===
              named.componentType,
          );

        const matchedComponentIndexes =
          typeMatched.length > 0
            ? typeMatched
            : candidateIndexes;

        evidence.push({
          degreeCode,
          degreeTitle,
          handbookCategory,
          kind:
            'NAMED_COMPONENT',
          rawText,
          componentName:
            named.componentName,
          componentType:
            named.componentType,
          tableName:
            null,
          matchedComponentIndexes,
          status:
            matchedComponentIndexes.length === 1
              ? 'RESOLVED'
              : matchedComponentIndexes.length > 1
                ? 'AMBIGUOUS'
                : 'UNRESOLVED',
        });
      }

      for (
        const generic
        of extractGenericComponentReferences(
          rawText,
        )
      ) {
        if (
          generic.tableNames.length >
          0
        ) {
          for (
            const tableName
            of generic.tableNames
          ) {
            evidence.push({
              degreeCode,
              degreeTitle,
              handbookCategory,
              kind:
                'GENERIC_COMPONENT_REFERENCE',
              rawText:
                generic.rawText,
              componentName:
                null,
              componentType:
                generic.componentType,
              tableName,
              matchedComponentIndexes:
                [],
              status:
                'GENERIC',
            });
          }
        } else {
          evidence.push({
            degreeCode,
            degreeTitle,
            handbookCategory,
            kind:
              'GENERIC_COMPONENT_REFERENCE',
            rawText:
              generic.rawText,
            componentName:
              null,
            componentType:
              generic.componentType,
            tableName:
              null,
            matchedComponentIndexes:
              [],
            status:
              'GENERIC',
          });
        }
      }

      for (
        const tableName
        of extractTableReferences(rawText)
      ) {
        evidence.push({
          degreeCode,
          degreeTitle,
          handbookCategory,
          kind:
            'GENERIC_TABLE_REFERENCE',
          rawText,
          componentName:
            null,
          componentType:
            null,
          tableName,
          matchedComponentIndexes:
            [],
          status:
            'GENERIC',
        });
      }
    }
  }

  const uniqueEvidence =
    [
      ...new Map(
        evidence.map(
          (item) => [
            [
              item.degreeCode,
              item.kind,
              item.componentType ?? '',
              item.componentName ?? '',
              item.tableName ?? '',
              item.rawText,
            ].join('|'),
            item,
          ],
        ),
      ).values(),
    ];

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date()
        .toISOString(),

    degreeCount:
      degrees.length,

    componentCount:
      components.length,

    evidenceCount:
      uniqueEvidence.length,

    resolvedNamedCount:
      uniqueEvidence.filter(
        (item) =>
          item.kind ===
            'NAMED_COMPONENT' &&
          item.status ===
            'RESOLVED',
      ).length,

    ambiguousNamedCount:
      uniqueEvidence.filter(
        (item) =>
          item.kind ===
            'NAMED_COMPONENT' &&
          item.status ===
            'AMBIGUOUS',
      ).length,

    unresolvedNamedCount:
      uniqueEvidence.filter(
        (item) =>
          item.kind ===
            'NAMED_COMPONENT' &&
          item.status ===
            'UNRESOLVED',
      ).length,

    genericCount:
      uniqueEvidence.filter(
        (item) =>
          item.status ===
          'GENERIC',
      ).length,

    evidence:
      uniqueEvidence,
  };
}
