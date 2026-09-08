import axios from "axios";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

const CUSP_BASE_URL = "https://cusp.sydney.edu.au";
const TARGET_YEAR = 2026;

const REQUEST_DELAY_MS = 750;
const NAVIGATION_RETRIES = 3;
const TREE_EXPANSION_ATTEMPTS = 30;

/*
 * This plan was already collected and verified successfully.
 * Keep it even when CUSP discovery is temporarily unavailable.
 */
const KNOWN_SEED_URL =
  `${CUSP_BASE_URL}/students/view-degree-page/` +
  "stream/14282/dvid/6435";

const OUTPUT_FILE = path.resolve(
  "data/config/usyd/2026/cusp-study-plan-seeds.json",
);

const REPORT_FILE = path.resolve(
  "data/normalized/usyd/2026/cusp-degree-discovery-report.json",
);

const DEGREE_CACHE_FILE = path.resolve(
  "data/normalized/usyd/2026/cusp-degree-pages-cache.json",
);

/*
 * CUSP currently exposes program directories for these study areas.
 * Some directories may temporarily contain no degree links.
 */
const PROGRAM_LIST_URLS = [
  `${CUSP_BASE_URL}/students/view-degree-programs-page/did/742`,
  `${CUSP_BASE_URL}/students/view-degree-programs-page/did/226226`,
  `${CUSP_BASE_URL}/students/view-degree-programs-page/did/1000`,
];

type DiscoveredDegree = {
  degreeId: string;
  name: string;
  sourceUrl: string;
};

type DiscoveryMapping = {
  degreeId: string;
  dvid: string;
  name: string;
  seedUrl: string;
};

type DegreeCacheFile = {
  generatedAt: string;
  degrees: DiscoveredDegree[];
};

const client = axios.create({
  timeout: 30_000,
  responseType: "text",
  headers: {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent":
      "UniversityHandbookCollector/1.0 (academic data collection)",
  },
});

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const cleanText = (
  value: string | null | undefined,
): string =>
  (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const readExistingSeeds = async (): Promise<string[]> => {
  try {
    const content = await readFile(OUTPUT_FILE, "utf8");
    const parsed: unknown = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (value): value is string =>
        typeof value === "string" &&
        value.startsWith(CUSP_BASE_URL),
    );
  } catch {
    return [];
  }
};

const readDegreeCache = async (): Promise<DiscoveredDegree[]> => {
  try {
    const content = await readFile(
      DEGREE_CACHE_FILE,
      "utf8",
    );

    const parsed = JSON.parse(content) as Partial<DegreeCacheFile>;

    if (!Array.isArray(parsed.degrees)) {
      return [];
    }

    return parsed.degrees.filter(
      (degree): degree is DiscoveredDegree =>
        typeof degree?.degreeId === "string" &&
        typeof degree?.name === "string" &&
        typeof degree?.sourceUrl === "string",
    );
  } catch {
    return [];
  }
};

const saveDegreeCache = async (
  degrees: DiscoveredDegree[],
): Promise<void> => {
  await mkdir(path.dirname(DEGREE_CACHE_FILE), {
    recursive: true,
  });

  const cache: DegreeCacheFile = {
    generatedAt: new Date().toISOString(),
    degrees,
  };

  await writeFile(
    DEGREE_CACHE_FILE,
    `${JSON.stringify(cache, null, 2)}\n`,
    "utf8",
  );
};

