import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BREADTH_SPECIALISATIONS, INDUSTRIAL_DESIGN_GROUPS, breadthName, breadthUrl } from './engineering-specialisation-evidence.js';
import { repairEngineeringSpecialisations } from './repair-engineering-specialisations.js';
import { classifyCuspVariant, isCuspChoice, repairCuspMathematicsAllocation } from '../cusp/cusp-plan-semantics.js';
import { parseCuspStudyPlan } from '../cusp/cusp-study-plan.parser.js';

type Row = Record<string, any>;
const directory = 'data/normalized/usyd/2026/';
const read = (name: string): Row => JSON.parse(readFileSync(directory + name, 'utf8'));
const master = read('usyd-master-final.database-ready.json');
const normalized = read('usyd-master-final.engineering-repaired.subjects-resolved.json');
const subjects = new Set<string>(master.subjects.map((s: Row) => s.code));
const groupsFor = (source: Row): Row[] => source.parsedTables.flatMap((t: Row) => t.structure.components.flatMap((c: Row) => c.requirementGroups ?? []));
const rowsFor = (plan: Row): Row[] => plan.years.flatMap((y: Row) => y.periods.flatMap((p: Row) => p.items));
const total = (rows: Row[]): number => rows.reduce((n, r) => n + (r.creditPoints ?? 0), 0);
const sameCodes = (actual: string[], expected: string[]): void => assert.deepEqual([...actual].sort(), [...expected].sort());

for (const definition of BREADTH_SPECIALISATIONS) {
  const url = breadthUrl(definition.slug);
  const component = master.components.filter((c: Row) => c.unitTableUrl === url);
  assert.equal(component.length, 1);
  assert.equal(component[0].name, breadthName(definition.title));
  assert.equal(component[0].officialTitle, definition.title);
  assert.equal(component[0].requiredCreditPoints, 24);
  assert.ok(component[0].code.endsWith('-BREADTH'));
  const source = master.componentSources.find((s: Row) => s.component.unitTableUrl === url);
  const groups = groupsFor(source);
  assert.equal(groups.length, 2);
  definition.groups.forEach((definition, i) => {
    const group = groups[i];
    sameCodes(group.units.map((u: Row) => u.code), definition.codes);
    assert.equal(group.requiredCreditPoints, definition.cp);
    assert.equal(group.minCreditPoints, definition.cp);
    assert.equal(group.maxCreditPoints, definition.cp);
    assert.notEqual(group.logic, 'UNKNOWN');
    assert.ok(group.rawText && group.sourceUrl === url);
  });
}
const breadthCodes = new Set(BREADTH_SPECIALISATIONS.flatMap(d => d.groups.flatMap(g => g.codes)));
assert.equal(breadthCodes.size, 34);
for (const code of breadthCodes) assert.ok(subjects.has(code), `Missing Breadth unit ${code}`);

