import {
  writeUsydDegreeRequirementSourceHierarchyV1,
} from './usyd.degree-requirement-source-hierarchy';

writeUsydDegreeRequirementSourceHierarchyV1()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
