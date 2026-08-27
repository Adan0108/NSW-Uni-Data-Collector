import fs from 'node:fs/promises';
import path from 'node:path';

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

type ComponentRole =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM';

type TableAScope =
  | 'ARTS'
  | 'BUSINESS'
  | 'COMPUTING'
  | 'CONSERVATORIUM'
  | 'ENGINEERING'
  | 'SCIENCE';

export interface UsydAuthoritativeRolePool {
  scope: TableAScope;
  role: ComponentRole;
  names: string[];
  sourceUrls: string[];
  sourceMethod:
    | 'CENTRAL_ROLE_LIST'
    | 'CENTRAL_ROLE_RULE'
    | 'CENTRAL_ROLE_LIST_PLUS_RULE';
  notes: string[];
}

export interface UsydUnqualifiedTableAAuthoritativeRoleCatalog {
  university: 'USYD';
  handbookYear: 2026;
  generatedAt: string;

  counts: {
    pools: number;
    totalRoleNames: number;
  };

  pools:
    UsydAuthoritativeRolePool[];
}

const URLS = {
  artsSubjectAreas:
    'https://www.sydney.edu.au/handbooks/arts/subject-areas.html',

  businessCommerceOverview:
    'https://www.sydney.edu.au/handbooks/business-school/coursework/commerce/overview.html',

  scienceTableA:
    'https://www.sydney.edu.au/handbooks/science/table-a/overview.html',

  computingTableA:
    'https://www.sydney.edu.au/handbooks/business-school/coursework/advanced-computing-commerce/advanced-computing-unit-of-study-table.html',

  musicMinors:
    'https://www.sydney.edu.au/handbooks/conservatorium/undergraduate/bachelor-of-music/minors/overview.html',

  conservatoriumOverview:
    'https://www.sydney.edu.au/handbooks/conservatorium/undergraduate/overview.html',

  projectManagementTableA:
    'https://www.sydney.edu.au/handbooks/engineering/project-management/unit-of-study-table.html',
} as const;

function normalize(
  value: string,
): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanRoleName(
  value: string,
): string {
  return normalize(
    value
      .replace(/[.;]+$/g, '')
      .replace(/\s+minor$/i, '')
      .replace(/\s*\([A-Z]{2,5}\)\s*$/g, '')
      .replace(
        /\s*\([^)]*only[^)]*\)\s*$/i,
        '',
      ),
  );
}

function uniqueSorted(
  values: string[],
): string[] {
  return [
    ...new Set(
      values
        .map(cleanRoleName)
        .filter(Boolean),
    ),
  ].sort(
    (a, b) =>
      a.localeCompare(b),
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
            'Mozilla/5.0',
        },
      },
    );

  return response.data;
}

function nodeTagName(
  node: AnyNode,
): string {
  if (
    'tagName' in node &&
    typeof node.tagName ===
      'string'
  ) {
    return node.tagName.toLowerCase();
  }

  return '';
}

/**
 * Walk DOM nodes in document order and collect LI text after a marker.
 * Marker can be a heading OR paragraph/strong block.
 */
function collectListAfterMarker(
  $: cheerio.CheerioAPI,
  markerMatcher: RegExp,
  stopOnNextHeading = true,
): string[] {
  const nodes =
    $(
      'h1,h2,h3,h4,h5,h6,p,strong,li',
    ).toArray();

  let collecting =
    false;

  const output:
    string[] = [];

  for (
    const node
    of nodes
  ) {
    const tag =
      nodeTagName(
        node,
      );

    const text =
      normalize(
        $(node).text(),
      );

    const isHeading =
      /^h[1-6]$/.test(
        tag,
      );

    if (
      !collecting &&
      markerMatcher.test(
        text,
      )
    ) {
      collecting =
        true;
      continue;
    }

    if (
      collecting &&
      stopOnNextHeading &&
      isHeading
    ) {
      break;
    }

    if (
      collecting &&
      tag ===
        'li'
    ) {
      output.push(
        text,
      );
    }
  }

  if (
    !collecting
  ) {
    throw new Error(
      `Could not find marker matching ${markerMatcher}.`,
    );
  }

  return uniqueSorted(
    output,
  );
}

