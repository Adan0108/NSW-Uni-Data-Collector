import {
  readFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

import {
  Prisma,
} from '../generated/prisma/client.js';

import {
  prisma,
} from '../db/prisma.js';

/*
 * ------------------------------------------------
 * CONSTANTS
 * ------------------------------------------------
 */

const UNIVERSITY_CODE =
  'UTS';

const UNIVERSITY_NAME =
  'University of Technology Sydney';

const HANDBOOK_YEAR =
  2026;

const HANDBOOK_URL =
  'https://coursehandbook.uts.edu.au';

const DATA_DIRECTORY =
  resolve(
    process.cwd(),
    'data',
    'normalized',
    'uts',
    '2026',
  );

/*
 * ------------------------------------------------
 * SOURCE TYPES
 * ------------------------------------------------
 */

interface StructureItem {
  type: string;
  code?: string;
  name?: string;
  creditPoints?: number;
  url?: string;
  order?: number;
}

interface StructureGroup {
  id?: string;
  title?: string;
  description?: string;
  logic?: string;
  requiredCreditPoints?: number;
  maximumCreditPoints?: number;
  items?: StructureItem[];
  children?: StructureGroup[];
  order?: number;
}

interface Structure {
  code?: string;
  name?: string;
  creditPoints?: number;
  groups?: StructureGroup[];
}

interface CourseRecord {
  code: string;
  name: string;
  creditPoints?: number;
  year?: string;
  area?: string;
  studyLevel?: string;
  structure?: Structure;
  raw?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AosRecord {
  code: string;
  name: string;
  type: string;
  creditPoints?: number;
  year?: string;
  area?: string;
  structure?: Structure;
  [key: string]: unknown;
}

interface SubjectRecord {
  code: string;
  name: string;
  creditPoints?: number;
  year?: string;
  area?: string;
  description?: string;
  overview?: unknown;
  assessment?: unknown;
  learningOutcomes?: unknown;
  offerings?: unknown;
  [key: string]: unknown;
}

interface DegreeComponentRelationship {
  degreeCode: string;
  componentCode: string;
  componentName?: string;
  componentType?: string;
  requiredCreditPoints?: number;
  parentGroup?: string;
  path?: string[];
  containerPath?: string[];
  order?: number;
}

interface StudyPlanItemRecord {
  type: 'SUBJECT' | 'CHOICE';
  code?: string;
  title: string;
  creditPoints?: number;
  url?: string;
  custom?: boolean;
  order?: number;
  numberOfPeriods?: number;
}

interface StudyPlanPeriodRecord {
  name: string;
  order?: number;
  items?: StudyPlanItemRecord[];
}

interface StudyPlanYearRecord {
  name: string;
  order?: number;
  periods?: StudyPlanPeriodRecord[];
}

interface StudyPlanRecord {
  id: string;
  title: string;
  description?: string;
  url?: string;
  courseCode: string;
  courseName?: string;
  courseCreditPoints?: number;
  years?: StudyPlanYearRecord[];
}

interface AccessConditionItemRecord {
  id: string;
  sourceType: string;
  details: string;
  referencedCodes?: string[];
}

interface AccessConditionGroupRecord {
  rule?: string;
  items?: AccessConditionItemRecord[];
}

interface AntiRequisiteItemRecord {
  id: string;
  details: string;
  referencedCodes?: string[];
}

interface AccessConditionRecord {
  subjectCode: string;
  subjectName?: string;
  requisiteGroups?: AccessConditionGroupRecord[];
  antiRequisiteRule?: string;
  antiRequisites?: AntiRequisiteItemRecord[];
  hasConditions: boolean;
}

interface UnresolvedAosRecord {
  degreeCode: string;
  componentCode: string;
  componentName?: string;
  componentType?: string;
  requiredCreditPoints?: number;
  parentGroup?: string;
  path?: string[];
  containerPath?: string[];
  order?: number;
}

interface UnresolvedSubjectRecord {
  code: string;
  name?: string;
  creditPoints?: number;
  url?: string;
  sourceType?: string;
  sourceCode?: string;
  sourceName?: string;
  groupPath?: string;
}

interface YearMismatchRecord {
  code: string;
  name?: string;
  creditPoints?: number;
  url?: string;
  sourceType?: string;
  sourceCode?: string;
  sourceName?: string;
  groupPath?: string;
}

interface SummaryRecord {
  university: string;
  handbookYear: string;

  courses: {
    total: number;
  };

  aos: {
    total: number;
    unresolvedRelationships: number;
    unresolvedUniqueCodes: number;
  };

  subjects: {
    globalCatalogue: number;
    referencedRelationships: number;
    referencedUnique: number;
    unresolvedReferenced: number;
    yearMismatchReferences: number;
  };

  studyPlans: {
    total: number;
    years: number;
    periods: number;
    items: number;
    subjects: number;
    choices: number;
  };

  accessConditions: {
    requestedSubjects: number;
    collected: number;
    withConditions: number;
    withoutConditions: number;
    conditionItems: number;
    failures: number;
  };

  degreeComponentRelationships: number;
}

/*
 * ------------------------------------------------
 * MAIN
 * ------------------------------------------------
 */

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'UTS 2026 DATABASE IMPORT',
  );

  console.log(
    '================================',
  );

  const [
    courses,
    aos,
    subjects,
    degreeComponentRelationships,
    studyPlans,
    accessConditions,
    unresolvedAos,
    unresolvedSubjects,
    yearMismatches,
    summary,
  ] =
    await Promise.all([
      readJson<CourseRecord[]>(
        'courses.json',
      ),

      readJson<AosRecord[]>(
        'aos.json',
      ),

      readJson<SubjectRecord[]>(
        'subjects.json',
      ),

      readJson<DegreeComponentRelationship[]>(
        'degree-component-relationships.json',
      ),

      readJson<StudyPlanRecord[]>(
        'study-plans.json',
      ),

      readJson<AccessConditionRecord[]>(
        'access-conditions.json',
      ),

      readJson<UnresolvedAosRecord[]>(
        'unresolved-aos.json',
      ),

      readJson<UnresolvedSubjectRecord[]>(
        'unresolved-subjects.json',
      ),

      readJson<YearMismatchRecord[]>(
        'subject-year-mismatches.json',
      ),

      readJson<SummaryRecord>(
        'summary.json',
      ),
    ]);

  validateInputCounts(
    summary,
    courses,
    aos,
    subjects,
    degreeComponentRelationships,
    studyPlans,
    accessConditions,
    unresolvedAos,
    unresolvedSubjects,
    yearMismatches,
  );

  /*
   * Create the university once.
   */
  const university =
    await prisma.university.upsert({
      where: {
        code: UNIVERSITY_CODE,
      },

      update: {
        name: UNIVERSITY_NAME,
      },

      create: {
        code: UNIVERSITY_CODE,

        name: UNIVERSITY_NAME,
      },
    });

  /*
   * Make the import rerunnable.
   *
   * If UTS 2026 already exists, remove that
   * handbook version. All its child records
   * cascade according to our Prisma schema.
   *
   * This does NOT delete another year such as
   * UTS 2025 and does not delete another
   * university.
   */
  const existingHandbook =
    await prisma.handbookVersion.findUnique({
      where: {
        universityId_year: {
          universityId:
            university.id,

          year:
            HANDBOOK_YEAR,
        },
      },
    });

  if (existingHandbook) {
    console.log(
      'Existing UTS 2026 data found. Replacing it...',
    );

    await prisma.handbookVersion.delete({
      where: {
        id:
          existingHandbook.id,
      },
    });
  }

  const handbook =
    await prisma.handbookVersion.create({
      data: {
        universityId:
          university.id,

        year:
          HANDBOOK_YEAR,

        sourceUrl:
          HANDBOOK_URL,
      },
    });

  console.log(
    `Handbook created: ${UNIVERSITY_CODE} ${HANDBOOK_YEAR}`,
  );

  /*
   * ------------------------------------------------
   * DEGREES
   * ------------------------------------------------
   */

  await prisma.degree.createMany({
    data:
      courses.map(
        (
          course,
        ) => ({
          handbookVersionId:
            handbook.id,

          code:
            course.code,

          name:
            course.name.trim(),

          creditPoints:
            numberOrNull(
              course.creditPoints,
            ),

          description:
            getRawString(
              course.raw,
              'description',
            ),

          /*
           * Preserve the complete normalized
           * course object as well.
           */
          rawData:
            toJson(
              course,
            ),
        }),
      ),
  });

  const degreeRows =
    await prisma.degree.findMany({
      where: {
        handbookVersionId:
          handbook.id,
      },

      select: {
        id: true,
        code: true,
      },
    });

  const degreeIdByCode =
    new Map(
      degreeRows.map(
        (
          row,
        ) => [
          row.code,
          row.id,
        ],
      ),
    );

  console.log(
    `Degrees imported: ${degreeRows.length}`,
  );

  /*
   * ------------------------------------------------
   * COMPONENTS / AOS
   * ------------------------------------------------
   */

  await prisma.component.createMany({
    data:
      aos.map(
        (
          component,
        ) => ({
          handbookVersionId:
            handbook.id,

          code:
            component.code,

          name:
            cleanComponentName(
              component.name,
              component.code,
            ),

          type:
            mapComponentType(
              component.type,
            ),

          originalType:
            component.type,

          creditPoints:
            numberOrNull(
              component.creditPoints,
            ),

          rawData:
            toJson(
              component,
            ),
        }),
      ),
  });

  const componentRows =
    await prisma.component.findMany({
      where: {
        handbookVersionId:
          handbook.id,
      },

      select: {
        id: true,
        code: true,
      },
    });

  const componentIdByCode =
    new Map(
      componentRows.map(
        (
          row,
        ) => [
          row.code,
          row.id,
        ],
      ),
    );

  console.log(
    `Components imported: ${componentRows.length}`,
  );

  /*
   * ------------------------------------------------
   * SUBJECT CATALOGUE
   * ------------------------------------------------
   */

  await prisma.subject.createMany({
    data:
      subjects.map(
        (
          subject,
        ) => ({
          handbookVersionId:
            handbook.id,

          code:
            subject.code,

          name:
            subject.name.trim(),

          creditPoints:
            numberOrNull(
              subject.creditPoints,
            ),

          description:
            stringOrNull(
              subject.description,
            ),

          overview:
            optionalJson(
              subject.overview,
            ),

          assessment:
            optionalJson(
              subject.assessment,
            ),

          learningOutcomes:
            optionalJson(
              subject.learningOutcomes,
            ),

          offerings:
            optionalJson(
              subject.offerings,
            ),

          /*
           * Preserve the entire normalized
           * subject object.
           */
          rawData:
            toJson(
              subject,
            ),
        }),
      ),
  });

  const subjectRows =
    await prisma.subject.findMany({
      where: {
        handbookVersionId:
          handbook.id,
      },

      select: {
        id: true,
        code: true,
      },
    });

  const subjectIdByCode =
    new Map(
      subjectRows.map(
        (
          row,
        ) => [
          row.code,
          row.id,
        ],
      ),
    );

  console.log(
    `Catalogue subjects imported: ${subjectRows.length}`,
  );

  /*
   * ------------------------------------------------
   * REQUIREMENT STRUCTURES
   * ------------------------------------------------
   *
   * Import both:
   *
   * Degree -> requirement groups
   *
   * Component -> requirement groups
   *
   * Requirement groups remain nested.
   */

  const requirementGroupIdByOwnerAndSourceId =
    new Map<string, string>();

  let requirementGroupCount =
    0;

  let requirementItemCount =
    0;

  for (const course of courses) {
    const degreeId =
      degreeIdByCode.get(
        course.code,
      );

    if (!degreeId) {
      throw new Error(
        `Degree not found while importing structure: ${course.code}`,
      );
    }

    for (
      const group
      of course.structure?.groups ?? []
    ) {
      const result =
        await importRequirementGroup({
          group,

          degreeId,

          componentId:
            undefined,

          ownerType:
            'DEGREE',

          ownerCode:
            course.code,

          parentGroupId:
            undefined,

          requirementGroupIdByOwnerAndSourceId,

          subjectIdByCode,

          componentIdByCode,
        });

      requirementGroupCount +=
        result.groups;

      requirementItemCount +=
        result.items;
    }
  }

  for (const component of aos) {
    const componentId =
      componentIdByCode.get(
        component.code,
      );

    if (!componentId) {
      throw new Error(
        `Component not found while importing structure: ${component.code}`,
      );
    }

    for (
      const group
      of component.structure?.groups ?? []
    ) {
      const result =
        await importRequirementGroup({
          group,

          degreeId:
            undefined,

          componentId,

          ownerType:
            'COMPONENT',

          ownerCode:
            component.code,

          parentGroupId:
            undefined,

          requirementGroupIdByOwnerAndSourceId,

          subjectIdByCode,

          componentIdByCode,
        });

      requirementGroupCount +=
        result.groups;

      requirementItemCount +=
        result.items;
    }
  }

  console.log(
    `Requirement groups imported: ${requirementGroupCount}`,
  );

  console.log(
    `Requirement items imported: ${requirementItemCount}`,
  );

  /*
   * ------------------------------------------------
   * DEGREE -> COMPONENT RELATIONSHIPS
   * ------------------------------------------------
   */

  const degreeComponentRows =
    degreeComponentRelationships.map(
      (
        relationship,
      ) => {
        const degreeId =
          degreeIdByCode.get(
            relationship.degreeCode,
          );

        if (!degreeId) {
          throw new Error(
            `Degree missing for degree-component relationship: ${relationship.degreeCode}`,
          );
        }

        const sourceGroupId =
          relationship.containerPath?.at(
            -1,
          );

        const parentGroupId =
          sourceGroupId
            ? requirementGroupIdByOwnerAndSourceId.get(
                makeRequirementGroupKey(
                  'DEGREE',
                  relationship.degreeCode,
                  sourceGroupId,
                ),
              )
            : undefined;

        return {
          degreeId,

          componentId:
            componentIdByCode.get(
              relationship.componentCode,
            ) ?? null,

          parentGroupId:
            parentGroupId ?? null,

          rawComponentCode:
            relationship.componentCode,

          rawComponentName:
            stringOrNull(
              relationship.componentName,
            ),

          requiredCreditPoints:
            numberOrNull(
              relationship.requiredCreditPoints,
            ),

          groupPath:
            relationship.path?.join(
              ' > ',
            ) ?? null,

          containerPath:
            relationship.containerPath?.join(
              ' > ',
            ) ?? null,

          sortOrder:
            numberOrNull(
              relationship.order,
            ),
        };
      },
    );

  await prisma.degreeComponent.createMany({
    data:
      degreeComponentRows,
  });

  console.log(
    `Degree-component relationships imported: ${degreeComponentRows.length}`,
  );

  /*
   * ------------------------------------------------
   * STUDY PLANS
   * ------------------------------------------------
   */

  let studyPlanCount =
    0;

  let studyPlanYearCount =
    0;

  let studyPlanPeriodCount =
    0;

  let studyPlanItemCount =
    0;

  for (const plan of studyPlans) {
    const degreeId =
      degreeIdByCode.get(
        plan.courseCode,
      );

    if (!degreeId) {
      throw new Error(
        `Degree missing for study plan ${plan.id}: ${plan.courseCode}`,
      );
    }

    const years =
      plan.years ?? [];

    await prisma.studyPlan.create({
      data: {
        degreeId,

        sourcePlanId:
          plan.id,

        title:
          plan.title,

        description:
          stringOrNull(
            plan.description,
          ),

        sourceUrl:
          stringOrNull(
            plan.url,
          ),

        years: {
          create:
            years.map(
              (
                year,
              ) => ({
                name:
                  year.name,

                sortOrder:
                  numberOrNull(
                    year.order,
                  ),

                periods: {
                  create:
                    (
                      year.periods ??
                      []
                    ).map(
                      (
                        period,
                      ) => ({
                        name:
                          period.name,

                        sortOrder:
                          numberOrNull(
                            period.order,
                          ),

                        items: {
                          create:
                            (
                              period.items ??
                              []
                            ).map(
                              (
                                item,
                              ) => ({
                                itemType:
                                  item.type,

                                subjectId:
                                  item.type ===
                                    'SUBJECT' &&
                                  item.code
                                    ? subjectIdByCode.get(
                                        item.code,
                                      ) ??
                                      null
                                    : null,

                                rawCode:
                                  item.code ??
                                  null,

                                title:
                                  item.title,

                                creditPoints:
                                  numberOrNull(
                                    item.creditPoints,
                                  ),

                                sourceUrl:
                                  stringOrNull(
                                    item.url,
                                  ),

                                numberOfPeriods:
                                  numberOrNull(
                                    item.numberOfPeriods,
                                  ),

                                sortOrder:
                                  numberOrNull(
                                    item.order,
                                  ),
                              }),
                            ),
                        },
                      }),
                    ),
                },
              }),
            ),
        },
      },
    });

    studyPlanCount +=
      1;

    studyPlanYearCount +=
      years.length;

    for (const year of years) {
      studyPlanPeriodCount +=
        year.periods?.length ??
        0;

      for (
        const period
        of year.periods ?? []
      ) {
        studyPlanItemCount +=
          period.items?.length ??
          0;
      }
    }

    if (
      studyPlanCount %
        50 ===
      0
    ) {
      console.log(
        `Study plans imported: ${studyPlanCount}/${studyPlans.length}`,
      );
    }
  }

  console.log(
    `Study plans imported: ${studyPlanCount}`,
  );

  /*
   * ------------------------------------------------
   * ACCESS CONDITIONS
   * ------------------------------------------------
   *
   * This imports all 1,621 results.
   *
   * subjectId can be null when a referenced
   * subject is not in the official 2026
   * catalogue.
   */

  let accessConditionCount =
    0;

  let requisiteGroupCount =
    0;

  let requisiteItemCount =
    0;

  let antiRequisiteItemCount =
    0;

  for (
    const condition
    of accessConditions
  ) {
    const accessCondition =
      await prisma.subjectAccessCondition.create({
        data: {
          handbookVersionId:
            handbook.id,

          subjectId:
            subjectIdByCode.get(
              condition.subjectCode,
            ) ?? null,

          subjectCode:
            condition.subjectCode,

          subjectName:
            stringOrNull(
              condition.subjectName,
            ),

          hasConditions:
            condition.hasConditions,
        },
      });

    accessConditionCount +=
      1;

    const normalGroups =
      condition.requisiteGroups ??
      [];

    for (
      let groupIndex =
        0;
      groupIndex <
      normalGroups.length;
      groupIndex++
    ) {
      const group =
        normalGroups[
          groupIndex
        ];

      if (!group) {
        continue;
      }

      const items =
        group.items ?? [];

      await prisma.subjectRequisiteGroup.create({
        data: {
          accessConditionId:
            accessCondition.id,

          groupType:
            'REQUISITE',

          rule:
            stringOrNull(
              group.rule,
            ),

          sortOrder:
            groupIndex,

          items: {
            create:
              items.map(
                (
                  item,
                  itemIndex,
                ) =>
                  buildRequisiteItem({
                    itemKey:
                      item.id,

                    requisiteType:
                      item.sourceType,

                    details:
                      item.details,

                    referencedCodes:
                      item.referencedCodes ??
                      [],

                    sortOrder:
                      itemIndex,

                    subjectIdByCode,

                    componentIdByCode,

                    degreeIdByCode,
                  }),
              ),
          },
        },
      });

      requisiteGroupCount +=
        1;

      requisiteItemCount +=
        items.length;
    }

    const antiItems =
      condition.antiRequisites ??
      [];

    if (
      condition.antiRequisiteRule ||
      antiItems.length >
        0
    ) {
      await prisma.subjectRequisiteGroup.create({
        data: {
          accessConditionId:
            accessCondition.id,

          groupType:
            'ANTI_REQUISITE',

          rule:
            stringOrNull(
              condition.antiRequisiteRule,
            ),

          sortOrder:
            normalGroups.length,

          items: {
            create:
              antiItems.map(
                (
                  item,
                  itemIndex,
                ) =>
                  buildRequisiteItem({
                    itemKey:
                      item.id,

                    requisiteType:
                      'Anti-requisite',

                    details:
                      item.details,

                    referencedCodes:
                      item.referencedCodes ??
                      [],

                    sortOrder:
                      itemIndex,

                    subjectIdByCode,

                    componentIdByCode,

                    degreeIdByCode,
                  }),
              ),
          },
        },
      });

      requisiteGroupCount +=
        1;

      antiRequisiteItemCount +=
        antiItems.length;
    }

    if (
      accessConditionCount %
        100 ===
      0
    ) {
      console.log(
        `Access conditions imported: ${accessConditionCount}/${accessConditions.length}`,
      );
    }
  }

  console.log(
    `Access conditions imported: ${accessConditionCount}`,
  );

  console.log(
    `Requisite groups imported: ${requisiteGroupCount}`,
  );

  console.log(
    `Normal requisite items imported: ${requisiteItemCount}`,
  );

  console.log(
    `Anti-requisite items imported: ${antiRequisiteItemCount}`,
  );

  /*
   * ------------------------------------------------
   * UNRESOLVED REFERENCES
   * ------------------------------------------------
   */

  const unresolvedRows: Prisma.UnresolvedReferenceCreateManyInput[] =
    [];

  for (
    const unresolved
    of unresolvedAos
  ) {
    unresolvedRows.push({
      handbookVersionId:
        handbook.id,

      sourceEntityType:
        'DEGREE',

      sourceEntityCode:
        unresolved.degreeCode,

      targetType:
        unresolved.componentType ??
        'COMPONENT',

      targetCode:
        unresolved.componentCode,

      targetName:
        stringOrNull(
          unresolved.componentName,
        ),

      sourceUrl:
        null,

      reason:
        'AOS_NOT_RESOLVED_FROM_2026_CATALOGUE',
    });
  }

  const mismatchKeys =
    new Set(
      yearMismatches.map(
        makeSubjectReferenceKey,
      ),
    );

  const unresolvedSubjectKeys =
    new Set<string>();

  for (
    const unresolved
    of unresolvedSubjects
  ) {
    const key =
      makeSubjectReferenceKey(
        unresolved,
      );

    unresolvedSubjectKeys.add(
      key,
    );

    unresolvedRows.push({
      handbookVersionId:
        handbook.id,

      sourceEntityType:
        unresolved.sourceType ??
        null,

      sourceEntityCode:
        unresolved.sourceCode ??
        null,

      targetType:
        'SUBJECT',

      targetCode:
        unresolved.code,

      targetName:
        stringOrNull(
          unresolved.name,
        ),

      sourceUrl:
        stringOrNull(
          unresolved.url,
        ),

      reason:
        mismatchKeys.has(
          key,
        )
          ? 'SUBJECT_YEAR_MISMATCH'
          : 'SUBJECT_NOT_IN_2026_CATALOGUE',
    });
  }

  /*
   * Normally the 14 year mismatch entries are
   * already inside unresolved-subjects.json.
   *
   * This fallback ensures we still preserve a
   * mismatch if a future collector output
   * changes that relationship.
   */
  for (
    const mismatch
    of yearMismatches
  ) {
    const key =
      makeSubjectReferenceKey(
        mismatch,
      );

    if (
      unresolvedSubjectKeys.has(
        key,
      )
    ) {
      continue;
    }

    unresolvedRows.push({
      handbookVersionId:
        handbook.id,

      sourceEntityType:
        mismatch.sourceType ??
        null,

      sourceEntityCode:
        mismatch.sourceCode ??
        null,

      targetType:
        'SUBJECT',

      targetCode:
        mismatch.code,

      targetName:
        stringOrNull(
          mismatch.name,
        ),

      sourceUrl:
        stringOrNull(
          mismatch.url,
        ),

      reason:
        'SUBJECT_YEAR_MISMATCH',
    });
  }

  await prisma.unresolvedReference.createMany({
    data:
      unresolvedRows,
  });

  console.log(
    `Unresolved references imported: ${unresolvedRows.length}`,
  );

  /*
   * ------------------------------------------------
   * FINAL DATABASE VERIFICATION
   * ------------------------------------------------
   */

  await verifyDatabase({
    handbookId:
      handbook.id,

    summary,

    requirementItemCount,

    studyPlanYearCount,

    studyPlanPeriodCount,

    studyPlanItemCount,
  });

  console.log(
    '',
  );

  console.log(
    '================================',
  );

  console.log(
    'UTS 2026 IMPORT COMPLETE',
  );

  console.log(
    '================================',
  );
}

