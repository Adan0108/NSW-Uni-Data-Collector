import { prisma } from '../src/db/prisma.ts';

async function handbookCounts(code: string) {
  const university = await prisma.university.findUnique({ where: { code } });
  if (!university) return null;
  const handbook = await prisma.handbookVersion.findUnique({
    where: { universityId_year: { universityId: university.id, year: 2026 } },
  });
  if (!handbook) return null;
  const handbookVersionId = handbook.id;
  const [degrees, subjects, components, studyPlans, requirementGroups, candidateSources, candidateMemberships] = await Promise.all([
    prisma.degree.count({ where: { handbookVersionId } }),
    prisma.subject.count({ where: { handbookVersionId } }),
    prisma.component.count({ where: { handbookVersionId } }),
    prisma.studyPlan.count({ where: { degree: { handbookVersionId } } }),
    prisma.requirementGroup.count({ where: { degree: { handbookVersionId } } }),
    prisma.requirementCandidateSource.count({ where: { requirementGroup: { degree: { handbookVersionId } } } }),
    prisma.requirementCandidateSubject.count({ where: { candidateSource: { requirementGroup: { degree: { handbookVersionId } } } } }),
  ]);
  return { handbookVersionId, degrees, subjects, components, studyPlans, requirementGroups, candidateSources, candidateMemberships };
}

async function main() {
  const usyd = await handbookCounts('USYD');
  const uts = await handbookCounts('UTS');
  const tableD = await prisma.requirementCandidateSource.findMany({
    where: { tableName: 'Table D', requirementGroup: { degree: { handbookVersion: { university: { code: 'USYD' }, year: 2026 } } } },
    select: {
      sourceKey: true,
      type: true,
      title: true,
      tableName: true,
      authoritative: true,
      requirementGroup: { select: { sourcePath: true, requiredCreditPoints: true, degree: { select: { code: true } } } },
      _count: { select: { subjects: true } },
    },
    orderBy: { sourceKey: 'asc' },
  });
  const existingPools = await prisma.requirementCandidateSource.findMany({
    where: { sourceKey: { in: ['USYD:2026:BHENGINE-04:FREE-ELECTIVES:ENGINEERING-UG', 'USYD:2026:BHENGINE-04:FREE-ELECTIVES:TABLE-S'] } },
    select: { sourceKey: true, type: true, title: true, tableName: true, authoritative: true, _count: { select: { subjects: true } } },
    orderBy: { sourceKey: 'asc' },
  });
  console.log(JSON.stringify({ usyd, uts, tableDCount: tableD.length, tableDMembershipCount: tableD.reduce((sum, source) => sum + source._count.subjects, 0), tableD, existingPools }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
