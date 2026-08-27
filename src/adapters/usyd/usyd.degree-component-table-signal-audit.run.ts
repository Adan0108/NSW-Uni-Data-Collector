import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydDegreeComponentTableSignals,
} from './usyd.degree-component-table-signal-audit';

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
    'usyd-degree-component-table-signal-audit.json',
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
    await auditUsydDegreeComponentTableSignals();

  await writeJsonAtomic(
    OUTPUT_FILE,
    result,
  );

  console.log(
    '[USYD degree-component table signal audit] PASS',
  );

  console.log(
    `Generic signals: ${result.counts.genericSignals}`,
  );

  console.log(
    `Grouped degree/table signals: ${result.counts.groupedTableSignals}`,
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
