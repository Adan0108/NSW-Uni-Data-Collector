import * as cheerio from "cheerio";
import type { Element } from "domhandler";

import type {
  CuspStudyPlan,
  CuspStudyPlanItem,
  CuspStudyPlanPeriod,
  CuspSubjectReference,
} from "./cusp-study-plan.types.js";

const CUSP_BASE_URL = "https://cusp.sydney.edu.au";

const cleanText = (value: string | null | undefined): string =>
  (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parseInteger = (value: string): number | null => {
  const match = cleanText(value).match(/\d+/);

  return match ? Number.parseInt(match[0], 10) : null;
};

const absoluteUrl = (href: string): string =>
  new URL(href, CUSP_BASE_URL).toString();

const parsePageIdentifiers = (
  pageUrl: string,
): {
  degreeVersionId: string;
  streamId: string | null;
} => {
  const url = new URL(pageUrl);

  return {
    degreeVersionId:
      url.pathname.match(/\/dvid\/(\d+)/)?.[1] ??
      url.searchParams.get("dvid") ??
      "",

    streamId:
      url.pathname.match(/\/stream\/(\d+)/)?.[1] ??
      url.searchParams.get("stream"),
  };
};

const parseSubjects = (
  $: cheerio.CheerioAPI,
  cell: cheerio.Cheerio<Element>,
): CuspSubjectReference[] => {
  const subjects = new Map<string, CuspSubjectReference>();

  cell.find('a[href*="/students/view-unit-page/alpha/"]').each(
    (_, link) => {
      const anchor = $(link);
      const href = anchor.attr("href");

      if (!href) {
        return;
      }

      const codeFromUrl = href.match(
        /\/alpha\/([A-Za-z0-9_-]+)/,
      )?.[1];

      const text = cleanText(anchor.text());
      const codeFromText = text.match(/\b[A-Z]{4}\d{4}\b/)?.[0];

      const code = (
        codeFromUrl ??
        codeFromText ??
        ""
      ).toUpperCase();

      if (!code) {
        return;
      }

      const name = cleanText(
        text
          .replace(
            new RegExp(`^${code}\\s*:?\\s*`, "i"),
            "",
          )
          .replace(/^:\s*/, ""),
      );

      subjects.set(code, {
        code,
        name,
        sourceUrl: absoluteUrl(href),
      });
    },
  );

  return [...subjects.values()];
};

const parseRequirementSourceId = (
  $: cheerio.CheerioAPI,
  cell: cheerio.Cheerio<Element>,
): string | null => {
  const href = cell
    .find('a[href^="#view_unit_block_"]')
    .first()
    .attr("href");

  return href?.match(/view_unit_block_(\d+)/)?.[1] ?? null;
};

const parsePeriod = (
  $: cheerio.CheerioAPI,
  headingElement: Element,
): CuspStudyPlanPeriod | null => {
  const heading = $(headingElement);
  const title = cleanText(heading.text());

  const headingMatch = title.match(
    /^Year\s+(\d+)\s*-\s*(.+)$/i,
  );

  if (!headingMatch) {
    return null;
  }

  const yearNumber = Number.parseInt(headingMatch[1], 10);
  const periodName = cleanText(headingMatch[2]);

  // CUSP places the study-plan table after each Year/Semester heading.
  const table = heading.nextAll("table.t_b").first();

  if (!table.length) {
    return null;
  }

  const items: CuspStudyPlanItem[] = [];

  table.find("tr").each((_, row) => {
    const cells = $(row).children("th, td");

    if (cells.length < 3) {
      return;
    }

    const requirementCell = cells.eq(0);
    const creditPointCell = cells.eq(1);
    const unitCell = cells.eq(2);

    const requirementLabel = cleanText(
      requirementCell.text(),
    );

    const creditPointText = cleanText(
      creditPointCell.text(),
    );

    const rawText = cleanText(unitCell.text());

    /*
     * CUSP sometimes represents its table heading using td elements
     * instead of th elements, so checking only for th is insufficient.
     */
    const isHeaderRow =
      requirementLabel.toLowerCase() ===
        "sits diet block/type" &&
      creditPointText.toLowerCase() === "cp" &&
      rawText.toLowerCase() ===
        "unit of study/unit block";

    if (isHeaderRow) {
      return;
    }

    if (!requirementLabel && !rawText) {
      return;
    }

    items.push({
      position: items.length + 1,
      requirementLabel: requirementLabel || null,
      requirementSourceId: parseRequirementSourceId(
        $,
        requirementCell,
      ),
      creditPoints: parseInteger(creditPointText),
      subjects: parseSubjects($, unitCell),
      rawText,
    });
  });

  const notes: string[] = [];

  let sibling = table.next();

  while (
    sibling.length > 0 &&
    !sibling.is("hr") &&
    !sibling.is("h1, h2, h3, h4, h5, h6")
  ) {
    const text = cleanText(sibling.text());

    if (text) {
      notes.push(text);
    }

    sibling = sibling.next();
  }

  return {
    yearNumber,
    periodName,
    title,
    notes: [...new Set(notes)],
    items,
  };
};

export const parseCuspStudyPlan = (
  html: string,
  pageUrl: string,
): CuspStudyPlan => {
  const $ = cheerio.load(html);
  const identifiers = parsePageIdentifiers(pageUrl);

  const commencementYearText = cleanText(
    $("#selected-degree-version-id option:selected").text(),
  );

  const commencementYear =
    commencementYearText.match(/^\d{4}$/)
      ? Number.parseInt(commencementYearText, 10)
      : null;

  const selectedVariantText = cleanText(
    $("#selected-stream-id option:selected").text(),
  );

  const variantTitle = selectedVariantText || null;

  const pageHeading = $("h3")
    .filter((_, element) => {
      const text = cleanText($(element).text());

      return !/^Year\s+\d+\s*-/i.test(text);
    })
    .first();

  const title =
    cleanText(pageHeading.text()) ||
    cleanText($("title").text()) ||
    "University of Sydney study plan";

  const periods: CuspStudyPlanPeriod[] = [];

  $("h3").each((_, heading) => {
    const period = parsePeriod($, heading);

    if (period) {
      periods.push(period);
    }
  });

  if (!identifiers.degreeVersionId) {
    throw new Error(
      `Could not find CUSP dvid in URL: ${pageUrl}`,
    );
  }

  if (periods.length === 0) {
    throw new Error(
      `No CUSP study-plan periods found: ${pageUrl}`,
    );
  }

  return {
    source: "USYD_CUSP",
    sourceUrl: pageUrl,
    cuspDegreeVersionId: identifiers.degreeVersionId,
    cuspStreamId: identifiers.streamId,
    commencementYear,
    title,
    variantTitle,
    underReview: /under review/i.test(
      cleanText($("body").text()),
    ),
    periods,
    collectedAt: new Date().toISOString(),
  };
};

export const discoverCuspVariants = (
  html: string,
  currentPageUrl: string,
): string[] => {
  const $ = cheerio.load(html);
  const currentUrl = new URL(currentPageUrl);

  const dvid =
    currentUrl.pathname.match(/\/dvid\/(\d+)/)?.[1] ??
    $("#selected-degree-version-id").val()?.toString();

  if (!dvid) {
    throw new Error(
      `Could not discover CUSP dvid: ${currentPageUrl}`,
    );
  }

  const urls = new Set<string>();

  // Stream value 0 represents the plan without a specialisation.
  urls.add(
    `${CUSP_BASE_URL}/students/view-degree-page/dvid/${dvid}`,
  );

  $("#selected-stream-id option").each((_, option) => {
    const streamId = cleanText($(option).attr("value"));

    if (!streamId || streamId === "0") {
      return;
    }

    urls.add(
      `${CUSP_BASE_URL}/students/view-degree-page/stream/${streamId}/dvid/${dvid}`,
    );
  });

  return [...urls];
};