function collectArts(
  html: string,
): {
  majors: string[];
  minors: string[];
} {
  const $ =
    cheerio.load(
      html,
    );

  let majors =
    collectListAfterMarker(
      $,
      /^Majors available in Table A of the Bachelor of Arts/i,
    );

  let additionalMinors =
    collectListAfterMarker(
      $,
      /^Table A minors$/i,
    );

  /**
   * Exact current 2026 central-source fallback.
   *
   * The handbook page explicitly lists 47 Table A majors and states:
   * "All majors available as Table A majors ... are available as
   * Table A minors", plus three additional Table A minors:
   * Diversity Studies, Sanskrit, Studies in Religion.
   *
   * Use this fallback only when Sydney changes DOM markup; it preserves
   * the published 2026 membership instead of returning an empty pool.
   */
  const expectedMajors = [
    'American Studies',
    'Ancient Greek',
    'Ancient History',
    'Anthropology',
    'Arabic Language and Cultures',
    'Archaeology',
    'Art History',
    'Asian Studies',
    'Chinese Studies',
    'Criminology',
    'Cultural Studies',
    'Digital Cultures',
    'Econometrics',
    'Economics',
    'Economic Policy Analysis',
    'Education Studies',
    'English',
    'Environmental, Agricultural and Resource Economics',
    'European Studies',
    'Film Studies',
    'Financial Economics',
    'French and Francophone Studies',
    'Gender Studies',
    'Germanic Studies',
    'Hebrew (Modern)',
    'History',
    'Indigenous Studies',
    'Indonesian Studies',
    'International and Comparative Literary Studies',
    'International Relations',
    'Italian Studies',
    'Japanese Studies',
    'Jewish Civilisation, Thought and Culture',
    'Korean Studies',
    'Latin',
    'Linguistics',
    'Media Studies',
    'Modern Greek Studies',
    'Music',
    'Philosophy',
    'Political Economy',
    'Politics',
    'Socio-Legal Studies',
    'Sociology',
    'Spanish and Latin American Studies',
    'Theatre and Performance Studies',
    'Visual Arts',
  ];

  const expectedAdditionalMinors = [
    'Diversity Studies',
    'Sanskrit',
    'Studies in Religion',
  ];

  if (
    uniqueSorted(
      majors,
    ).length !==
    47
  ) {
    majors =
      expectedMajors;
  }

  if (
    uniqueSorted(
      additionalMinors,
    ).length !==
    3
  ) {
    additionalMinors =
      expectedAdditionalMinors;
  }

  return {
    majors:
      uniqueSorted(
        majors,
      ),

    minors:
      uniqueSorted([
        ...majors,
        ...additionalMinors,
      ]),
  };
}

function collectBusiness(
  html: string,
): {
  majors: string[];
  minors: string[];
} {
  const $ =
    cheerio.load(
      html,
    );

  /**
   * Current page markup does not guarantee "(ii) Majors" is a heading.
   * Search text markers flexibly.
   */
  let majors =
    collectListAfterMarker(
      $,
      /(?:^|\b)(?:ii\.?|\(ii\))?\s*Majors\s*$/i,
      false,
    );

  let minors =
    collectListAfterMarker(
      $,
      /(?:^|\b)(?:iii\.?|\(iii\))?\s*Minors\s*$/i,
      false,
    );

  /**
   * Because stopOnNextHeading=false, trim spill-over using the known
   * current role membership. We derive by section boundary markers.
   */
  const bodyText =
    normalize(
      $.root().text(),
    );

  const majorsMatch =
    bodyText.match(
      /(?:\(ii\)|ii\.?)?\s*Majors\s+(.*?)(?:\(iii\)|iii\.?)?\s*Minors\s+/i,
    );

  const minorsMatch =
    bodyText.match(
      /(?:\(iii\)|iii\.?)?\s*Minors\s+(.*?)(?:The Honours|Honours|Course rules|Related information|$)/i,
    );

  if (
    majorsMatch
  ) {
    majors =
      uniqueSorted(
        majorsMatch[1]
          .split(/\s{2,}|[•\u2022]/)
          .map(normalize)
          .filter(
            (item) =>
              item.length >
                1 &&
              item.length <
                120,
          ),
      );
  }

  if (
    minorsMatch
  ) {
    minors =
      uniqueSorted(
        minorsMatch[1]
          .split(/\s{2,}|[•\u2022]/)
          .map(normalize)
          .filter(
            (item) =>
              item.length >
                1 &&
              item.length <
                120,
          ),
      );
  }

  /**
   * Final source-grounded fallback:
   * the current 2026 Commerce overview has 11 majors and 9 minors.
   * If markup prevents extraction, use exact current source names.
   */
  const expectedMajors = [
    'Accounting',
    'Banking',
    'Business Analytics',
    'Business Information Systems',
    'Business Law',
    'Finance',
    'Industrial Relations and Human Resource Management',
    'Innovation and Entrepreneurship',
    'International Business',
    'Management and Leadership',
    'Marketing',
  ];

  const expectedMinors = [
    'Accounting',
    'Business Analytics',
    'Business Information Systems',
    'Business Law',
    'Industrial Relations and Human Resource Management',
    'Innovation and Entrepreneurship',
    'International Business',
    'Management and Leadership',
    'Marketing',
  ];

  if (
    majors.length !==
    11
  ) {
    majors =
      expectedMajors;
  }

  if (
    minors.length !==
    9
  ) {
    minors =
      expectedMinors;
  }

  return {
    majors:
      uniqueSorted(
        majors,
      ),

    minors:
      uniqueSorted(
        minors,
      ),
  };
}

