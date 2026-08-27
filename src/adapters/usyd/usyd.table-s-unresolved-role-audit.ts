import fs from 'node:fs/promises';
import path from 'node:path';

import axios from 'axios';
import * as cheerio from 'cheerio';

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

const SOURCE_ROLE_AUDIT_FILE =
  path.join(
    DATA_DIR,
    'usyd-table-s-role-source-audit.json',
  );

const COMPONENT_FILE =
  path.join(
    DATA_DIR,
    'usyd-components-complete.json',
  );

const REQUEST_TIMEOUT_MS =
  30_000;

const CONCURRENCY =
  3;

type UnknownRecord =
  Record<string, unknown>;

type Role =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM';

interface SourceAuditRecord {
  familyName: string;
  overviewUrl: string;
  explicitRoles: Role[];
  status:
    | 'SUPPORTED'
    | 'NO_EXPLICIT_ROLE_EVIDENCE'
    | 'FETCH_FAILED';
}

interface ComponentRecord {
  name: string;
  handbook: string;
  tableUrl: string | null;
  overviewUrl: string | null;
  sourceUrl: string | null;
}

export interface UsydTableSUnresolvedRoleEvidence {
  familyName: string;

  overviewUrl: string;

  unitTableUrls: string[];

  explicitRoles:
    Role[];

  evidenceText:
    string[];

  status:
    | 'RESOLVED'
    | 'STILL_UNRESOLVED'
    | 'FETCH_FAILED';

  fetchErrors:
    string[];
}

export interface UsydTableSUnresolvedRoleAudit {
  university:
    'USYD';

  handbookYear:
    2026;

  generatedAt:
    string;

  counts: {
    unresolvedFamiliesInput: number;
    resolved: number;
    stillUnresolved: number;
    fetchFailed: number;
  };

  records:
    UsydTableSUnresolvedRoleEvidence[];
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

function normalizeSpace(
  value: string,
): string {
  return value
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
      values
        .map(
          normalizeSpace,
        )
        .filter(
          Boolean,
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

async function loadUnresolvedSourceRecords():
Promise<SourceAuditRecord[]> {
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
      'Table S source-role audit is missing records[].',
    );
  }

  return (
    value.records as
      SourceAuditRecord[]
  ).filter(
    (
      record,
    ) =>
      record.status ===
      'NO_EXPLICIT_ROLE_EVIDENCE',
  );
}

async function loadComponents():
Promise<ComponentRecord[]> {
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
      'Complete component catalogue is missing components[].',
    );
  }

  const output:
    ComponentRecord[] =
    [];

  for (
    const item
    of value.components
  ) {
    if (
      !isRecord(
        item,
      )
    ) {
      continue;
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
      !handbook
    ) {
      continue;
    }

    output.push({
      name,
      handbook:
        handbook.toUpperCase(),

      tableUrl:
        stringValue(
          item,
          [
            'tableUrl',
            'unitTableUrl',
            'unitOfStudyTableUrl',
          ],
        ),

      overviewUrl:
        stringValue(
          item,
          [
            'overviewUrl',
          ],
        ),

      sourceUrl:
        stringValue(
          item,
          [
            'sourceUrl',
            'url',
          ],
        ),
    });
  }

  return output;
}

function detectRolesFromText(
  text: string,
): Role[] {
  const roles =
    new Set<Role>();

  /**
   * Unit-table pages often expose explicit section headings such as:
   * - Major
   * - Minor
   * - Major requirements
   * - Minor requirements
   * - Program
   *
   * We deliberately require curricular role wording.
   */
  if (
    /\bmajor(?:\s+requirements?)?\b/i.test(
      text,
    )
  ) {
    roles.add(
      'MAJOR',
    );
  }

  if (
    /\bminor(?:\s+requirements?)?\b/i.test(
      text,
    )
  ) {
    roles.add(
      'MINOR',
    );
  }

  if (
    /\bprogram(?:\s+requirements?)?\b/i.test(
      text,
    )
  ) {
    roles.add(
      'PROGRAM',
    );
  }

  return [
    ...roles,
  ].sort();
}

function collectExplicitRoleEvidence(
  $:
    cheerio.CheerioAPI,
): {
  roles: Role[];
  evidenceText: string[];
} {
  const evidence:
    string[] =
    [];

  /**
   * Prefer headings, captions, table headers and short structural
   * text. Avoid using the entire page body because generic handbook
   * navigation may contain "major/minor/program" wording unrelated to
   * this subject area.
   */
  $(
    'h1, h2, h3, h4, h5, h6, caption, th, strong, b, p',
  ).each(
    (
      _,
      element,
    ) => {
      const text =
        normalizeSpace(
          $(
            element,
          ).text(),
        );

      if (
        !text ||
        text.length >
        500
      ) {
        return;
      }

      if (
        /\bmajor(?:\s+requirements?)?\b/i.test(
          text,
        ) ||
        /\bminor(?:\s+requirements?)?\b/i.test(
          text,
        ) ||
        /\bprogram(?:\s+requirements?)?\b/i.test(
          text,
        )
      ) {
        evidence.push(
          text,
        );
      }
    },
  );

  const uniqueEvidence =
    uniqueStrings(
      evidence,
    );

  return {
    roles:
      detectRolesFromText(
        uniqueEvidence.join(
          ' ',
        ),
      ),

    evidenceText:
      uniqueEvidence,
  };
}

