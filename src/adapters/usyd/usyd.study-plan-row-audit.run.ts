import {
  writeUsydStudyPlanRowAuditV2,
} from './usyd.study-plan-row-audit';

writeUsydStudyPlanRowAuditV2()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
