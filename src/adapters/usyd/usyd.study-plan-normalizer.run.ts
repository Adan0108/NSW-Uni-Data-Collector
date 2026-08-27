import {
  writeUsydStudyPlanNormalizedV1,
} from './usyd.study-plan-normalizer';

writeUsydStudyPlanNormalizedV1()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
