import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

const MASTER_FILE = path.join(
  DATA_DIR,
  'usyd-master-global.json',
);

const USER_AGENT =
  'Mozilla/5.0 (compatible; USYD handbook collector/1.0)';

type UnknownRecord = Record<string, unknown>;

interface DegreeRecord {
  code: string;
  title: string;
  sourceUrl: string;
}

export interface UsydStudyPlanCandidate {
  degreeCode: string;
  degreeTitle: string;
  handbookSourceUrl: string;

  candidateUrl: string;
  candidateText: string | null;

  discoverySource:
    | 'SOURCE_PAGE_LINK'
    | 'OVERVIEW_PAGE_LINK'
    | 'DIRECT_SOURCE_PAGE';

  sampleStudyPlanFound: boolean;

  heading:
    string | null;

  tableCount:
    number;

  tableRows:
    string[][];

  fetchStatus:
    | 'OK'
    | 'NO_SAMPLE_PLAN'
    | 'FETCH_FAILED';

  error:
    string | null;
}

export interface UsydStudyPlanDiscoveryDataset {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    degrees: number;

    sourcePagesFetched: number;
    sourceFetchFailures: number;

    overviewPagesFetched: number;
    overviewFetchFailures: number;

    degreesWithCandidateLinks: number;
    candidateLinks: number;

    candidatePagesFetched: number;
    candidateFetchFailures: number;

    degreesWithSampleStudyPlan: number;
    sampleStudyPlanPages: number;

    totalPlanTables: number;
    totalPlanRows: number;

    duplicateCandidateUrls: number;
  };

  degreesWithoutCandidateLinks: Array<{
    degreeCode: string;
    degreeTitle: string;
    handbookSourceUrl: string;
  }>;

  sourceFetchFailures: Array<{
    degreeCode: string;
    url: string;
    error: string;
  }>;

  candidates:
    UsydStudyPlanCandidate[];

  coverage: {
    handbookLocalPlanDiscovery: 'DIAGNOSTIC';
    samplePlanExtraction: 'DIAGNOSTIC';
    recommendedStudyPlans: 'NOT_YET_COMPLETE';
  };
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

