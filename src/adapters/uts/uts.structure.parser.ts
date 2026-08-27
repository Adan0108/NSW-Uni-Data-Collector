export interface ParsedStructureSubject {
  code: string;
  name: string;
  creditPoints?: number;
  url?: string;
  order?: number;
}

export interface ParsedStructureItem {
  type: string;

  code?: string;
  name?: string;

  creditPoints?: number;

  url?: string;
  order?: number;
}

export interface ParsedRequirementGroup {
  /**
   * CourseLoop container ID.
   *
   * Important because two groups can have
   * the same title but represent different
   * requirement branches.
   */
  id?: string;

  title: string;

  description?: string;

  logic:
    | 'ALL'
    | 'ANY'
    | 'ONE_OF'
    | 'UNKNOWN';

  requiredCreditPoints?: number;

  maximumCreditPoints?: number;

  items: ParsedStructureItem[];

  subjects: ParsedStructureSubject[];

  children: ParsedRequirementGroup[];

  order?: number;
}

export interface ParsedCurriculumStructure {
  code?: string;

  name?: string;

  creditPoints?: number;

  groups: ParsedRequirementGroup[];
}

/*
 * --------------------------------------------------
 * Raw CourseLoop types
 * --------------------------------------------------
 */

interface RawAcademicItemType {
  label?: string | null;
  value?: string | null;
}

interface RawConnector {
  label?: string | null;
  value?: string | null;
}

interface RawRelationship {
  parent_connector?: RawConnector;

  academic_item_type?: RawAcademicItemType;

  academic_item_code?: string;

  academic_item_name?: string;

  academic_item_credit_points?: string;

  academic_item_url?: string;

  order?: string;
}

interface RawContainer {
  cl_id?: string;

  title?: string;

  description?: string;

  credit_points?: string;

  credit_points_max?: string;

  order?: string;

  parent_connector?: RawConnector;

  vertical_grouping?: {
    label?: string | null;
    value?: string | null;
  };

  relationship?: RawRelationship[];

  container?: RawContainer[];
}

interface RawCurriculumStructure {
  cl_id?: {
    value?: string;
  };

  name?: string;

  credit_points?: string;

  container?: RawContainer[];
}

/*
 * --------------------------------------------------
 * Main parser
 * --------------------------------------------------
 */

export function parseUtsCurriculumStructure(
  rawJson: string,
): ParsedCurriculumStructure {
  const raw =
    JSON.parse(
      rawJson,
    ) as RawCurriculumStructure;

  const groups =
    (raw.container ?? [])
      .map(parseContainer)
      .sort(
        (a, b) =>
          (a.order ?? 0) -
          (b.order ?? 0),
      );

  return {
    code:
      raw.cl_id?.value,

    name:
      raw.name?.trim(),

    creditPoints:
      toNumber(
        raw.credit_points,
      ),

    groups,
  };
}

/*
 * --------------------------------------------------
 * Recursive container parser
 * --------------------------------------------------
 */

function parseContainer(
  container: RawContainer,
): ParsedRequirementGroup {
  const relationships =
    container.relationship ?? [];

  const items =
    relationships
      .map(parseRelationship)
      .filter(
        (
          item,
        ): item is ParsedStructureItem =>
          item !== undefined,
      )
      .sort(
        (a, b) =>
          (a.order ?? 0) -
          (b.order ?? 0),
      );

  const subjects =
    items
      .filter(
        (item) =>
          item.type === 'subject' &&
          item.code,
      )
      .map((item) => ({
        code:
          item.code as string,

        name:
          item.name ?? '',

        creditPoints:
          item.creditPoints,

        url:
          item.url,

        order:
          item.order,
      }));

  const children =
    (container.container ?? [])
      .map(parseContainer)
      .sort(
        (a, b) =>
          (a.order ?? 0) -
          (b.order ?? 0),
      );

  return {
    id:
      container.cl_id,

    title:
      container.title?.trim() ??
      'Unnamed requirement',

    description:
      container.description?.trim(),

    logic:
      detectContainerLogic(
        container,
      ),

    requiredCreditPoints:
      toNumber(
        container.credit_points,
      ),

    maximumCreditPoints:
      toNumber(
        container.credit_points_max,
      ),

    items,

    subjects,

    children,

    order:
      toNumber(
        container.order,
      ),
  };
}

/*
 * --------------------------------------------------
 * Relationship parser
 * --------------------------------------------------
 */

function parseRelationship(
  relationship: RawRelationship,
): ParsedStructureItem | undefined {
  const type =
    relationship
      .academic_item_type
      ?.value;

  if (!type) {
    return undefined;
  }

  return {
    type,

    code:
      relationship
        .academic_item_code
        ?.trim(),

    name:
      relationship
        .academic_item_name
        ?.trim(),

    creditPoints:
      toNumber(
        relationship
          .academic_item_credit_points,
      ),

    url:
      relationship
        .academic_item_url,

    order:
      toNumber(
        relationship.order,
      ),
  };
}

/*
 * --------------------------------------------------
 * Requirement logic
 * --------------------------------------------------
 */

function detectContainerLogic(
  container: RawContainer,
):
  | 'ALL'
  | 'ANY'
  | 'ONE_OF'
  | 'UNKNOWN' {
  const description =
    container.description
      ?.toLowerCase()
      .trim() ?? '';

  if (
    description.includes(
      'complete all',
    )
  ) {
    return 'ALL';
  }

  if (
    description.includes(
      'select one',
    ) ||
    description.includes(
      'choose one',
    ) ||
    description.includes(
      'complete one',
    )
  ) {
    return 'ONE_OF';
  }

  if (
    description.includes('select') &&
    description.includes('from')
  ) {
    return 'ANY';
  }

  if (
    description.includes(
      'choose from',
    ) ||
    description.includes(
      'complete any',
    )
  ) {
    return 'ANY';
  }

  const connector =
    container
      .parent_connector
      ?.value;

  if (connector === 'OR') {
    return 'ANY';
  }

  if (connector === 'AND') {
    return 'ALL';
  }

  return 'UNKNOWN';
}

/*
 * --------------------------------------------------
 * Helper
 * --------------------------------------------------
 */

function toNumber(
  value?: string,
): number | undefined {
  if (
    value === undefined ||
    value === null ||
    value.trim() === ''
  ) {
    return undefined;
  }

  const number =
    Number(value);

  return Number.isNaN(number)
    ? undefined
    : number;
}