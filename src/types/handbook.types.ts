export type ComponentType =
  | 'MAJOR'
  | 'MINOR'
  | 'SUB_MAJOR'
  | 'STREAM'
  | 'SPECIALISATION'
  | 'MAJOR_EXTENSION'
  | 'CHOICE_BLOCK'
  | 'ELECTIVE_POOL'
  | 'GENERAL_EDUCATION'
  | 'CAPSTONE'
  | 'HONOURS'
  | 'PLACEMENT'
  | 'OTHER';

export type RequirementType =
  | 'CORE'
  | 'MAJOR_CORE'
  | 'DISCIPLINE_ELECTIVE'
  | 'FREE_ELECTIVE'
  | 'GENERAL_EDUCATION'
  | 'TRANSDISCIPLINARY'
  | 'CAPSTONE'
  | 'PLACEMENT'
  | 'OTHER';

export type RequisiteType =
  | 'PREREQUISITE'
  | 'COREQUISITE'
  | 'EXCLUSION';

export interface University {
  id: string;
  name: string;
  shortName: string;
}

export interface Degree {
  id: string;

  universityId: string;
  handbookYear: number;

  code: string;
  name: string;

  awardType?: string;
  faculty?: string;
  studyArea?: string;

  durationYears?: number;
  totalCreditPoints?: number;

  sourceUrl: string;

  components: string[];
  requirementGroups: string[];
}

export interface Component {
  id: string;

  universityId: string;
  handbookYear: number;

  code?: string;
  name: string;

  originalType: string;
  normalizedType: ComponentType;

  creditPoints?: number;

  sourceUrl: string;
}

export interface Subject {
  id: string;

  universityId: string;
  handbookYear: number;

  code: string;
  name: string;

  creditPoints?: number;

  description?: string;

  sourceUrl: string;

  requisites: string[];
}

export interface RequirementGroup {
  id: string;

  degreeId?: string;
  componentId?: string;

  name: string;

  requirementType: RequirementType;

  logic: 'ALL' | 'ANY' | 'ONE_OF';

  minCreditPoints?: number;
  maxCreditPoints?: number;

  minItems?: number;
  maxItems?: number;

  items: RequirementItem[];

  rawRuleText?: string;
}

export interface RequirementItem {
  subjectId?: string;
  componentId?: string;
  requirementGroupId?: string;

  creditPoints?: number;

  required?: boolean;
}

export interface Requisite {
  id: string;

  subjectId: string;

  type: RequisiteType;

  relatedSubjectIds: string[];

  rawRuleText: string;

  logic?: 'AND' | 'OR' | 'COMPLEX';
}

export interface StudyPlanItem {
  subjectId?: string;
  requirementGroupId?: string;

  year: number;

  term?: string;

  order: number;

  notes?: string;
}

export interface StudyPlan {
  id: string;

  degreeId: string;
  componentId?: string;

  handbookYear: number;

  sourceType: 'HTML' | 'PDF';

  sourceUrl: string;

  items: StudyPlanItem[];
}

export interface HandbookDataset {
  universities: University[];

  degrees: Degree[];

  components: Component[];

  subjects: Subject[];

  requirementGroups: RequirementGroup[];

  requisites: Requisite[];

  studyPlans: StudyPlan[];
}