function normalize(
  value: string,
): string {
  return value
    .normalize('NFKC')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalUrl(
  value: string,
  baseUrl?: string,
): string | null {
  try {
    const url =
      new URL(
        value,
        baseUrl,
      );

    url.hash = '';

    return url.toString();
  } catch {
    return null;
  }
}

function firstString(
  record: UnknownRecord,
  keys: string[],
): string | null {
  for (
    const key
    of keys
  ) {
    const value =
      record[key];

    if (
      typeof value ===
      'string' &&
      normalize(value)
    ) {
      return normalize(
        value,
      );
    }
  }

  return null;
}

function findDegreeArray(
  value: unknown,
): UnknownRecord[] {
  if (
    !isRecord(
      value,
    )
  ) {
    throw new Error(
      'USYD master must be an object.',
    );
  }

  for (
    const key
    of [
      'degrees',
      'standaloneDegrees',
      'degreeRecords',
    ]
  ) {
    if (
      Array.isArray(
        value[key],
      )
    ) {
      return (
        value[key] as
          unknown[]
      ).filter(
        isRecord,
      );
    }
  }

  if (
    isRecord(
      value.data,
    )
  ) {
    return findDegreeArray(
      value.data,
    );
  }

  throw new Error(
    'Could not locate degrees[] in usyd-master-global.json.',
  );
}

async function loadDegrees():
Promise<DegreeRecord[]> {
  const raw =
    await fs.readFile(
      MASTER_FILE,
      'utf8',
    );

  const parsed =
    JSON.parse(
      raw,
    ) as unknown;

  const degrees =
    findDegreeArray(
      parsed,
    );

  return degrees.map(
    (degree) => {
      const code =
        firstString(
          degree,
          [
            'code',
            'degreeCode',
            'awardCode',
            'courseCode',
          ],
        );

      const title =
        firstString(
          degree,
          [
            'title',
            'name',
            'degreeTitle',
            'awardTitle',
          ],
        );

      const sourceUrl =
        firstString(
          degree,
          [
            'sourceUrl',
            'url',
            'courseUrl',
            'handbookUrl',
          ],
        );

      if (
        !code ||
        !title ||
        !sourceUrl
      ) {
        throw new Error(
          `Degree record missing code/title/sourceUrl: ${JSON.stringify(degree)}`,
        );
      }

      return {
        code,
        title,
        sourceUrl,
      };
    },
  );
}

async function fetchHtml(
  url: string,
): Promise<string> {
  const response =
    await axios.get<string>(
      url,
      {
        timeout:
          30000,

        headers: {
          'User-Agent':
            USER_AGENT,
        },

        responseType:
          'text',
      },
    );

  return response.data;
}

function directoryOf(
  sourceUrl: string,
): string {
  const url =
    new URL(
      sourceUrl,
    );

  const parts =
    url.pathname.split('/');

  parts.pop();

  url.pathname =
    `${parts.join('/')}/`;

  url.search = '';
  url.hash = '';

  return url.toString();
}

function overviewUrlFor(
  sourceUrl: string,
): string {
  return new URL(
    'overview.html',
    directoryOf(
      sourceUrl,
    ),
  ).toString();
}

function isHandbookLocal(
  candidateUrl: string,
  sourceUrl: string,
): boolean {
  const candidate =
    new URL(
      candidateUrl,
    );

  const source =
    new URL(
      sourceUrl,
    );

  return (
    candidate.hostname ===
      source.hostname &&
    candidate.pathname.startsWith(
      directoryOf(
        sourceUrl,
      )
        .replace(
          `${source.protocol}//${source.host}`,
          '',
        ),
    )
  );
}

function looksLikePlanLink(
  text: string,
  href: string,
): boolean {
  const haystack =
    `${text} ${href}`
      .toLowerCase();

  return (
    /sample[\s_-]*(enrolment|enrollment|study|pathway|plan)/i.test(
      haystack,
    ) ||
    /(enrolment|enrollment)[\s_-]*(guide|plan|sample)/i.test(
      haystack,
    ) ||
    /sample[\s_-]*pathway/i.test(
      haystack,
    ) ||
    /study[\s_-]*plan/i.test(
      haystack,
    ) ||
    /enrolment-guide/i.test(
      haystack,
    ) ||
    /-sample\.html(?:$|\?)/i.test(
      href,
    )
  );
}

function discoverHandbookPlanLinks(
  html: string,
  pageUrl: string,
  handbookSourceUrl: string,
): Array<{
  url: string;
  text: string | null;
}> {
  const $ =
    cheerio.load(
      html,
    );

  const results:
    Array<{
      url: string;
      text: string | null;
    }> =
    [];

  $('a[href]').each(
    (
      _index:
        number,
      element:
        AnyNode,
    ) => {
      const href =
        $(element)
          .attr(
            'href',
          );

      if (!href) {
        return;
      }

      const url =
        canonicalUrl(
          href,
          pageUrl,
        );

      if (!url) {
        return;
      }

      if (
        !isHandbookLocal(
          url,
          handbookSourceUrl,
        )
      ) {
        return;
      }

      const text =
        normalize(
          $(element)
            .text(),
        );

      if (
        !looksLikePlanLink(
          text,
          href,
        )
      ) {
        return;
      }

      results.push({
        url,

        text:
          text ||
          null,
      });
    },
  );

  const seen =
    new Set<string>();

  return results.filter(
    (item) => {
      if (
        seen.has(
          item.url,
        )
      ) {
        return false;
      }

      seen.add(
        item.url,
      );

      return true;
    },
  );
}

function headingLooksLikePlan(
  text: string,
): boolean {
  return (
    /sample\s+(enrolment|enrollment)/i.test(
      text,
    ) ||
    /sample\s+study\s+plan/i.test(
      text,
    ) ||
    /recommended\s+study\s+plan/i.test(
      text,
    ) ||
    /sample\s+pathway/i.test(
      text,
    ) ||
    /general\s+pathway/i.test(
      text,
    ) ||
    /enrolment\s+guide/i.test(
      text,
    )
  );
}

function extractTableRows(
  $:
    cheerio.CheerioAPI,
  table:
    AnyNode,
): string[][] {
  const rows:
    string[][] =
    [];

  $(table)
    .find(
      'tr',
    )
    .each(
      (
        _rowIndex:
          number,
        row:
          AnyNode,
      ) => {
        const cells =
          $(row)
            .find(
              'th,td',
            )
            .map(
              (
                _cellIndex:
                  number,
                cell:
                  AnyNode,
              ) =>
                normalize(
                  $(cell)
                    .text(),
                ),
            )
            .get()
            .filter(
              Boolean,
            );

        if (
          cells.length >
          0
        ) {
          rows.push(
            cells,
          );
        }
      },
    );

  return rows;
}

function extractSamplePlan(
  html: string,
): {
  found: boolean;
  heading: string | null;
  tables: string[][][];
} {
  const $ =
    cheerio.load(
      html,
    );

  const headingElements:
    AnyNode[] =
    [];

  $('h1,h2,h3,h4,h5,h6').each(
    (
      _index:
        number,
      element:
        AnyNode,
    ) => {
      const text =
        normalize(
          $(element)
            .text(),
        );

      if (
        headingLooksLikePlan(
          text,
        )
      ) {
        headingElements.push(
          element,
        );
      }
    },
  );

  const pageTitle =
    normalize(
      $('h1')
        .first()
        .text(),
    );

  const bodyText =
    normalize(
      $('body')
        .text(),
    );

  const pageLooksLikePlan =
    headingElements.length >
      0 ||
    headingLooksLikePlan(
      pageTitle,
    ) ||
    /sample\s+(enrolment|pathway)/i.test(
      bodyText,
    );

  if (
    !pageLooksLikePlan
  ) {
    return {
      found:
        false,

      heading:
        null,

      tables:
        [],
    };
  }

  const tables:
    string[][][] =
    [];

  $('table').each(
    (
      _tableIndex:
        number,
      table:
        AnyNode,
    ) => {
      const rows =
        extractTableRows(
          $,
          table,
        );

      if (
        rows.length ===
        0
      ) {
        return;
      }

      const flattened =
        normalize(
          rows
            .flat()
            .join(
              ' ',
            ),
        );

      const planLikeTable =
        /\bsemester\b|\byear\s*[1-6]\b|\bunit[s]?\s+of\s+study\b|\bcredit\s+points?\b|\btotal\b/i.test(
          flattened,
        );

      if (
        planLikeTable
      ) {
        tables.push(
          rows,
        );
      }
    },
  );

  return {
    found:
      tables.length >
        0,

    heading:
      headingElements[0]
        ? normalize(
            $(
              headingElements[0],
            ).text(),
          )
        : pageTitle ||
          null,

    tables,
  };
}

export async function discoverUsydStudyPlansV2():
Promise<UsydStudyPlanDiscoveryDataset> {
  const degrees =
    await loadDegrees();

  const candidates:
    UsydStudyPlanCandidate[] =
    [];

  const degreesWithoutCandidateLinks:
    UsydStudyPlanDiscoveryDataset['degreesWithoutCandidateLinks'] =
    [];

  const sourceFetchFailures:
    UsydStudyPlanDiscoveryDataset['sourceFetchFailures'] =
    [];

  let sourcePagesFetched =
    0;

  let overviewPagesFetched =
    0;

  let overviewFetchFailures =
    0;

  for (
    const degree
    of degrees
  ) {
    let sourceHtml:
      string;

    try {
      sourceHtml =
        await fetchHtml(
          degree.sourceUrl,
        );

      sourcePagesFetched +=
        1;
    } catch (
      error
    ) {
      sourceFetchFailures.push({
        degreeCode:
          degree.code,

        url:
          degree.sourceUrl,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      });

      continue;
    }

    const directPlan =
      extractSamplePlan(
        sourceHtml,
      );

    if (
      directPlan.found
    ) {
      candidates.push({
        degreeCode:
          degree.code,

        degreeTitle:
          degree.title,

        handbookSourceUrl:
          degree.sourceUrl,

        candidateUrl:
          degree.sourceUrl,

        candidateText:
          'Embedded source-page plan',

        discoverySource:
          'DIRECT_SOURCE_PAGE',

        sampleStudyPlanFound:
          true,

        heading:
          directPlan.heading,

        tableCount:
          directPlan.tables.length,

        tableRows:
          directPlan.tables.flat(),

        fetchStatus:
          'OK',

        error:
          null,
      });
    }

    const discovered:
      Array<{
        url: string;
        text: string | null;
        discoverySource:
          | 'SOURCE_PAGE_LINK'
          | 'OVERVIEW_PAGE_LINK';
      }> =
      discoverHandbookPlanLinks(
        sourceHtml,
        degree.sourceUrl,
        degree.sourceUrl,
      ).map(
        (item) => ({
          ...item,

          discoverySource:
            'SOURCE_PAGE_LINK' as const,
        }),
      );

    const overviewUrl =
      overviewUrlFor(
        degree.sourceUrl,
      );

    if (
      overviewUrl !==
      degree.sourceUrl
    ) {
      try {
        const overviewHtml =
          await fetchHtml(
            overviewUrl,
          );

        overviewPagesFetched +=
          1;

        const overviewLinks =
          discoverHandbookPlanLinks(
            overviewHtml,
            overviewUrl,
            degree.sourceUrl,
          ).map(
            (item) => ({
              ...item,

              discoverySource:
                'OVERVIEW_PAGE_LINK' as const,
            }),
          );

        discovered.push(
          ...overviewLinks,
        );
      } catch {
        overviewFetchFailures +=
          1;
      }
    }

    const seenCandidate =
      new Set<string>();

    const uniqueDiscovered =
      discovered.filter(
        (item) => {
          if (
            seenCandidate.has(
              item.url,
            )
          ) {
            return false;
          }

          seenCandidate.add(
            item.url,
          );

          return true;
        },
      );

    if (
      uniqueDiscovered.length ===
      0 &&
      !directPlan.found
    ) {
      degreesWithoutCandidateLinks.push({
        degreeCode:
          degree.code,

        degreeTitle:
          degree.title,

        handbookSourceUrl:
          degree.sourceUrl,
      });
    }

    for (
      const link
      of uniqueDiscovered
    ) {
      try {
        const html =
          await fetchHtml(
            link.url,
          );

        const plan =
          extractSamplePlan(
            html,
          );

        candidates.push({
          degreeCode:
            degree.code,

          degreeTitle:
            degree.title,

          handbookSourceUrl:
            degree.sourceUrl,

          candidateUrl:
            link.url,

          candidateText:
            link.text,

          discoverySource:
            link.discoverySource,

          sampleStudyPlanFound:
            plan.found,

          heading:
            plan.heading,

          tableCount:
            plan.tables.length,

          tableRows:
            plan.tables.flat(),

          fetchStatus:
            plan.found
              ? 'OK'
              : 'NO_SAMPLE_PLAN',

          error:
            null,
        });
      } catch (
        error
      ) {
        candidates.push({
          degreeCode:
            degree.code,

          degreeTitle:
            degree.title,

          handbookSourceUrl:
            degree.sourceUrl,

          candidateUrl:
            link.url,

          candidateText:
            link.text,

          discoverySource:
            link.discoverySource,

          sampleStudyPlanFound:
            false,

          heading:
            null,

          tableCount:
            0,

          tableRows:
            [],

          fetchStatus:
            'FETCH_FAILED',

          error:
            error instanceof Error
              ? error.message
              : String(error),
        });
      }
    }
  }

  const linkedCandidates =
    candidates.filter(
      (item) =>
        item.discoverySource !==
        'DIRECT_SOURCE_PAGE',
    );

  const keys =
    linkedCandidates.map(
      (item) =>
        `${item.degreeCode}|${item.candidateUrl}`,
    );

  const duplicateCandidateUrls =
    keys.length -
    new Set(
      keys,
    ).size;

  const samplePlans =
    candidates.filter(
      (item) =>
        item.sampleStudyPlanFound,
    );

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      degrees:
        degrees.length,

      sourcePagesFetched,

      sourceFetchFailures:
        sourceFetchFailures.length,

      overviewPagesFetched,

      overviewFetchFailures,

      degreesWithCandidateLinks:
        new Set(
          linkedCandidates.map(
            (item) =>
              item.degreeCode,
          ),
        ).size,

      candidateLinks:
        linkedCandidates.length,

      candidatePagesFetched:
        linkedCandidates.filter(
          (item) =>
            item.fetchStatus !==
            'FETCH_FAILED',
        ).length,

      candidateFetchFailures:
        linkedCandidates.filter(
          (item) =>
            item.fetchStatus ===
            'FETCH_FAILED',
        ).length,

      degreesWithSampleStudyPlan:
        new Set(
          samplePlans.map(
            (item) =>
              item.degreeCode,
          ),
        ).size,

      sampleStudyPlanPages:
        samplePlans.length,

      totalPlanTables:
        samplePlans.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.tableCount,
          0,
        ),

      totalPlanRows:
        samplePlans.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.tableRows.length,
          0,
        ),

      duplicateCandidateUrls,
    },

    degreesWithoutCandidateLinks,

    sourceFetchFailures,

    candidates,

    coverage: {
      handbookLocalPlanDiscovery:
        'DIAGNOSTIC',

      samplePlanExtraction:
        'DIAGNOSTIC',

      recommendedStudyPlans:
        'NOT_YET_COMPLETE',
    },
  };
}

export async function writeUsydStudyPlanDiscoveryV2():
Promise<void> {
  const result =
    await discoverUsydStudyPlansV2();

  const outputFile =
    path.join(
      DATA_DIR,
      'usyd-study-plan-discovery.v2.json',
    );

  const temporary =
    `${outputFile}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      result,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    outputFile,
  );

  console.log(
    '[USYD study plan discovery V2] PASS',
  );

  console.log(
    `Degrees: ${result.counts.degrees}`,
  );

  console.log(
    `Degrees with candidate links: ${result.counts.degreesWithCandidateLinks}`,
  );

  console.log(
    `Degrees with sample study plan: ${result.counts.degreesWithSampleStudyPlan}`,
  );

  console.log(
    `Output: ${outputFile}`,
  );
}
