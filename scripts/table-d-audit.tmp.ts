import fs from 'node:fs';
import path from 'node:path';

type Obj = Record<string, any>;

const root = process.cwd();
const file = path.join(root, 'data', 'normalized', 'usyd', '2026', 'usyd-master-final.engineering-repaired.subjects-resolved.json');
const master = JSON.parse(fs.readFileSync(file, 'utf8')) as Obj;

const summarize = (value: any) => Array.isArray(value) ? value.length : typeof value;
console.log('topLevel', Object.fromEntries(Object.entries(master).map(([key, value]) => [key, summarize(value)])));
console.log('counts', master.metadata?.counts);

const tableDComponents: Obj[] = [];
const tableDTables: Obj[] = [];
const codes = new Set<string>();
for (const source of master.componentSources ?? []) {
  const component = source.component ?? {};
  const componentText = JSON.stringify(component);
  const componentMatch = /table[- /]?d|dalyell/i.test(componentText);
  if (componentMatch) {
    tableDComponents.push({
      code: component.code,
      name: component.name,
      type: component.type,
      sourceUrl: component.sourceUrl,
      overviewUrl: component.overviewUrl,
      unitTableUrl: component.unitTableUrl,
      tableUrl: component.tableUrl,
      parsedTableCount: source.parsedTables?.length ?? 0,
    });
  }
  for (const table of source.parsedTables ?? []) {
    const url = String(table.url ?? '');
    const title = String(table.title ?? table.name ?? '');
    if (/table[- /]?d|dalyell/i.test(`${url} ${title}`) || componentMatch) {
      const unitCodes = (table.units ?? []).map((unit: Obj) => String(unit.code ?? unit.subjectCode ?? '').toUpperCase()).filter(Boolean);
      unitCodes.forEach((code: string) => codes.add(code));
      tableDTables.push({
        componentCode: component.code,
        componentName: component.name,
        url,
        title,
        unitCount: unitCodes.length,
        uniqueUnitCount: new Set(unitCodes).size,
        codes: unitCodes,
      });
    }
  }
}

const subjectCodes = new Set((master.subjects ?? []).map((subject: Obj) => String(subject.code ?? '').toUpperCase()).filter(Boolean));
const missingCodes = [...codes].filter((code) => !subjectCodes.has(code)).sort();
console.log('tableDComponents', JSON.stringify(tableDComponents, null, 2));
console.log('tableDTableSummary', JSON.stringify(tableDTables.map(({ codes: _codes, ...table }) => table), null, 2));
const coreDalyellTables = tableDTables.filter((table) => /dalyell-stream\/unit-of-study-table\.html/i.test(table.url));
const coreDalyellCodes = [...new Set(coreDalyellTables.flatMap((table) => table.codes))].sort();
console.log('coreDalyellPool', {
  tableCount: coreDalyellTables.length,
  uniqueCodes: coreDalyellCodes.length,
  canonicalCodes: coreDalyellCodes.filter((code) => subjectCodes.has(code)).length,
  missingCodes: coreDalyellCodes.filter((code) => !subjectCodes.has(code)),
  codes: coreDalyellCodes,
  urls: coreDalyellTables.map((table) => table.url),
});
console.log('tableDPool', { uniqueCodes: codes.size, missingCodes, canonicalCodes: codes.size - missingCodes.length, codes: [...codes].sort() });

const formal = (master.degreeRequirements ?? []).filter((requirement: Obj) => {
  const raw = String(requirement.raw ?? requirement.node?.raw ?? '');
  return /(?:minimum|complete)\s+(?:of\s+)?\d+\s*(?:credit points|cp|cps).*dalyell.*table d|dalyell.*(?:minimum|complete)\s+(?:of\s+)?\d+\s*(?:credit points|cp|cps).*table d/i.test(raw)
    && /students? enrolled in (?:the )?dalyell stream|dalyell stream students?/i.test(raw);
});
const authoritativeDalyell = (master.degreeRequirements ?? []).filter((requirement: Obj) =>
  requirement.status === 'AUTHORITATIVE'
  && requirement.node?.nodeType === 'CONDITIONAL'
  && requirement.node?.condition === 'DALYELL_ENROLLED'
  && requirement.node?.requirement?.category === 'DALYELL'
  && (requirement.node?.requirement?.tables ?? []).includes('D')
);
console.log('formalBroadCount', formal.length);
console.log('authoritativeDalyellCount', authoritativeDalyell.length);
console.log('authoritativeDalyell', JSON.stringify(authoritativeDalyell.map((requirement: Obj) => ({
  degreeCode: requirement.degreeCode,
  status: requirement.status,
  sourcePath: requirement.sourcePath,
  sourceIndex: requirement.sourceIndex,
  requiredCreditPoints: requirement.node?.requiredCreditPoints ?? requirement.node?.requirement?.requiredCreditPoints ?? requirement.node?.requirement?.creditPoints,
  minimumCreditPoints: requirement.node?.minimumCreditPoints,
  maximumCreditPoints: requirement.node?.maximumCreditPoints,
  nodeType: requirement.node?.nodeType,
  condition: requirement.node?.condition,
  candidateSourceIds: requirement.node?.candidateSourceIds,
  raw: requirement.raw ?? requirement.node?.raw,
})), null, 2));

console.log('cpDistribution', Object.fromEntries([...new Set(authoritativeDalyell.map((r: Obj) => r.node?.requirement?.creditPoints))].sort().map((cp) => [cp, authoritativeDalyell.filter((r: Obj) => r.node?.requirement?.creditPoints === cp).length])));
console.log('candidateSources', JSON.stringify((master.requirementCandidateSources ?? []).map((source: Obj) => ({ id: source.id, degreeCode: source.degreeCode, requirementKey: source.requirementKey, sourceType: source.sourceType, title: source.title, tableName: source.tableName, authoritative: source.authoritative, subjectCount: source.subjectCodes?.length, sourceUrlCount: source.sourceUrls?.length })), null, 2));
