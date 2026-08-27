import { Page } from 'playwright';
import { politeDelay } from '../../core/rate-limiter.js';

export interface DiscoveredLink {
  url: string;
  code?: string;
  type:
    | 'COURSE'
    | 'SUBJECT'
    | 'COMPONENT';
}

export async function discoverUtsLinks(
  page: Page,
): Promise<DiscoveredLink[]> {
  const discovered = new Map<string, DiscoveredLink>();

  const seeds = [
    'https://coursehandbook.uts.edu.au/',
  ];

  for (const seed of seeds) {
    await page.goto(seed, {
      waitUntil: 'networkidle',
    });

    const links = await page
      .locator('a')
      .evaluateAll((elements) =>
        elements
          .map((a) => ({
            href: (a as HTMLAnchorElement).href,
            text: a.textContent?.trim() ?? '',
          }))
          .filter((x) => x.href),
      );

    for (const link of links) {
      classify(link.href, discovered);
    }

    await politeDelay();
  }

  return [...discovered.values()];
}

function classify(
  url: string,
  discovered: Map<string, DiscoveredLink>,
) {
  const lower = url.toLowerCase();

  if (lower.includes('/course/')) {
    discovered.set(url, {
      url,
      type: 'COURSE',
    });
  }

  if (
    lower.includes('/subject/') ||
    lower.includes('/course-area/')
  ) {
    discovered.set(url, {
      url,
      type: 'SUBJECT',
    });
  }

  if (
    lower.includes('/aos/') ||
    lower.includes('/major/') ||
    lower.includes('/sub-major/')
  ) {
    discovered.set(url, {
      url,
      type: 'COMPONENT',
    });
  }
}
