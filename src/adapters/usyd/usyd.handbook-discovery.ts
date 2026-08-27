import axios from 'axios';
import * as cheerio from 'cheerio';

export type UsydHandbookCategory =
  | 'ARCHITECTURE'
  | 'ARTS'
  | 'BUSINESS'
  | 'ENGINEERING'
  | 'INTERDISCIPLINARY'
  | 'MEDICINE_HEALTH'
  | 'SCIENCE'
  | 'CONSERVATORIUM'
  | 'LAW';

export interface UsydHandbookRoot {
  category: UsydHandbookCategory;

  name: string;

  url: string;

  /*
   * Some handbooks explicitly say Undergraduate.
   *
   * Architecture, Conservatorium and Law are not
   * labelled exactly the same way on the root page,
   * so we explicitly classify the handbook roots
   * we want rather than relying on the label alone.
   */
  undergraduateRelevant: boolean;
}

const USYD_HANDBOOK_HOME =
  'https://www.sydney.edu.au/handbooks/';

function normalizeText(
  value: string,
): string {
  return value
    .replace(
      /[\u200B-\u200D\uFEFF]/g,
      '',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function normalizeUrl(
  href: string,
): string {
  return new URL(
    href,
    USYD_HANDBOOK_HOME,
  ).toString();
}

function classifyHandbook(
  name: string,
): UsydHandbookCategory | null {
  const normalized =
    name.toLowerCase();

  if (
    normalized.includes(
      'architecture',
    )
  ) {
    return 'ARCHITECTURE';
  }

  if (
    normalized.includes(
      'arts and social sciences undergraduate',
    )
  ) {
    return 'ARTS';
  }

  if (
    normalized.includes(
      'business school undergraduate',
    )
  ) {
    return 'BUSINESS';
  }

  if (
    normalized.includes(
      'engineering undergraduate',
    )
  ) {
    return 'ENGINEERING';
  }

  if (
    normalized.includes(
      'interdisciplinary studies',
    )
  ) {
    return 'INTERDISCIPLINARY';
  }

  if (
    normalized.includes(
      'medicine and health undergraduate',
    )
  ) {
    return 'MEDICINE_HEALTH';
  }

  if (
    normalized.includes(
      'science undergraduate',
    )
  ) {
    return 'SCIENCE';
  }

  if (
    normalized.includes(
      'sydney conservatorium of music',
    )
  ) {
    return 'CONSERVATORIUM';
  }

  if (
    normalized.includes(
      'sydney law school',
    )
  ) {
    return 'LAW';
  }

  return null;
}

export async function discoverUsydHandbooks(): Promise<
  UsydHandbookRoot[]
> {
  const response =
    await axios.get<string>(
      USYD_HANDBOOK_HOME,
    );

  const $ =
    cheerio.load(
      response.data,
    );

  const handbooks =
    new Map<
      UsydHandbookCategory,
      UsydHandbookRoot
    >();

  $('a').each(
    (_, element) => {
      const anchor =
        $(element);

      const name =
        normalizeText(
          anchor.text(),
        );

      const href =
        anchor.attr(
          'href',
        );

      if (
        !name ||
        !href
      ) {
        return;
      }

      const category =
        classifyHandbook(
          name,
        );

      if (!category) {
        return;
      }

      handbooks.set(
        category,
        {
          category,

          name,

          url:
            normalizeUrl(
              href,
            ),

          undergraduateRelevant:
            true,
        },
      );
    },
  );

  return [
    ...handbooks.values(),
  ];
}