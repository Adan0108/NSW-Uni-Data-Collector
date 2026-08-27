import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydUnqualifiedTableAScopeDedup,
} from './usyd.unqualified-table-a-scope-dedup-audit';

const OUTPUT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    '2026',
    'usyd-unqualified-table-a-scope-dedup-audit.json',
  );

async function main():
Promise<void> {
  const result =
    await auditUsydUnqualifiedTableAScopeDedup();

  if (
    result.counts.semanticSafeSignals !==
      49 ||
    result.counts.typedEligibleSignals !==
      47 ||
    result.counts.safeButUntypedSignals !==
      2 ||
    result.counts.exactScope !==
      44 ||
    result.counts.multiScopeExplicit !==
      2 ||
    result.counts.alreadyCoveredByQualifiedPool !==
      1 ||
    result.counts.ambiguousScope !==
      0 ||
    result.counts.noScopeEvidence !==
      0
  ) {
    throw new Error(
      'Refusing to write scope/dedup V3 because expected scope resolution changed.',
    );
  }

  const temporary =
    `${OUTPUT_FILE}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      result,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    OUTPUT_FILE,
  );

  console.log(
    '[USYD unqualified Table A scope/dedup V3] PASS',
  );

  console.log(
    `Semantic safe: ${result.counts.semanticSafeSignals}`,
  );

  console.log(
    `Typed eligible: ${result.counts.typedEligibleSignals}`,
  );

  console.log(
    `Safe but untyped: ${result.counts.safeButUntypedSignals}`,
  );

  console.log(
    `Exact: ${result.counts.exactScope}`,
  );

  console.log(
    `Covered: ${result.counts.alreadyCoveredByQualifiedPool}`,
  );

  console.log(
    `Multi-scope: ${result.counts.multiScopeExplicit}`,
  );

  console.log(
    `Ambiguous: ${result.counts.ambiguousScope}`,
  );

  console.log(
    `No scope: ${result.counts.noScopeEvidence}`,
  );

  console.log(
    `Output: ${OUTPUT_FILE}`,
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
