import {
  auditUsydTableSRoleEligibility,
} from './usyd.table-s-role-eligibility-audit';

function divider():
void {
  console.log(
    '================================',
  );
}

async function main():
Promise<void> {
  divider();

  console.log(
    'USYD TABLE S ROLE ELIGIBILITY AUDIT',
  );

  divider();

  const result =
    await auditUsydTableSRoleEligibility();

  console.log(
    `Table S role-gap groups: ${result.counts.tableSRoleGapGroups}`,
  );

  console.log(
    `Requested missing types: ${result.requestedMissingTypes.join(', ') || 'NONE'}`,
  );

  console.log(
    `Table S component families: ${result.counts.tableSComponentFamilies}`,
  );

  console.log(
    `Families with multiple source records: ${result.counts.familiesWithMultipleSourceRecords}`,
  );

  divider();

  console.log(
    'DEGREE ROLE GAPS',
  );

  divider();

  for (
    const gap
    of result.degreeRoleGaps
  ) {
    console.log(
      `${gap.degreeCode} — ${gap.degreeTitle}`,
    );

    console.log(
      `  Requested: ${gap.requestedTypes.join(', ')}`,
    );
  }

  divider();

  console.log(
    'TABLE S FAMILY SOURCE AUDIT',
  );

  divider();

  for (
    const family
    of result.families
  ) {
    console.log(
      `${family.name}`,
    );

    console.log(
      `  Existing types: ${family.existingTypes.join(', ')}`,
    );

    console.log(
      `  Missing requested types: ${family.requestedMissingTypes.join(', ') || 'NONE'}`,
    );

    console.log(
      `  Source records: ${family.sourceRecordCount}`,
    );

    if (
      family.overviewUrls.length >
      0
    ) {
      console.log(
        `  Overview: ${family.overviewUrls.join(' | ')}`,
      );
    }

    if (
      family.tableUrls.length >
      0
    ) {
      console.log(
        `  Tables: ${family.tableUrls.join(' | ')}`,
      );
    }

    console.log(
      '  Auto-create role: NO',
    );

    console.log('');
  }

  divider();

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'STATUS: SOURCE ELIGIBILITY REVIEW REQUIRED',
  );

  console.log(
    'NEXT: use each subject-area source page to determine whether MINOR/PROGRAM is actually offered. Do not clone all Table S majors into minors.',
  );
}

main().catch(
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
