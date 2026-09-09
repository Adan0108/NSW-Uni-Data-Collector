import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../db/prisma.js';

const DATA_FILE = resolve(
  process.cwd(),
  process.env.USYD_DATA_FILE ??
    'data/normalized/usyd/2026/usyd-master-final.database-ready.json',
);

const UNIVERSITY_CODE = 'USYD';
const UNIVERSITY_NAME = 'The University of Sydney';
const HANDBOOK_YEAR = 2026;
const HANDBOOK_URL = 'https://www.sydney.edu.au/handbooks/';

type JsonObject = Record<string, unknown>;

interface UsydMaster {
  university: { code: string; name: string };
  handbookYear: number;
  metadata: JsonObject & {
    generatedAt?: string;
    coverage?: Record<string, boolean>;
    counts?: Record<string, number>;
  };
  degrees: JsonObject[];
  components: JsonObject[];
  componentRequirementObjects: JsonObject[];
  componentSources: JsonObject[];
  subjects: JsonObject[];
  unresolvedSubjectDetails: JsonObject[];
  subjectAccessConditions: JsonObject[];
  subjectRequisites: JsonObject[];
  degreeComponents: Array<{
    relationshipKind: 'EXPLICIT_NAMED' | 'CHOICE_POOL';
    data: JsonObject;
  }>;
  degreeRequirements: JsonObject[];
  degreeRequirementRoots: JsonObject[];
  studyPlans: JsonObject[];
}

interface ImportCounts {
  degrees: number;
  components: number;
  subjects: number;
  accessConditions: number;
  requisiteGroups: number;
  requisiteItems: number;
  relationshipSourceRecords: number;
  degreeComponentRows: number;
  requirementGroups: number;
  requirementItems: number;
  studyPlans: number;
  studyPlanYears: number;
  studyPlanPeriods: number;
  studyPlanItems: number;
  unresolvedReferences: number;
}

/**
 * Imports the referentially-audited USYD 2026 master into the shared schema.
 *
 * Rerun safety:
 * - only the USYD 2026 HandbookVersion is replaced;
 * - UTS, other universities and other handbook years are untouched;
 * - deletion cascades only through children of that USYD handbook version;
 * - the replacement runs in one transaction, so any failure rolls the old
 *   USYD 2026 handbook back instead of leaving a partial import.
 */
