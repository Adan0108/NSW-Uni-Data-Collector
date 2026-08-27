export interface UtsQueryParam {
  queryField: string;
  queryValue: string;
}

export interface UtsApiRequest {
  siteId: string;
  contentType: string;

  queryParams: UtsQueryParam[];

  offset: number;
  limit: number;
}

export interface UtsApiItem {
  data: string;

  publishDate?: string;

  studyLevel?: string;

  inode?: string;

  CurriculumStructure?: string;

  /*
   * CourseLoop browse metadata.
   *
   * These fields live outside the JSON
   * contained in "data".
   */
  educationalArea?: string;

  educationalAreaDisplay?: string;

  studyLevelRefDisplay?: string;

  code?: string;

  name?: string;

  title?: string;

  contentType?: string;

  availableInYears?: string;
}

export interface UtsApiResponse {
  data: {
    data: UtsApiItem[];
    count: number;
  };
}

export interface UtsAcademicItem {
  code?: string;

  title?: string;

  search_title?: string;

  implementation_year?: string;

  study_level_ref?: string;

  educational_area?: string;

  academic_item_type?: string;

  type_ref?: string;

  credit_points?: string;

  version_name?: string;

  description?: string;

  additional_information?: string;

  study_plans?: unknown[];

  [key: string]: unknown;
}