import {
  writeUsydStudyPlanRelevanceAuditV2,
} from './usyd.study-plan-relevance-audit';

writeUsydStudyPlanRelevanceAuditV2()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