// Independently specified resolution matrix; protects against changing the evidence exclusions.
const matrix: Record<string, string[]> = {
  aeronautical: ['data-science', 'humanitarian-engineering', 'innovation-entrepreneurship', 'computer-systems'],
  'aeronautical-with-space': ['data-science', 'humanitarian-engineering', 'innovation-entrepreneurship', 'computer-systems'],
  biomedical: ['data-science', 'humanitarian-engineering', 'innovation-entrepreneurship', 'computer-systems'],
  'chemical-biomolecular': ['data-science'],
  civil: ['data-science', 'innovation-entrepreneurship', 'computer-systems'],
  electrical: ['data-science', 'innovation-entrepreneurship'],
  environmental: ['data-science', 'humanitarian-engineering', 'innovation-entrepreneurship', 'computer-systems'],
  mechanical: ['data-science', 'humanitarian-engineering', 'innovation-entrepreneurship', 'computer-systems'],
  'mechanical-with-space': ['data-science', 'humanitarian-engineering', 'innovation-entrepreneurship', 'computer-systems'],
  mechatronic: ['data-science', 'humanitarian-engineering', 'innovation-entrepreneurship', 'computer-systems'],
  'mechatronic-with-space': ['data-science', 'humanitarian-engineering', 'innovation-entrepreneurship', 'computer-systems'],
  software: ['humanitarian-engineering', 'innovation-entrepreneurship'],
};
for (const [slug, expected] of Object.entries(matrix)) {
  const source = master.componentSources.find((s: Row) => s.component.handbookCategory === 'ENGINEERING'
    && s.component.unitTableUrl.endsWith(`/streams/${slug}/unit-of-study-table.html`));
  const choices = groupsFor(source).filter(g => g.generatedRelationshipKind === 'BREADTH_SPECIALISATION_CHOICE');
  assert.equal(choices.length, 1);
  assert.equal(choices[0].minCreditPoints, 0);
  assert.equal(choices[0].degreeCode, 'BHENGINE-04');
  sameCodes(choices[0].components.map((c: Row) => c.sourceUrl), expected.map(breadthUrl));
}
for (const slug of ['mechanical', 'mechanical-with-space']) {
  const source = master.componentSources.find((s: Row) => s.component.handbookCategory === 'ENGINEERING'
    && s.component.unitTableUrl.endsWith(`/streams/${slug}/specialisations/industrial-product-design-unit-of-study-table.html`));
  const groups = groupsFor(source);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map(g => g.logic), ['ALL', 'ONE_OF', 'ALL']);
  INDUSTRIAL_DESIGN_GROUPS.forEach((d, i) => {
    sameCodes(groups[i].units.map((u: Row) => u.code), d.codes);
    assert.equal(groups[i].requiredCreditPoints, 6);
  });
  assert.equal(source.parsedTables[0].structure.components[0].requiredCreditPoints, 18);
}
for (const [suffix, cp] of [
  ['/software/specialisations/engineering-data-science-unit-of-study-table.html', 30],
  ['/civil/specialisations/humanitarian-unit-of-study-table.html', 18],
] as const) {
  const component = master.components.find((c: Row) => c.handbookCategory === 'ENGINEERING' && c.unitTableUrl.endsWith(suffix));
  assert.equal(component.requiredCreditPoints, cp);
  assert.ok(!component.name.endsWith('(Breadth)'));
}
const engineeringSpecialisations = master.componentSources.filter((s: Row) => s.component.handbookCategory === 'ENGINEERING'
  && s.component.type === 'SPECIALISATION');
assert.equal(engineeringSpecialisations.length, 49);
for (const source of engineeringSpecialisations) for (const group of groupsFor(source)) {
  for (const unit of group.units ?? []) assert.ok(subjects.has(unit.code), `Missing formal unit ${unit.code}`);
}

