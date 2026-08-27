-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('MAJOR', 'MINOR', 'SUB_MAJOR', 'STREAM', 'SPECIALISATION', 'MAJOR_EXTENSION', 'CHOICE_BLOCK', 'ELECTIVE_POOL', 'GENERAL_EDUCATION', 'CAPSTONE', 'HONOURS', 'PLACEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RequirementLogic" AS ENUM ('ALL', 'ANY', 'ONE_OF', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RequirementItemType" AS ENUM ('SUBJECT', 'COMPONENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RequisiteGroupType" AS ENUM ('REQUISITE', 'ANTI_REQUISITE');

-- CreateEnum
CREATE TYPE "StudyPlanItemType" AS ENUM ('SUBJECT', 'CHOICE');

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandbookVersion" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandbookVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Degree" (
    "id" TEXT NOT NULL,
    "handbookVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creditPoints" INTEGER,
    "description" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Degree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "handbookVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "originalType" TEXT,
    "creditPoints" INTEGER,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DegreeComponent" (
    "id" TEXT NOT NULL,
    "degreeId" TEXT NOT NULL,
    "componentId" TEXT,
    "parentGroupId" TEXT,
    "rawComponentCode" TEXT,
    "rawComponentName" TEXT,
    "requiredCreditPoints" INTEGER,
    "groupPath" TEXT,
    "containerPath" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DegreeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementGroup" (
    "id" TEXT NOT NULL,
    "degreeId" TEXT,
    "componentId" TEXT,
    "parentGroupId" TEXT,
    "sourceGroupId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "logic" "RequirementLogic" NOT NULL DEFAULT 'UNKNOWN',
    "requiredCreditPoints" INTEGER,
    "maximumCreditPoints" INTEGER,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementItem" (
    "id" TEXT NOT NULL,
    "requirementGroupId" TEXT NOT NULL,
    "itemType" "RequirementItemType" NOT NULL,
    "subjectId" TEXT,
    "componentId" TEXT,
    "rawCode" TEXT,
    "rawName" TEXT,
    "creditPoints" INTEGER,
    "sourceUrl" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "handbookVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creditPoints" INTEGER,
    "description" TEXT,
    "overview" JSONB,
    "assessment" JSONB,
    "learningOutcomes" JSONB,
    "offerings" JSONB,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectRequisiteGroup" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "groupType" "RequisiteGroupType" NOT NULL,
    "rule" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectRequisiteGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectRequisiteItem" (
    "id" TEXT NOT NULL,
    "requisiteGroupId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "requisiteType" TEXT,
    "details" TEXT NOT NULL,
    "referencedSubjectId" TEXT,
    "referencedComponentId" TEXT,
    "referencedDegreeId" TEXT,
    "rawReferencedCodes" JSONB,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectRequisiteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "degreeId" TEXT NOT NULL,
    "sourcePlanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanYear" (
    "id" TEXT NOT NULL,
    "studyPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlanYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanPeriod" (
    "id" TEXT NOT NULL,
    "studyPlanYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlanPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyPlanItem" (
    "id" TEXT NOT NULL,
    "studyPlanPeriodId" TEXT NOT NULL,
    "itemType" "StudyPlanItemType" NOT NULL,
    "subjectId" TEXT,
    "rawCode" TEXT,
    "title" TEXT NOT NULL,
    "creditPoints" INTEGER,
    "sourceUrl" TEXT,
    "numberOfPeriods" INTEGER,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL,
    "handbookVersionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityCode" TEXT,
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "sha256" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnresolvedReference" (
    "id" TEXT NOT NULL,
    "handbookVersionId" TEXT NOT NULL,
    "sourceEntityType" TEXT,
    "sourceEntityCode" TEXT,
    "targetType" TEXT,
    "targetCode" TEXT,
    "targetName" TEXT,
    "sourceUrl" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnresolvedReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "University_code_key" ON "University"("code");

-- CreateIndex
CREATE INDEX "HandbookVersion_year_idx" ON "HandbookVersion"("year");

-- CreateIndex
CREATE UNIQUE INDEX "HandbookVersion_universityId_year_key" ON "HandbookVersion"("universityId", "year");

-- CreateIndex
CREATE INDEX "Degree_code_idx" ON "Degree"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Degree_handbookVersionId_code_key" ON "Degree"("handbookVersionId", "code");

-- CreateIndex
CREATE INDEX "Component_code_idx" ON "Component"("code");

-- CreateIndex
CREATE INDEX "Component_type_idx" ON "Component"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Component_handbookVersionId_code_key" ON "Component"("handbookVersionId", "code");

-- CreateIndex
CREATE INDEX "DegreeComponent_degreeId_idx" ON "DegreeComponent"("degreeId");

-- CreateIndex
CREATE INDEX "DegreeComponent_componentId_idx" ON "DegreeComponent"("componentId");

-- CreateIndex
CREATE INDEX "DegreeComponent_parentGroupId_idx" ON "DegreeComponent"("parentGroupId");

-- CreateIndex
CREATE INDEX "RequirementGroup_degreeId_idx" ON "RequirementGroup"("degreeId");

-- CreateIndex
CREATE INDEX "RequirementGroup_componentId_idx" ON "RequirementGroup"("componentId");

-- CreateIndex
CREATE INDEX "RequirementGroup_parentGroupId_idx" ON "RequirementGroup"("parentGroupId");

-- CreateIndex
CREATE INDEX "RequirementItem_requirementGroupId_idx" ON "RequirementItem"("requirementGroupId");

-- CreateIndex
CREATE INDEX "RequirementItem_subjectId_idx" ON "RequirementItem"("subjectId");

-- CreateIndex
CREATE INDEX "RequirementItem_componentId_idx" ON "RequirementItem"("componentId");

-- CreateIndex
CREATE INDEX "Subject_code_idx" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_handbookVersionId_code_key" ON "Subject"("handbookVersionId", "code");

-- CreateIndex
CREATE INDEX "SubjectRequisiteGroup_subjectId_idx" ON "SubjectRequisiteGroup"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectRequisiteGroup_groupType_idx" ON "SubjectRequisiteGroup"("groupType");

-- CreateIndex
CREATE INDEX "SubjectRequisiteItem_requisiteGroupId_idx" ON "SubjectRequisiteItem"("requisiteGroupId");

-- CreateIndex
CREATE INDEX "SubjectRequisiteItem_referencedSubjectId_idx" ON "SubjectRequisiteItem"("referencedSubjectId");

-- CreateIndex
CREATE INDEX "SubjectRequisiteItem_referencedComponentId_idx" ON "SubjectRequisiteItem"("referencedComponentId");

-- CreateIndex
CREATE INDEX "SubjectRequisiteItem_referencedDegreeId_idx" ON "SubjectRequisiteItem"("referencedDegreeId");

-- CreateIndex
CREATE INDEX "StudyPlan_degreeId_idx" ON "StudyPlan"("degreeId");

-- CreateIndex
CREATE INDEX "StudyPlanYear_studyPlanId_idx" ON "StudyPlanYear"("studyPlanId");

-- CreateIndex
CREATE INDEX "StudyPlanPeriod_studyPlanYearId_idx" ON "StudyPlanPeriod"("studyPlanYearId");

-- CreateIndex
CREATE INDEX "StudyPlanItem_studyPlanPeriodId_idx" ON "StudyPlanItem"("studyPlanPeriodId");

-- CreateIndex
CREATE INDEX "StudyPlanItem_subjectId_idx" ON "StudyPlanItem"("subjectId");

-- CreateIndex
CREATE INDEX "SourceRecord_handbookVersionId_idx" ON "SourceRecord"("handbookVersionId");

-- CreateIndex
CREATE INDEX "SourceRecord_entityType_entityCode_idx" ON "SourceRecord"("entityType", "entityCode");

-- CreateIndex
CREATE INDEX "UnresolvedReference_handbookVersionId_idx" ON "UnresolvedReference"("handbookVersionId");

-- CreateIndex
CREATE INDEX "UnresolvedReference_targetCode_idx" ON "UnresolvedReference"("targetCode");

-- AddForeignKey
ALTER TABLE "HandbookVersion" ADD CONSTRAINT "HandbookVersion_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Degree" ADD CONSTRAINT "Degree_handbookVersionId_fkey" FOREIGN KEY ("handbookVersionId") REFERENCES "HandbookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_handbookVersionId_fkey" FOREIGN KEY ("handbookVersionId") REFERENCES "HandbookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegreeComponent" ADD CONSTRAINT "DegreeComponent_degreeId_fkey" FOREIGN KEY ("degreeId") REFERENCES "Degree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegreeComponent" ADD CONSTRAINT "DegreeComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DegreeComponent" ADD CONSTRAINT "DegreeComponent_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "RequirementGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroup" ADD CONSTRAINT "RequirementGroup_degreeId_fkey" FOREIGN KEY ("degreeId") REFERENCES "Degree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroup" ADD CONSTRAINT "RequirementGroup_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementGroup" ADD CONSTRAINT "RequirementGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "RequirementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementItem" ADD CONSTRAINT "RequirementItem_requirementGroupId_fkey" FOREIGN KEY ("requirementGroupId") REFERENCES "RequirementGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementItem" ADD CONSTRAINT "RequirementItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementItem" ADD CONSTRAINT "RequirementItem_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_handbookVersionId_fkey" FOREIGN KEY ("handbookVersionId") REFERENCES "HandbookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequisiteGroup" ADD CONSTRAINT "SubjectRequisiteGroup_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequisiteItem" ADD CONSTRAINT "SubjectRequisiteItem_requisiteGroupId_fkey" FOREIGN KEY ("requisiteGroupId") REFERENCES "SubjectRequisiteGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequisiteItem" ADD CONSTRAINT "SubjectRequisiteItem_referencedSubjectId_fkey" FOREIGN KEY ("referencedSubjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequisiteItem" ADD CONSTRAINT "SubjectRequisiteItem_referencedComponentId_fkey" FOREIGN KEY ("referencedComponentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequisiteItem" ADD CONSTRAINT "SubjectRequisiteItem_referencedDegreeId_fkey" FOREIGN KEY ("referencedDegreeId") REFERENCES "Degree"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_degreeId_fkey" FOREIGN KEY ("degreeId") REFERENCES "Degree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanYear" ADD CONSTRAINT "StudyPlanYear_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanPeriod" ADD CONSTRAINT "StudyPlanPeriod_studyPlanYearId_fkey" FOREIGN KEY ("studyPlanYearId") REFERENCES "StudyPlanYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_studyPlanPeriodId_fkey" FOREIGN KEY ("studyPlanPeriodId") REFERENCES "StudyPlanPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlanItem" ADD CONSTRAINT "StudyPlanItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecord" ADD CONSTRAINT "SourceRecord_handbookVersionId_fkey" FOREIGN KEY ("handbookVersionId") REFERENCES "HandbookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnresolvedReference" ADD CONSTRAINT "UnresolvedReference_handbookVersionId_fkey" FOREIGN KEY ("handbookVersionId") REFERENCES "HandbookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