/*
 * ------------------------------------------------
 * REQUIREMENT IMPORT
 * ------------------------------------------------
 */

interface ImportRequirementGroupParams {
  group: StructureGroup;

  degreeId?: string;

  componentId?: string;

  ownerType:
    | 'DEGREE'
    | 'COMPONENT';

  ownerCode: string;

  parentGroupId?: string;

  requirementGroupIdByOwnerAndSourceId:
    Map<string, string>;

  subjectIdByCode:
    Map<string, string>;

  componentIdByCode:
    Map<string, string>;
}

async function importRequirementGroup(
  params: ImportRequirementGroupParams,
): Promise<{
  groups: number;

  items: number;
}> {
  const {
    group,
    degreeId,
    componentId,
    ownerType,
    ownerCode,
    parentGroupId,
    requirementGroupIdByOwnerAndSourceId,
    subjectIdByCode,
    componentIdByCode,
  } =
    params;

  const createdGroup =
    await prisma.requirementGroup.create({
      data: {
        degreeId:
          degreeId ??
          null,

        componentId:
          componentId ??
          null,

        parentGroupId:
          parentGroupId ??
          null,

        sourceGroupId:
          group.id ??
          null,

        title:
          stringOrNull(
            group.title,
          ),

        description:
          stringOrNull(
            group.description,
          ),

        logic:
          mapRequirementLogic(
            group.logic,
          ),

        requiredCreditPoints:
          numberOrNull(
            group.requiredCreditPoints,
          ),

        maximumCreditPoints:
          numberOrNull(
            group.maximumCreditPoints,
          ),

        sortOrder:
          numberOrNull(
            group.order,
          ),
      },
    });

  if (group.id) {
    requirementGroupIdByOwnerAndSourceId.set(
      makeRequirementGroupKey(
        ownerType,
        ownerCode,
        group.id,
      ),

      createdGroup.id,
    );
  }

  const items =
    group.items ??
    [];

  if (
    items.length >
    0
  ) {
    await prisma.requirementItem.createMany({
      data:
        items.map(
          (
            item,
          ) => {
            const itemType =
              mapRequirementItemType(
                item.type,
              );

            return {
              requirementGroupId:
                createdGroup.id,

              itemType,

              subjectId:
                itemType ===
                  'SUBJECT' &&
                item.code
                  ? subjectIdByCode.get(
                      item.code,
                    ) ??
                    null
                  : null,

              componentId:
                itemType ===
                  'COMPONENT' &&
                item.code
                  ? componentIdByCode.get(
                      item.code,
                    ) ??
                    null
                  : null,

              /*
               * Always preserve original code
               * and name even when the FK was
               * successfully resolved.
               */
              rawCode:
                item.code ??
                null,

              rawName:
                stringOrNull(
                  item.name,
                ),

              creditPoints:
                numberOrNull(
                  item.creditPoints,
                ),

              sourceUrl:
                stringOrNull(
                  item.url,
                ),

              sortOrder:
                numberOrNull(
                  item.order,
                ),
            };
          },
        ),
    });
  }

  let totalGroups =
    1;

  let totalItems =
    items.length;

  for (
    const child
    of group.children ?? []
  ) {
    const result =
      await importRequirementGroup({
        group:
          child,

        degreeId,

        componentId,

        ownerType,

        ownerCode,

        parentGroupId:
          createdGroup.id,

        requirementGroupIdByOwnerAndSourceId,

        subjectIdByCode,

        componentIdByCode,
      });

    totalGroups +=
      result.groups;

    totalItems +=
      result.items;
  }

  return {
    groups:
      totalGroups,

    items:
      totalItems,
  };
}

