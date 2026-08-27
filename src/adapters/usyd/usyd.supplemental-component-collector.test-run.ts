import {
  collectUsydSupplementalComponents,
} from './usyd.supplemental-component-collector';

const EXPECTED_COMPONENTS =
  9;

const EXPECTED_KEYS =
  new Set(
    [
      'ARTS|MINOR|Sociology',
      'ARTS|PROGRAM|Economics',

      'ARTS|MAJOR|International Studies',

      'CONSERVATORIUM|MAJOR|Musicology',

      'MEDICINE_HEALTH|MAJOR|Exercise Science',

      'MEDICINE_HEALTH|MINOR|Physical Activity and Health',
      'MEDICINE_HEALTH|MAJOR|Physical Activity and Health',

      'MEDICINE_HEALTH|MINOR|Disability and Participation',
      'MEDICINE_HEALTH|MAJOR|Disability and Participation',
    ],
  );

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
    'USYD SUPPLEMENTAL COMPONENT COLLECTOR AUDIT',
  );

  divider();

  const result =
    await collectUsydSupplementalComponents();

  console.log(
    `Source named evidence: ${result.sourceNamedEvidenceCount}`,
  );

  console.log(
    `Unique supplemental components: ${result.uniqueSupplementalComponents}`,
  );

  console.log(
    `Missing-role components: ${result.countsByReason.missingRole}`,
  );

  console.log(
    `Missing-family components: ${result.countsByReason.missingFamily}`,
  );

  console.log(
    `Other-handbook-localised components: ${result.countsByReason.onlyOtherHandbook}`,
  );

  divider();

  console.log(
    'SUPPLEMENTAL COMPONENTS',
  );

  divider();

  const actualKeys =
    new Set<string>();

  for (
    const component
    of result.components
  ) {
    const key =
      `${component.handbook}|${component.type}|${component.name}`;

    actualKeys.add(
      key,
    );

    console.log(
      key,
    );

    console.log(
      `  CP: ${component.requiredCreditPoints ?? 'NULL'}`,
    );

    console.log(
      `  Reason: ${component.evidenceKind}`,
    );

    console.log(
      `  Evidence records: ${component.evidence.length}`,
    );

    for (
      const evidence
      of component.evidence
    ) {
      console.log(
        `    ${evidence.degreeCode} — ${evidence.degreeTitle}`,
      );
    }
  }

  divider();

  const failures:
    string[] =
    [];

  if (
    result.uniqueSupplementalComponents !==
    EXPECTED_COMPONENTS
  ) {
    failures.push(
      `Expected ${EXPECTED_COMPONENTS} supplemental components, got ${result.uniqueSupplementalComponents}.`,
    );
  }

  for (
    const key
    of EXPECTED_KEYS
  ) {
    if (
      !actualKeys.has(
        key,
      )
    ) {
      failures.push(
        `Missing expected supplemental component: ${key}`,
      );
    }
  }

  for (
    const key
    of actualKeys
  ) {
    if (
      !EXPECTED_KEYS.has(
        key,
      )
    ) {
      failures.push(
        `Unexpected supplemental component: ${key}`,
      );
    }
  }

  const missingCp =
    result.components.filter(
      (
        component,
      ) =>
        component.requiredCreditPoints ===
        null,
    );

  if (
    missingCp.length >
    0
  ) {
    failures.push(
      `Supplemental components missing CP: ${missingCp.map((item) => `${item.handbook}/${item.type}/${item.name}`).join(', ')}`,
    );
  }

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
    'SUPPLEMENTAL COMPONENT SET: CLEAN',
  );

  console.log(
    'NEXT: write the supplemental dataset, then merge these 9 evidence-backed records into the canonical component catalogue before creating degree-component relationships.',
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
