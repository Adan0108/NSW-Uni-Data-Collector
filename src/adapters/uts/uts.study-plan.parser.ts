export interface ParsedUtsStudyPlanItem {
  type:
    | 'SUBJECT'
    | 'CHOICE';

  code?: string;

  title: string;

  creditPoints?: number;

  url?: string;

  custom: boolean;

  order?: number;

  numberOfPeriods?: number;
}

export interface ParsedUtsStudyPlanPeriod {
  name: string;

  order?: number;

  items:
    ParsedUtsStudyPlanItem[];
}

export interface ParsedUtsStudyPlanYear {
  name: string;

  order?: number;

  periods:
    ParsedUtsStudyPlanPeriod[];
}

export interface ParsedUtsStudyPlan {
  id?: string;

  title: string;

  description?: string;

  url?: string;

  courseCode?: string;

  courseName?: string;

  courseCreditPoints?: number;

  years:
    ParsedUtsStudyPlanYear[];
}

interface RawStudyPlan {
  title?: unknown;

  description?: unknown;

  cl_id?: unknown;

  url?: unknown;

  academic_item_association?: {
    credit_points?: unknown;

    assoc_title?: unknown;

    assoc_code?: unknown;
  };

  container?: unknown[];
}

interface RawContainer {
  name?: unknown;

  order?: unknown;

  relationship?: unknown[];

  container?: unknown[];
}

interface RawRelationship {
  order?: unknown;

  number_of_periods?: unknown;

  ai_details?: {
    code?: unknown;

    title?: unknown;

    credit_points?: unknown;

    academic_item_url?: unknown;

    custom_ai?: unknown;
  };
}

export function parseUtsStudyPlans(
  value: unknown,
): ParsedUtsStudyPlan[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const plans:
    ParsedUtsStudyPlan[] = [];

  for (const raw of value) {
    if (!isRecord(raw)) {
      continue;
    }

    const plan =
      raw as RawStudyPlan;

    plans.push(
      parseStudyPlan(
        plan,
      ),
    );
  }

  return plans;
}

function parseStudyPlan(
  plan: RawStudyPlan,
): ParsedUtsStudyPlan {
  const years:
    ParsedUtsStudyPlanYear[] = [];

  if (
    Array.isArray(
      plan.container,
    )
  ) {
    for (
      const rawYear
      of plan.container
    ) {
      if (!isRecord(rawYear)) {
        continue;
      }

      years.push(
        parseYear(
          rawYear as RawContainer,
        ),
      );
    }
  }

  years.sort(
    compareByOrder,
  );

  const association =
    plan.academic_item_association;

  return {
    id:
      stringValue(
        plan.cl_id,
      ),

    title:
      stringValue(
        plan.title,
      ) ?? '',

    description:
      stringValue(
        plan.description,
      ),

    url:
      stringValue(
        plan.url,
      ),

    courseCode:
      stringValue(
        association?.assoc_code,
      ),

    courseName:
      stringValue(
        association?.assoc_title,
      ),

    courseCreditPoints:
      numberValue(
        association?.credit_points,
      ),

    years,
  };
}

function parseYear(
  year: RawContainer,
): ParsedUtsStudyPlanYear {
  const periods:
    ParsedUtsStudyPlanPeriod[] = [];

  if (
    Array.isArray(
      year.container,
    )
  ) {
    for (
      const rawPeriod
      of year.container
    ) {
      if (
        !isRecord(
          rawPeriod,
        )
      ) {
        continue;
      }

      periods.push(
        parsePeriod(
          rawPeriod as RawContainer,
        ),
      );
    }
  }

  periods.sort(
    compareByOrder,
  );

  return {
    name:
      stringValue(
        year.name,
      ) ?? '',

    order:
      numberValue(
        year.order,
      ),

    periods,
  };
}

function parsePeriod(
  period: RawContainer,
): ParsedUtsStudyPlanPeriod {
  const items:
    ParsedUtsStudyPlanItem[] = [];

  if (
    Array.isArray(
      period.relationship,
    )
  ) {
    for (
      const rawRelationship
      of period.relationship
    ) {
      if (
        !isRecord(
          rawRelationship,
        )
      ) {
        continue;
      }

      const item =
        parseRelationship(
          rawRelationship as RawRelationship,
        );

      if (item) {
        items.push(
          item,
        );
      }
    }
  }

  items.sort(
    compareByOrder,
  );

  return {
    name:
      stringValue(
        period.name,
      ) ?? '',

    order:
      numberValue(
        period.order,
      ),

    items,
  };
}

function parseRelationship(
  relationship: RawRelationship,
): ParsedUtsStudyPlanItem | undefined {
  const details =
    relationship.ai_details;

  if (!details) {
    return undefined;
  }

  const custom =
    details.custom_ai === true ||
    details.custom_ai === 'true';

  const title =
    stringValue(
      details.title,
    );

  if (!title) {
    return undefined;
  }

  const code =
    stringValue(
      details.code,
    );

  const url =
    stringValue(
      details.academic_item_url,
    );

  return {
    type:
      custom
        ? 'CHOICE'
        : 'SUBJECT',

    code:
      code || undefined,

    title,

    creditPoints:
      numberValue(
        details.credit_points,
      ),

    url:
      url || undefined,

    custom,

    order:
      numberValue(
        relationship.order,
      ),

    numberOfPeriods:
      numberValue(
        relationship.number_of_periods,
      ),
  };
}

function compareByOrder(
  a: {
    order?: number;
  },
  b: {
    order?: number;
  },
): number {
  return (
    (a.order ?? 0) -
    (b.order ?? 0)
  );
}

function stringValue(
  value: unknown,
): string | undefined {
  if (
    typeof value !==
    'string'
  ) {
    return undefined;
  }

  const trimmed =
    value.trim();

  return trimmed || undefined;
}

function numberValue(
  value: unknown,
): number | undefined {
  if (
    typeof value ===
    'number'
  ) {
    return Number.isFinite(
      value,
    )
      ? value
      : undefined;
  }

  if (
    typeof value !==
    'string'
  ) {
    return undefined;
  }

  if (
    value.trim() === ''
  ) {
    return undefined;
  }

  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : undefined;
}

function isRecord(
  value: unknown,
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value,
    )
  );
}