export async function importUsyd2026(): Promise<ImportCounts> {
  const master = await readMaster();
  validateMaster(master);

  console.log('================================');
  console.log('USYD 2026 DATABASE IMPORT');
  console.log('================================');

  const counts = await prisma.$transaction(
    async (tx) => {
      const university = await tx.university.upsert({
        where: { code: UNIVERSITY_CODE },
        update: { name: UNIVERSITY_NAME },
        create: { code: UNIVERSITY_CODE, name: UNIVERSITY_NAME },
      });
      
      const previous = await tx.handbookVersion.findUnique({
        where: {
          universityId_year: {
            universityId: university.id,
            year: HANDBOOK_YEAR,
          },
        },
        select: { id: true },
      });
      
      if (previous) {
        console.log('Existing USYD 2026 data found. Replacing only that handbook...');
        await tx.handbookVersion.delete({ where: { id: previous.id } });
      }
      
      const handbook = await tx.handbookVersion.create({
        data: {
          universityId: university.id,
          year: HANDBOOK_YEAR,
          sourceUrl: HANDBOOK_URL,
        },
      });
      
      const counts: ImportCounts = {
        degrees: 0,
        components: 0,
        subjects: 0,
        accessConditions: 0,
        requisiteGroups: 0,
        requisiteItems: 0,
        relationshipSourceRecords: master.degreeComponents.length,
        degreeComponentRows: 0,
        requirementGroups: 0,
        requirementItems: 0,
        studyPlans: 0,
        studyPlanYears: 0,
        studyPlanPeriods: 0,
        studyPlanItems: 0,
        unresolvedReferences: 0,
      };
      
      const componentCodeByRecord = buildComponentCodes(master.components);
      
      await tx.degree.createMany({
        data: master.degrees.map((degree) => ({
          handbookVersionId: handbook.id,
          code: requiredString(degree.code, 'degree.code'),
          name: requiredString(degree.title, 'degree.title'),
          creditPoints: numberOrNull(degree.totalCreditPoints),
          description: stringOrNull(degree.rawRequirements),
          rawData: toJson(degree),
        })),
      });
      
      const degreeIdByCode = await idMap(
        tx.degree.findMany({
          where: { handbookVersionId: handbook.id },
          select: { id: true, code: true },
        }),
      );
      counts.degrees = degreeIdByCode.size;
      
      /* USYD components have no native code. This deterministic code is stable
       * across reruns and distinguishes same-named roles in different handbooks. */
      await tx.component.createMany({
        data: master.components.map((component) => {
          const name = requiredString(component.name, 'component.name');
          const type = requiredString(component.type, `component ${name}.type`);
          /* Source-discovered components use handbookCategory. The nine audited
           * role supplements use handbook instead. Both fields represent the same
           * canonical handbook namespace and therefore produce the same stable
           * component code. */
          const handbookCategory = requiredString(
            firstString(component.handbookCategory, component.handbook),
            `component ${name}.handbookCategory/handbook`,
          );
      
          return {
            handbookVersionId: handbook.id,
            code: requiredMapValue(
              componentCodeByRecord,
              component,
              'generated component code',
            ),
            name,
            type: mapComponentType(type),
            originalType: type,
            creditPoints: numberOrNull(component.requiredCreditPoints),
            sourceUrl: firstString(
              component.sourceUrl,
              component.overviewUrl,
              component.unitTableUrl,
            ),
            rawData: toJson(component),
          };
        }),
      });
      
      const componentRows = await tx.component.findMany({
        where: { handbookVersionId: handbook.id },
        select: { id: true, code: true },
      });
      const componentIdByCode = new Map(
        componentRows.map((row) => [row.code, row.id]),
      );
      counts.components = componentIdByCode.size;
      
      await tx.subject.createMany({
        data: master.subjects.map((subject) => ({
          handbookVersionId: handbook.id,
          code: requiredString(subject.code, 'subject.code'),
          name: requiredString(subject.name, 'subject.name'),
          creditPoints: numberOrNull(subject.creditPoints),
          description: stringOrNull(subject.description),
          sourceYear: integerOrNull(subject.year),
          studyLevel: stringOrNull(subject.studyLevel),
          academicUnit: stringOrNull(subject.academicUnit),
          managingFaculty: stringOrNull(subject.managingFaculty),
          sourceUrl: stringOrNull(subject.sourceUrl),
          assumedKnowledge: accessText(subject.accessConditions, 'assumedKnowledge'),
          learningOutcomes: optionalJson(subject.learningOutcomes),
          offerings: optionalJson(subject.availabilities),
          rawData: toJson(subject),
        })),
      });
      
      const subjectIdByCode = await idMap(
        tx.subject.findMany({
          where: { handbookVersionId: handbook.id },
          select: { id: true, code: true },
        }),
      );
      counts.subjects = subjectIdByCode.size;
      
      /*
       * Batch access-condition rows first. The previous importer inserted one
       * SubjectAccessCondition per query and then scanned every requisite rule
       * again for every subject. With ~3k subjects this was the main transaction
       * bottleneck and caused P2028 after 10 minutes.
       */
      console.log('Importing subject access conditions...');
      const accessByCode = buildAccessConditionMap(master);
      const requisitesByUnitCode = buildRequisitesByUnitCode(master.subjectRequisites);

      if (accessByCode.size > 0) {
        await tx.subjectAccessCondition.createMany({
          data: [...accessByCode.entries()].map(([unitCode, access]) => {
            const relevantRules = requisitesByUnitCode.get(unitCode) ?? [];
            const rawConditions = ['prerequisite', 'corequisite', 'prohibition']
              .map((key) => stringOrNull(access[key]))
              .filter((value): value is string => value !== null);

            return {
              handbookVersionId: handbook.id,
              subjectId: subjectIdByCode.get(unitCode) ?? null,
              subjectCode: unitCode,
              subjectName: stringOrNull(access.unitName),
              hasConditions: relevantRules.length > 0 || rawConditions.length > 0,
            };
          }),
        });
      }

      const accessConditionRows = await tx.subjectAccessCondition.findMany({
        where: { handbookVersionId: handbook.id },
        select: { id: true, subjectCode: true },
      });
      const accessConditionIdByCode = new Map(
        accessConditionRows
          .filter((row): row is { id: string; subjectCode: string } => row.subjectCode !== null)
          .map((row) => [row.subjectCode, row.id]),
      );
      counts.accessConditions = accessConditionRows.length;

      console.log(`Imported ${counts.accessConditions} subject access conditions.`);
      console.log('Importing subject requisite groups/items...');

      /*
       * Batch requisite groups/items instead of creating one group per query.
       * We provide IDs ourselves so every item can reference its parent group
       * before either batch is written. This removes thousands of sequential
       * round trips while keeping the same relational structure.
       */
      const requisiteGroupRows: Prisma.SubjectRequisiteGroupCreateManyInput[] = [];
      const requisiteItemRows: Prisma.SubjectRequisiteItemCreateManyInput[] = [];

      for (const [unitCode, relevantRules] of requisitesByUnitCode) {
        const accessConditionId = accessConditionIdByCode.get(unitCode);
        if (!accessConditionId) {
          throw new Error(`Missing access-condition reference for requisite unit: ${unitCode}`);
        }

        for (const [ruleIndex, rule] of relevantRules.entries()) {
          const type = requiredString(rule.type, `${unitCode} requisite.type`);
          const rawText = requiredString(rule.rawText, `${unitCode} requisite.rawText`);
          const parsed = objectOrEmpty(rule.parsed);
          const referencedCodes = stringArray(parsed.unitCodes);
          const groupId = randomUUID();

          requisiteGroupRows.push({
            id: groupId,
            accessConditionId,
            groupType: mapRequisiteType(type),
            rule: rawText,
            sortOrder: ruleIndex,
            authoritative: booleanOrNull(rule.authoritative),
            containsUnparsedText: booleanOrNull(rule.containsUnparsedText),
            rawData: toJson(rule),
          });

          /* One row per referenced code keeps foreign-key navigation queryable.
           * A raw-only rule still receives one item, preserving text that could not
           * be safely resolved into unit codes. */
          const itemCodes: Array<string | null> =
            referencedCodes.length > 0 ? referencedCodes : [null];

          for (const [itemIndex, code] of itemCodes.entries()) {
            requisiteItemRows.push({
              id: randomUUID(),
              requisiteGroupId: groupId,
              itemKey: `${unitCode}:${type}:${ruleIndex}:${itemIndex}`,
              requisiteType: type,
              details: rawText,
              referencedSubjectId: code ? subjectIdByCode.get(code) ?? null : null,
              rawReferencedCodes: code ? toJson([code]) : optionalJson(parsed.unitPatterns),
              sortOrder: itemIndex,
              rawData: toJson({ parsedRoot: parsed.root ?? null, referencedCode: code }),
            });
          }
        }
      }

      await createManyInChunks(
        requisiteGroupRows,
        1_000,
        async (data) => {
          await tx.subjectRequisiteGroup.createMany({ data });
        },
      );

      await createManyInChunks(
        requisiteItemRows,
        2_000,
        async (data) => {
          await tx.subjectRequisiteItem.createMany({ data });
        },
      );

      counts.requisiteGroups = requisiteGroupRows.length;
      counts.requisiteItems = requisiteItemRows.length;

      console.log(
        `Imported ${counts.requisiteGroups} requisite groups and ${counts.requisiteItems} requisite items.`,
      );
      
      /* The flattened componentRequirementObjects array deliberately omits its
       * parent subject-area identity. componentSources retains that identity, so
       * import from it to avoid attaching a generic "Major" requirement to the
       * wrong canonical component. */
      for (const source of master.componentSources) {
        const sourceComponent = objectOrEmpty(source.component);
        const componentName = stringOrNull(sourceComponent.name);
        const handbookCategory = stringOrNull(sourceComponent.handbookCategory);
        if (!componentName || !handbookCategory) continue;
      
        for (const parsedTable of arrayOfObjects(source.parsedTables)) {
          const structure = objectOrEmpty(parsedTable.structure);
          for (const requirement of arrayOfObjects(structure.components)) {
            const type = stringOrNull(requirement.type);
            if (!type) continue;
      
        const canonicalRecord = resolveComponentRecord({
          handbookCategory,
          type,
          name: componentName,
          evidence: sourceComponent,
          components: master.components,
        });
        const code = canonicalRecord
          ? componentCodeByRecord.get(canonicalRecord)
          : undefined;
        const componentId = code ? componentIdByCode.get(code) : undefined;
      
            /* The six known role supplements have authoritative identities but no
             * parsed requirement source. Missing identities here remain a hard
             * skip because guessing would create a false foreign-key relation. */
            if (!componentId) continue;
      
            for (const [index, rawGroup] of arrayOfObjects(requirement.requirementGroups).entries()) {
              const group = await tx.requirementGroup.create({
                data: {
                  componentId,
                  sourceGroupId: `USYD:COMPONENT:${code}:${slug(String(parsedTable.url ?? 'TABLE'))}:${index}`,
                  title: stringOrNull(rawGroup.name),
                  description: stringOrNull(requirement.summary),
                  logic: mapRequirementLogic(rawGroup.logic),
                  nodeType: 'GROUP',
                  status: 'AUTHORITATIVE',
                  sourceUrl: stringOrNull(parsedTable.url),
                  authoritative: true,
                  requiredCreditPoints: numberOrNull(rawGroup.requiredCreditPoints),
                  sortOrder: index,
                  rawData: toJson(rawGroup),
                },
              });
              counts.requirementGroups += 1;
      
              const units = arrayOfObjects(rawGroup.units);
              if (units.length > 0) {
                await tx.requirementItem.createMany({
                  data: units.map((unit, unitIndex) => {
                    const codeValue = stringOrNull(unit.code);
                    return {
                      requirementGroupId: group.id,
                      itemType: 'SUBJECT' as const,
                      subjectId: codeValue ? subjectIdByCode.get(codeValue) ?? null : null,
                      rawCode: codeValue,
                      rawName: stringOrNull(unit.name),
                      creditPoints: numberOrNull(unit.creditPoints),
                      sourceUrl: stringOrNull(unit.sourceUrl),
                      sortOrder: unitIndex,
                      authoritative: true,
                      rawData: toJson(unit),
                    };
                  }),
                });
                counts.requirementItems += units.length;
              }
            }
          }
        }
      }
      
      /* Each semantic degree clause is preserved as a queryable group. Complex
       * AST nodes remain lossless in rawData instead of being guessed into an
       * incorrect relational meaning. */
      for (const clause of master.degreeRequirements) {
        const degreeCode = requiredString(clause.degreeCode, 'degreeRequirement.degreeCode');
        const degreeId = requiredMapValue(degreeIdByCode, degreeCode, 'degree');
        const node = objectOrEmpty(clause.node);
        const status = stringOrNull(clause.status);
        const group = await tx.requirementGroup.create({
          data: {
            degreeId,
            sourceGroupId: `USYD:DEGREE:${degreeCode}:${String(clause.sourcePath)}:${String(clause.sourceIndex)}`,
            title: firstString(node.title, node.label, clause.sourcePath),
            description: stringOrNull(clause.raw),
            logic: mapNodeLogic(node),
            nodeType: stringOrNull(node.nodeType),
            status,
            sourcePath: stringOrNull(clause.sourcePath),
            sourceIndex: integerOrNull(clause.sourceIndex),
            authoritative: status === 'AUTHORITATIVE',
            requiredCreditPoints: findCreditPoints(node),
            sortOrder: integerOrNull(clause.sourceIndex),
            rawData: toJson(clause),
          },
        });
        counts.requirementGroups += 1;
      
        const references = collectRequirementReferences(node);
        if (references.length > 0) {
          await tx.requirementItem.createMany({
            data: references.map((reference, index) => ({
              requirementGroupId: group.id,
              itemType: reference.kind,
              subjectId:
                reference.kind === 'SUBJECT'
                  ? subjectIdByCode.get(reference.value) ?? null
                  : null,
              componentId:
                reference.kind === 'COMPONENT'
                  ? findComponentIdByLooseReference(reference.value, master.components, componentIdByCode)
                  : null,
              rawCode: reference.kind === 'SUBJECT' ? reference.value : null,
              rawName: reference.kind !== 'SUBJECT' ? reference.value : null,
              sortOrder: index,
              authoritative: status === 'AUTHORITATIVE',
              rawData: toJson(reference.raw),
            })),
          });
          counts.requirementItems += references.length;
        }
      }
      
      for (const relationship of master.degreeComponents) {
        if (relationship.relationshipKind === 'EXPLICIT_NAMED') {
          const data = relationship.data;
          const degreeCode = requiredString(data.degreeCode, 'explicit relationship.degreeCode');
          const componentName = requiredString(data.componentName, 'explicit relationship.componentName');
          const componentType = requiredString(data.componentType, 'explicit relationship.componentType');
          const componentHandbook = requiredString(
            data.componentHandbook,
            'explicit relationship.componentHandbook',
          );
      
          await tx.degreeComponent.create({
            data: {
              degreeId: requiredMapValue(degreeIdByCode, degreeCode, 'degree'),
              componentId: resolveComponentId({
                handbookCategory: componentHandbook,
                type: componentType,
                name: componentName,
                evidence: data,
                components: master.components,
                componentCodeByRecord,
                componentIdByCode,
              }),
              rawComponentCode: stringOrNull(data.componentKey),
              rawComponentName: componentName,
              rawComponentType: componentType,
              relationshipKind: 'EXPLICIT_NAMED',
              authoritative: booleanOrNull(data.authoritative),
              rawData: toJson(data),
            },
          });
          counts.degreeComponentRows += 1;
          continue;
        }
      
        const data = relationship.data;
        const degreeCode = requiredString(data.degreeCode, 'choice pool.degreeCode');
        const candidates = arrayOfObjects(data.candidates);
        const pool = await tx.requirementGroup.create({
          data: {
            degreeId: requiredMapValue(degreeIdByCode, degreeCode, 'degree'),
            sourceGroupId: `USYD:CHOICE_POOL:${degreeCode}:${String(data.tableName)}:${String(data.requestedComponentType)}`,
            title: `${String(data.tableName)} ${String(data.requestedComponentType)} choice pool`,
            logic: 'ONE_OF',
            nodeType: 'COMPONENT',
            status: 'AUTHORITATIVE',
            authoritative: booleanOrNull(data.authoritative),
            rawData: toJson(data),
          },
        });
        counts.requirementGroups += 1;
      
        if (candidates.length > 0) {
          await tx.degreeComponent.createMany({
            data: candidates.map((candidate, index) => {
              /* Table S and the two Table A collectors use different field names
               * for the same candidate identity. Normalize both shapes here. */
              const name = requiredString(
                firstString(candidate.componentName, candidate.name),
                'choice candidate.componentName/name',
              );
              const canonicalType = requiredString(
                firstString(candidate.componentType, candidate.type),
                'choice candidate.componentType/type',
              );
              const handbookCategory = requiredString(
                firstString(candidate.componentHandbook, candidate.handbook, candidate.scope),
                'choice candidate.componentHandbook/handbook/scope',
              );
      
              return {
                degreeId: requiredMapValue(degreeIdByCode, degreeCode, 'degree'),
                /* A requested MINOR can legitimately resolve to the same canonical
                 * subject-area page catalogued under MAJOR. Prefer an exact role,
                 * then fall back to a unique same-handbook/name identity. The six
                 * audited Conservatorium warnings intentionally remain null. */
                componentId: resolveComponentIdentity({
                  handbookCategory,
                  type: canonicalType,
                  name,
                  evidence: candidate,
                  components: master.components,
                  componentCodeByRecord,
                  componentIdByCode,
                }),
                parentGroupId: pool.id,
                rawComponentName: name,
                rawComponentType: stringOrNull(data.requestedComponentType),
                relationshipKind: 'CHOICE_POOL_CANDIDATE',
                authoritative: booleanOrNull(data.authoritative),
                groupPath: stringOrNull(data.tableName),
                sortOrder: index,
                rawData: toJson(candidate),
              };
            }),
          });
          counts.degreeComponentRows += candidates.length;
        }
      }
      
      console.log('Importing study plans...');

      /*
       * Do not use one very deep nested Prisma create for StudyPlan -> Year ->
       * Period -> Item. With hundreds of plans and tens of thousands of items,
       * the adapter can generate a large nested write graph and may attempt item
       * inserts before their period rows are visible, producing a foreign-key
       * violation on StudyPlanItem.studyPlanPeriodId.
       *
       * Generate stable-in-this-import IDs up front and insert each FK layer in
       * order. This also turns 531 nested writes into a small number of bulk
       * queries while preserving the same shared relational schema.
       */
      const studyPlanRows: Prisma.StudyPlanCreateManyInput[] = [];
      const studyPlanYearRows: Prisma.StudyPlanYearCreateManyInput[] = [];
      const studyPlanPeriodRows: Prisma.StudyPlanPeriodCreateManyInput[] = [];
      const studyPlanItemRows: Prisma.StudyPlanItemCreateManyInput[] = [];

      for (const plan of master.studyPlans) {
        const degreeCode = requiredString(plan.degreeCode, 'studyPlan.degreeCode');
        const planId = randomUUID();
        const years = arrayOfObjects(plan.years);

        studyPlanRows.push({
          id: planId,
          degreeId: requiredMapValue(degreeIdByCode, degreeCode, 'degree'),
          sourcePlanId:
            stringOrNull(plan.sourcePlanId) ??
            `${degreeCode}:${String(plan.pathway)}:${String(plan.variantNumber)}`,
          title: requiredString(plan.title, 'studyPlan.title'),
          description: stringOrNull(plan.description),
          sourceUrl: stringOrNull(plan.sourceUrl),
          pathway: stringOrNull(plan.pathway),
          variantNumber: integerOrNull(plan.variantNumber),
          handbookYear: integerOrNull(plan.handbookYear),
          totalCreditPoints: numberOrNull(plan.totalCreditPoints),
          sourceType: stringOrNull(plan.sourceType),
          isFormalRequirement: booleanOrNull(plan.isFormalRequirement),
          rawData: toJson(plan),
        });

        counts.studyPlans += 1;
        counts.studyPlanYears += years.length;

        for (const [yearIndex, year] of years.entries()) {
          const yearId = randomUUID();
          const periods = arrayOfObjects(year.periods);

          studyPlanYearRows.push({
            id: yearId,
            studyPlanId: planId,
            name:
              firstString(year.label, `Year ${String(year.yearNumber)}`) ??
              `Year ${yearIndex + 1}`,
            yearNumber: integerOrNull(year.yearNumber),
            sortOrder: yearIndex,
          });

          counts.studyPlanPeriods += periods.length;

          for (const [periodIndex, period] of periods.entries()) {
            const periodId = randomUUID();
            const items = arrayOfObjects(period.items);

            studyPlanPeriodRows.push({
              id: periodId,
              studyPlanYearId: yearId,
              name: requiredString(period.name, 'studyPlan.period.name'),
              periodType: stringOrNull(period.periodType),
              periodNumber: integerOrNull(period.periodNumber),
              totalCreditPoints: numberOrNull(period.totalCreditPoints),
              sortOrder: periodIndex,
            });

            counts.studyPlanItems += items.length;

            for (const [itemIndex, item] of items.entries()) {
              const itemType = requiredString(
                item.itemType,
                'studyPlan.item.itemType',
              );
              const subjectCode = stringOrNull(item.subjectCode);

              if (itemType === 'SUBJECT' && !subjectCode) {
                throw new Error(
                  `Study-plan SUBJECT item has no subjectCode: ${degreeCode} / ${String(plan.title)}`,
                );
              }

              studyPlanItemRows.push({
                id: randomUUID(),
                studyPlanPeriodId: periodId,
                itemType: itemType === 'SUBJECT' ? 'SUBJECT' : 'CHOICE',
                subjectId: subjectCode
                  ? requiredMapValue(
                      subjectIdByCode,
                      subjectCode,
                      'study-plan subject',
                    )
                  : null,
                rawCode: subjectCode,
                title:
                  firstString(item.choiceText, item.rawText, subjectCode) ??
                  'Choice',
                creditPoints: numberOrNull(item.creditPoints),
                sourceUrl: stringOrNull(item.sourceUrl),
                numberOfPeriods: integerOrNull(item.numberOfPeriods),
                sortOrder: integerOrNull(item.sortOrder) ?? itemIndex,
                rawData: toJson(item),
              });
            }
          }
        }
      }

      console.log(
        `Prepared ${studyPlanRows.length} plans, ${studyPlanYearRows.length} years, ` +
          `${studyPlanPeriodRows.length} periods and ${studyPlanItemRows.length} items.`,
      );

      await createManyInChunks(studyPlanRows, 25, async (data) => {
        await tx.studyPlan.createMany({ data });
      });
      console.log(`Imported ${studyPlanRows.length} study plans.`);

      await createManyInChunks(studyPlanYearRows, 1000, async (data) => {
        await tx.studyPlanYear.createMany({ data });
      });
      console.log(`Imported ${studyPlanYearRows.length} study-plan years.`);

      await createManyInChunks(studyPlanPeriodRows, 1000, async (data) => {
        await tx.studyPlanPeriod.createMany({ data });
      });
      console.log(`Imported ${studyPlanPeriodRows.length} study-plan periods.`);

      await createManyInChunks(studyPlanItemRows, 1000, async (data) => {
        await tx.studyPlanItem.createMany({ data });
      });
      console.log(`Imported ${studyPlanItemRows.length} study-plan items.`);

      if (master.unresolvedSubjectDetails.length > 0) {
        await tx.unresolvedReference.createMany({
          data: master.unresolvedSubjectDetails.map((entry) => ({
            handbookVersionId: handbook.id,
            sourceEntityType: 'USYD_UNIT_DETAIL_COLLECTION',
            targetType: 'SUBJECT',
            targetCode: stringOrNull(entry.code),
            sourceUrl: stringOrNull(entry.url),
            reason: stringOrNull(entry.error),
          })),
        });
      }
      counts.unresolvedReferences = master.unresolvedSubjectDetails.length;
      
      const rootGeneratedAt = stringOrNull(master.metadata.generatedAt);
      await tx.sourceRecord.create({
        data: {
          handbookVersionId: handbook.id,
          entityType: 'USYD_FINAL_MASTER',
          entityCode: `${UNIVERSITY_CODE}:${HANDBOOK_YEAR}`,
          sourceUrl: HANDBOOK_URL,
          retrievedAt: rootGeneratedAt ? new Date(rootGeneratedAt) : new Date(),
          /* Keep compact audit/provenance metadata here. The complete source is
           * already retained in usyd-master-final.database-ready.json and is not
       * duplicated into
           * one oversized database JSON cell. */
          rawData: toJson({
            metadata: master.metadata,
            degreeRequirementRoots: master.degreeRequirementRoots,
          }),
        },
      });
      
      verifyImportedCounts(master, counts);
      await verifyPersistedCounts(tx, handbook.id, master);
      return counts;
    },
    {
      maxWait: 20_000,
      /*
       * This remains one atomic replacement transaction. The expensive
       * access-condition N+1 section is batched above; 20 minutes is now a
       * safety ceiling rather than the primary performance strategy.
       */
      timeout: 1_800_000,
    },
  );

  printCounts(counts);
  return counts;
}

