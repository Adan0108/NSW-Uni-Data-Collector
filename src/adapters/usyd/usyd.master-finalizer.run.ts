import {
  writeUsydFinalMasterV1,
} from './usyd.master-finalizer';

writeUsydFinalMasterV1()
  .catch(
    (
      error,
    ) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
