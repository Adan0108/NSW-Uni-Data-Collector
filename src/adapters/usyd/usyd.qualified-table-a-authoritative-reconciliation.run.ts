import {
  writeUsydQualifiedTableAReconciliation,
} from './usyd.qualified-table-a-authoritative-reconciliation';

writeUsydQualifiedTableAReconciliation()
  .catch(
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );
