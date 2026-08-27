import {
  writeUsydRequisiteFreezeV1,
} from './usyd.requisite-freeze';

writeUsydRequisiteFreezeV1()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
