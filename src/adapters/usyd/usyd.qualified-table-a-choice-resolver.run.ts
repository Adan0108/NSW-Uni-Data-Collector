import fs from 'node:fs/promises';
import path from 'node:path';

import {
  collectUsydQualifiedTableAChoices,
} from './usyd.qualified-table-a-choice-resolver';

const OUTPUT_FILE = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
  'usyd-qualified-table-a-degree-component-choices.json',
);

async function main():
Promise<void> {
  const result =
    await collectUsydQualifiedTableAChoices();

  if (
    result.counts.contextualHonoursSignals !== 4 ||
    result.counts.streamReviewSignals !== 1 ||
    result.counts.unresolvedRoleSignals !== 0
  ) {
    throw new Error(
      'Refusing to write final qualified Table A choices because expected final review classification changed.',
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
    '[USYD qualified Table A final choices] PASS',
  );

  console.log(
    `Choice pools: ${result.counts.authoritativeChoicePools}`,
  );

  console.log(
    `Review signals: ${result.counts.reviewSignals}`,
  );

  console.log(
    `Unresolved roles: ${result.counts.unresolvedRoleSignals}`,
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
