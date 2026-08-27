import {
  writeUsydDegreeComponentFinalMerge,
} from './usyd.degree-component-final-merge';

writeUsydDegreeComponentFinalMerge()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
