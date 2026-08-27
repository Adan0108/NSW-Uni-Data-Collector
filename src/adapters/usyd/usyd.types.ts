export interface UsydUnitAccessConditions {
  prerequisite: string | null;
  corequisite: string | null;
  prohibition: string | null;
  assumedKnowledge: string | null;
}

export interface UsydUnitAvailability {
  session: string;
  year: number;
  mode: string | null;
  location: string | null;
  outlineUrl: string | null;
}

export interface UsydUnit {
  code: string;
  name: string;
  year: number;
  studyLevel: string | null;
  academicUnit: string | null;
  managingFaculty: string | null;
  creditPoints: number | null;
  description: string | null;
  accessConditions: UsydUnitAccessConditions;
  availabilities: UsydUnitAvailability[];
  learningOutcomes: string[];
  sourceUrl: string;
}

export type UsydComponentType =
  | 'MAJOR'
  | 'MINOR'
  | 'PROGRAM'
  | 'STREAM'
  | 'OTHER';

export type UsydRequirementLogic =
  | 'ALL'
  | 'ANY'
  | 'UNKNOWN';

export type UsydFormalRequirementKind =
  | 'CORE'
  | 'SELECTIVE'
  | 'INTERDISCIPLINARY_PROJECT'
  | 'METHODOLOGY'
  | 'APPLICATION'
  | 'UNITS'
  | 'COMBINED'
  | 'OTHER';

export type UsydReferencedComponentType =
  | 'MAJOR'
  | 'PROGRAM'
  | 'STREAM';

export type UsydComponentReferenceLogic =
  | 'ALL'
  | 'ONE_OF';

export interface UsydComponentReference {
  type: UsydReferencedComponentType;
  name: string;
  requiredCreditPoints: number;
}

export interface UsydComponentReferenceRule {
  logic: UsydComponentReferenceLogic;
  requiredCreditPoints: number;
  components: UsydComponentReference[];
}

export interface UsydRequirementUnit {
  code: string;
  name: string;
  creditPoints: number | null;
  prerequisite: string | null;
  corequisite: string | null;
  prohibition: string | null;
  assumedKnowledge: string | null;
  sourceUrl: string | null;
}

export interface UsydRequirementGroup {
  name: string;
  level: number | null;
  logic: UsydRequirementLogic;
  requiredCreditPoints: number | null;
  units: UsydRequirementUnit[];
}

export interface UsydRequirementCondition {
  componentType: 'STREAM';
  componentName: string;
}

export interface UsydConditionalRequirementBranch {
  condition: UsydRequirementCondition | null;
  rawText: string;
  requirementGroup: UsydRequirementGroup;
}

export interface UsydConditionalRequirementRule {
  requiredCreditPoints: number | null;
  branches: UsydConditionalRequirementBranch[];
}

export interface UsydFormalRequirement {
  order: number;
  rawText: string;
  requiredCreditPoints: number | null;
  level: number | null;
  groupKind: UsydFormalRequirementKind;
  componentReferenceRule?: UsydComponentReferenceRule | null;
  conditionalRule?: UsydConditionalRequirementRule | null;
  subrules: string[];
  notes: string[];
}

export interface UsydComponentRequirement {
  name: string;
  type: UsydComponentType;
  requiredCreditPoints: number | null;
  summary: string | null;
  formalRequirements: UsydFormalRequirement[];
  requirementGroups: UsydRequirementGroup[];
}

export interface UsydSubjectAreaTable {
  name: string;
  tableName: string | null;
  year: number;
  components: UsydComponentRequirement[];
  sourceUrl: string;
}