async function readMaster(): Promise<UsydMaster> {
  return JSON.parse(await readFile(DATA_FILE, 'utf8')) as UsydMaster;
}

function validateMaster(master: UsydMaster): void {
  if (master.university?.code !== UNIVERSITY_CODE || master.handbookYear !== HANDBOOK_YEAR) {
    throw new Error('Expected the audited USYD 2026 final master.');
  }

  const missingCoverage = Object.entries(master.metadata.coverage ?? {})
    .filter(([, complete]) => complete !== true)
    .map(([name]) => name);
  if (missingCoverage.length > 0) {
    throw new Error(`USYD master has incomplete coverage: ${missingCoverage.join(', ')}`);
  }

  const expected = master.metadata.counts ?? {};
  assertCount('degrees', master.degrees.length, expected.degrees);
  assertCount('canonicalComponents', master.components.length, expected.canonicalComponents);
  assertCount('subjects', master.subjects.length, expected.subjects);
  assertCount(
    'totalDegreeComponentRelationshipRecords',
    master.degreeComponents.length,
    expected.totalDegreeComponentRelationshipRecords,
  );
  assertCount('degreeRequirementClauses', master.degreeRequirements.length, expected.degreeRequirementClauses);
  assertCount('studyPlans', master.studyPlans.length, expected.studyPlans);
}

