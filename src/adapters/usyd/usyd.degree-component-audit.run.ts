import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydDegreeComponentEvidence,
} from './usyd.degree-component-audit';

const HANDBOOK_YEAR =
  2026;

const OUTPUT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(HANDBOOK_YEAR),
    'usyd-degree-component-evidence.json',
  );

async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  const temporary =
    `${filePath}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      value,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporary,
    filePath,
  );
}

async function main():
Promise<void> {
  const result =
    await auditUsydDegreeComponentEvidence();

  if (
    result.degreeCount !==
    109
  ) {
    throw new Error(
      `Expected 109 degrees, got ${result.degreeCount}.`,
    );
  }

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD degree-component evidence] PASS',
  );

  console.log(
    `Degrees: ${result.degreeCount}`,
  );

  console.log(
    `Components: ${result.componentCount}`,
  );

  console.log(
    `Evidence: ${result.evidenceCount}`,
  );

  console.log(
    `Resolved named refs: ${result.resolvedNamedCount}`,
  );

  console.log(
    `Ambiguous named refs: ${result.ambiguousNamedCount}`,
  );

  console.log(
    `Unresolved named refs: ${result.unresolvedNamedCount}`,
  );

  console.log(
    `Generic refs: ${result.genericCount}`,
  );

  console.log(
    `Output: ${OUTPUT_FILE}`,
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
