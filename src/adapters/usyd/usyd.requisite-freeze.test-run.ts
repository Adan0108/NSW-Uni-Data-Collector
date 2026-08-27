import {
  buildUsydRequisiteFreezeV1,
} from './usyd.requisite-freeze';

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
    'USYD REQUISITE FINAL FREEZE V1',
  );

  divider();

  const result =
    await buildUsydRequisiteFreezeV1();

  console.log(
    `Units: ${result.counts.units}`,
  );

  console.log(
    `P/C/N rules: ${result.counts.rules}`,
  );

  console.log(
    `Authoritative structured: ${result.counts.authoritativeStructured}`,
  );

  console.log(
    `Safe raw fallback: ${result.counts.safeRawFallback}`,
  );

  console.log(
    `MUST_FIX: ${result.counts.mustFix}`,
  );

  console.log(
    `TEXT rules: ${result.counts.textRules}`,
  );

  console.log(
    `Missing raw text: ${result.counts.missingRawText}`,
  );

  console.log(
    `Missing root: ${result.counts.missingRoot}`,
  );

  console.log(
    `Duplicate rule keys: ${result.counts.duplicateRuleKeys}`,
  );

  console.log(
    `V6.3 target fallbacks: ${result.counts.v63TargetFallbacks}`,
  );

  divider();

  console.log(
    'SAFE RAW FALLBACK RULES',
  );

  divider();

  for (
    const record
    of result.records.filter(
      (item) =>
        item.classification ===
        'SAFE_RAW_FALLBACK',
    )
  ) {
    console.log(
      `${record.code} — ${record.name}`,
    );

    console.log(
      `Type: ${record.ruleType}`,
    );

    console.log(
      `Reasons: ${record.reasons.join(', ')}`,
    );

    console.log(
      `Raw: ${record.rawText}`,
    );

    console.log('');
  }

  const failures:
    string[] =
    [];

  if (
    result.counts.units !==
    3011
  ) {
    failures.push(
      `Expected 3011 units, got ${result.counts.units}.`,
    );
  }

  if (
    result.counts.rules !==
    3189
  ) {
    failures.push(
      `Expected 3189 rules, got ${result.counts.rules}.`,
    );
  }

  if (
    result.counts.textRules !==
    41
  ) {
    failures.push(
      `Expected frozen V6.3 TEXT count 41, got ${result.counts.textRules}.`,
    );
  }

  if (
    result.counts.safeRawFallback !==
    41
  ) {
    failures.push(
      `Expected all 41 TEXT rules to be SAFE_RAW_FALLBACK, got ${result.counts.safeRawFallback}.`,
    );
  }

  if (
    result.counts.mustFix !==
    0
  ) {
    failures.push(
      `Expected MUST_FIX=0, got ${result.counts.mustFix}.`,
    );
  }

  if (
    result.counts.authoritativeStructured !==
    3148
  ) {
    failures.push(
      `Expected 3148 authoritative structured rules, got ${result.counts.authoritativeStructured}.`,
    );
  }

  if (
    result.counts.missingRawText !==
      0 ||
    result.counts.missingRoot !==
      0 ||
    result.counts.duplicateRuleKeys !==
      0
  ) {
    failures.push(
      'Freeze structural invariants are not clean.',
    );
  }

  if (
    result.counts.v63TargetFallbacks !==
    0
  ) {
    failures.push(
      `The four V6.3 corrected unit families must not remain raw fallback. Found ${result.counts.v63TargetFallbacks}.`,
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
    'USYD REQUISITE SEMANTICS: FROZEN LOSSLESS',
  );

  console.log(
    '3148 STRUCTURED AUTHORITATIVE + 41 SAFE RAW FALLBACK + 0 MUST_FIX',
  );

  console.log(
    'IMPORTANT: partial ASTs for the 41 raw-fallback rules are diagnostic only. rawText is authoritative.',
  );

  console.log(
    'NEXT: write the freeze artifact, then rebuild the final USYD master with final relationships, requirements and study plans.',
  );
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);
