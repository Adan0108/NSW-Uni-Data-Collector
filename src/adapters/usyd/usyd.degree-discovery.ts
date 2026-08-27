import { chromium } from 'playwright';

const USYD_SCIENCE_COURSEWORK_URL =
  'https://www.sydney.edu.au/handbooks/science/coursework.html';

export interface UsydDiscoveredDegree {
  name: string;
  overviewUrl: string;
  courseBaseUrl: string;
}

function normalizeText(
  value: string,
): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

export async function discoverUsydScienceDegrees(): Promise<
  UsydDiscoveredDegree[]
> {
  const browser =
    await chromium.launch({
      headless: true,
    });

  try {
    const page =
      await browser.newPage();

    await page.goto(
      USYD_SCIENCE_COURSEWORK_URL,
      {
        waitUntil:
          'domcontentloaded',
      },
    );

    const links =
      await page
        .locator('a')
        .evaluateAll(
          (
            anchors: HTMLAnchorElement[],
          ) =>
            anchors.map(
              (anchor) => ({
                text:
                  anchor.textContent ??
                  '',

                href:
                  anchor.href,
              }),
            ),
        );

    const discovered =
      new Map<
        string,
        UsydDiscoveredDegree
      >();

    for (
      const link
      of links
    ) {
      const name =
        normalizeText(
          link.text,
        );

      const href =
        link.href;

      if (
        !name ||
        !href
      ) {
        continue;
      }

      /*
       * Course overview pages follow:
       *
       * /handbooks/science/coursework/<course-slug>/overview.html
       */
      if (
        !href.includes(
          '/handbooks/science/coursework/',
        )
      ) {
        continue;
      }

      if (
        !href.endsWith(
          '/overview.html',
        )
      ) {
        continue;
      }

      const courseBaseUrl =
        href.replace(
          /\/overview\.html$/,
          '',
        );

      discovered.set(
        courseBaseUrl,
        {
          name,

          overviewUrl:
            href,

          courseBaseUrl,
        },
      );
    }

    return [
      ...discovered.values(),
    ].sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
        ),
    );
  } finally {
    await browser.close();
  }
}