import {
  discoverUsydScienceSubjectAreas,
} from './usyd.subject-area-discovery';

import {
  fetchUsydSubjectAreaTable,
} from './usyd.subject-area-parser';

const TARGETS = new Set([
  'Astrophysics',
  'Environmental Science',
  'Health',
  'Life Sciences',
  'Medical Science',
  'Nutrition and Dietetics',
  'Psychology',
]);

function printDivider() {
  console.log(
    '\n================================',
  );
}

async function main() {
  const subjectAreas =
    await discoverUsydScienceSubjectAreas();

  const targets =
    subjectAreas.filter(
      (subjectArea) =>
        TARGETS.has(
          subjectArea.name,
        ),
    );

  console.log(
    'USYD MAJOR/MINOR FAILURE DIAGNOSTIC',
  );

  console.log(
    `Targets found: ${targets.length}/${TARGETS.size}`,
  );

  for (
    const target
    of targets
  ) {
    printDivider();

    console.log(
      target.name,
    );

    console.log(
      target.unitTableUrl,
    );

    const parsed =
      await fetchUsydSubjectAreaTable(
        target.unitTableUrl,
      );

    for (
      const component
      of parsed.components
    ) {
      printDivider();

      console.log(
        `${component.name} — ${component.requiredCreditPoints ?? '?'} CP`,
      );

      console.log(
        '\nFORMAL REQUIREMENTS',
      );

      console.log(
        '-------------------',
      );

      for (
        const requirement
        of component.formalRequirements
      ) {
        console.log(
          `\n${requirement.order}. ${requirement.rawText}`,
        );

        console.log(
          `   Kind: ${requirement.groupKind}`,
        );

        console.log(
          `   Level: ${requirement.level ?? 'unknown'}`,
        );

        console.log(
          `   CP: ${requirement.requiredCreditPoints ?? 'unknown'}`,
        );

        if (
          requirement.subrules.length >
          0
        ) {
          console.log(
            '   Subrules:',
          );

          for (
            const subrule
            of requirement.subrules
          ) {
            console.log(
              `      - ${subrule}`,
            );
          }
        }

        if (
          requirement.notes.length >
          0
        ) {
          console.log(
            '   Notes:',
          );

          for (
            const note
            of requirement.notes
          ) {
            console.log(
              `      - ${note}`,
            );
          }
        }
      }

      console.log(
        '\nMAPPED REQUIREMENT GROUPS',
      );

      console.log(
        '-------------------------',
      );

      let mappedTotal =
        0;

      for (
        const [
          index,
          group,
        ]
        of component
          .requirementGroups
          .entries()
      ) {
        console.log(
          `\n${index + 1}. ${group.name}`,
        );

        console.log(
          `   Level: ${group.level ?? 'unknown'}`,
        );

        console.log(
          `   CP required: ${group.requiredCreditPoints ?? 'unknown'}`,
        );

        console.log(
          `   Logic: ${group.logic}`,
        );

        console.log(
          `   Units: ${group.units.length}`,
        );

        console.log(
          `   Unit codes: ${group.units
            .map(
              (unit) =>
                unit.code,
            )
            .join(', ')}`,
        );

        mappedTotal +=
          group.requiredCreditPoints ??
          0;
      }

      const formalTotal =
        component.formalRequirements
          .reduce(
            (
              total,
              requirement,
            ) =>
              total +
              (
                requirement.requiredCreditPoints ??
                0
              ),
            0,
          );

      console.log(
        '\nCP CHECK',
      );

      console.log(
        '--------',
      );

      console.log(
        `Declared: ${component.requiredCreditPoints ?? '?'}`,
      );

      console.log(
        `Formal total: ${formalTotal}`,
      );

      console.log(
        `Mapped total: ${mappedTotal}`,
      );

      const unmapped =
        component.formalRequirements.filter(
          (
            requirement,
          ) =>
            !component
              .requirementGroups
              .some(
                (
                  group,
                ) =>
                  group.level ===
                    requirement.level &&
                  group.requiredCreditPoints ===
                    requirement.requiredCreditPoints,
              ),
        );

      if (
        unmapped.length >
        0
      ) {
        console.log(
          '\nPOSSIBLY UNMAPPED RULES',
        );

        console.log(
          '-----------------------',
        );

        for (
          const requirement
          of unmapped
        ) {
          console.log(
            `- ${requirement.rawText}`,
          );
        }
      }
    }
  }
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);