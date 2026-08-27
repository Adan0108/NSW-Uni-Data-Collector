import axios from 'axios';
import * as cheerio from 'cheerio';

import { fetchUsydSubjectAreaTable } from './usyd.subject-area-parser';
import { validateUsydSubjectArea } from './usyd.subject-area-validator';

const TEST_URL =
  'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/discrete-mathematics-algorithms/unit-of-study-table.html';
  
function normalizeText(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function printRawPhysicalHeadings(
  url: string,
): Promise<void> {
  const response = await axios.get<string>(
    url,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
      },
    },
  );

  const $ = cheerio.load(
    response.data,
  );

  const unitTable = $('table')
    .filter(
      (_, table) => {
        return $(table)
          .find('tr')
          .toArray()
          .some((row) => {
            const text =
              normalizeText(
                $(row).text(),
              );

            return (
              text.includes(
                'Unit of study',
              ) &&
              text.includes(
                'Credit points',
              ) &&
              text.includes(
                'Prerequisites',
              )
            );
          });
      },
    )
    .first();

  console.log('');
  console.log(
    'RAW PHYSICAL TABLE HEADINGS',
  );
  console.log(
    '----------------------------',
  );

  if (unitTable.length === 0) {
    console.log(
      'No unit table found.',
    );

    return;
  }

  let afterHeader = false;

  unitTable
    .find('tr')
    .each(
      (_, row) => {
        const cells = $(row)
          .find('th, td')
          .map(
            (_, cell) =>
              normalizeText(
                $(cell).text(),
              ),
          )
          .get();

        if (cells.length === 0) {
          return;
        }

        const rowText =
          normalizeText(
            cells.join(' '),
          );

        if (
          rowText.includes(
            'Unit of study',
          ) &&
          rowText.includes(
            'Credit points',
          ) &&
          rowText.includes(
            'Prerequisites',
          )
        ) {
          afterHeader = true;

          return;
        }

        if (!afterHeader) {
          return;
        }

        if (
          cells.length === 1 &&
          !/^[A-Z]{4}\d{4}\b/.test(
            rowText,
          )
        ) {
          console.log(
            JSON.stringify(
              rowText,
            ),
          );
        }
      },
    );
}

async function main(): Promise<void> {
  console.log(
    '================================',
  );
  console.log(
    'USYD DATA SCIENCE DIAGNOSTIC',
  );
  console.log(
    '================================',
  );

  const result =
    await fetchUsydSubjectAreaTable(
      TEST_URL,
    );

  console.log('');
  console.log(
    `Subject area: ${result.name}`,
  );

  console.log(
    `Components: ${result.components.length}`,
  );

  for (
    const component
    of result.components
  ) {
    console.log('');
    console.log(
      '================================',
    );

    console.log(
      `${component.name} — ${component.requiredCreditPoints ?? '?'} CP`,
    );

    console.log(
      '================================',
    );

    console.log('');
    console.log(
      'FORMAL REQUIREMENTS',
    );
    console.log(
      '-------------------',
    );

    for (
      const requirement
      of component.formalRequirements
    ) {
      console.log('');
      console.log(
        `${requirement.order}. ${requirement.rawText}`,
      );

      console.log(
        `   Kind: ${requirement.groupKind}`,
      );

      console.log(
        `   Level: ${requirement.level ?? '?'}`,
      );

      console.log(
        `   CP: ${requirement.requiredCreditPoints ?? '?'}`,
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

    console.log('');
    console.log(
      'MAPPED REQUIREMENT GROUPS',
    );
    console.log(
      '-------------------------',
    );

    if (
      component.requirementGroups
        .length === 0
    ) {
      console.log(
        'NONE',
      );
    }

    component.requirementGroups.forEach(
      (group, index) => {
        console.log('');
        console.log(
          `${index + 1}. ${group.name}`,
        );

        console.log(
          `   Level: ${group.level ?? '?'}`,
        );

        console.log(
          `   CP required: ${group.requiredCreditPoints ?? '?'}`,
        );

        console.log(
          `   Logic: ${group.logic}`,
        );

        console.log(
          `   Units: ${group.units.length}`,
        );

        console.log(
          `   Unit codes: ${
            group.units
              .map(
                (unit) =>
                  unit.code,
              )
              .join(', ') ||
            'NONE'
          }`,
        );
      },
    );

    const formalCp =
      component.formalRequirements.reduce(
        (total, requirement) =>
          total +
          (
            requirement.requiredCreditPoints ??
            0
          ),
        0,
      );

    const mappedCp =
      component.requirementGroups.reduce(
        (total, group) =>
          total +
          (
            group.requiredCreditPoints ??
            0
          ),
        0,
      );

    console.log('');
    console.log(
      'CP CHECK',
    );
    console.log(
      '--------',
    );

    console.log(
      `Declared component CP: ${component.requiredCreditPoints ?? '?'}`,
    );

    console.log(
      `Formal requirement CP total: ${formalCp}`,
    );

    console.log(
      `Mapped group CP total: ${mappedCp}`,
    );

    console.log(
      `Formal requirements: ${component.formalRequirements.length}`,
    );

    console.log(
      `Mapped groups: ${component.requirementGroups.length}`,
    );
  }

  await printRawPhysicalHeadings(
    TEST_URL,
  );

  const validation =
    validateUsydSubjectArea(
      result,
    );

  console.log('');
  console.log(
    '================================',
  );

  console.log(
    `VALIDATION: ${
      validation.valid
        ? 'PASS'
        : 'FAIL'
    }`,
  );

  if (!validation.valid) {
    for (
      const error
      of validation.errors
    ) {
      console.log(
        `- ${error}`,
      );
    }

    for (
      const component
      of validation.components
    ) {
      for (
        const error
        of component.errors
      ) {
        console.log(
          `- ${component.componentName}: ${error}`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});