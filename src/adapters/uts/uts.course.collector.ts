import {
  fetchAllUtsItems,
  parseAcademicItem,
} from './uts.api.js';

import {
  parseUtsCurriculumStructure,
} from './uts.structure.parser.js';

export interface CollectedUtsCourse {
  code: string;
  name: string;
  creditPoints?: number;
  year?: string;
  area?: string;
  areaId?: string;
  studyLevel?: string;

  studyPlans?: unknown[];

  structure?: ReturnType<
    typeof parseUtsCurriculumStructure
  >;

  /*
   * Preserve the complete parsed
   * CourseLoop course record.
   *
   * This is useful later for:
   * - course descriptions
   * - career information
   * - accreditation
   * - duration
   * - entry information
   * - learning outcomes
   * - study plans
   */
  raw: ReturnType<
    typeof parseAcademicItem
  >;
}

export async function collectUtsCourses(
  year: string,
): Promise<CollectedUtsCourse[]> {
  const items =
    await fetchAllUtsItems({
      contentType: 'course',

      queryParams: [
        {
          queryField:
            'implementationYear',

          queryValue:
            year,
        },
        {
          queryField:
            'studyLevel',

          queryValue:
            '0c2074dcdb6afc5087f743ea13961960',
        },
      ],

      /*
       * Course records are large.
       *
       * A page size of 100 caused
       * CourseLoop to return 502.
       */
      pageSize: 10,
    });

  return items.map((raw) => {
    const item =
      parseAcademicItem(raw);

    return {
      code:
        item.code ?? '',

      name:
        item.title ??
        item.search_title ??
        '',

      creditPoints:
        item.credit_points
          ? Number(
              item.credit_points,
            )
          : undefined,

      year:
        item.implementation_year,

      area:
        raw.educationalAreaDisplay ??
        item.educational_area,

      areaId:
        raw.educationalArea,

      studyLevel:
        item.study_level_ref,

      studyPlans:
        item.study_plans,

      structure:
        raw.CurriculumStructure
          ? parseUtsCurriculumStructure(
              raw.CurriculumStructure,
            )
          : undefined,

      raw:
        item,
    };
  });
}