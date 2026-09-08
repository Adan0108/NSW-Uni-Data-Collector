import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';

type JsonObject = Record<string, any>;
type Role = 'MAJOR' | 'MINOR' | 'PROGRAM' | 'STREAM' | 'OTHER';

const dataFile = resolve('data', 'normalized', 'usyd', '2026', 'usyd-master-final.json');

function slug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/&/g, ' AND ').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function componentKey(handbook: string, name: string): string {
  return `${slug(handbook)}:${slug(name)}`;
}

function stableCode(handbook: string, role: Role, name: string, context: string): string {
  void context;
  return `USYD:${slug(handbook)}:${slug(role)}:${slug(name)}`;
}

function prismaType(role: Role) {
  return role === 'MAJOR' || role === 'MINOR' || role === 'PROGRAM' || role === 'STREAM' ? role : 'OTHER';
}

function logic(value: unknown) {
  return value === 'ALL' || value === 'ANY' || value === 'ONE_OF' ? value : 'UNKNOWN';
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

interface RoleRecord {
  handbook: string;
  name: string;
  role: Role;
  code: string;
  context: string;
  sourceUrl: string | null;
  canonical: JsonObject;
  requirements: Array<{ tableUrl: string; requirement: JsonObject }>;
  creditPoints: number | null;
}

function deriveRoleRecords(master: JsonObject): RoleRecord[] {
  const sourcesByKey = new Map<string, JsonObject[]>();
  for (const source of master.componentSources ?? []) {
    const component = source.component ?? {};
    const key = componentKey(component.handbookCategory ?? '', component.name ?? '');
    sourcesByKey.set(key, [...(sourcesByKey.get(key) ?? []), source]);
  }

  const records: RoleRecord[] = [];
  for (const canonical of master.components ?? []) {
    const handbook = canonical.handbookCategory ?? canonical.handbook;
    const name = canonical.name;
    const context = canonical.overviewUrl ?? canonical.unitTableUrl ?? canonical.sourceUrl ?? '';
    const matchingSources = (sourcesByKey.get(componentKey(handbook, name)) ?? []).filter((source) => {
      const urls = new Set([source.component?.overviewUrl, source.component?.unitTableUrl, ...(source.component?.tableUrls ?? [])].filter(Boolean));
      return !context || urls.has(context) || source.component?.overviewUrl === canonical.overviewUrl;
    });
    const roleRequirements = new Map<Role, Array<{ tableUrl: string; requirement: JsonObject }>>();
    for (const source of matchingSources) {
      for (const table of source.parsedTables ?? []) {
        for (const requirement of table.structure?.components ?? []) {
          const role = requirement.type as Role;
          roleRequirements.set(role, [...(roleRequirements.get(role) ?? []), { tableUrl: table.url, requirement }]);
        }
      }
    }
    const roles = roleRequirements.size > 0 ? [...roleRequirements.keys()] : [canonical.type as Role];
    for (const role of roles) {
      const requirements = roleRequirements.get(role) ?? [];
      const explicitTotals = [...new Set(requirements.map(({ requirement }) => Number(requirement.requiredCreditPoints)).filter(Number.isFinite))];
      const creditPoints = explicitTotals.length === 1 ? explicitTotals[0] : null;
      records.push({
        handbook, name, role,
        code: stableCode(handbook, role, name, context),
        context,
        sourceUrl: requirements[0]?.tableUrl ?? canonical.unitTableUrl ?? canonical.overviewUrl ?? canonical.sourceUrl ?? null,
        canonical,
        requirements,
        creditPoints,
      });
    }
  }
  const codes = new Set<string>();
  return records.filter((record) => !codes.has(record.code) && Boolean(codes.add(record.code)));
}

export async function importUsyd2026Components(): Promise<void> {
  const master = JSON.parse(await readFile(dataFile, 'utf8')) as JsonObject;
  const records = deriveRoleRecords(master);
  const university = await prisma.university.findUniqueOrThrow({ where: { code: 'USYD' } });
  const handbook = await prisma.handbookVersion.findUniqueOrThrow({
    where: { universityId_year: { universityId: university.id, year: 2026 } },
  });

  await prisma.$transaction(async (tx) => {
    const oldComponents = await tx.component.findMany({ where: { handbookVersionId: handbook.id } });
    const oldById = new Map(oldComponents.map((component) => [component.id, component]));
    const subjectIds = new Map((await tx.subject.findMany({
      where: { handbookVersionId: handbook.id }, select: { id: true, code: true },
    })).map((subject) => [subject.code, subject.id]));

    await tx.component.createMany({
      skipDuplicates: true,
      data: records.map((record) => ({
        handbookVersionId: handbook.id, code: record.code, name: record.name,
        type: prismaType(record.role), originalType: record.role,
        creditPoints: record.creditPoints, sourceUrl: record.sourceUrl,
        rawData: asJson({ ...record.canonical, role: record.role, identityContext: record.context }),
      })),
    });
    const componentUpdates = records.map((record) => ({
      code: record.code, name: record.name, type: prismaType(record.role), original_type: record.role,
      credit_points: record.creditPoints, source_url: record.sourceUrl,
      raw_data: { ...record.canonical, role: record.role, identityContext: record.context },
    }));
    await tx.$executeRaw`
      UPDATE "Component" AS component
      SET name = incoming.name,
          type = incoming.type::"ComponentType",
          "originalType" = incoming.original_type,
          "creditPoints" = incoming.credit_points,
          "sourceUrl" = incoming.source_url,
          "rawData" = incoming.raw_data
      FROM jsonb_to_recordset(${JSON.stringify(componentUpdates)}::jsonb)
        AS incoming(code text, name text, type text, original_type text, credit_points integer, source_url text, raw_data jsonb)
      WHERE component."handbookVersionId" = ${handbook.id} AND component.code = incoming.code
    `;

    const current = await tx.component.findMany({ where: { handbookVersionId: handbook.id } });
    const exact = new Map(current.map((component) => [
      `${component.code.split(':')[1]}:${slug(component.originalType ?? component.type)}:${slug(component.name)}`,
      component.id,
    ]));
    const degreeComponents = await tx.degreeComponent.findMany({
      where: { degree: { handbookVersionId: handbook.id } },
      select: { id: true, componentId: true, rawComponentName: true, rawComponentType: true },
    });
    const relationshipUpdates = degreeComponents.flatMap((relation) => {
      if (!relation.rawComponentName || !relation.rawComponentType) return [];
      const old = relation.componentId ? oldById.get(relation.componentId) : null;
      const handbookCode = old?.code.split(':')[1];
      if (!handbookCode) return [];
      const componentId = exact.get(`${handbookCode}:${slug(relation.rawComponentType)}:${slug(relation.rawComponentName)}`) ?? null;
      return [{ id: relation.id, component_id: componentId }];
    });
    await tx.$executeRaw`
      UPDATE "DegreeComponent" AS relationship
      SET "componentId" = incoming.component_id
      FROM jsonb_to_recordset(${JSON.stringify(relationshipUpdates)}::jsonb)
        AS incoming(id text, component_id text)
      WHERE relationship.id = incoming.id
    `;

    await tx.requirementGroup.deleteMany({ where: { component: { handbookVersionId: handbook.id } } });
    const componentIds = new Map((await tx.component.findMany({
      where: { handbookVersionId: handbook.id }, select: { id: true, code: true },
    })).map((component) => [component.code, component.id]));

    const groupRows: Prisma.RequirementGroupCreateManyInput[] = [];
    const itemRows: Prisma.RequirementItemCreateManyInput[] = [];
    for (const record of records) {
      const componentId = componentIds.get(record.code)!;
      const variants = record.requirements.filter(({ requirement }) => (requirement.requirementGroups?.length ?? 0) > 0);
      let variantIndex = 0;
      for (const variant of variants) {
        const parentId = variants.length > 1 ? randomUUID() : null;
        if (parentId) groupRows.push({
          id: parentId, componentId, sourceGroupId: `${record.code}:VARIANT:${variantIndex}`,
          title: variant.requirement.name ?? `Official ${record.role.toLowerCase()} pathway ${variantIndex + 1}`,
          description: variant.requirement.summary ?? null, logic: 'ALL', nodeType: 'VARIANT',
          status: 'AUTHORITATIVE', sourceUrl: variant.tableUrl, authoritative: true,
          requiredCreditPoints: Number.isFinite(Number(variant.requirement.requiredCreditPoints)) ? Number(variant.requirement.requiredCreditPoints) : null,
          sortOrder: variantIndex, rawData: asJson(variant.requirement),
        });
        for (const [groupIndex, rawGroup] of (variant.requirement.requirementGroups ?? []).entries()) {
          const groupId = randomUUID();
          groupRows.push({
            id: groupId, componentId, parentGroupId: parentId,
            sourceGroupId: `${record.code}:${slug(variant.tableUrl)}:${groupIndex}`,
            title: rawGroup.name ?? null, description: variant.requirement.summary ?? null,
            logic: logic(rawGroup.logic), nodeType: 'GROUP', status: 'AUTHORITATIVE',
            sourceUrl: variant.tableUrl, authoritative: true,
            requiredCreditPoints: Number.isFinite(Number(rawGroup.requiredCreditPoints)) ? Number(rawGroup.requiredCreditPoints) : null,
            sortOrder: groupIndex, rawData: asJson(rawGroup),
          });
          const units = rawGroup.units ?? [];
          itemRows.push(...units.map((unit: JsonObject, index: number) => ({
            requirementGroupId: groupId, itemType: 'SUBJECT' as const,
            subjectId: subjectIds.get(unit.code) ?? null, rawCode: unit.code ?? null,
            rawName: unit.name ?? null, creditPoints: Number.isFinite(Number(unit.creditPoints)) ? Number(unit.creditPoints) : null,
            sourceUrl: unit.sourceUrl ?? null, sortOrder: index, authoritative: true, rawData: asJson(unit),
          })));
        }
        variantIndex += 1;
      }
    }
    for (let index = 0; index < groupRows.length; index += 500) {
      await tx.requirementGroup.createMany({ data: groupRows.slice(index, index + 500) });
    }
    for (let index = 0; index < itemRows.length; index += 500) {
      await tx.requirementItem.createMany({ data: itemRows.slice(index, index + 500) });
    }
  }, { maxWait: 20_000, timeout: 180_000 });

  console.log(`Scoped USYD component import complete: ${records.length} role-specific components.`);
}

void importUsyd2026Components().finally(() => prisma.$disconnect()).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
