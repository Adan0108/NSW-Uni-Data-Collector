import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { repairCuspMathematicsAllocation } from '../cusp/cusp-plan-semantics.js';
import {
  BREADTH_SPECIALISATIONS, INDUSTRIAL_DESIGN_GROUPS, SPECIALISATION_RESOLUTIONS,
  breadthName, breadthUrl,
} from './engineering-specialisation-evidence.js';

// The master schema is shared with the existing repair scripts and carries raw evidence.
type Row = Record<string, any>;
const file = resolve('data/normalized/usyd/2026/usyd-master-final.engineering-repaired.subjects-resolved.json');

export function repairEngineeringSpecialisations(master: Row): void {
  if (master.university?.code !== 'USYD' || master.handbookYear !== 2026) {
    throw new Error('Expected USYD 2026 master');
  }
  const subjects = new Map<string, Row>(master.subjects.map((s: Row) => [s.code, s]));
  // Repair persisted nested schedules before the normalized master is written.
  // Database conversion alone is too late to repair this artifact.
  for (const degree of master.degrees) {
    if (degree.code !== 'BHENGINE-04') continue;
    for (const plan of degree.studyPlans ?? []) {
      if (plan.source !== 'CUSP') continue;
      const dvid = plan.cuspDegreeVersionId ?? plan.cusp?.dvid;
      for (const period of plan.periods ?? []) {
        period.items = period.items.map((item: Row) => {
          const code = item.subjects?.[0]?.code;
          if (dvid !== '6436' && dvid !== '6669') return item;
          if (code !== 'MATH1061' && code !== 'MATH1062') return item;
          const canonical = subjects.get(code);
          if (!canonical || canonical.creditPoints !== 6) throw new Error(`Invalid canonical mathematics evidence: ${code}`);
          return repairCuspMathematicsAllocation(item, dvid, canonical);
        });
      }
    }
  }
  const groups = (definitions: Array<{ cp: number; codes: string[] }>, sourceUrl: string): Row[] =>
    definitions.map((definition, index) => {
      const units = definition.codes.map(code => {
        const subject = subjects.get(code);
        if (!subject || subject.creditPoints !== 6) throw new Error(`Missing or unexpected canonical subject: ${code}`);
        return {
          code, name: subject.name, creditPoints: subject.creditPoints,
          ...Object.fromEntries(['assumedKnowledge', 'prerequisite', 'corequisite', 'prohibition']
            .map(key => [key, subject.accessConditions?.[key] ?? null])),
          sourceUrl: subject.sourceUrl,
        };
      });
      return {
        name: `Requirement ${index + 1}: ${definition.cp} CP`, level: null,
        logic: definition.cp === units.length * 6 ? 'ALL' : definition.cp === 6 ? 'ONE_OF' : 'AT_LEAST',
        requiredCreditPoints: definition.cp, minCreditPoints: definition.cp, maxCreditPoints: definition.cp,
        rawText: `Students complete ${definition.cp} credit points from the following:`, sourceUrl, units,
      };
    });
  const installRequirements = (source: Row, definitions: Array<{ cp: number; codes: string[] }>, cp: number): void => {
    const table = source.parsedTables[0];
    const requirementGroups = groups(definitions, table.url);
    const requirement = {
      name: `${source.component.name} specialisation`, type: 'SPECIALISATION', requiredCreditPoints: cp,
      summary: `${cp} credit points from the official 2026 specialisation table.`,
      sourceUrl: table.url, requirementGroups,
      formalRequirements: requirementGroups.map((group, i) => ({
        order: i + 1, rawText: group.rawText, requiredCreditPoints: group.requiredCreditPoints,
        level: null, groupKind: group.logic === 'ALL' ? 'CORE' : 'SELECTIVE',
        componentReferenceRule: null, conditionalRule: null, subrules: [], notes: [],
      })),
    };
    table.structure = { ...table.structure, name: source.component.name, year: 2026, sourceUrl: table.url, components: [requirement] };
    master.componentRequirementObjects = master.componentRequirementObjects.filter((r: Row) => r.sourceUrl !== table.url);
    master.componentRequirementObjects.push(requirement);
    source.component.requiredCreditPoints = cp;
    const canonical = master.components.find((c: Row) => c.unitTableUrl === source.component.unitTableUrl);
    if (!canonical) throw new Error(`Missing canonical component: ${table.url}`);
    canonical.requiredCreditPoints = cp;
  };

  for (const definition of BREADTH_SPECIALISATIONS) {
    const url = breadthUrl(definition.slug);
    let source = master.componentSources.find((s: Row) => s.component.unitTableUrl === url);
    if (!source) {
      const component = {
        handbookCategory: 'ENGINEERING', name: breadthName(definition.title), officialTitle: definition.title,
        code: `USYD:ENGINEERING:SPECIALISATION:${breadthName(definition.title).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/-$/, '')}`,
        type: 'SPECIALISATION', specialisationKind: 'BREADTH', requiredCreditPoints: 24,
        overviewUrl: url, unitTableUrl: url, tableUrls: [url], learningOutcomesUrl: null, sourceUrl: url,
      };
      master.components.push(component);
      source = { component: { ...component }, parsedTables: [{ url, structure: {}, units: [] }], failedTables: [], hasNoTable: false, complete: true };
      master.componentSources.push(source);
    }
    const code = `USYD:ENGINEERING:SPECIALISATION:${breadthName(definition.title).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/-$/, '')}`;
    source.component.code = code;
    master.components.find((c: Row) => c.unitTableUrl === url).code = code;
    installRequirements(source, definition.groups, 24);
    const table = source.parsedTables[0];
    table.units = table.structure.components[0].requirementGroups.flatMap((g: Row, i: number) =>
      g.units.map((u: Row) => ({ code: u.code, title: u.name, creditPoints: u.creditPoints,
        section: g.rawText, sectionOrder: i + 1, sourceUrl: url })));
    table.uniqueUnitCodes = table.units.map((u: Row) => u.code);
    table.unitOccurrenceCount = table.units.length;
    table.uniqueUnitCount = table.units.length;
  }

  for (const source of master.componentSources) {
    const url = source.component.unitTableUrl ?? '';
    if (source.component.handbookCategory !== 'ENGINEERING') continue;
    if (/\/streams\/(mechanical|mechanical-with-space)\/specialisations\/industrial-product-design-unit-of-study-table\.html$/.test(url)) {
      installRequirements(source, INDUSTRIAL_DESIGN_GROUPS, 18);
      const requirements = source.parsedTables[0].structure.components[0];
      requirements.formalRequirements[2].notes = ['This unit will also count as one of your free electives.'];
      requirements.notes = ['Units taken for the specialisation will also count toward requirements of the Mechanical or Mechanical with Space stream.'];
    }
    // Directly related same-concept stream components retain their own identities and CP.
    if (url.endsWith('/software/specialisations/engineering-data-science-unit-of-study-table.html')) {
      installRequirements(source, [BREADTH_SPECIALISATIONS[0].groups[0], { ...BREADTH_SPECIALISATIONS[0].groups[1], cp: 12 }], 30);
    }
    if (url.endsWith('/civil/specialisations/humanitarian-unit-of-study-table.html')) {
      installRequirements(source, [{ cp: 6, codes: ['CIVL3310'] }, { cp: 12, codes: ['CIVL5320', 'CIVL5330', 'ENGG3801'] }], 18);
    }
    if (source.component.type !== 'STREAM') continue;
    const slug = url.match(/\/streams\/([^/]+)\/unit-of-study-table.html$/)?.[1];
    if (!slug) continue;
    const requirement = source.parsedTables[0].structure.components[0];
    requirement.requirementGroups = requirement.requirementGroups.filter((g: Row) => g.generatedRelationshipKind !== 'BREADTH_SPECIALISATION_CHOICE');
    requirement.requirementGroups.push({
      name: 'Optional Breadth specialisation (single degree)', logic: 'ONE_OF', nodeType: 'COMPONENT',
      requiredCreditPoints: 24, minCreditPoints: 0, maxCreditPoints: 24,
      generatedRelationshipKind: 'BREADTH_SPECIALISATION_CHOICE', parentStream: source.component.name,
      degreeCode: 'BHENGINE-04', sourceUrl: SPECIALISATION_RESOLUTIONS,
      rawText: 'Optional breadth specialisation within the 24 credit points of free electives; availability from section 9(4). Maximum combinations remain subject to section 9(5).',
      unresolvedConstraints: [{ logic: 'UNKNOWN', sourceUrl: SPECIALISATION_RESOLUTIONS,
        rawText: 'The maximum number and combination of specialisations depends on the stream (section 9(5)); students may not exceed the degree credit point limit.' }],
      components: BREADTH_SPECIALISATIONS.filter(d => !d.excluded.includes(slug)).map((d, sortOrder) => ({
        name: breadthName(d.title), type: 'SPECIALISATION', handbookCategory: 'ENGINEERING',
        sourceUrl: breadthUrl(d.slug), evidenceUrl: breadthUrl(d.slug), sortOrder, authoritative: true,
      })),
    });
    const requirementObject = master.componentRequirementObjects.find((r: Row) => r.sourceUrl === url);
    if (requirementObject) requirementObject.requirementGroups = requirement.requirementGroups;
  }
  master.metadata.counts.canonicalComponents = master.components.length;
  master.metadata.counts.componentSourceRecords = master.componentSources.length;
  master.metadata.counts.componentRequirementObjects = master.componentRequirementObjects.length;
}

if (process.argv[1]?.endsWith('repair-engineering-specialisations.ts')) {
  const master = JSON.parse(readFileSync(file, 'utf8'));
  repairEngineeringSpecialisations(master);
  writeFileSync(file, JSON.stringify(master, null, 2) + '\n');
  console.log(`Engineering specialisations repaired locally: ${master.components.length} components`);
}