const saveSeeds = async (
  seeds: Iterable<string>,
): Promise<void> => {
  const sortedSeeds = [...new Set(seeds)].sort();

  /*
   * Never overwrite the seed file with an empty array.
   */
  if (sortedSeeds.length === 0) {
    throw new Error(
      "Refusing to overwrite CUSP seed file with zero seeds",
    );
  }

  await mkdir(path.dirname(OUTPUT_FILE), {
    recursive: true,
  });

  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(sortedSeeds, null, 2)}\n`,
    "utf8",
  );
};

const collectLinksFromProgramPage = async (
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  programListUrl: string,
): Promise<DiscoveredDegree[]> => {
  const degreeLinkSelector =
    '#program-tree a[href*="/students/view-degree-page/degree_id/"]';

  for (
    let navigationAttempt = 1;
    navigationAttempt <= NAVIGATION_RETRIES;
    navigationAttempt += 1
  ) {
    const page = await browser.newPage();

    try {
      console.log(
        `Navigation attempt ${navigationAttempt}: ${programListUrl}`,
      );

      const response = await page.goto(programListUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      if (response && response.status() >= 400) {
        throw new Error(
          `CUSP returned HTTP ${response.status()}`,
        );
      }

      await page.waitForSelector("#program-tree", {
        state: "attached",
        timeout: 30_000,
      });

      await page.waitForFunction(
        () => {
          const cuspWindow = window as typeof window & {
            vdpspage?: {
              expandAll?: () => void;
            };
          };

          return (
            typeof cuspWindow.vdpspage?.expandAll ===
            "function"
          );
        },
        undefined,
        {
          timeout: 30_000,
        },
      );

      let previousCount = -1;
      let stableChecks = 0;
      let currentCount = 0;

      for (
        let attempt = 1;
        attempt <= TREE_EXPANSION_ATTEMPTS;
        attempt += 1
      ) {
        await page.evaluate(() => {
          const cuspWindow = window as typeof window & {
            vdpspage?: {
              expandAll?: () => void;
            };
          };

          cuspWindow.vdpspage?.expandAll?.();
        });

        await page.waitForTimeout(1_000);

        currentCount = await page
          .locator(degreeLinkSelector)
          .count();

        console.log(
          `Tree attempt ${attempt}: ${currentCount} degree links`,
        );

        if (
          currentCount > 0 &&
          currentCount === previousCount
        ) {
          stableChecks += 1;
        } else {
          stableChecks = 0;
        }

        if (stableChecks >= 3) {
          break;
        }

        previousCount = currentCount;
      }

      if (currentCount === 0) {
        throw new Error(
          "Program tree produced zero degree links",
        );
      }

      const rawLinks = await page
        .locator(degreeLinkSelector)
        .evaluateAll((links) =>
          links.map((link) => ({
            name: (link.textContent ?? "")
              .replace(/\s+/g, " ")
              .trim(),

            href: link.getAttribute("href") ?? "",
          })),
        );

      const degrees = new Map<
        string,
        DiscoveredDegree
      >();

      for (const rawLink of rawLinks) {
        const degreeId = rawLink.href.match(
          /\/degree_id\/(\d+)/,
        )?.[1];

        if (!degreeId) {
          continue;
        }

        degrees.set(degreeId, {
          degreeId,
          name: cleanText(rawLink.name),
          sourceUrl: new URL(
            rawLink.href,
            CUSP_BASE_URL,
          ).toString(),
        });
      }

      return [...degrees.values()];
    } catch (error) {
      console.warn(
        `Attempt ${navigationAttempt} failed: ` +
          `${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
      );
    } finally {
      await page.close();
    }

    if (navigationAttempt < NAVIGATION_RETRIES) {
      await wait(3_000);
    }
  }

  console.warn(
    `Could not discover degrees; skipping ${programListUrl}`,
  );

  return [];
};

const discoverDegreeLinks =
  async (): Promise<DiscoveredDegree[]> => {
    const browser = await chromium.launch({
      headless: true,
    });

    const degrees = new Map<string, DiscoveredDegree>();

    try {
      for (const programListUrl of PROGRAM_LIST_URLS) {
        console.log(`Opening ${programListUrl}`);

        const discovered =
          await collectLinksFromProgramPage(
            browser,
            programListUrl,
          );

        for (const degree of discovered) {
          degrees.set(degree.degreeId, degree);
        }

        if (degrees.size > 0) {
          /*
           * Save after every successful study area.
           * A later CUSP failure will not lose earlier results.
           */
          await saveDegreeCache([
            ...degrees.values(),
          ]);

          console.log(
            `Saved checkpoint with ${degrees.size} degree pages`,
          );
        }
      }
    } finally {
      await browser.close();
    }

    if (degrees.size > 0) {
      return [...degrees.values()];
    }

    const cachedDegrees = await readDegreeCache();

    if (cachedDegrees.length > 0) {
      console.warn(
        `Live discovery failed; using ${cachedDegrees.length} cached degree pages`,
      );

      return cachedDegrees;
    }

    return [];
  };

