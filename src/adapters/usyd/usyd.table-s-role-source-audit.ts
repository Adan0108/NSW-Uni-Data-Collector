import axios from 'axios';
import * as cheerio from 'cheerio';

import {
  auditUsydTableSRoleEligibility,
  type UsydTableSRoleEligibilityFamily,
} from './usyd.table-s-role-eligibility-audit';

const CONCURRENCY =
  4;

const REQUEST_TIMEOUT_MS =
  30_000;

export type UsydTableSRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM';

export interface UsydTableSRoleSourceEvidence {
  familyName: string;
  overviewUrl: string;

  explicitRoles:
    UsydTableSRole[];

  requirementsText:
    string | null;

  evidenceText:
    string[];

  status:
    | 'SUPPORTED'
    | 'NO_EXPLICIT_ROLE_EVIDENCE'
    | 'FETCH_FAILED';

  error:
    string | null;
}

export interface UsydTableSRoleSourceAudit {
  university:
    'USYD';

  handbookYear:
    2026;

  generatedAt:
    string;

  counts: {
    familiesInspected: number;
    fetchSucceeded: number;
    fetchFailed: number;

    majorSupported: number;
    minorSupported: number;
    programSupported: number;

    noExplicitRoleEvidence: number;
  };

  records:
    UsydTableSRoleSourceEvidence[];
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
  values:
    string[],
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

function detectRoles(
  text: string,
): UsydTableSRole[] {
  const roles =
    new Set<
      UsydTableSRole
    >();

  /**
   * Use explicit curricular role language only.
   *
   * Examples found in USYD overview pages:
   * - "The requirements of the major and minor in Anthropology..."
   * - "The Computer Science major and minor requirements..."
   *
   * Avoid generic words such as:
   * "curriculum component (Program, Major or Minor)"
   * because that is boilerplate and does not prove all three roles exist.
   */
  if (
    /\b(?:the\s+)?(?:requirements?\s+of\s+the\s+)?major(?:\s+and\s+minor)?\b/i.test(
      text,
    ) ||
    /\bmajor\s+requirements?\b/i.test(
      text,
    )
  ) {
    roles.add(
      'MAJOR',
    );
  }

  if (
    /\bmajor\s+and\s+minor\b/i.test(
      text,
    ) ||
    /\bminor\s+and\s+major\b/i.test(
      text,
    ) ||
    /\bminor\s+requirements?\b/i.test(
      text,
    ) ||
    /\brequirements?\s+of\s+the\s+minor\b/i.test(
      text,
    )
  ) {
    roles.add(
      'MINOR',
    );
  }

  if (
    /\bprogram\s+requirements?\b/i.test(
      text,
    ) ||
    /\brequirements?\s+of\s+the\s+program\b/i.test(
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

function getRequirementsSectionText(
  $:
    cheerio.CheerioAPI,
): string | null {
  const heading =
    $(
      'h1, h2, h3, h4, h5, h6',
    )
      .filter(
        (
          _,
          element,
        ) =>
          normalizeSpace(
            $(
              element,
            ).text(),
          )
            .toLowerCase() ===
          'requirements for completion',
      )
      .first();

  if (
    heading.length ===
    0
  ) {
    return null;
  }

  const headingTag =
    heading
      .prop(
        'tagName',
      )
      ?.toLowerCase();

  const headingLevel =
    headingTag &&
    /^h[1-6]$/.test(
      headingTag,
    )
      ? Number(
          headingTag.slice(
            1,
          ),
        )
      : 6;

  const parts:
    string[] =
    [];

  let current =
    heading.next();

  while (
    current.length >
    0
  ) {
    const tagName =
      current
        .prop(
          'tagName',
        )
        ?.toLowerCase();

    if (
      tagName &&
      /^h[1-6]$/.test(
        tagName,
      )
    ) {
      const level =
        Number(
          tagName.slice(
            1,
          ),
        );

      if (
        level <=
        headingLevel
      ) {
        break;
      }
    }

    const text =
      normalizeSpace(
        current.text(),
      );

    if (
      text
    ) {
      parts.push(
        text,
      );
    }

    current =
      current.next();
  }

  const combined =
    normalizeSpace(
      parts.join(
        ' ',
      ),
    );

  return combined ||
    null;
}

function collectRoleEvidenceTexts(
  $:
    cheerio.CheerioAPI,
): string[] {
  const output:
    string[] =
    [];

  $(
    'p, li, td, th',
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
        !text
      ) {
        return;
      }

      if (
        /\b(?:major|minor|program)\s+(?:and\s+(?:major|minor|program)\s+)?requirements?\b/i.test(
          text,
        ) ||
        /\brequirements?\s+of\s+the\s+(?:major|minor|program)\b/i.test(
          text,
        ) ||
        /\bmajor\s+and\s+minor\b/i.test(
          text,
        ) ||
        /\bminor\s+and\s+major\b/i.test(
          text,
        )
      ) {
        output.push(
          text,
        );
      }
    },
  );

  return uniqueStrings(
    output,
  );
}

async function inspectFamily(
  family:
    UsydTableSRoleEligibilityFamily,
): Promise<UsydTableSRoleSourceEvidence> {
  const overviewUrl =
    family
      .overviewUrls[0];

  if (
    !overviewUrl
  ) {
    return {
      familyName:
        family.name,

      overviewUrl:
        '',

      explicitRoles:
        [],

      requirementsText:
        null,

      evidenceText:
        [],

      status:
        'FETCH_FAILED',

      error:
        'No overview URL.',
    };
  }

  try {
    const response =
      await axios.get<
        string
      >(
        overviewUrl,
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

    const requirementsText =
      getRequirementsSectionText(
        $,
      );

    const evidenceText =
      collectRoleEvidenceTexts(
        $,
      );

    const roleSourceText =
      [
        requirementsText ??
          '',
        ...evidenceText,
      ].join(
        ' ',
      );

    const explicitRoles =
      detectRoles(
        roleSourceText,
      );

    return {
      familyName:
        family.name,

      overviewUrl,

      explicitRoles,

      requirementsText,

      evidenceText,

      status:
        explicitRoles.length >
          0
          ? 'SUPPORTED'
          : 'NO_EXPLICIT_ROLE_EVIDENCE',

      error:
        null,
    };
  } catch (
    error
  ) {
    return {
      familyName:
        family.name,

      overviewUrl,

      explicitRoles:
        [],

      requirementsText:
        null,

      evidenceText:
        [],

      status:
        'FETCH_FAILED',

      error:
        error instanceof Error
          ? error.message
          : String(
              error,
            ),
    };
  }
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

export async function auditUsydTableSRoleSourceEvidence():
Promise<UsydTableSRoleSourceAudit> {
  const eligibility =
    await auditUsydTableSRoleEligibility();

  const families =
    eligibility
      .families
      .filter(
        (
          family,
        ) =>
          family
            .overviewUrls
            .some(
              (
                url,
              ) =>
                url.includes(
                  '/interdisciplinary-studies/table-s/subject-areas/',
                ),
            ),
      );

  const records =
    await mapWithConcurrency(
      families,
      CONCURRENCY,
      inspectFamily,
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

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date()
        .toISOString(),

    counts: {
      familiesInspected:
        records.length,

      fetchSucceeded:
        records.filter(
          (
            record,
          ) =>
            record.status !==
            'FETCH_FAILED',
        ).length,

      fetchFailed:
        records.filter(
          (
            record,
          ) =>
            record.status ===
            'FETCH_FAILED',
        ).length,

      majorSupported:
        records.filter(
          (
            record,
          ) =>
            record
              .explicitRoles
              .includes(
                'MAJOR',
              ),
        ).length,

      minorSupported:
        records.filter(
          (
            record,
          ) =>
            record
              .explicitRoles
              .includes(
                'MINOR',
              ),
        ).length,

      programSupported:
        records.filter(
          (
            record,
          ) =>
            record
              .explicitRoles
              .includes(
                'PROGRAM',
              ),
        ).length,

      noExplicitRoleEvidence:
        records.filter(
          (
            record,
          ) =>
            record.status ===
            'NO_EXPLICIT_ROLE_EVIDENCE',
        ).length,
    },

    records,
  };
}
