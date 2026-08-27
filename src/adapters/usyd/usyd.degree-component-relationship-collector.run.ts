import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydDegreeComponentRelationshipsStage1,
} from './usyd.degree-component-relationship-collector';

const HANDBOOK_YEAR =
  2026;

const OUTPUT_FILE =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
    'usyd-degree-component-relationships.stage1.json',
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
    await collectUsydDegreeComponentRelationshipsStage1();

  if (
    result.counts.namedEvidenceRecords !==
      36 ||
    result.counts.unresolvedNamedEvidence !==
      0 ||
    result.relationships.length ===
      0
  ) {
    throw new Error(
      `Refusing to write Stage 1 relationships: named=${result.counts.namedEvidenceRecords}, unresolved=${result.counts.unresolvedNamedEvidence}, relationships=${result.relationships.length}.`,
    );
  }

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD degree-component relationships stage 1] PASS',
  );

  console.log(
    `Named evidence: ${result.counts.namedEvidenceRecords}`,
  );

  console.log(
    `Explicit relationships: ${result.counts.authoritativeRelationships}`,
  );

  console.log(
    `Generic signals retained: ${result.counts.genericSignals}`,
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