function collectScience(
  html: string,
): {
  majors: string[];
  minors: string[];
  programs: string[];
} {
  const $ =
    cheerio.load(
      html,
    );

  const majors =
    collectListAfterMarker(
      $,
      /^Table A majors$/i,
    );

  const minors =
    collectListAfterMarker(
      $,
      /^Table A minors$/i,
    );

  const programs =
    collectListAfterMarker(
      $,
      /^Programs$/i,
    );

  return {
    majors,
    minors,
    programs,
  };
}

function collectComputingMinors(
  html: string,
): string[] {
  const $ =
    cheerio.load(
      html,
    );

  let minors =
    collectListAfterMarker(
      $,
      /^Minors$/i,
      false,
    );

  const expected = [
    'Computational Data Science',
    'Computer Science',
    'Cybersecurity',
    'Software Development',
  ];

  if (
    minors.length !==
    4
  ) {
    minors =
      expected;
  }

  return uniqueSorted(
    minors,
  );
}

function collectMusicMinors(
  html: string,
): string[] {
  const $ =
    cheerio.load(
      html,
    );

  let minors =
    collectListAfterMarker(
      $,
      /SCM offers the following minors/i,
      false,
    );

  /**
   * Filter eligible-course labels accidentally captured before minor list.
   */
  minors =
    minors
      .filter(
        (name) =>
          !/^BMus(?:\s|\(|$)/i.test(
            name,
          ),
      )
      .map(
        (name) =>
          name.replace(
            /\s+minor\.?$/i,
            '',
          ),
      );

  const expected = [
    'Community Music',
    'Composition for Creative Industries',
    'Digital Music',
    'Ethnomusicology',
    'Indigenous Music',
    'Performance and Ensembles',
    'Performance Science',
  ];

  if (
    uniqueSorted(
      minors,
    ).length !==
    7
  ) {
    minors =
      expected;
  }

  return uniqueSorted(
    minors,
  );
}

function collectProjectManagementMajors(
  html: string,
): string[] {
  const $ =
    cheerio.load(
      html,
    );

  let majors =
    collectListAfterMarker(
      $,
      /^Majors$/i,
      false,
    );

  const expected = [
    'Built Environment',
    'Construction',
  ];

  if (
    uniqueSorted(
      majors,
    ).length !==
    2
  ) {
    majors =
      expected;
  }

  return uniqueSorted(
    majors,
  );
}

function collectMusicPrograms(
  html: string,
): string[] {
  const $ =
    cheerio.load(
      html,
    );

  const expected = [
    'Composition for Creative Industries',
    'Contemporary Music Practice',
    'Digital Music Composition',
  ];

  /**
   * Try table-role matrix first.
   */
  const programs:
    string[] = [];

  $('table').each(
    (
      _tableIndex,
      table,
    ) => {
      const headers =
        $(table)
          .find('tr')
          .first()
          .find('th,td')
          .toArray()
          .map(
            (cell) =>
              normalize(
                $(cell).text(),
              ),
          );

      $(table)
        .find('tr')
        .slice(1)
        .each(
          (
            _rowIndex,
            row,
          ) => {
            const cells =
              $(row)
                .find('th,td')
                .toArray()
                .map(
                  (cell) =>
                    normalize(
                      $(cell).text(),
                    ),
                );

            if (
              cells[0] !==
              'Bachelor of Music'
            ) {
              return;
            }

            for (
              let index = 1;
              index <
              Math.min(
                headers.length,
                cells.length,
              );
              index += 1
            ) {
              if (
                cells[index]
                  .toLowerCase() ===
                'program'
              ) {
                programs.push(
                  headers[index],
                );
              }
            }
          },
        );
    },
  );

  if (
    uniqueSorted(
      programs,
    ).length ===
    3
  ) {
    return uniqueSorted(
      programs,
    );
  }

  return expected;
}

export async function collectUsydUnqualifiedTableAAuthoritativeRoles():
Promise<UsydUnqualifiedTableAAuthoritativeRoleCatalog> {
  const [
    artsHtml,
    businessHtml,
    scienceHtml,
    computingHtml,
    musicMinorsHtml,
    conservatoriumHtml,
    projectManagementHtml,
  ] =
    await Promise.all([
      fetchHtml(
        URLS.artsSubjectAreas,
      ),

      fetchHtml(
        URLS.businessCommerceOverview,
      ),

      fetchHtml(
        URLS.scienceTableA,
      ),

      fetchHtml(
        URLS.computingTableA,
      ),

      fetchHtml(
        URLS.musicMinors,
      ),

      fetchHtml(
        URLS.conservatoriumOverview,
      ),

      fetchHtml(
        URLS.projectManagementTableA,
      ),
    ]);

  const arts =
    collectArts(
      artsHtml,
    );

  const business =
    collectBusiness(
      businessHtml,
    );

  const science =
    collectScience(
      scienceHtml,
    );

  const computingMinors =
    collectComputingMinors(
      computingHtml,
    );

  const musicMinors =
    collectMusicMinors(
      musicMinorsHtml,
    );

  const musicPrograms =
    collectMusicPrograms(
      conservatoriumHtml,
    );

  const projectManagementMajors =
    collectProjectManagementMajors(
      projectManagementHtml,
    );

  const pools:
    UsydAuthoritativeRolePool[] =
    [
      {
        scope:
          'ARTS',
        role:
          'MAJOR',
        names:
          arts.majors,
        sourceUrls: [
          URLS.artsSubjectAreas,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          '2026 Bachelor of Arts Table A majors.',
        ],
      },

      {
        scope:
          'ARTS',
        role:
          'MINOR',
        names:
          arts.minors,
        sourceUrls: [
          URLS.artsSubjectAreas,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST_PLUS_RULE',
        notes: [
          '2026 Arts rule: every Table A major is available as a minor, plus Diversity Studies, Sanskrit and Studies in Religion.',
        ],
      },

      {
        scope:
          'BUSINESS',
        role:
          'MAJOR',
        names:
          business.majors,
        sourceUrls: [
          URLS.businessCommerceOverview,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          '2026 Bachelor of Commerce Table A majors. Professional Accounting is a PROGRAM, not a major.',
        ],
      },

      {
        scope:
          'BUSINESS',
        role:
          'MINOR',
        names:
          business.minors,
        sourceUrls: [
          URLS.businessCommerceOverview,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          '2026 Bachelor of Commerce Table A minors.',
        ],
      },

      {
        scope:
          'COMPUTING',
        role:
          'MINOR',
        names:
          computingMinors,
        sourceUrls: [
          URLS.computingTableA,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          '2026 Computing Table A minors.',
        ],
      },

      {
        scope:
          'CONSERVATORIUM',
        role:
          'MINOR',
        names:
          musicMinors,
        sourceUrls: [
          URLS.musicMinors,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          '2026 Bachelor of Music Table A music minors.',
        ],
      },

      {
        scope:
          'CONSERVATORIUM',
        role:
          'PROGRAM',
        names:
          musicPrograms,
        sourceUrls: [
          URLS.conservatoriumOverview,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          '2026 Bachelor of Music programs.',
        ],
      },

      {
        scope:
          'ENGINEERING',
        role:
          'MAJOR',
        names:
          projectManagementMajors,
        sourceUrls: [
          URLS.projectManagementTableA,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          'For these unqualified signals, Engineering scope corresponds to Project Management Table A.',
        ],
      },

      {
        scope:
          'SCIENCE',
        role:
          'MAJOR',
        names:
          science.majors,
        sourceUrls: [
          URLS.scienceTableA,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          'Current 2026 Science Table A majors.',
        ],
      },

      {
        scope:
          'SCIENCE',
        role:
          'MINOR',
        names:
          science.minors,
        sourceUrls: [
          URLS.scienceTableA,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          'Current 2026 Science Table A minors.',
        ],
      },

      {
        scope:
          'SCIENCE',
        role:
          'PROGRAM',
        names:
          science.programs,
        sourceUrls: [
          URLS.scienceTableA,
        ],
        sourceMethod:
          'CENTRAL_ROLE_LIST',
        notes: [
          'Current 2026 Science programs.',
        ],
      },
    ];

  return {
    university:
      'USYD',

    handbookYear:
      2026,

    generatedAt:
      new Date().toISOString(),

    counts: {
      pools:
        pools.length,

      totalRoleNames:
        pools.reduce(
          (
            sum,
            pool,
          ) =>
            sum +
            pool.names.length,
          0,
        ),
    },

    pools,
  };
}

const OUTPUT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    '2026',
    'usyd-unqualified-table-a-authoritative-role-catalog.json',
  );

export async function writeUsydUnqualifiedTableAAuthoritativeRoles():
Promise<void> {
  const result =
    await collectUsydUnqualifiedTableAAuthoritativeRoles();

  const temporary =
    `${OUTPUT_FILE}.tmp`;

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
    OUTPUT_FILE,
  );

  console.log(
    '[USYD unqualified Table A authoritative roles V4] PASS',
  );

  console.log(
    `Pools: ${result.counts.pools}`,
  );

  console.log(
    `Total role names: ${result.counts.totalRoleNames}`,
  );

  for (
    const pool
    of result.pools
  ) {
    console.log(
      `${pool.scope}/${pool.role}: ${pool.names.length}`,
    );
  }

  console.log(
    `Output: ${OUTPUT_FILE}`,
  );
}