function buildAccessConditionMap(master: UsydMaster): Map<string, JsonObject> {
  const result = new Map<string, JsonObject>();
  for (const access of master.subjectAccessConditions) {
    const code = stringOrNull(access.unitCode);
    if (code) result.set(code, access);
  }

  /* Supplements may be embedded in subjects before they appear in the frozen
   * access-condition array. Add only missing codes; authoritative frozen rows
   * always win. */
  for (const subject of master.subjects) {
    const code = stringOrNull(subject.code);
    const access = objectOrEmpty(subject.accessConditions);
    if (code && Object.keys(access).length > 0 && !result.has(code)) {
      result.set(code, { unitCode: code, unitName: subject.name, ...access });
    }
  }
  return result;
}

function buildRequisitesByUnitCode(
  rules: JsonObject[],
): Map<string, JsonObject[]> {
  const result = new Map<string, JsonObject[]>();

  for (const rule of rules) {
    const unitCode = stringOrNull(rule.unitCode);
    if (!unitCode) continue;

    const existing = result.get(unitCode) ?? [];
    existing.push(rule);
    result.set(unitCode, existing);
  }

  return result;
}

function verifyImportedCounts(master: UsydMaster, counts: ImportCounts): void {
  if (counts.degrees !== master.degrees.length) throw new Error('Imported degree count mismatch.');
  if (counts.components !== master.components.length) throw new Error('Imported component count mismatch.');
  if (counts.subjects !== master.subjects.length) throw new Error('Imported subject count mismatch.');
  if (counts.relationshipSourceRecords !== master.degreeComponents.length) {
    throw new Error('Degree-component source relationship count mismatch.');
  }
  if (counts.studyPlans !== master.studyPlans.length) throw new Error('Imported study-plan count mismatch.');
  if (counts.unresolvedReferences !== master.unresolvedSubjectDetails.length) {
    throw new Error('Imported unresolved-reference count mismatch.');
  }
}

