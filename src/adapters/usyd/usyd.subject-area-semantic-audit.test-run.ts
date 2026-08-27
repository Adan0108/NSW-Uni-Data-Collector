import { fetchUsydSubjectAreaTable } from './usyd.subject-area-parser';
import type {
  UsydComponentRequirement,
  UsydFormalRequirement,
} from './usyd.types';

interface AuditTarget {
  name: string;
  url: string;
}

const TARGETS: AuditTarget[] = [
  {
    name: 'Statistics',
    url:
      'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/statistics/unit-of-study-table.html',
  },
  {
    name: 'Genetics and Genomics',
    url:
      'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/genetics-genomics/unit-of-study-table.html',
  },
  {
    name: 'Health',
    url:
      'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/health/unit-of-study-table.html',
  },
  {
    name: 'Life Sciences',
    url:
      'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/life-sciences/unit-of-study-table.html',
  },
  {
    name: 'Medical Science',
    url:
      'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/medical-science/unit-of-study-table.html',
  },
  {
    name: 'Nutrition Science',
    url:
      'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/nutrition-science/unit-of-study-table.html',
  },
  {
    name: 'Pathology',
    url:
      'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/pathology/unit-of-study-table.html',
  },
  {
    name: 'Environmental Science',
    url:
      'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/environmental-science/unit-of-study-table.html',
  },
];

function isConditionalRule(
  requirement: UsydFormalRequirement,
): boolean {
  const text = [
    requirement.rawText,
    ...requirement.subrules,
    ...requirement.notes,
  ]
    .join(' ')
    .toLowerCase();

  return (
    /\bfor students\b/.test(text) ||
    /\bstudents in\b/.test(text) ||
    /\baccording to\b/.test(text) ||
    /\bdepending on\b/.test(text) ||
    /\balternative\b/.test(text)
  );
}

function hasChoiceRule(
  requirement: UsydFormalRequirement,
): boolean {
  const text = [
    requirement.rawText,
    ...requirement.subrules,
  ]
    .join(' ')
    .toLowerCase();

  return /\bor\b/.test(text);
}

function printComponentReference(
  requirement: UsydFormalRequirement,
): void {
  const rule =
    requirement.componentReferenceRule;

  if (!rule) {
    return;
  }

  console.log(
    `   Component reference logic: ${rule.logic}`,
  );

  console.log(
    `   Component reference CP: ${rule.requiredCreditPoints}`,
  );

  for (
    const reference
    of rule.components
  ) {
    console.log(
      `      -> ${reference.type}: ${reference.name}`,
    );
  }
}

function printConditionalRule(
  requirement: UsydFormalRequirement,
): void {
  const rule =
    requirement.conditionalRule;

  if (!rule) {
    return;
  }

  console.log(
    '   CONDITIONAL RULE:',
  );

  console.log(
    `      Required CP: ${rule.requiredCreditPoints ?? '?'}`,
  );

  rule.branches.forEach(
    (branch, index) => {
      const condition =
        branch.condition
          ? `${branch.condition.componentType}: ${branch.condition.componentName}`
          : 'DEFAULT';

      console.log(
        `      Branch ${index + 1}: ${condition}`,
      );

      console.log(
        `         Group: ${branch.requirementGroup.name}`,
      );

      console.log(
        `         Level: ${branch.requirementGroup.level ?? '?'}`,
      );

      console.log(
        `         CP: ${branch.requirementGroup.requiredCreditPoints ?? '?'}`,
      );

      console.log(
        `         Logic: ${branch.requirementGroup.logic}`,
      );

      console.log(
        `         Codes: ${
          branch.requirementGroup.units
            .map(
              (unit) =>
                unit.code,
            )
            .join(', ') ||
          'NONE'
        }`,
      );

      console.log(
        `         Raw: ${branch.rawText}`,
      );
    },
  );
}

function printFormalRequirement(
  requirement: UsydFormalRequirement,
): void {
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

  printComponentReference(
    requirement,
  );

  printConditionalRule(
    requirement,
  );

  const warnings: string[] = [];

  if (
    isConditionalRule(
      requirement,
    )
  ) {
    warnings.push(
      'CONDITIONAL RULE',
    );
  }

  if (
    hasChoiceRule(
      requirement,
    )
  ) {
    warnings.push(
      'OR / CHOICE RULE',
    );
  }

  if (
    warnings.length >
    0
  ) {
    console.log(
      `   AUDIT FLAGS: ${warnings.join(', ')}`,
    );
  }
}

function printComponent(
  component: UsydComponentRequirement,
): void {
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
    printFormalRequirement(
      requirement,
    );
  }

  console.log('');
  console.log(
    'NORMALIZED GROUPS',
  );

  console.log(
    '-----------------',
  );

  if (
    component.requirementGroups.length ===
    0
  ) {
    console.log('NONE');
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
        `   CP: ${group.requiredCreditPoints ?? '?'}`,
      );

      console.log(
        `   Logic: ${group.logic}`,
      );

      console.log(
        `   Units: ${group.units.length}`,
      );

      console.log(
        `   Codes: ${
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

  const formalCP =
    component.formalRequirements.reduce(
      (total, requirement) =>
        total +
        (
          requirement.requiredCreditPoints ??
          0
        ),
      0,
    );

  const mappedCP =
    component.requirementGroups.reduce(
      (total, group) =>
        total +
        (
          group.requiredCreditPoints ??
          0
        ),
      0,
    );

  const referenceCP =
    component.formalRequirements.reduce(
      (total, requirement) =>
        total +
        (
          requirement
            .componentReferenceRule
            ?.requiredCreditPoints ??
          0
        ),
      0,
    );

  console.log('');
  console.log(
    'CP SUMMARY',
  );

  console.log(
    '----------',
  );

  console.log(
    `Declared: ${component.requiredCreditPoints ?? '?'}`,
  );

  console.log(
    `Formal CP: ${formalCP}`,
  );

  console.log(
    `Mapped physical CP: ${mappedCP}`,
  );

  console.log(
    `Component-reference CP: ${referenceCP}`,
  );
}

async function auditTarget(
  target: AuditTarget,
): Promise<void> {
  console.log('');
  console.log('');
  console.log(
    '################################',
  );

  console.log(
    target.name,
  );

  console.log(
    '################################',
  );

  console.log(
    target.url,
  );

  const table =
    await fetchUsydSubjectAreaTable(
      target.url,
    );

  console.log(
    `Parsed components: ${table.components.length}`,
  );

  for (
    const component
    of table.components
  ) {
    printComponent(
      component,
    );
  }
}

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'USYD SCIENCE SEMANTIC AUDIT',
  );

  console.log(
    '================================',
  );

  console.log(
    `Targets: ${TARGETS.length}`,
  );

  for (
    const target
    of TARGETS
  ) {
    try {
      await auditTarget(
        target,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error('');
      console.error(
        `${target.name}: ERROR`,
      );

      console.error(
        message,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});