/*
 * ------------------------------------------------
 * REQUISITE ITEM RESOLUTION
 * ------------------------------------------------
 */

interface BuildRequisiteItemParams {
  itemKey: string;

  requisiteType: string;

  details: string;

  referencedCodes: string[];

  sortOrder: number;

  subjectIdByCode:
    Map<string, string>;

  componentIdByCode:
    Map<string, string>;

  degreeIdByCode:
    Map<string, string>;
}

function buildRequisiteItem(
  params: BuildRequisiteItemParams,
): Prisma.SubjectRequisiteItemCreateWithoutRequisiteGroupInput {
  const {
    itemKey,
    requisiteType,
    details,
    referencedCodes,
    sortOrder,
    subjectIdByCode,
    componentIdByCode,
    degreeIdByCode,
  } =
    params;

  let referencedSubjectId:
    string |
    undefined;

  let referencedComponentId:
    string |
    undefined;

  let referencedDegreeId:
    string |
    undefined;

  /*
   * Only create a direct FK when one exact
   * referenced code exists.
   *
   * Expressions such as:
   *
   * C10000-C10999
   *
   * contain multiple codes and should not
   * incorrectly resolve to a single degree.
   *
   * All codes are still retained in
   * rawReferencedCodes.
   */
  if (
    referencedCodes.length ===
    1
  ) {
    const code =
      referencedCodes[0];

    if (code) {
      if (
        /^\d{5,6}$/.test(
          code,
        )
      ) {
        referencedSubjectId =
          subjectIdByCode.get(
            code,
          );
      } else if (
        /^C\d+/i.test(
          code,
        )
      ) {
        referencedDegreeId =
          degreeIdByCode.get(
            code,
          );
      } else {
        referencedComponentId =
          componentIdByCode.get(
            code,
          );
      }
    }
  }

  return {
    itemKey,

    requisiteType,

    details,

    rawReferencedCodes:
      toJson(
        referencedCodes,
      ),

    sortOrder,

    ...(referencedSubjectId
      ? {
          referencedSubject: {
            connect: {
              id:
                referencedSubjectId,
            },
          },
        }
      : {}),

    ...(referencedComponentId
      ? {
          referencedComponent: {
            connect: {
              id:
                referencedComponentId,
            },
          },
        }
      : {}),

    ...(referencedDegreeId
      ? {
          referencedDegree: {
            connect: {
              id:
                referencedDegreeId,
            },
          },
        }
      : {}),
  };
}

