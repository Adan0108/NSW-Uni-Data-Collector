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
  console.log(`Downloading ${url}`);

  const response = await client.get<string>(url);

  if (typeof response.data !== "string" || !response.data.trim()) {
    throw new Error(`CUSP returned an empty response for ${url}`);
  }

  return response.data;
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
  const discoveredUrls = new Set<string>();

  for (const seedUrl of seedUrls) {
    const html = await downloadPage(seedUrl);

    for (const variantUrl of discoverCuspVariants(html, seedUrl)) {
      discoveredUrls.add(variantUrl);
    }

    await wait(REQUEST_DELAY_MS);
  }

  const plansByIdentity = new Map<string, CuspStudyPlan>();

  for (const pageUrl of discoveredUrls) {
    try {
      const html = await downloadPage(pageUrl);
      const plan = parseCuspStudyPlan(html, pageUrl);

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