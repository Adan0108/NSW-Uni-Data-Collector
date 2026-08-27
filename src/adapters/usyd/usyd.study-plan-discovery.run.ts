import {
  writeUsydStudyPlanDiscoveryV2,
} from './usyd.study-plan-discovery';

writeUsydStudyPlanDiscoveryV2()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