const categories: Record<string, number> = {};
let alternativePlans = 0;
let repairedMathRows = 0;
for (const degree of normalized.degrees) {
  for (const rawPlan of degree.studyPlans ?? []) {
    if (rawPlan.source !== 'CUSP') continue;
    const plan = master.studyPlans.find((p: Row) => p.sourceType === 'CUSP' && p.sourceUrl === rawPlan.sourceUrl);
    assert.ok(plan, `Missing source plan ${rawPlan.sourceUrl}`);
    const rawPeriods = rawPlan.periods.filter((p: Row) => p.yearNumber > 0);
    const finalPeriods = plan.years.flatMap((y: Row) => y.periods);
    assert.equal(finalPeriods.length, rawPeriods.length);
    for (const [i, rawPeriod] of rawPeriods.entries()) {
      const finalPeriod = finalPeriods[i];
      assert.equal(finalPeriod.items.length, rawPeriod.items.length, `${plan.title}: source position expanded`);
      let expectedCp = 0;
      for (const [j, rawItem] of rawPeriod.items.entries()) {
        const item = finalPeriod.items[j];
        expectedCp += rawItem.creditPoints ?? 0;
        assert.equal(item.sortOrder, rawItem.position);
        assert.equal(item.creditPoints, rawItem.creditPoints, 'Database conversion must not conceal an unrepaired normalized row');
        assert.equal(item.itemType, isCuspChoice(rawItem) ? 'CHOICE' : 'SUBJECT');
        assert.deepEqual(item.rawData.subjects, rawItem.subjects);
        if (item.itemType === 'SUBJECT') {
          assert.equal(item.subjectCode, rawItem.subjects[0].code);
          assert.ok(subjects.has(item.subjectCode));
        } else assert.equal(item.subjectCode, null);
        if (rawItem.sourceCreditPoints === 3 && rawItem.creditPointEvidenceUrl
          && ['MATH1061', 'MATH1062'].includes(rawItem.subjects[0]?.code)) repairedMathRows++;
      }
      assert.equal(finalPeriod.totalCreditPoints, expectedCp);
    }
    if (degree.code === 'BHENGINE-04') {
      assert.equal(total(rawPeriods.flatMap((p: Row) => p.items)), 192, `Normalized plan: ${rawPlan.variantTitle}`);
      for (const period of rawPeriods) {
        for (const item of period.items) {
          if (item.subjects.length === 1 && ['MATH1061', 'MATH1062'].includes(item.subjects[0].code)) {
            const canonical = normalized.subjects.find((s: Row) => s.code === item.subjects[0].code);
            assert.equal(canonical.creditPoints, 6);
            assert.equal(item.creditPoints, canonical.creditPoints, `Normalized mathematics row: ${rawPlan.sourceUrl}`);
            if (['6436', '6669'].includes(rawPlan.cuspDegreeVersionId)) {
              assert.equal(total(period.items), 24, `Normalized affected period: ${rawPlan.sourceUrl}`);
              assert.equal(finalPeriods[rawPeriods.indexOf(period)].totalCreditPoints, 24);
            }
          }
        }
      }
      const category = plan.rawData.category;
      categories[category] = (categories[category] ?? 0) + 1;
      assert.equal(category, classifyCuspVariant(rawPlan));
      assert.equal(total(rowsFor(plan)), 192, plan.title);
      assert.equal(plan.totalCreditPoints, total(rowsFor(plan)), 'Persisted database-ready plan total must match source allocations');
      assert.equal(plan.isFormalRequirement, false);
      if (rawPeriods.some((p: Row) => p.items.some((i: Row) => i.subjects.length > 1))) alternativePlans++;
    }
  }
}
assert.equal(alternativePlans, 44);
assert.equal(normalized.degrees.find((d: Row) => d.code === 'BHENGINE-04').studyPlans.length, 196);
assert.deepEqual(categories, { BASE: 24, STREAM_SPECIALISATION: 90, BREADTH_SPECIALISATION: 80, OTHER: 2 });
assert.equal(repairedMathRows, 22);

// Exercise the HTML path, including advanced alternatives and a singleton select block.
const fixture = `<select id="selected-degree-version-id"><option selected>2026</option></select>
  <h3>Electrical Engineering (mid-year)</h3><h3>Year 1 - Semester 1</h3><table class="t_b">
  <tr><td>Core</td><td>3</td><td><a href="/students/view-unit-page/alpha/MATH1061">MATH1061: Mathematics 1A</a></td></tr>
  <tr><td>Core</td><td>6</td><td>Select from <a href="/students/view-unit-page/alpha/MATH1062">MATH1062</a><a href="/students/view-unit-page/alpha/MATH1962">MATH1962</a></td></tr>
  <tr><td>Elective</td><td>6</td><td>Select from <a href="/students/view-unit-page/alpha/COMP3308">COMP3308</a></td></tr></table>`;
const parsed = parseCuspStudyPlan(fixture, 'https://cusp.sydney.edu.au/students/view-degree-page/dvid/6436');
assert.equal(parsed.periods[0].items[0].creditPoints, 6);
assert.equal(parsed.periods[0].items[1].subjects.length, 2);
assert.ok(isCuspChoice(parsed.periods[0].items[2]));
assert.equal(repairCuspMathematicsAllocation({ subjects: [{ code: 'MATH1062' }, { code: 'MATH1962' }], creditPoints: 3 }).creditPoints, 3);
assert.equal(repairCuspMathematicsAllocation({ subjects: [{ code: 'MATH1061' }], creditPoints: 3 }, 'UNVERIFIED').creditPoints, 3);

