import {
  writeUsydUnqualifiedTableAChoicePools,
} from './usyd.unqualified-table-a-choice-pool-builder';

writeUsydUnqualifiedTableAChoicePools()
  .catch(
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