async function fetchRoleEvidence(
  url: string,
): Promise<{
  roles: Role[];
  evidenceText: string[];
}> {
  const response =
    await axios.get<string>(
      url,
      {
        timeout:
          REQUEST_TIMEOUT_MS,

        headers: {
          'User-Agent':
            'Mozilla/5.0 university-handbook-collector/1.0',
        },
      },
    );

  const $ =
    cheerio.load(
      response.data,
    );

  return collectExplicitRoleEvidence(
    $,
  );
}

async function inspectFamily(
  record:
    SourceAuditRecord,
  components:
    ComponentRecord[],
): Promise<UsydTableSUnresolvedRoleEvidence> {
  const matching =
    components.filter(
      (
        component,
      ) =>
        component.handbook ===
          'INTERDISCIPLINARY' &&
        normalize(
          component.name,
        ) ===
          normalize(
            record.familyName,
          ),
    );

  const unitTableUrls =
    [
      ...new Set(
        matching
          .map(
            (
              component,
            ) =>
              component.tableUrl,
          )
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
                'string' &&
              value.includes(
                '/interdisciplinary-studies/table-s/subject-areas/',
              ),
          ),
      ),
    ];

  const roles =
    new Set<Role>();

  const evidenceText:
    string[] =
    [];

  const fetchErrors:
    string[] =
    [];

  for (
    const url
    of unitTableUrls
  ) {
    try {
      const evidence =
        await fetchRoleEvidence(
          url,
        );

      for (
        const role
        of evidence.roles
      ) {
        roles.add(
          role,
        );
      }

      for (
        const text
        of evidence.evidenceText
      ) {
        evidenceText.push(
          `${url} :: ${text}`,
        );
      }
    } catch (
      error
    ) {
      fetchErrors.push(
        `${url} :: ${
          error instanceof Error
            ? error.message
            : String(
                error,
              )
        }`,
      );
    }
  }

  const explicitRoles =
    [
      ...roles,
    ].sort();

  let status:
    UsydTableSUnresolvedRoleEvidence['status'];

  if (
    unitTableUrls.length >
      0 &&
    fetchErrors.length ===
      unitTableUrls.length
  ) {
    status =
      'FETCH_FAILED';
  } else if (
    explicitRoles.length >
    0
  ) {
    status =
      'RESOLVED';
  } else {
    status =
      'STILL_UNRESOLVED';
  }

  return {
    familyName:
      record.familyName,

    overviewUrl:
      record.overviewUrl,

    unitTableUrls,

    explicitRoles,

    evidenceText:
      uniqueStrings(
        evidenceText,
      ),

    status,

    fetchErrors,
  };
}

async function mapWithConcurrency<
  Input,
  Output,
>(
  items:
    Input[],
  concurrency:
    number,
  worker:
    (
      item: Input,
    ) => Promise<Output>,
): Promise<Output[]> {
  const output =
    new Array<Output>(
      items.length,
    );

  let nextIndex =
    0;

  async function runWorker():
  Promise<void> {
    while (
      true
    ) {
      const index =
        nextIndex++;

      if (
        index >=
        items.length
      ) {
        return;
      }

      output[
        index
      ] =
        await worker(
          items[
            index
          ],
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.min(
            concurrency,
            items.length,
          ),
      },
      () =>
        runWorker(),
    ),
  );

  return output;
}

export async function auditUsydTableSUnresolvedRoles():
Promise<UsydTableSUnresolvedRoleAudit> {
  const [
    unresolved,
    components,
  ] =
    await Promise.all(
      [
        loadUnresolvedSourceRecords(),
        loadComponents(),
      ],
    );

  const records =
    await mapWithConcurrency(
      unresolved,
      CONCURRENCY,
      (
        record,
      ) =>
        inspectFamily(
          record,
          components,
        ),
    );

  records.sort(
    (
      left,
      right,
    ) =>
      left.familyName.localeCompare(
        right.familyName,
      ),
  );

  const count =
    (
      status:
        UsydTableSUnresolvedRoleEvidence['status'],
    ) =>
      records.filter(
        (
          record,
        ) =>
          record.status ===
          status,
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
      unresolvedFamiliesInput:
        unresolved.length,

      resolved:
        count(
          'RESOLVED',
        ),

      stillUnresolved:
        count(
          'STILL_UNRESOLVED',
        ),

      fetchFailed:
        count(
          'FETCH_FAILED',
        ),
    },

    records,
  };
}