async function verifyPersistedCounts(
  tx: Prisma.TransactionClient,
  handbookVersionId: string,
  master: UsydMaster,
): Promise<void> {
  const expectedCuspPlans = master.studyPlans.filter(
    (plan) => stringOrNull(plan.sourceType) === 'CUSP',
  ).length;

  const [degrees, components, subjects, studyPlans, cuspStudyPlans] =
    await Promise.all([
      tx.degree.count({
        where: { handbookVersionId },
      }),
      tx.component.count({
        where: { handbookVersionId },
      }),
      tx.subject.count({
        where: { handbookVersionId },
      }),
      tx.studyPlan.count({
        where: {
          degree: {
            handbookVersionId,
          },
        },
      }),
      tx.studyPlan.count({
        where: {
          degree: {
            handbookVersionId,
          },
          sourceType: 'CUSP',
        },
      }),
    ]);

  if (degrees !== master.degrees.length) {
    throw new Error(
      `Persisted degree count mismatch: expected ${master.degrees.length}, found ${degrees}.`,
    );
  }

  if (components !== master.components.length) {
    throw new Error(
      `Persisted component count mismatch: expected ${master.components.length}, found ${components}.`,
    );
  }

  if (subjects !== master.subjects.length) {
    throw new Error(
      `Persisted subject count mismatch: expected ${master.subjects.length}, found ${subjects}.`,
    );
  }

  if (studyPlans !== master.studyPlans.length) {
    throw new Error(
      `Persisted study-plan count mismatch: expected ${master.studyPlans.length}, found ${studyPlans}.`,
    );
  }

  if (cuspStudyPlans !== expectedCuspPlans) {
    throw new Error(
      `Persisted CUSP study-plan count mismatch: expected ${expectedCuspPlans}, found ${cuspStudyPlans}.`,
    );
  }
}