/*
 * ------------------------------------------------
 * VALIDATION
 * ------------------------------------------------
 */

function validateInputCounts(
  summary: SummaryRecord,
  courses: CourseRecord[],
  aos: AosRecord[],
  subjects: SubjectRecord[],
  degreeComponentRelationships: DegreeComponentRelationship[],
  studyPlans: StudyPlanRecord[],
  accessConditions: AccessConditionRecord[],
  unresolvedAos: UnresolvedAosRecord[],
  unresolvedSubjects: UnresolvedSubjectRecord[],
  yearMismatches: YearMismatchRecord[],
): void {
  assertCount(
    'courses',
    courses.length,
    summary.courses.total,
  );

  assertCount(
    'AOS',
    aos.length,
    summary.aos.total,
  );

  assertCount(
    'subjects',
    subjects.length,
    summary.subjects.globalCatalogue,
  );

  assertCount(
    'degree-component relationships',
    degreeComponentRelationships.length,
    summary.degreeComponentRelationships,
  );

  assertCount(
    'study plans',
    studyPlans.length,
    summary.studyPlans.total,
  );

  assertCount(
    'access conditions',
    accessConditions.length,
    summary.accessConditions.collected,
  );

  assertCount(
    'unresolved AOS relationships',
    unresolvedAos.length,
    summary.aos.unresolvedRelationships,
  );

  assertCount(
    'unresolved subject references',
    unresolvedSubjects.length,
    summary.subjects.unresolvedReferenced,
  );

  assertCount(
    'subject year mismatches',
    yearMismatches.length,
    summary.subjects.yearMismatchReferences,
  );

  if (
    summary.accessConditions.failures !==
    0
  ) {
    throw new Error(
      `Collector summary contains ${summary.accessConditions.failures} access-condition failures.`,
    );
  }

  console.log(
    'Input files validated against summary.json.',
  );
}

