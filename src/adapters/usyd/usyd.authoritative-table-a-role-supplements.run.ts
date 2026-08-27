import {
  writeUsydAuthoritativeTableARoleSupplements,
} from './usyd.authoritative-table-a-role-supplements';

writeUsydAuthoritativeTableARoleSupplements()
  .catch(
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
