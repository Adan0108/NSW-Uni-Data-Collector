import {
  writeUsydDegreeRootSemanticsV2,
} from './usyd.degree-root-semantics';

writeUsydDegreeRootSemanticsV2()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