async function verifyDatabase(
  params: {
    handbookId: string;

    summary: SummaryRecord;

    requirementItemCount: number;

    studyPlanYearCount: number;

    studyPlanPeriodCount: number;

    studyPlanItemCount: number;
  },
): Promise<void> {
  const {
    handbookId,
    summary,
    requirementItemCount,
    studyPlanYearCount,
    studyPlanPeriodCount,
    studyPlanItemCount,
  } =
    params;

  const degreeCount =
    await prisma.degree.count({
      where: {
        handbookVersionId:
          handbookId,
      },
    });

  const componentCount =
    await prisma.component.count({
      where: {
        handbookVersionId:
          handbookId,
      },
    });

  const subjectCount =
    await prisma.subject.count({
      where: {
        handbookVersionId:
          handbookId,
      },
    });

  const accessConditionCount =
    await prisma.subjectAccessCondition.count({
      where: {
        handbookVersionId:
          handbookId,
      },
    });

  const degreeComponentCount =
    await prisma.degreeComponent.count({
      where: {
        degree: {
          handbookVersionId:
            handbookId,
        },
      },
    });

  const studyPlanCount =
    await prisma.studyPlan.count({
      where: {
        degree: {
          handbookVersionId:
            handbookId,
        },
      },
    });

  const databaseRequirementItemCount =
    await prisma.requirementItem.count({
      where: {
        OR: [
          {
            requirementGroup: {
              degree: {
                handbookVersionId:
                  handbookId,
              },
            },
          },

          {
            requirementGroup: {
              component: {
                handbookVersionId:
                  handbookId,
              },
            },
          },
        ],
      },
    });

  const databaseStudyPlanYearCount =
    await prisma.studyPlanYear.count({
      where: {
        studyPlan: {
          degree: {
            handbookVersionId:
              handbookId,
          },
        },
      },
    });

  const databaseStudyPlanPeriodCount =
    await prisma.studyPlanPeriod.count({
      where: {
        studyPlanYear: {
          studyPlan: {
            degree: {
              handbookVersionId:
                handbookId,
            },
          },
        },
      },
    });

  const databaseStudyPlanItemCount =
    await prisma.studyPlanItem.count({
      where: {
        studyPlanPeriod: {
          studyPlanYear: {
            studyPlan: {
              degree: {
                handbookVersionId:
                  handbookId,
              },
            },
          },
        },
      },
    });

  assertCount(
    'database degrees',
    degreeCount,
    summary.courses.total,
  );

  assertCount(
    'database components',
    componentCount,
    summary.aos.total,
  );

  assertCount(
    'database catalogue subjects',
    subjectCount,
    summary.subjects.globalCatalogue,
  );

  assertCount(
    'database access conditions',
    accessConditionCount,
    summary.accessConditions.collected,
  );

  assertCount(
    'database degree-component relationships',
    degreeComponentCount,
    summary.degreeComponentRelationships,
  );

  assertCount(
    'database study plans',
    studyPlanCount,
    summary.studyPlans.total,
  );

  assertCount(
    'database requirement items',
    databaseRequirementItemCount,
    requirementItemCount,
  );

  assertCount(
    'database study-plan years',
    databaseStudyPlanYearCount,
    studyPlanYearCount,
  );

  assertCount(
    'database study-plan periods',
    databaseStudyPlanPeriodCount,
    studyPlanPeriodCount,
  );

  assertCount(
    'database study-plan items',
    databaseStudyPlanItemCount,
    studyPlanItemCount,
  );

  console.log(
    '',
  );

  console.log(
    'DATABASE VERIFICATION',
  );

  console.log(
    `Degrees: ${degreeCount}`,
  );

  console.log(
    `Components: ${componentCount}`,
  );

  console.log(
    `Catalogue subjects: ${subjectCount}`,
  );

  console.log(
    `Access-condition records: ${accessConditionCount}`,
  );

  console.log(
    `Degree-component relationships: ${degreeComponentCount}`,
  );

  console.log(
    `Requirement items: ${databaseRequirementItemCount}`,
  );

  console.log(
    `Study plans: ${studyPlanCount}`,
  );

  console.log(
    `Study-plan years: ${databaseStudyPlanYearCount}`,
  );

  console.log(
    `Study-plan periods: ${databaseStudyPlanPeriodCount}`,
  );

  console.log(
    `Study-plan items: ${databaseStudyPlanItemCount}`,
  );
}