const findTargetYearDvid = async (
  degree: DiscoveredDegree,
): Promise<string | null> => {
  console.log(
    `Checking ${degree.name} ` +
      `(degree_id ${degree.degreeId})`,
  );

  try {
    const response = await client.get<string>(
      degree.sourceUrl,
    );

    const $ = cheerio.load(response.data);

    let targetDvid: string | null = null;

    $("#selected-degree-version-id option").each(
      (_, option) => {
        const optionYear = cleanText(
          $(option).text(),
        );

        const optionValue = cleanText(
          $(option).attr("value"),
        );

        if (
          optionYear === String(TARGET_YEAR) &&
          /^\d+$/.test(optionValue)
        ) {
          targetDvid = optionValue;
        }
      },
    );

    if (!targetDvid) {
      console.warn(
        `No ${TARGET_YEAR} version: ${degree.name}`,
      );

      return null;
    }

    return targetDvid;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn(
        `Skipping ${degree.name}: HTTP ` +
          `${
            error.response?.status ??
            "request failed"
          }`,
      );
    } else {
      console.warn(
        `Skipping ${degree.name}: ` +
          `${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
      );
    }

    return null;
  }
};

const saveReport = async (
  discoveredDegreePages: number,
  mappings: DiscoveryMapping[],
  usedCache: boolean,
): Promise<void> => {
  await mkdir(path.dirname(REPORT_FILE), {
    recursive: true,
  });

  await writeFile(
    REPORT_FILE,
    `${JSON.stringify(
      {
        targetYear: TARGET_YEAR,
        discoveredDegreePages,
        degreesWithTargetYear: mappings.length,
        usedCache,
        generatedAt: new Date().toISOString(),
        degrees: mappings,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

const run = async (): Promise<void> => {
  const existingSeeds = await readExistingSeeds();

  /*
   * Preserve all existing seeds and restore the verified seed
   * if a previous failed run replaced the file with [].
   */
  const seedUrls = new Set<string>([
    ...existingSeeds,
    KNOWN_SEED_URL,
  ]);

  const cachedBeforeDiscovery = await readDegreeCache();
  const degrees = await discoverDegreeLinks();

  const usedCache =
    degrees.length > 0 &&
    cachedBeforeDiscovery.length > 0 &&
    degrees.every((degree) =>
      cachedBeforeDiscovery.some(
        (cached) =>
          cached.degreeId === degree.degreeId,
      ),
    );

  console.log(
    `Found ${degrees.length} unique CUSP degree pages`,
  );

  const discoveredMappings: DiscoveryMapping[] = [];

  if (degrees.length === 0) {
    console.warn(
      "CUSP discovery is unavailable. Preserving existing seeds.",
    );

    await saveSeeds(seedUrls);

    await saveReport(
      0,
      discoveredMappings,
      false,
    );

    console.log("");
    console.log("No new degree pages were discovered.");
    console.log(
      `Preserved ${seedUrls.size} existing/known seeds`,
    );
    console.log(`Saved seeds to ${OUTPUT_FILE}`);

    return;
  }

  for (const degree of degrees) {
    const dvid = await findTargetYearDvid(degree);

    if (dvid) {
      const seedUrl =
        `${CUSP_BASE_URL}/students/` +
        `view-degree-page/dvid/${dvid}`;

      seedUrls.add(seedUrl);

      discoveredMappings.push({
        degreeId: degree.degreeId,
        dvid,
        name: degree.name,
        seedUrl,
      });
    }

    await wait(REQUEST_DELAY_MS);
  }

  await saveSeeds(seedUrls);

  await saveReport(
    degrees.length,
    discoveredMappings,
    usedCache,
  );

  console.log("");
  console.log(
    `Degree pages found: ${degrees.length}`,
  );

  console.log(
    `${TARGET_YEAR} degree versions found: ` +
      `${discoveredMappings.length}`,
  );

  console.log(
    `Total preserved/generated seeds: ${seedUrls.size}`,
  );

  console.log(`Saved seeds to ${OUTPUT_FILE}`);
  console.log(`Saved report to ${REPORT_FILE}`);
  console.log(
    `Saved degree cache to ${DEGREE_CACHE_FILE}`,
  );
};

run().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  process.exitCode = 1;
});