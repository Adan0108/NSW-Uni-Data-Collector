import type {
  UsydGlobalParsedAward,
  UsydGlobalParsedCourse,
} from './usyd.global-degree-parser';

export type UsydNormalizedDegreeLevel =
  | 'UNDERGRADUATE'
  | 'HONOURS'
  | 'COMBINED'
  | 'DIPLOMA'
  | 'POSTGRADUATE_CONSTITUENT'
  | 'OTHER';

export interface UsydNormalizedDegreeSource {
  discoveredName: string;

  handbookCategory:
  UsydGlobalParsedCourse['handbookCategory'];

  sourceRootUrl: string;

  sourceUrl: string;

  resolutionsUrl: string | null;

  matchedAwardSection: boolean;
}

export interface UsydNormalizedDegree {
  code: string;

  title: string;

  level:
  UsydNormalizedDegreeLevel;

  totalCreditPoints:
  number | null;

  awardRequirements:
  UsydGlobalParsedAward['awardRequirements'];

  rawAwardRequirements:
  string | null;

  sources:
  UsydNormalizedDegreeSource[];

  isStandaloneDegree:
  boolean;
}

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

function classifyDegree(
  award:
    UsydGlobalParsedAward,
): UsydNormalizedDegreeLevel {
  const title =
    normalizeText(
      award.title,
    );

  const code =
    award.code.toUpperCase();

  /*
   * ------------------------------------------------
   * DIPLOMA
   * ------------------------------------------------
   */
  if (
    /^Diploma\b/i.test(
      title,
    ) ||
    code.startsWith(
      'DL',
    )
  ) {
    return 'DIPLOMA';
  }

  /*
   * ------------------------------------------------
   * POSTGRADUATE CONSTITUENT
   * ------------------------------------------------
   *
   * These codes can occur inside an undergraduate
   * combined-course resolution.
   *
   * They should be preserved but not inserted as
   * standalone undergraduate Degree rows.
   */
  if (
    /^Master\b/i.test(
      title,
    ) ||
    code.startsWith(
      'MA',
    )
  ) {
    return 'POSTGRADUATE_CONSTITUENT';
  }

  /*
   * ------------------------------------------------
   * COMBINED
   * ------------------------------------------------
   */
  if (
    /\band Bachelor\b/i.test(
      title,
    ) ||
    /\band Master\b/i.test(
      title,
    ) ||
    /\band Doctor\b/i.test(
      title,
    )
  ) {
    return 'COMBINED';
  }

  /*
   * ------------------------------------------------
   * HONOURS
   * ------------------------------------------------
   */
  if (
    /\(Honours\)/i.test(
      title,
    ) ||
    /\bHonours\b/i.test(
      title,
    ) ||
    code.startsWith(
      'BH',
    )
  ) {
    return 'HONOURS';
  }

  /*
   * ------------------------------------------------
   * UNDERGRADUATE
   * ------------------------------------------------
   */
  if (
    /^Bachelor\b/i.test(
      title,
    ) ||
    code.startsWith(
      'BP',
    ) ||
    code.startsWith(
      'BU',
    ) ||
    code.startsWith(
      'BG',
    )
  ) {
    return 'UNDERGRADUATE';
  }

  return 'OTHER';
}

function shouldCreateStandaloneDegree(
  level:
    UsydNormalizedDegreeLevel,
): boolean {
  return (
    level !==
    'POSTGRADUATE_CONSTITUENT'
  );
}

function makeSource(
  parsed:
    UsydGlobalParsedCourse,

  award:
    UsydGlobalParsedAward,
): UsydNormalizedDegreeSource {
  return {
    discoveredName:
      parsed.discoveredName,

    handbookCategory:
      parsed.handbookCategory,

    sourceRootUrl:
      parsed.sourceRootUrl,

    sourceUrl:
      parsed.sourceUrl,

    resolutionsUrl:
      parsed.resolutionsUrl,

    matchedAwardSection:
      award.matchedAwardSection,
  };
}

function sourceKey(
  source:
    UsydNormalizedDegreeSource,
): string {
  return [
    source.handbookCategory,
    source.sourceUrl,
    source.resolutionsUrl ??
    '',
  ].join(
    '::',
  );
}

