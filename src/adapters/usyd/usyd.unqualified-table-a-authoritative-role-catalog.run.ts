import {
  writeUsydUnqualifiedTableAAuthoritativeRoles,
} from './usyd.unqualified-table-a-authoritative-role-catalog';

writeUsydUnqualifiedTableAAuthoritativeRoles()
  .catch(
    (error) => {
      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
