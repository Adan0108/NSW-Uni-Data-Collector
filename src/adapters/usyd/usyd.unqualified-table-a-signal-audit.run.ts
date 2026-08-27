import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydUnqualifiedTableASignals,
} from './usyd.unqualified-table-a-signal-audit';

const OUTPUT_FILE = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-unqualified-table-a-signal-audit.json',
);

async function main():
Promise<void> {
  const result =
    await auditUsydUnqualifiedTableASignals();

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
    '[USYD unqualified Table A signal audit V2] PASS',
  );

  console.log(
    `Signals: ${result.counts.signals}`,
  );

  console.log(
    `Safe direct: ${result.counts.directTableAComponentChoice}`,
  );

  console.log(
    `Safe A-or-S: ${result.counts.tableAOrTableSComponentChoice}`,
  );

  console.log(
    `Safe cross-faculty: ${result.counts.crossFacultyTableAComponentChoice}`,
  );

  console.log(
    `Unit refs: ${result.counts.nonComponentUnitReference}`,
  );

  console.log(
    `Stream context: ${result.counts.streamContext}`,
  );

  console.log(
    `Untyped component clauses: ${result.counts.untypedComponentClause}`,
  );

  console.log(
    `Review: ${result.counts.review}`,
  );

  console.log(
    `Output: ${OUTPUT_FILE}`,
  );
}

main().catch(
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
