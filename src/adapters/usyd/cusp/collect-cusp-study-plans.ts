import axios from "axios";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  discoverCuspVariants,
  parseCuspStudyPlan,
} from "./cusp-study-plan.parser.js";
import type {
  CuspCollectionFile,
  CuspStudyPlan,
} from "./cusp-study-plan.types.js";

const HANDBOOK_YEAR = 2026;

const OUTPUT_DIRECTORY = path.resolve(
  "data/normalized/usyd/2026",
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIRECTORY,
  "usyd-cusp-study-plans.v1.json",
);

const SEED_FILE = path.resolve(
  "data/config/usyd/2026/cusp-study-plan-seeds.json",
);

const REQUEST_DELAY_MS = 750;
const RETRIES = 4;
const RETRY_BASE_DELAY_MS = 5_000;

type DiscoveryEntry = {
  degreeId: string;
  dvid: string;
  name: string;
};

const client = axios.create({
  timeout: 30_000,
  headers: {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent":
      "UniversityHandbookCollector/1.0 (academic data collection)",
  },
  responseType: "text",
});

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const downloadPage = async (url: string): Promise<string> => {
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      console.log(`Downloading ${url} (attempt ${attempt}/${RETRIES})`);
      const response = await client.get<string>(url);

      if (typeof response.data !== "string" || !response.data.trim()) {
        throw new Error(`CUSP returned an empty response for ${url}`);
      }

      return response.data;
    } catch (error) {
      if (attempt === RETRIES) {
        throw error;
      }

      const delay = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(`Download failed; retrying in ${delay / 1_000}s`);
      await wait(delay);
    }
  }

  throw new Error(`Unreachable retry state for ${url}`);
};

const readDiscoveryByDvid = async (): Promise<Map<string, DiscoveryEntry>> => {
  const reportFile = path.resolve(
    "data/normalized/usyd/2026/cusp-degree-discovery-report.json",
  );

  try {
    const parsed = JSON.parse(await readFile(reportFile, "utf8")) as {
      degrees?: DiscoveryEntry[];
    };

    return new Map(
      (parsed.degrees ?? []).map((degree) => [degree.dvid, degree]),
    );
  } catch {
    return new Map();
  }
};

const readExistingCollection = async (): Promise<CuspStudyPlan[]> => {
  try {
    const parsed = JSON.parse(await readFile(OUTPUT_FILE, "utf8")) as
      Partial<CuspCollectionFile>;
    return Array.isArray(parsed.plans) ? parsed.plans : [];
  } catch {
    return [];
  }
};

const readSeedUrls = async (): Promise<string[]> => {
  const content = await readFile(SEED_FILE, "utf8");
  const parsed: unknown = JSON.parse(content);

  if (
    !Array.isArray(parsed) ||
    parsed.some((value) => typeof value !== "string")
  ) {
    throw new Error(`${SEED_FILE} must contain an array of URL strings`);
  }

  return [...new Set(parsed)];
};

const planIdentity = (plan: CuspStudyPlan): string =>
  [
    plan.cuspDegreeVersionId,
    plan.cuspStreamId ?? "base",
    plan.commencementYear ?? "unknown",
  ].join(":");

const run = async (): Promise<void> => {
  const seedUrls = await readSeedUrls();
  const discoveryByDvid = await readDiscoveryByDvid();
  const discoveredUrls = new Set<string>();

  for (const seedUrl of seedUrls) {
    try {
      const html = await downloadPage(seedUrl);

      for (const variantUrl of discoverCuspVariants(html, seedUrl)) {
        discoveredUrls.add(variantUrl);
      }
    } catch (error) {
      console.error(`Failed to discover variants for ${seedUrl}`, error);
    }

    await wait(REQUEST_DELAY_MS);
  }

  /* Preserve successful prior results so a temporary CUSP outage cannot
   * replace a complete collection with a partial or empty file. */
  const plansByIdentity = new Map<string, CuspStudyPlan>(
    (await readExistingCollection()).map((plan) => [planIdentity(plan), plan]),
  );

  for (const pageUrl of discoveredUrls) {
    try {
      const html = await downloadPage(pageUrl);
      const dvid = new URL(pageUrl).pathname.match(/\/dvid\/(\d+)/)?.[1];
      const degree = dvid ? discoveryByDvid.get(dvid) : undefined;
      const plan = parseCuspStudyPlan(html, pageUrl, degree);

      plansByIdentity.set(planIdentity(plan), plan);

      console.log(
        `Collected ${plan.variantTitle ?? plan.title}: ` +
          `${plan.periods.length} periods`,
      );
    } catch (error) {
      console.error(`Failed to collect ${pageUrl}`, error);
    }

    await wait(REQUEST_DELAY_MS);
  }

  const output: CuspCollectionFile = {
    schemaVersion: "1.0",
    universityCode: "USYD",
    handbookYear: HANDBOOK_YEAR,
    collectedAt: new Date().toISOString(),
    plans: [...plansByIdentity.values()],
  };

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const itemCount = output.plans.reduce(
    (planTotal, plan) =>
      planTotal +
      plan.periods.reduce(
        (periodTotal, period) => periodTotal + period.items.length,
        0,
      ),
    0,
  );

  console.log(`Saved ${output.plans.length} plans to ${OUTPUT_FILE}`);
  console.log(`Collected ${itemCount} study-plan rows`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
