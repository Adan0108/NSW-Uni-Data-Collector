/*
  Warnings:

  - You are about to drop the column `subjectId` on the `SubjectRequisiteGroup` table. All the data in the column will be lost.
  - Added the required column `accessConditionId` to the `SubjectRequisiteGroup` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "SubjectRequisiteGroup" DROP CONSTRAINT "SubjectRequisiteGroup_subjectId_fkey";

-- DropIndex
DROP INDEX "SubjectRequisiteGroup_subjectId_idx";

-- AlterTable
ALTER TABLE "SubjectRequisiteGroup" DROP COLUMN "subjectId",
ADD COLUMN     "accessConditionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "SubjectAccessCondition" (
    "id" TEXT NOT NULL,
    "handbookVersionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectCode" TEXT NOT NULL,
    "subjectName" TEXT,
    "hasConditions" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectAccessCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubjectAccessCondition_subjectId_key" ON "SubjectAccessCondition"("subjectId");

-- CreateIndex
CREATE INDEX "SubjectAccessCondition_subjectCode_idx" ON "SubjectAccessCondition"("subjectCode");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectAccessCondition_handbookVersionId_subjectCode_key" ON "SubjectAccessCondition"("handbookVersionId", "subjectCode");

-- CreateIndex
CREATE INDEX "RequirementGroup_sourceGroupId_idx" ON "RequirementGroup"("sourceGroupId");

-- CreateIndex
CREATE INDEX "SubjectRequisiteGroup_accessConditionId_idx" ON "SubjectRequisiteGroup"("accessConditionId");

-- AddForeignKey
ALTER TABLE "SubjectAccessCondition" ADD CONSTRAINT "SubjectAccessCondition_handbookVersionId_fkey" FOREIGN KEY ("handbookVersionId") REFERENCES "HandbookVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAccessCondition" ADD CONSTRAINT "SubjectAccessCondition_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequisiteGroup" ADD CONSTRAINT "SubjectRequisiteGroup_accessConditionId_fkey" FOREIGN KEY ("accessConditionId") REFERENCES "SubjectAccessCondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
