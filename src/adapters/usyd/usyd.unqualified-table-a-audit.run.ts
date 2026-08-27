import fs from 'node:fs/promises';
import path from 'node:path';

import {
  auditUsydUnqualifiedTableA,
} from './usyd.unqualified-table-a-audit';

const OUTPUT_FILE = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-unqualified-table-a-audit.json',
);

async function main():
Promise<void> {
  const result =
    await auditUsydUnqualifiedTableA();

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
    '[USYD unqualified Table A audit] PASS',
  );

  console.log(
    `Groups: ${result.counts.groups}`,
  );

  console.log(
    `Typed: ${result.counts.typedComponentReferences}`,
  );

  console.log(
    `Table-only/elective: ${result.counts.tableOnlyOrElective}`,
  );

  console.log(
    `Multi-type: ${result.counts.multiTypeReview}`,
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