function assertCount(
  name: string,
  actual: number,
  expected: number,
): void {
  if (
    actual !==
    expected
  ) {
    throw new Error(
      `${name} count mismatch. Expected ${expected}, received ${actual}.`,
    );
  }
}

/*
 * ------------------------------------------------
 * MAPPERS
 * ------------------------------------------------
 */

function mapComponentType(
  value: string,
):
  | 'MAJOR'
  | 'MINOR'
  | 'SUB_MAJOR'
  | 'STREAM'
  | 'SPECIALISATION'
  | 'MAJOR_EXTENSION'
  | 'CHOICE_BLOCK'
  | 'ELECTIVE_POOL'
  | 'GENERAL_EDUCATION'
  | 'CAPSTONE'
  | 'HONOURS'
  | 'PLACEMENT'
  | 'OTHER' {
  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized ===
    'major'
  ) {
    return 'MAJOR';
  }

  if (
    normalized ===
    'minor'
  ) {
    return 'MINOR';
  }

  if (
    normalized ===
      'sub-major' ||
    normalized ===
      'sub_major'
  ) {
    return 'SUB_MAJOR';
  }

  if (
    normalized ===
    'stream'
  ) {
    return 'STREAM';
  }

  if (
    normalized ===
    'specialisation'
  ) {
    return 'SPECIALISATION';
  }

  return 'OTHER';
}

