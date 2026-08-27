import {
  auditUsydTablePoolRoleGaps,
} from './usyd.table-pool-role-gap-audit';

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
    'USYD TABLE-POOL ROLE GAP AUDIT',
  );

  divider();

  const result =
    await auditUsydTablePoolRoleGaps();

  console.log(
    `Inspected Table A/S groups: ${result.counts.inspectedGroups}`,
  );

  console.log(
    `Has exact role candidates: ${result.counts.hasExactType}`,
  );

  console.log(
    `Role variant missing: ${result.counts.roleVariantMissing}`,
  );

  console.log(
    `No component pool: ${result.counts.noComponentPool}`,
  );

  console.log(
    `Likely false STREAM signals: ${result.counts.likelyFalseStreamSignal}`,
  );

  divider();

  console.log(
    'ROLE VARIANT MISSING',
  );

  divider();

  for (
    const gap
    of result.gaps.filter(
      (
        item,
      ) =>
        item.status ===
        'ROLE_VARIANT_MISSING',
    )
  ) {
    console.log(
      `${gap.degreeCode} — ${gap.degreeTitle}`,
    );

    console.log(
      `  Table: ${gap.tableName}`,
    );

    console.log(
      `  Requested types: ${gap.requestedTypes.join(', ')}`,
    );

    console.log(
      `  Same-pool other-type candidates: ${gap.samePoolOtherTypeCandidates.length}`,
    );

    for (
      const component
      of gap.samePoolOtherTypeCandidates.slice(
        0,
        20,
      )
    ) {
      console.log(
        `    [${component.index}] ${component.handbook}/${component.type}/${component.name}`,
      );
    }

    console.log('');
  }

  divider();

  console.log(
    'NO COMPONENT POOL',
  );

  divider();

  for (
    const gap
    of result.gaps.filter(
      (
        item,
      ) =>
        item.status ===
        'NO_COMPONENT_POOL',
    )
  ) {
    console.log(
      `${gap.degreeCode} — ${gap.degreeTitle}`,
    );

    console.log(
      `  Table: ${gap.tableName}`,
    );

    console.log(
      `  Requested types: ${gap.requestedTypes.join(', ')}`,
    );
  }

  divider();

  console.log(
    'LIKELY FALSE STREAM SIGNALS',
  );

  divider();

  for (
    const gap
    of result.gaps.filter(
      (
        item,
      ) =>
        item.status ===
        'LIKELY_FALSE_STREAM_SIGNAL',
    )
  ) {
    console.log(
      `${gap.degreeCode} — ${gap.degreeTitle}`,
    );

    console.log(
      `  Table: ${gap.tableName}`,
    );

    console.log(
      `  Requested types: ${gap.requestedTypes.join(', ')}`,
    );
  }

  divider();

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'STATUS: DIAGNOSTIC ONLY',
  );

  console.log(
    'NEXT: decide role expansion only for real Table A/S component pools; remove false Dalyell/stream signals separately.',
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
