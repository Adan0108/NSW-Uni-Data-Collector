import {
  writeUsydDegreeRequirementSemanticAudit,
} from './usyd.degree-requirement-semantic-audit';

writeUsydDegreeRequirementSemanticAudit()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
