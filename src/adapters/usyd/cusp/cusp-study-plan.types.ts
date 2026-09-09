export type CuspSubjectReference = {
  code: string;
  name: string;
  sourceUrl: string;
};

export type CuspStudyPlanItem = {
  position: number;
  requirementLabel: string | null;
  requirementSourceId: string | null;
  creditPoints: number | null;

  // A row may contain one fixed unit or multiple possible units.
  subjects: CuspSubjectReference[];

  rawText: string;
};

export type CuspStudyPlanPeriod = {
  yearNumber: number;
  periodName: string;
  title: string;
  notes: string[];
  items: CuspStudyPlanItem[];
};

export type CuspStudyPlan = {
  source: "USYD_CUSP";
  sourceUrl: string;

  // CUSP identifiers, not your Prisma database IDs.
  cuspDegreeVersionId: string;
  cuspDegreeId: string | null;
  cuspDegreeName: string | null;
  cuspStreamId: string | null;
  commencementYear: number | null;

  title: string;
  variantTitle: string | null;
  underReview: boolean;

  periods: CuspStudyPlanPeriod[];
  collectedAt: string;
};

export type CuspCollectionFile = {
  schemaVersion: "1.0";
  universityCode: "USYD";
  handbookYear: number;
  collectedAt: string;
  plans: CuspStudyPlan[];
};
