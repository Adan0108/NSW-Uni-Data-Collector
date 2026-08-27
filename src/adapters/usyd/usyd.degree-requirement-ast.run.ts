import {
  writeUsydDegreeRequirementAstV2,
} from './usyd.degree-requirement-ast';

writeUsydDegreeRequirementAstV2()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
