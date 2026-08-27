import axios from 'axios';
import * as cheerio from 'cheerio';

const ECONOMICS_TABLE_A_OVERVIEWS = [
  {
    name:
      'Economics',
    url:
      'https://www.sydney.edu.au/handbooks/arts/subject-areas/economics/overview.html',
  },
  {
    name:
      'Environmental, Agricultural and Resource Economics',
    url:
      'https://www.sydney.edu.au/handbooks/arts/subject-areas/environmental-agricultural-resource-economics/overview.html',
  },
  {
    name:
      'Financial Economics',
    url:
      'https://www.sydney.edu.au/handbooks/arts/subject-areas/financial-economics/overview.html',
  },
] as const;

export interface UsydEconomicsTableARoleRecord {
  name: string;
  url: string;

  roles:
    Array<
      'MAJOR' | 'MINOR'
    >;

  evidence:
    string[];

  fetchError:
    string | null;
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

function collectEvidence(
  $:
    cheerio.CheerioAPI,
): {
  roles:
    Array<'MAJOR' | 'MINOR'>;
  evidence:
    string[];
} {
  const evidence:
    string[] =
    [];

  $(
    'h1, h2, h3, h4, h5, h6, p, li, th, caption',
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
        600
      ) {
        return;
      }

      if (
        /\bmajor\b/i.test(
          text,
        ) ||
        /\bminor\b/i.test(
          text,
        )
      ) {
        evidence.push(
          text,
        );
      }
    },
  );

  const joined =
    evidence.join(
      ' ',
    );

  const roles:
    Array<'MAJOR' | 'MINOR'> =
    [];

  if (
    /\bmajor\b/i.test(
      joined,
    )
  ) {
    roles.push(
      'MAJOR',
    );
  }

  if (
    /\bminor\b/i.test(
      joined,
    )
  ) {
    roles.push(
      'MINOR',
    );
  }

  return {
    roles,
    evidence: [
      ...new Set(
        evidence,
      ),
    ],
  };
}

export async function auditUsydEconomicsTableARoles():
Promise<UsydEconomicsTableARoleRecord[]> {
  const output:
    UsydEconomicsTableARoleRecord[] =
    [];

  for (
    const item
    of ECONOMICS_TABLE_A_OVERVIEWS
  ) {
    try {
      const response =
        await axios.get<string>(
          item.url,
          {
            timeout:
              30_000,

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

      const evidence =
        collectEvidence(
          $,
        );

      output.push({
        name:
          item.name,

        url:
          item.url,

        roles:
          evidence.roles,

        evidence:
          evidence.evidence,

        fetchError:
          null,
      });
    } catch (
      error
    ) {
      output.push({
        name:
          item.name,

        url:
          item.url,

        roles:
          [],

        evidence:
          [],

        fetchError:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      });
    }
  }

  return output;
}
