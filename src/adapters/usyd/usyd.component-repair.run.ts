import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { parseUsydGlobalComponent } from './usyd.global-component-parser';

const file = resolve('data', 'normalized', 'usyd', '2026', 'usyd-master-global.json');

type JsonObject = Record<string, any>;

function needsRepair(source: JsonObject): boolean {
  if ((source.failedTables?.length ?? 0) > 0 || source.hasNoTable) return true;
  return (source.parsedTables ?? []).some((table: JsonObject) =>
    (table.structure?.components ?? []).some((component: JsonObject) => {
      const groups = component.requirementGroups ?? [];
      const subjectCount = groups.reduce(
        (total: number, group: JsonObject) => total + (group.units?.length ?? 0),
        0,
      );
      return Number(component.requiredCreditPoints) > 0
        && (groups.length === 0 || subjectCount === 0);
    }),
  );
}

async function main(): Promise<void> {
  const master = JSON.parse(await readFile(file, 'utf8')) as JsonObject;
  const sources = master.componentSources as JsonObject[];
  const affected = sources.map((source, index) => ({ source, index })).filter(({ source }) => needsRepair(source));
  console.log(`Recollecting ${affected.length} of ${sources.length} USYD component source records.`);

  for (const [position, { source, index }] of affected.entries()) {
    const component = source.component;
    console.log(`[${position + 1}/${affected.length}] ${component.handbookCategory} / ${component.type} / ${component.name}`);
    sources[index] = await parseUsydGlobalComponent(component);
  }

  master.metadata = {
    ...master.metadata,
    componentRepair: {
      generatedAt: new Date().toISOString(),
      sourceRecordsRecollected: affected.length,
      sourceRecordsPreserved: sources.length - affected.length,
    },
  };
  const temporary = `${file}.tmp`;
  await writeFile(temporary, `${JSON.stringify(master, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
