-- AlterEnum
ALTER TYPE "ComponentType" ADD VALUE 'PROGRAM';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RequirementItemType" ADD VALUE 'TABLE';
ALTER TYPE "RequirementItemType" ADD VALUE 'RAW';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RequisiteGroupType" ADD VALUE 'PREREQUISITE';
ALTER TYPE "RequisiteGroupType" ADD VALUE 'COREQUISITE';
ALTER TYPE "RequisiteGroupType" ADD VALUE 'PROHIBITION';

-- AlterTable
ALTER TABLE "Component" ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "DegreeComponent" ADD COLUMN     "authoritative" BOOLEAN,
ADD COLUMN     "rawComponentType" TEXT,
ADD COLUMN     "rawData" JSONB,
ADD COLUMN     "relationshipKind" TEXT;

-- AlterTable
ALTER TABLE "RequirementGroup" ADD COLUMN     "authoritative" BOOLEAN,
ADD COLUMN     "nodeType" TEXT,
ADD COLUMN     "rawData" JSONB,
ADD COLUMN     "sourceIndex" INTEGER,
ADD COLUMN     "sourcePath" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "RequirementItem" ADD COLUMN     "authoritative" BOOLEAN,
ADD COLUMN     "rawData" JSONB;

-- AlterTable
ALTER TABLE "StudyPlan" ADD COLUMN     "handbookYear" INTEGER,
ADD COLUMN     "isFormalRequirement" BOOLEAN,
ADD COLUMN     "pathway" TEXT,
ADD COLUMN     "rawData" JSONB,
ADD COLUMN     "sourceType" TEXT,
ADD COLUMN     "totalCreditPoints" INTEGER,
ADD COLUMN     "variantNumber" INTEGER;

-- AlterTable
ALTER TABLE "StudyPlanItem" ADD COLUMN     "rawData" JSONB;

-- AlterTable
ALTER TABLE "StudyPlanPeriod" ADD COLUMN     "periodNumber" INTEGER,
ADD COLUMN     "periodType" TEXT,
ADD COLUMN     "totalCreditPoints" INTEGER;

-- AlterTable
ALTER TABLE "StudyPlanYear" ADD COLUMN     "yearNumber" INTEGER;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "academicUnit" TEXT,
ADD COLUMN     "assumedKnowledge" TEXT,
ADD COLUMN     "managingFaculty" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "sourceYear" INTEGER,
ADD COLUMN     "studyLevel" TEXT;

-- AlterTable
ALTER TABLE "SubjectRequisiteGroup" ADD COLUMN     "authoritative" BOOLEAN,
ADD COLUMN     "containsUnparsedText" BOOLEAN,
ADD COLUMN     "rawData" JSONB;

-- AlterTable
ALTER TABLE "SubjectRequisiteItem" ADD COLUMN     "rawData" JSONB;

-- CreateIndex
CREATE INDEX "DegreeComponent_relationshipKind_idx" ON "DegreeComponent"("relationshipKind");

-- CreateIndex
CREATE INDEX "RequirementGroup_nodeType_idx" ON "RequirementGroup"("nodeType");

-- CreateIndex
CREATE INDEX "RequirementGroup_status_idx" ON "RequirementGroup"("status");

-- CreateIndex
CREATE INDEX "Subject_sourceYear_idx" ON "Subject"("sourceYear");
