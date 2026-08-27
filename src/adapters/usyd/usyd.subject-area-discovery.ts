import axios from 'axios';
import * as cheerio from 'cheerio';

export interface UsydSubjectAreaLink {
  name: string;
  overviewUrl: string;
  unitTableUrl: string;
}

const SCIENCE_SUBJECT_AREAS_URL =
  'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas.html';

function normalizeText(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSubjectAreaBaseUrl(
  url: string,
): string | null {
  const marker = '/subject-areas/';

  const index = url.indexOf(marker);

  if (index < 0) {
    return null;
  }

  const afterMarker =
    url.slice(index + marker.length);

  const firstSegment =
    afterMarker.split('/')[0];

  if (
    !firstSegment ||
    firstSegment.endsWith('.html')
  ) {
    return null;
  }

  return (
    url.slice(
      0,
      index + marker.length,
    ) + firstSegment
  );
}

export async function discoverUsydScienceSubjectAreas(): Promise<
  UsydSubjectAreaLink[]
> {
  const response =
    await axios.get<string>(
      SCIENCE_SUBJECT_AREAS_URL,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
        },
      },
    );

  const $ =
    cheerio.load(
      response.data,
    );

  const discovered =
    new Map<
      string,
      UsydSubjectAreaLink
    >();

  $('a[href]').each(
    (_, element) => {
      const href =
        $(element).attr('href');

      if (!href) {
        return;
      }

      let absoluteUrl: string;

      try {
        absoluteUrl =
          new URL(
            href,
            SCIENCE_SUBJECT_AREAS_URL,
          ).toString();
      } catch {
        return;
      }

      if (
        !absoluteUrl.includes(
          '/handbooks/science/table-a/subject-areas/',
        )
      ) {
        return;
      }

      const baseUrl =
        normalizeSubjectAreaBaseUrl(
          absoluteUrl,
        );

      if (!baseUrl) {
        return;
      }

      const slug =
        baseUrl.split('/').pop();

      if (!slug) {
        return;
      }

      const anchorText =
        normalizeText(
          $(element).text(),
        );

      const fallbackName =
        slug
          .split('-')
          .map(
            (part) =>
              part.charAt(0).toUpperCase() +
              part.slice(1),
          )
          .join(' ');

      const name =
        anchorText ||
        fallbackName;

      discovered.set(
        slug,
        {
          name,

          overviewUrl:
            `${baseUrl}/overview.html`,

          unitTableUrl:
            `${baseUrl}/unit-of-study-table.html`,
        },
      );
    },
  );

  return [
    ...discovered.values(),
  ].sort(
    (a, b) =>
      a.name.localeCompare(
        b.name,
      ),
  );
}