function mergeSources(
  current:
    UsydNormalizedDegreeSource[],

  incoming:
    UsydNormalizedDegreeSource,
): UsydNormalizedDegreeSource[] {
  const seen =
    new Set(
      current.map(
        sourceKey,
      ),
    );

  const key =
    sourceKey(
      incoming,
    );

  if (
    seen.has(
      key,
    )
  ) {
    return current;
  }

  return [
    ...current,
    incoming,
  ];
}

function sourceQuality(
  award:
    UsydGlobalParsedAward,
): number {
  let score = 0;

  if (
    award.matchedAwardSection
  ) {
    score +=
      1000;
  }

  if (
    award.totalCreditPoints !==
    null
  ) {
    score +=
      100;
  }

  score +=
    award.awardRequirements.length;

  if (
    award.rawAwardRequirements
  ) {
    score +=
      Math.min(
        award.rawAwardRequirements.length /
        1000,
        10,
      );
  }

  return score;
}

function shouldReplaceAwardData(
  existing:
    UsydNormalizedDegree,

  incoming:
    UsydGlobalParsedAward,

  incomingSource:
    UsydNormalizedDegreeSource,
): boolean {
  /*
   * Prefer an explicitly matched award section
   * over a generic page-level fallback.
   */
  const existingHasMatched =
    existing.sources.some(
      (source) =>
        source.matchedAwardSection,
    );

  if (
    incomingSource.matchedAwardSection &&
    !existingHasMatched
  ) {
    return true;
  }

  if (
    !incomingSource.matchedAwardSection &&
    existingHasMatched
  ) {
    return false;
  }

  const currentPseudoAward:
    UsydGlobalParsedAward =
  {
    code:
      existing.code,

    title:
      existing.title,

    totalCreditPoints:
      existing.totalCreditPoints,

    awardRequirements:
      existing.awardRequirements,

    rawAwardRequirements:
      existing.rawAwardRequirements,

    matchedAwardSection:
      existingHasMatched,

    matchMethod:
      existingHasMatched
        ? 'HEADING'
        : 'FALLBACK',
  };

  return (
    sourceQuality(
      incoming,
    ) >
    sourceQuality(
      currentPseudoAward,
    )
  );
}

export function normalizeUsydDegrees(
  parsedCourses:
    UsydGlobalParsedCourse[],
): UsydNormalizedDegree[] {
  const degrees =
    new Map<
      string,
      UsydNormalizedDegree
    >();

  for (
    const parsed
    of parsedCourses
  ) {
    for (
      const award
      of parsed.awards
    ) {
      const code =
        award.code
          .trim()
          .toUpperCase();

      const title =
        normalizeText(
          award.title,
        );

      if (
        !code ||
        !title
      ) {
        continue;
      }

      const normalizedAward:
        UsydGlobalParsedAward =
      {
        ...award,

        code,

        title,
      };

      const level =
        classifyDegree(
          normalizedAward,
        );

      const source =
        makeSource(
          parsed,
          normalizedAward,
        );

      const existing =
        degrees.get(
          code,
        );

      if (
        !existing
      ) {
        degrees.set(
          code,
          {
            code,

            title,

            level,

            totalCreditPoints:
              normalizedAward.totalCreditPoints,

            awardRequirements:
              normalizedAward.awardRequirements,

            rawAwardRequirements:
              normalizedAward.rawAwardRequirements,

            sources:
              [
                source,
              ],

            isStandaloneDegree:
              shouldCreateStandaloneDegree(
                level,
              ),
          },
        );

        continue;
      }

      const replaceData =
        shouldReplaceAwardData(
          existing,
          normalizedAward,
          source,
        );

      if (
        replaceData
      ) {
        existing.totalCreditPoints =
          normalizedAward.totalCreditPoints;

        existing.awardRequirements =
          normalizedAward.awardRequirements;

        existing.rawAwardRequirements =
          normalizedAward.rawAwardRequirements;
      }

      existing.sources =
        mergeSources(
          existing.sources,
          source,
        );

      /*
       * Prefer the longer official title if the
       * same code appears with slightly different
       * wording.
       */
      if (
        title.length >
        existing.title.length
      ) {
        existing.title =
          title;
      }
    }
  }

  return [
    ...degrees.values(),
  ].sort(
    (a, b) =>
      a.title.localeCompare(
        b.title,
      ),
  );
}