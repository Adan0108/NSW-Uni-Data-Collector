import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydGlobalMaster,
} from './usyd.master.collector';

const HANDBOOK_YEAR =
  2026;

const OUTPUT_DIR =
  path.resolve(
    process.cwd(),
    'data',
    'normalized',
    'usyd',
    String(
      HANDBOOK_YEAR,
    ),
  );

const OUTPUT_FILE =
  path.join(
    OUTPUT_DIR,
    'usyd-master-global.json',
  );

async function writeJsonAtomic(
  filePath: string,
  value: unknown,
): Promise<void> {
  const temporaryPath =
    `${filePath}.tmp`;

  await fs.writeFile(
    temporaryPath,
    JSON.stringify(
      value,
      null,
      2,
    ),
    'utf8',
  );

  await fs.rename(
    temporaryPath,
    filePath,
  );
}

async function main():
Promise<void> {
  console.log(
    '[USYD master] building global stage-1 master...',
  );

  const master =
    await collectUsydGlobalMaster();

  const counts =
    master
      .metadata
      .counts;

  const hardFailures:
    string[] =
    [];

  if (
    counts.degreeSourcePages !==
    86
  ) {
    hardFailures.push(
      `degreeSourcePages=${counts.degreeSourcePages}`,
    );
  }

  if (
    counts.degrees !==
    109
  ) {
    hardFailures.push(
      `degrees=${counts.degrees}`,
    );
  }

  if (
    counts.components !==
    358
  ) {
    hardFailures.push(
      `components=${counts.components}`,
    );
  }

  if (
    counts.componentSourceRecords !==
    358
  ) {
    hardFailures.push(
      `componentSourceRecords=${counts.componentSourceRecords}`,
    );
  }

  if (
    counts.degreeSpecificTables !==
    37
  ) {
    hardFailures.push(
      `degreeSpecificTables=${counts.degreeSpecificTables}`,
    );
  }

  if (
    counts.degreeTableOwnerGroups !==
    21
  ) {
    hardFailures.push(
      `degreeTableOwnerGroups=${counts.degreeTableOwnerGroups}`,
    );
  }

  if (
    counts.units !==
    3011
  ) {
    hardFailures.push(
      `units=${counts.units}`,
    );
  }

  if (
    counts.unresolvedUnits !==
    111
  ) {
    hardFailures.push(
      `unresolvedUnits=${counts.unresolvedUnits}`,
    );
  }

  if (
    counts.requisiteRules !==
    3189
  ) {
    hardFailures.push(
      `requisiteRules=${counts.requisiteRules}`,
    );
  }

  if (
    counts.rawFallbackRequisiteRules !==
    45
  ) {
    hardFailures.push(
      `rawFallbackRequisiteRules=${counts.rawFallbackRequisiteRules}`,
    );
  }

  if (
    hardFailures.length >
    0
  ) {
    throw new Error(
      [
        'USYD global master failed hard count checks.',
        ...hardFailures,
        'Run usyd.master.collector.test-run.ts.',
      ].join(
        ' ',
      ),
    );
  }

  await fs.mkdir(
    OUTPUT_DIR,
    {
      recursive:
        true,
    },
  );

  await writeJsonAtomic(
    OUTPUT_FILE,
    master,
  );

  console.log(
    '[USYD master] PASS',
  );

  console.log(
    `Degrees: ${counts.degrees}`,
  );

  console.log(
    `Canonical components: ${counts.components}`,
  );

  console.log(
    `Requirement-bearing component objects: ${counts.componentRequirementObjects}`,
  );

  console.log(
    `Degree tables: ${counts.degreeSpecificTables}`,
  );

  console.log(
    `Units: ${counts.units}`,
  );

  console.log(
    `Unresolved units: ${counts.unresolvedUnits}`,
  );

  console.log(
    `P/C/N rules: ${counts.requisiteRules}`,
  );

  console.log(
    `Raw fallback rules: ${counts.rawFallbackRequisiteRules}`,
  );

  console.log(
    `Output: ${OUTPUT_FILE}`,
  );

  console.log('');

  console.log(
    'GLOBAL MASTER STAGE 1 WRITTEN.',
  );

  console.log(
    'Do not rename it to usyd-master.json yet.',
  );

  console.log(
    'USYD still needs degree-component relationships, formal degree requirement completeness, and recommended study plans.',
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
