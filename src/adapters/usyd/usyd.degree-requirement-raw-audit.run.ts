import {
  writeUsydDegreeRequirementRawAuditV1,
} from './usyd.degree-requirement-raw-audit';

writeUsydDegreeRequirementRawAuditV1()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
