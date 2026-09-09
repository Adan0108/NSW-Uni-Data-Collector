import { prisma } from '../db/prisma.js';

async function main() {
  const universities =
    await prisma.university.findMany({
      orderBy: {
        code: 'asc',
      },

      include: {
        handbookVersions: {
          orderBy: {
            year: 'asc',
          },

          include: {
            _count: {
              select: {
                degrees: true,
                subjects: true,
                components: true,
              },
            },
          },
        },
      },
    });

  console.log(
    '================================',
  );

  console.log(
    'ALL UNIVERSITIES',
  );

  console.log(
    '================================',
  );

  console.dir(
    universities,
    {
      depth: null,
    },
  );

  const usyd =
    await prisma.university.findUnique({
      where: {
        code: 'USYD',
      },
    });

  console.log(
    '================================',
  );

  console.log(
    'USYD 2026 CURRENT DB',
  );

  console.log(
    '================================',
  );

  if (!usyd) {
    console.log(
      'USYD university row does not exist.',
    );

    return;
  }

  const handbook =
    await prisma.handbookVersion.findUnique({
      where: {
        universityId_year: {
          universityId:
            usyd.id,

          year:
            2026,
        },
      },

      include: {
        _count: {
          select: {
            degrees: true,
            subjects: true,
            components: true,
          },
        },
      },
    });

  if (!handbook) {
    console.log(
      'USYD 2026 handbook does not exist.',
    );

    return;
  }

  console.dir(
    handbook,
    {
      depth: null,
    },
  );

  const degreeRows =
    await prisma.degree.findMany({
      where: {
        handbookVersionId:
          handbook.id,
      },

      select: {
        id: true,
        code: true,
        name: true,

        _count: {
          select: {
            studyPlans: true,
          },
        },
      },

      orderBy: {
        code: 'asc',
      },
    });

  const studyPlanCount =
    await prisma.studyPlan.count({
      where: {
        degree: {
          handbookVersionId:
            handbook.id,
        },
      },
    });

  const cuspCount =
    await prisma.studyPlan.count({
      where: {
        degree: {
          handbookVersionId:
            handbook.id,
        },

        sourceType:
          'CUSP',
      },
    });

  const studyPlanItemCount =
    await prisma.studyPlanItem.count({
      where: {
        studyPlanPeriod: {
          studyPlanYear: {
            studyPlan: {
              degree: {
                handbookVersionId:
                  handbook.id,
              },
            },
          },
        },
      },
    });

  console.log(
    'Degree count:',
    degreeRows.length,
  );

  console.log(
    'Subject count:',
    handbook._count.subjects,
  );

  console.log(
    'Component count:',
    handbook._count.components,
  );

  console.log(
    'Study plan count:',
    studyPlanCount,
  );

  console.log(
    'CUSP plan count:',
    cuspCount,
  );

  console.log(
    'Study plan item count:',
    studyPlanItemCount,
  );

  console.log(
    'Degrees with study plans:',
  );

  console.dir(
    degreeRows
      .filter(
        (degree) =>
          degree._count.studyPlans >
          0,
      )
      .map(
        (degree) => ({
          code:
            degree.code,

          name:
            degree.name,

          plans:
            degree._count
              .studyPlans,
        }),
      ),

    {
      depth: null,
    },
  );
}

main()
  .catch(
    (error: unknown) => {
      console.error(
        error,
      );

      process.exitCode = 1;
    },
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    },
  );