assert.equal(master.degrees.length, 109);
assert.equal(master.components.length, 371);
assert.equal(master.subjects.length, 3119);
assert.equal(master.studyPlans.length, 531);
assert.equal(master.requirementCandidateSources.length, 33);
assert.equal(master.requirementCandidateSources.reduce((n: number, s: Row) => n + s.subjectCodes.length, 0), 2270);
assert.equal(master.requirementCandidateSources[0].subjectCodes.length, 271);
assert.equal(master.requirementCandidateSources[1].subjectCodes.length, 1472);
for (const source of master.requirementCandidateSources.slice(2)) assert.equal(source.subjectCodes.length, 17);
assert.ok(!master.requirementCandidateSources.slice(0, 2).some((s: Row) => s.subjectCodes.includes('CIVL5330')));
const repeat = structuredClone(normalized);
repairEngineeringSpecialisations(repeat);
assert.deepEqual(repeat, normalized, 'Repair must be idempotent');

// Optional review comparison uses Git read-only; validation also works outside a checkout.
if (process.argv.includes('--compare-head')) {
  const original = JSON.parse(execFileSync('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`,
    'show', `HEAD:${directory}usyd-master-final.database-ready.json`], { encoding: 'utf8', maxBuffer: 150_000_000 }));
  assert.deepEqual(master.subjects, original.subjects);
  assert.deepEqual(master.degrees, original.degrees);
  assert.deepEqual(master.requirementCandidateSources, original.requirementCandidateSources);
  assert.deepEqual(master.unresolvedSubjectDetails, original.unresolvedSubjectDetails);
  assert.deepEqual(master.studyPlans.filter((p: Row) => p.sourceType !== 'CUSP'),
    original.studyPlans.filter((p: Row) => p.sourceType !== 'CUSP'));
  const existingSources = original.componentSources.filter((s: Row) => s.component.handbookCategory === 'ENGINEERING'
    && s.component.type === 'SPECIALISATION');
  for (const before of existingSources) {
    const after = master.componentSources.find((s: Row) => s.component.unitTableUrl === before.component.unitTableUrl);
    sameCodes([...new Set<string>(groupsFor(after).flatMap(g => (g.units ?? []).map((u: Row) => u.code)))],
      [...new Set<string>(groupsFor(before).flatMap(g => (g.units ?? []).map((u: Row) => u.code)))]);
  }
  for (const key of ['degreeRequirements', 'degreeRequirementRoots', 'subjectRequisites', 'requisiteFreeze']) {
    assert.deepEqual(master[key], original[key], `${key} changed`);
  }
  const counts = (m: Row) => {
    const plans = m.studyPlans.filter((p: Row) => p.sourceType === 'CUSP');
    return {
      components: m.components.length, specialisations: m.components.filter((c: Row) => c.type === 'SPECIALISATION').length,
      breadth: m.components.filter((c: Row) => c.specialisationKind === 'BREADTH').length,
      requirementGroups: m.componentSources.flatMap(groupsFor).length,
      candidateSources: m.requirementCandidateSources.length,
      candidateMemberships: m.requirementCandidateSources.reduce((n: number, s: Row) => n + s.subjectCodes.length, 0),
      subjects: m.subjects.length, studyPlans: m.studyPlans.length,
      cuspRows: plans.flatMap(rowsFor).length, cuspRowCp: total(plans.flatMap(rowsFor)),
      unresolved: m.unresolvedSubjectDetails.length,
    };
  };
  console.log(JSON.stringify({ before: counts(original), after: counts(master) }, null, 2));
  const changedPlans = master.studyPlans.filter((p: Row) => p.sourceType === 'CUSP'
    && total(rowsFor(p)) !== total(rowsFor(original.studyPlans.find((b: Row) => b.sourcePlanId === p.sourcePlanId))));
  console.log('Changed CUSP plan totals by degree:', changedPlans.reduce((n: Row, p: Row) => {
    n[p.degreeCode] = (n[p.degreeCode] ?? 0) + 1;
    return n;
  }, {}));
}
console.log(`Engineering regression passed: 49 formal specialisations, 34 canonical Breadth subjects, 44 alternative-slot plans, ${repairedMathRows} mathematics repairs, 196 plans at 192 CP.`);