function mapRequirementLogic(
  value?: string,
):
  | 'ALL'
  | 'ANY'
  | 'ONE_OF'
  | 'UNKNOWN' {
  switch (
    value
      ?.trim()
      .toUpperCase()
  ) {
    case 'ALL':
      return 'ALL';

    case 'ANY':
      return 'ANY';

    case 'ONE_OF':
      return 'ONE_OF';

    default:
      return 'UNKNOWN';
  }
}

function mapRequirementItemType(
  value: string,
):
  | 'SUBJECT'
  | 'COMPONENT'
  | 'OTHER' {
  const normalized =
    value
      .trim()
      .toLowerCase();

  if (
    normalized ===
    'subject'
  ) {
    return 'SUBJECT';
  }

  if (
    [
      'major',
      'minor',
      'sub_major',
      'sub-major',
      'stream',
      'specialisation',
      'major_extension',
      'choice_block',
    ].includes(
      normalized,
    )
  ) {
    return 'COMPONENT';
  }

  return 'OTHER';
}

/*
 * ------------------------------------------------
 * HELPERS
 * ------------------------------------------------
 */

async function readJson<T>(
  fileName: string,
): Promise<T> {
  const path =
    resolve(
      DATA_DIRECTORY,
      fileName,
    );

  const text =
    await readFile(
      path,
      'utf8',
    );

  return JSON.parse(
    text,
  ) as T;
}