function printCounts(counts: ImportCounts): void {
  console.log('================================');
  console.log('USYD 2026 IMPORT PASS');
  console.log('================================');
  for (const [name, count] of Object.entries(counts)) console.log(`${name}: ${count}`);
  console.log('UTS data was not modified.');
}

function mapComponentType(value: string) {
  const known = new Set([
    'MAJOR', 'MINOR', 'PROGRAM', 'SUB_MAJOR', 'STREAM', 'SPECIALISATION',
    'MAJOR_EXTENSION', 'CHOICE_BLOCK', 'ELECTIVE_POOL', 'GENERAL_EDUCATION',
    'CAPSTONE', 'HONOURS', 'PLACEMENT', 'OTHER',
  ]);
  return (known.has(value) ? value : 'OTHER') as
    | 'MAJOR' | 'MINOR' | 'PROGRAM' | 'SUB_MAJOR' | 'STREAM'
    | 'SPECIALISATION' | 'MAJOR_EXTENSION' | 'CHOICE_BLOCK'
    | 'ELECTIVE_POOL' | 'GENERAL_EDUCATION' | 'CAPSTONE'
    | 'HONOURS' | 'PLACEMENT' | 'OTHER';
}

function mapRequisiteType(value: string) {
  if (value === 'PREREQUISITE' || value === 'COREQUISITE' || value === 'PROHIBITION') return value;
  throw new Error(`Unsupported USYD requisite type: ${value}`);
}

