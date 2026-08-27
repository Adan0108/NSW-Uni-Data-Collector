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

type DetectedReference = {
  type: 'MAJOR' | 'PROGRAM' | 'STREAM';
  name: string;
  creditPoints: number;
};

function printDivider() {
  console.log(
    '\n================================',
  );
}

function cleanReferenceName(
  value: string,
): string {
  return value
    .replace(/[.;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectComponentReferences(
  rawText: string,
): DetectedReference[] {
  const text = rawText
    .replace(
      /^\([ivxlcdm]+\)\s*/i,
      '',
    )
    .trim();

  const match =
    text.match(
      /\b(\d+(?:\.\d+)?)\s+credit point(?:s)?\s+(major|program|stream)\s+in\s+(.+)$/i,
    );

  if (!match) {
    return [];
  }

  const creditPoints =
    Number(match[1]);

  if (
    !Number.isFinite(
      creditPoints,
    )
  ) {
    return [];
  }

  const type =
    match[2]
      .toUpperCase() as
      | 'MAJOR'
      | 'PROGRAM'
      | 'STREAM';

  let namesText =
    match[3].trim();

  /*
   * Example:
   *
   * A 48 credit point major in
   * Biochemistry and Molecular Biology;
   * Genetics and Genomics;
   * or Microbiology.
   *
   * Preserve "and" inside names such as:
   * "Biochemistry and Molecular Biology".
   *
   * Therefore alternatives are split
   * using semicolons, with optional "or".
   */
  const names =
    namesText
      .split(
        /\s*;\s*(?:or\s+)?/i,
      )
      .map(
        cleanReferenceName,
      )
      .filter(Boolean);

  /*
   * Single alternative can also end with:
   *
   * "or Microbiology"
   *
   * after a semicolon split.
   */
  const cleanedNames =
    names.map(
      (name) =>
        name.replace(
          /^or\s+/i,
          '',
        ),
    );

  return cleanedNames.map(
    (name) => ({
      type,
      name,
      creditPoints,
    }),
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
    'USYD COMPONENT REFERENCE DIAGNOSTIC',
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
        `Type: ${component.type}`,
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
          `   Parsed CP: ${requirement.requiredCreditPoints ?? 'unknown'}`,
        );

        const references =
          detectComponentReferences(
            requirement.rawText,
          );

        if (
          references.length ===
          0
        ) {
          console.log(
            '   Component references: none',
          );
        } else {
          console.log(
            `   Component references: ${references.length}`,
          );

          for (
            const reference
            of references
          ) {
            console.log(
              `      - Type: ${reference.type}`,
            );

            console.log(
              `        Name: ${reference.name}`,
            );

            console.log(
              `        CP: ${reference.creditPoints}`,
            );
          }
        }

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
        '\nCURRENT MAPPED UNIT GROUPS',
      );

      console.log(
        '--------------------------',
      );

      let mappedTotal =
        0;

      for (
        const group
        of component.requirementGroups
      ) {
        console.log(
          `- ${group.name}`,
        );

        console.log(
          `  Level: ${group.level ?? 'unknown'}`,
        );

        console.log(
          `  CP: ${group.requiredCreditPoints ?? 'unknown'}`,
        );

        console.log(
          `  Logic: ${group.logic}`,
        );

        console.log(
          `  Units: ${group.units.length}`,
        );

        mappedTotal +=
          group.requiredCreditPoints ??
          0;
      }

      const referenceTotal =
        component.formalRequirements
          .flatMap(
            (requirement) =>
              detectComponentReferences(
                requirement.rawText,
              ),
          )
          .reduce(
            (
              total,
              reference,
            ) =>
              total +
              reference.creditPoints,
            0,
          );

      console.log(
        '\nTOTALS',
      );

      console.log(
        '------',
      );

      console.log(
        `Declared component CP: ${component.requiredCreditPoints ?? '?'}`,
      );

      console.log(
        `Mapped unit-group CP: ${mappedTotal}`,
      );

      console.log(
        `Detected referenced-component CP: ${referenceTotal}`,
      );

      if (
        component.requiredCreditPoints !==
        null
      ) {
        console.log(
          `Potential combined CP: ${mappedTotal + referenceTotal}`,
        );
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