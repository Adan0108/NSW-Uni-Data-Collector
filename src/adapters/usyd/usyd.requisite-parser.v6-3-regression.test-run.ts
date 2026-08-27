import {
  formatUsydRequisiteTree,
  parseUsydRequisite,
} from './usyd.requisite-parser';

function assert(
  condition: boolean,
  message: string,
): void {
  if (
    !condition
  ) {
    throw new Error(
      message,
    );
  }
}

function divider():
void {
  console.log(
    '================================',
  );
}

function main():
void {
  divider();

  console.log(
    'USYD REQUISITE V6.3 TARGETED REGRESSION',
  );

  divider();

  const phys4036 =
    parseUsydRequisite(
      '144 credit points of units of study including 6 credit points of (PHYS3X34 or PHYS3X90 or PHYS3991) and 6 credit points of (PHYS3X42 or PHYS3X43 or PHYS3X44)',
    );

  assert(
    !!phys4036,
    'PHYS4036 parse returned null.',
  );

  assert(
    phys4036?.containsUnparsedText ===
      false,
    'PHYS4036 must contain no TEXT fallback after V6.3.',
  );

  assert(
    JSON.stringify(
      phys4036?.unitPatterns,
    ) ===
      JSON.stringify([
        'PHYS3X34',
        'PHYS3X42',
        'PHYS3X43',
        'PHYS3X44',
        'PHYS3X90',
      ]),
    `Unexpected PHYS4036 wildcard references: ${JSON.stringify(phys4036?.unitPatterns)}`,
  );

  assert(
    JSON.stringify(
      phys4036?.unitCodes,
    ) ===
      JSON.stringify([
        'PHYS3991',
      ]),
    `Unexpected PHYS4036 exact references: ${JSON.stringify(phys4036?.unitCodes)}`,
  );

  console.log(
    'PASS: PHYS4036 nested 144cp + two 6cp inclusions',
  );

  console.log(
    formatUsydRequisiteTree(
      phys4036?.root ??
        null,
    ),
  );

  divider();

  const theatreCases = [
    {
      code:
        'PRFM2608',

      raw:
        '12 credit points at 1000 level in Theatre and Performance Studies including PRFM1601',

      requiredUnit:
        'PRFM1601',
    },
    {
      code:
        'PRFM3622',

      raw:
        '12 credit points in 2000 level Theatre and Performance Studies including PRFM2601',

      requiredUnit:
        'PRFM2601',
    },
    {
      code:
        'PRFM3624',

      raw:
        '12 credit points in 2000 level Theatre and Performance Studies including PRFM2601',

      requiredUnit:
        'PRFM2601',
    },
  ];

  for (
    const testCase
    of theatreCases
  ) {
    const parsed =
      parseUsydRequisite(
        testCase.raw,
      );

    assert(
      !!parsed,
      `${testCase.code}: parser returned null.`,
    );

    assert(
      parsed?.containsUnparsedText ===
        false,
      `${testCase.code}: Theatre and Performance Studies must not split into TEXT.`,
    );

    assert(
      parsed?.normalizedText.includes(
        'Theatre and Performance Studies',
      ) ===
        true,
      `${testCase.code}: protected subject name was damaged during normalization.`,
    );

    assert(
      parsed?.unitCodes.includes(
        testCase.requiredUnit,
      ) ===
        true,
      `${testCase.code}: expected required unit ${testCase.requiredUnit}.`,
    );

    console.log(
      `PASS: ${testCase.code} keeps Theatre and Performance Studies intact`,
    );

    console.log(
      formatUsydRequisiteTree(
        parsed?.root ??
          null,
      ),
    );

    console.log('');
  }

  divider();

  console.log(
    'RESULT: PASS',
  );

  console.log(
    'V6.3 NARROW SEMANTIC FIXES: CLEAN',
  );

  console.log(
    'NEXT: rerun the full V6.2/V6.3 semantic invariant audit and verify the global 3011-unit / 3189-rule coverage remains unchanged.',
  );
}

main();