function mapRequirementLogic(value: unknown) {
  return value === 'ALL' || value === 'ANY' || value === 'ONE_OF' ? value : 'UNKNOWN';
}

function mapNodeLogic(node: JsonObject) {
  const operator = firstString(node.logic, node.operator);
  if (operator === 'AND' || operator === 'ALL') return 'ALL' as const;
  if (operator === 'OR' || operator === 'ANY') return 'ANY' as const;
  if (operator === 'ONE_OF') return 'ONE_OF' as const;
  return 'UNKNOWN' as const;
}

function componentCode(handbookCategory: string, type: string, name: string): string {
  return `USYD:${slug(handbookCategory)}:${slug(type)}:${slug(name)}`;
}

function buildComponentCodes(components: JsonObject[]): Map<JsonObject, string> {
  const recordsByBase = new Map<string, JsonObject[]>();

  for (const component of components) {
    const name = requiredString(component.name, 'component.name');
    const type = requiredString(component.type, `component ${name}.type`);
    const handbook = requiredString(
      firstString(component.handbookCategory, component.handbook),
      `component ${name}.handbookCategory/handbook`,
    );
    const base = componentCode(handbook, type, name);
    const records = recordsByBase.get(base) ?? [];
    records.push(component);
    recordsByBase.set(base, records);
  }

  const result = new Map<JsonObject, string>();
  for (const [base, records] of recordsByBase) {
    if (records.length === 1) {
      result.set(records[0], base);
      continue;
    }

    for (const record of records) {
      const identityUrl = componentIdentityUrl(record);
      if (!identityUrl) {
        throw new Error(`Duplicate component identity has no source URL: ${base}`);
      }
      const suffix = createHash('sha256').update(identityUrl).digest('hex').slice(0, 12).toUpperCase();
      result.set(record, `${base}:${suffix}`);
    }
  }

  if (new Set(result.values()).size !== components.length) {
    throw new Error('Generated USYD component codes are not unique.');
  }
  return result;
}

function slug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/&/g, ' AND ').replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function findComponentIdByLooseReference(
  name: string,
  components: JsonObject[],
  ids: Map<string, string>,
): string | null {
  const matches = components.filter((component) => component.name === name);
  if (matches.length !== 1) return null;
  const component = matches[0];
  return ids.get(componentCode(
    requiredString(
      firstString(component.handbookCategory, component.handbook),
      `${name}.handbookCategory/handbook`,
    ),
    requiredString(component.type, `${name}.type`),
    name,
  )) ?? null;
}

