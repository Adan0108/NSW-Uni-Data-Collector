import {
  mergeUsydComponentCatalog,
} from './usyd.component-catalog-merge';

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
    'USYD COMPONENT CATALOG MERGE AUDIT',
  );

  divider();

  const result =
    await mergeUsydComponentCatalog();

  console.log(
    `Base components: ${result.baseComponentCount}`,
  );

  console.log(
    `Supplemental components: ${result.supplementalComponentCount}`,
  );

  console.log(
    `Merged components: ${result.totalComponentCount}`,
  );

  console.log(
    `Duplicate keys: ${result.duplicateKeys.length}`,
  );

  const failures:
    string[] =
    [];

  if (
    result.baseComponentCount !==
    358
  ) {
    failures.push(
      `Expected 358 base components, got ${result.baseComponentCount}.`,
    );
  }

  if (
    result.supplementalComponentCount !==
    9
  ) {
    failures.push(
      `Expected 9 supplemental components, got ${result.supplementalComponentCount}.`,
    );
  }

  if (
    result.totalComponentCount !==
    367
  ) {
    failures.push(
      `Expected 367 merged components, got ${result.totalComponentCount}.`,
    );
  }

  if (
    result.duplicateKeys.length !==
    0
  ) {
    failures.push(
      `Duplicate handbook/type/name keys found: ${result.duplicateKeys.join(', ')}`,
    );
  }

  divider();

  if (
    failures.length >
    0
  ) {
    console.log(
      'RESULT: FAIL',
    );

    for (
      const failure
      of failures
    ) {
      console.log(
        `- ${failure}`,
      );
    }

    process.exitCode =
      1;

    return;
  }

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'COMPONENT CATALOG MERGE: CLEAN',
  );

  console.log(
    'NEXT: write the 367-component merged catalogue and rerun component-role coverage against it.',
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
