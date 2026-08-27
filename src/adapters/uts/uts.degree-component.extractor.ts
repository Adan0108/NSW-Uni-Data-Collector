import type {
  ParsedCurriculumStructure,
  ParsedRequirementGroup,
  ParsedStructureItem,
} from './uts.structure.parser.js';

export type ExtractedComponentType =
  | 'MAJOR'
  | 'MINOR'
  | 'SUB_MAJOR'
  | 'MAJOR_EXTENSION'
  | 'STREAM'
  | 'SPECIALISATION'
  | 'OTHER';

export interface ExtractedDegreeComponent {
  degreeCode: string;

  componentCode: string;

  componentName: string;

  componentType:
    ExtractedComponentType;

  requiredCreditPoints?: number;

  parentGroup: string;

  /**
   * Human-readable hierarchy.
   */
  path: string[];

  /**
   * CourseLoop container hierarchy.
   *
   * This is safer than using names alone
   * because different branches may share
   * the same title.
   */
  containerPath: string[];

  order?: number;
}

export function extractDegreeComponents(
  degreeCode: string,
  structure: ParsedCurriculumStructure,
): ExtractedDegreeComponent[] {
  const results:
    ExtractedDegreeComponent[] = [];

  for (const group of structure.groups) {
    walkGroup(
      degreeCode,
      group,
      [],
      [],
      results,
    );
  }

  return results;
}

function walkGroup(
  degreeCode: string,
  group: ParsedRequirementGroup,
  parentPath: string[],
  parentContainerPath: string[],
  results: ExtractedDegreeComponent[],
): void {
  const currentPath = [
    ...parentPath,
    group.title,
  ];

  const currentContainerPath = [
    ...parentContainerPath,
    group.id ??
      `${group.title}:${group.order ?? 0}`,
  ];

  for (const item of group.items) {
    if (!item.code) {
      continue;
    }

    const normalizedType =
      normalizeComponentType(
        item,
        group,
      );

    if (!normalizedType) {
      continue;
    }

    results.push({
      degreeCode,

      componentCode:
        item.code,

      componentName:
        item.name ?? '',

      componentType:
        normalizedType,

      requiredCreditPoints:
        item.creditPoints,

      parentGroup:
        group.title,

      path:
        currentPath,

      containerPath:
        currentContainerPath,

      order:
        item.order,
    });
  }

  for (const child of group.children) {
    walkGroup(
      degreeCode,
      child,
      currentPath,
      currentContainerPath,
      results,
    );
  }
}

function normalizeComponentType(
  item: ParsedStructureItem,
  group: ParsedRequirementGroup,
):
  | ExtractedComponentType
  | undefined {
  /*
   * UTS represents Business Major Extensions
   * using the underlying CourseLoop
   * "sub_major" type.
   *
   * We preserve the source type elsewhere,
   * but normalize it for our database.
   */
  if (
    item.type === 'sub_major' &&
    group.title
      .toLowerCase()
      .includes('major extension')
  ) {
    return 'MAJOR_EXTENSION';
  }

  switch (item.type) {
    case 'major':
      return 'MAJOR';

    case 'minor':
      return 'MINOR';

    case 'sub_major':
      return 'SUB_MAJOR';

    case 'stream':
      return 'STREAM';

    case 'specialisation':
      return 'SPECIALISATION';

    /*
     * Subjects belong to requirement
     * relationships, not degree_components.
     */
    case 'subject':
      return undefined;

    default:
      return 'OTHER';
  }
}