function makeRequirementGroupKey(
  ownerType:
    | 'DEGREE'
    | 'COMPONENT',
  ownerCode: string,
  sourceGroupId: string,
): string {
  return [
    ownerType,
    ownerCode,
    sourceGroupId,
  ].join(
    ':',
  );
}

function makeSubjectReferenceKey(
  record:
    | UnresolvedSubjectRecord
    | YearMismatchRecord,
): string {
  return [
    record.sourceType ??
      '',

    record.sourceCode ??
      '',

    record.code,

    record.groupPath ??
      '',

    record.url ??
      '',
  ].join(
    '|',
  );
}

function cleanComponentName(
  value: string,
  code: string,
): string {
  const trimmed =
    value.trim();

  const prefix =
    `${code} - `;

  if (
    trimmed.startsWith(
      prefix,
    )
  ) {
    return trimmed
      .slice(
        prefix.length,
      )
      .trim();
  }

  return trimmed;
}

function getRawString(
  raw:
    | Record<string, unknown>
    | undefined,
  key: string,
): string | null {
  const value =
    raw?.[key];

  return typeof value ===
    'string'
    ? value
    : null;
}

function numberOrNull(
  value:
    | number
    | undefined,
): number | null {
  return typeof value ===
    'number' &&
    Number.isFinite(
      value,
    )
    ? value
    : null;
}

function stringOrNull(
  value:
    | string
    | undefined,
): string | null {
  if (
    typeof value !==
    'string'
  ) {
    return null;
  }

  return value;
}

function optionalJson(
  value: unknown,
): Prisma.InputJsonValue | undefined {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return undefined;
  }

  return value as
    Prisma.InputJsonValue;
}

function toJson(
  value: unknown,
): Prisma.InputJsonValue {
  return value as
    Prisma.InputJsonValue;
}

/*
 * ------------------------------------------------
 * RUN
 * ------------------------------------------------
 */

main()
  .catch(
    (
      error,
    ) => {
      console.error(
        '',
      );

      console.error(
        'UTS import failed:',
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );