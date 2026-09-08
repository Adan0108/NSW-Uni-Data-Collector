import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type JsonObject = Record<string, any>;

const directory = resolve('data', 'normalized', 'usyd', '2026');
const canonicalFile = resolve(directory, 'usyd-components-complete.json');
const masterFile = resolve(directory, 'usyd-master-final.json');
const reportFile = resolve(directory, 'usyd-component-requirement-audit.json');

function slug(value: unknown): string {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/&/g, ' AND ').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sourceMatches(component: JsonObject, source: JsonObject): boolean {
  const discovered = source.component ?? {};
  if (slug(discovered.handbookCategory) !== slug(component.handbookCategory ?? component.handbook)) return false;
  if (slug(discovered.name) !== slug(component.name)) return false;
  const componentUrls = new Set([
    component.overviewUrl, component.unitTableUrl, component.sourceUrl, ...(component.tableUrls ?? []),
  ].filter(Boolean));
  const sourceUrls = [discovered.overviewUrl, discovered.unitTableUrl, ...(discovered.tableUrls ?? [])].filter(Boolean);
  return componentUrls.size === 0 || sourceUrls.some((url) => componentUrls.has(url));
}

function totalFor(requirements: JsonObject[]): { value: number | null; basis: string } {
  const explicit = [...new Set(requirements.map((item) => Number(item.requiredCreditPoints)).filter(Number.isFinite))];
  if (explicit.length === 1) return { value: explicit[0], basis: 'OFFICIAL_EXPLICIT' };
  const variantTotals = requirements.map((item) => {
    const groups = item.requirementGroups ?? [];
    if (!groups.length || groups.some((group: JsonObject) => !Number.isFinite(Number(group.requiredCreditPoints)))) return null;
    return groups.reduce((sum: number, group: JsonObject) => sum + Number(group.requiredCreditPoints), 0);
  });
  const calculated = [...new Set(variantTotals.filter((value): value is number => value !== null))];
  return calculated.length === 1 && variantTotals.every((value) => value === calculated[0])
    ? { value: calculated[0], basis: 'CALCULATED_REQUIRED_GROUPS' }
    : { value: null, basis: explicit.length > 1 ? 'CONFLICTING_OFFICIAL_TOTALS' : 'UNRESOLVED' };
}

async function main(): Promise<void> {
  const canonicalArtifact = JSON.parse(await readFile(canonicalFile, 'utf8')) as JsonObject;
  const master = JSON.parse(await readFile(masterFile, 'utf8')) as JsonObject;
  const components: JsonObject[] = Array.isArray(canonicalArtifact) ? canonicalArtifact : canonicalArtifact.components;
  const rows = components.map((component, index) => {
    const sources = (master.componentSources as JsonObject[]).filter((source) => sourceMatches(component, source));
    const tables = sources.flatMap((source) => source.parsedTables ?? []);
    const role = component.type;
    const roleRequirements = tables.flatMap((table) =>
      (table.structure?.components ?? []).filter((requirement: JsonObject) => requirement.type === role)
        .map((requirement: JsonObject) => ({ ...requirement, sourceUrl: table.url })),
    );
    const otherRoleRequirements = tables.flatMap((table) =>
      (table.structure?.components ?? []).filter((requirement: JsonObject) => requirement.type !== role),
    );
    const groups = roleRequirements.flatMap((requirement) => requirement.requirementGroups ?? []);
    const subjectCodes = new Set(groups.flatMap((group: JsonObject) => (group.units ?? []).map((unit: JsonObject) => unit.code)).filter(Boolean));
    const otherSubjects = otherRoleRequirements.flatMap((requirement) => requirement.requirementGroups ?? [])
      .flatMap((group: JsonObject) => group.units ?? []);
    const total = totalFor(roleRequirements);
    const sourceUrls = [...new Set(tables.map((table) => table.url).filter(Boolean))];
    const failedUrls = [...new Set(sources.flatMap((source) => (source.failedTables ?? []).map((failure: JsonObject) => failure.url)).filter(Boolean))];
    const rolesOnSamePage = new Set(tables.flatMap((table) => (table.structure?.components ?? []).map((requirement: JsonObject) => requirement.type)));
    return {
      componentId: component.id ?? `CANONICAL-${index + 1}`,
      name: component.name,
      role,
      handbook: component.handbookCategory ?? component.handbook,
      sourceUrl: sourceUrls[0] ?? component.unitTableUrl ?? component.overviewUrl ?? component.sourceUrl ?? null,
      sourceUrls,
      groupCount: groups.length,
      subjectCount: subjectCodes.size,
      creditPoints: total.value,
      creditPointBasis: total.basis,
      groupsButZeroSubjects: groups.length > 0 && subjectCodes.size === 0,
      noGroups: groups.length === 0,
      onlyDifferentRoleGroups: groups.length === 0 && otherSubjects.length > 0,
      missingCreditPointTotal: total.value === null,
      brokenOrUnresolvedSourceUrls: failedUrls,
      majorMinorSharedSource: rolesOnSamePage.has('MAJOR') && rolesOnSamePage.has('MINOR'),
    };
  });
  const summary = {
    canonicalComponents: rows.length,
    withRequirementGroupsAndSubjects: rows.filter((row) => row.groupCount > 0 && row.subjectCount > 0).length,
    withGroupsButZeroSubjects: rows.filter((row) => row.groupsButZeroSubjects).length,
    withNoGroups: rows.filter((row) => row.noGroups).length,
    whoseOnlyGroupsBelongToDifferentRole: rows.filter((row) => row.onlyDifferentRoleGroups).length,
    withMissingCreditPointTotals: rows.filter((row) => row.missingCreditPointTotal).length,
    withBrokenOrUnresolvedSourceUrls: rows.filter((row) => row.brokenOrUnresolvedSourceUrls.length > 0 || row.sourceUrls.length === 0).length,
    majorMinorPairsSharingOfficialSourcePage: new Set(rows.filter((row) => row.majorMinorSharedSource).flatMap((row) => row.sourceUrls)).size,
  };
  await writeFile(reportFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, components: rows }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${reportFile}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
