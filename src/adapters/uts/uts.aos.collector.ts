import {
  fetchAllUtsItems,
  parseAcademicItem,
} from './uts.api.js';

import {
  parseUtsCurriculumStructure,
} from './uts.structure.parser.js';

export interface CollectedUtsAos {
  code: string;
  name: string;
  type: string;
  creditPoints?: number;
  year?: string;
  area?: string;
  structure?: ReturnType<
    typeof parseUtsCurriculumStructure
  >;
}

export async function collectUtsAos(params: {
  educationalAreaId: string;
  studyLevelId: string;
  year: string;
  level: string;
}): Promise<CollectedUtsAos[]> {
  const items = await fetchAllUtsItems({
    contentType: 'aos',

    queryParams: [
      {
        queryField: 'educationalArea',
        queryValue:
          params.educationalAreaId,
      },
      {
        queryField: 'implementationYear',
        queryValue:
          params.year,
      },
      {
        queryField: 'studyLevel',
        queryValue:
          params.studyLevelId,
      },
      {
        queryField: 'level',
        queryValue:
          params.level,
      },
    ],
  });

  return items.map((raw) => {
    const item =
      parseAcademicItem(raw);

    return {
      code:
        item.code ?? '',

      name:
        item.search_title ??
        item.title ??
        '',

      type:
        item.academic_item_type ??
        params.level,

      creditPoints:
        item.credit_points
          ? Number(item.credit_points)
          : undefined,

      year:
        item.implementation_year,

      area:
        item.educational_area,

      structure:
        raw.CurriculumStructure
          ? parseUtsCurriculumStructure(
              raw.CurriculumStructure,
            )
          : undefined,
    };
  });
}