function resolveComponentIdentity(params: {
  handbookCategory: string;
  type: string;
  name: string;
  evidence: JsonObject;
  components: JsonObject[];
  componentCodeByRecord: Map<JsonObject, string>;
  componentIdByCode: Map<string, string>;
}): string | null {
  return resolveComponentId(params);
}

function resolveComponentId(params: {
  handbookCategory: string;
  type: string;
  name: string;
  evidence: JsonObject;
  components: JsonObject[];
  componentCodeByRecord: Map<JsonObject, string>;
  componentIdByCode: Map<string, string>;
}): string | null {
  const record = resolveComponentRecord(params);
  if (!record) return null;
  const code = params.componentCodeByRecord.get(record);
  return code ? params.componentIdByCode.get(code) ?? null : null;
}

function resolveComponentRecord(params: {
  handbookCategory: string;
  type: string;
  name: string;
  evidence: JsonObject;
  components: JsonObject[];
}): JsonObject | null {
  const sameNameAndHandbook = params.components.filter((component) =>
    firstString(component.handbookCategory, component.handbook) === params.handbookCategory
    /* Candidate catalogs vary only in capitalization for a few names, e.g.
     * Hebrew (modern) vs Hebrew (Modern). Compare their stable slug while
     * preserving the authoritative display name in Component.name. */
    && typeof component.name === 'string'
    && slug(component.name) === slug(params.name),
  );
  const exactRole = sameNameAndHandbook.filter((component) => component.type === params.type);
  const candidates = exactRole.length > 0 ? exactRole : sameNameAndHandbook;
  if (candidates.length === 1) return candidates[0];
  if (candidates.length === 0) return null;

  const evidenceUrls = componentUrls(params.evidence);
  const sourceMatched = candidates.filter((candidate) =>
    [...componentUrls(candidate)].some((url: string) => evidenceUrls.has(url)),
  );
  return sourceMatched.length === 1 ? sourceMatched[0] : null;
}

function componentIdentityUrl(component: JsonObject): string | null {
  return firstString(
    component.overviewUrl,
    component.unitTableUrl,
    component.sourceUrl,
    stringArray(component.tableUrls)[0],
  );
}

function componentUrls(component: JsonObject): Set<string> {
  return new Set([
    stringOrNull(component.overviewUrl),
    stringOrNull(component.unitTableUrl),
    stringOrNull(component.sourceUrl),
    stringOrNull(component.evidenceUrl),
    ...stringArray(component.tableUrls),
  ].filter((value): value is string => value !== null));
}

function collectRequirementReferences(node: unknown): Array<{
  kind: 'SUBJECT' | 'COMPONENT' | 'TABLE' | 'RAW';
  value: string;
  raw: unknown;
}> {
  const found: Array<{ kind: 'SUBJECT' | 'COMPONENT' | 'TABLE' | 'RAW'; value: string; raw: unknown }> = [];
  const seen = new Set<string>();

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isObject(value)) return;

    const nodeType = stringOrNull(value.nodeType);
    let kind: 'SUBJECT' | 'COMPONENT' | 'TABLE' | 'RAW' | null = null;
    if (nodeType === 'SUBJECT') kind = 'SUBJECT';
    else if (nodeType === 'COMPONENT') kind = 'COMPONENT';
    else if (nodeType === 'TABLE') kind = 'TABLE';

    if (kind) {
      const reference = firstString(
        value.code,
        value.subjectCode,
        value.componentName,
        value.name,
        value.tableName,
        value.raw,
      );
      if (reference) {
        const key = `${kind}:${reference}`;
        if (!seen.has(key)) {
          seen.add(key);
          found.push({ kind, value: reference, raw: value });
        }
      }
    }
    Object.values(value).forEach(visit);
  };

  visit(node);
  return found;
}

function findCreditPoints(node: JsonObject): number | null {
  return numberOrNull(node.requiredCreditPoints ?? node.creditPoints);
}

function accessText(value: unknown, key: string): string | null {
  return stringOrNull(objectOrEmpty(value)[key]);
}

function objectOrEmpty(value: unknown): JsonObject {
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function requiredString(value: unknown, label: string): string {
  const result = stringOrNull(value);
  if (!result) throw new Error(`Missing ${label}.`);
  return result;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const result = stringOrNull(value);
    if (result) return result;
  }
  return null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function integerOrNull(value: unknown): number | null {
  const number = numberOrNull(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function optionalJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined || value === null ? undefined : toJson(value);
}

async function createManyInChunks<T>(
  rows: T[],
  chunkSize: number,
  createChunk: (rows: T[]) => Promise<void>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) {
    await createChunk(rows.slice(index, index + chunkSize));
  }
}

async function idMap(
  rowsPromise: Promise<Array<{ id: string; code: string }>>,
): Promise<Map<string, string>> {
  const rows = await rowsPromise;
  return new Map(rows.map((row) => [row.code, row.id]));
}

function requiredMapValue<K>(
  map: Map<K, string>,
  key: K,
  label: string,
): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing ${label} reference: ${key}`);
  return value;
}

function assertCount(label: string, actual: number, expected: number | undefined): void {
  if (expected !== undefined && actual !== expected) {
    throw new Error(`${label}: expected ${expected}, found ${actual}.`);
  }
}

async function main(): Promise<void> {
  try {
    await importUsyd2026();
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = process.argv[1]?.replace(/\\/g, '/').endsWith('/usyd-2026.import.ts');
if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
