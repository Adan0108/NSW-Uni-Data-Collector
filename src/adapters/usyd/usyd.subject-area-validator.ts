import type {
  UsydComponentRequirement,
  UsydRequirementGroup,
  UsydSubjectAreaTable,
  UsydFormalRequirement,
} from './usyd.types';

export interface UsydComponentValidationResult {
  componentName: string;
  valid: boolean;
  errors: string[];
}

export interface UsydValidationResult {
  valid: boolean;
  errors: string[];
  components: UsydComponentValidationResult[];
}
function validateConditionalRequirement(
  requirement: UsydFormalRequirement,
  errors: string[],
): void {
  const rule =
    requirement.conditionalRule;

  if (!rule) {
    return;
  }

  if (rule.branches.length < 2) {
    errors.push(
      `Conditional requirement "${requirement.rawText}" has fewer than 2 branches.`,
    );

    return;
  }

  const defaultBranches =
    rule.branches.filter(
      (branch) =>
        branch.condition === null,
    );

  if (defaultBranches.length !== 1) {
    errors.push(
      `Conditional requirement "${requirement.rawText}" must have exactly one default branch.`,
    );
  }

  for (
    const branch
    of rule.branches
  ) {
    if (
      branch.requirementGroup.units.length ===
      0
    ) {
      const condition =
        branch.condition
          ? `${branch.condition.componentType} ${branch.condition.componentName}`
          : 'DEFAULT';

      errors.push(
        `Conditional branch "${condition}" has no units.`,
      );
    }

    if (
      rule.requiredCreditPoints !== null &&
      branch.requirementGroup
        .requiredCreditPoints !==
      rule.requiredCreditPoints
    ) {
      errors.push(
        `Conditional branch "${branch.requirementGroup.name}" requires ${branch.requirementGroup.requiredCreditPoints ?? '?'} CP but parent conditional rule requires ${rule.requiredCreditPoints} CP.`,
      );
    }
  }
}

function getMappedGroupCreditPoints(
  groups: UsydRequirementGroup[],
): number {
  return groups.reduce(
    (total, group) =>
      total +
      (group.requiredCreditPoints ?? 0),
    0,
  );
}

function getReferencedComponentCreditPoints(
  component: UsydComponentRequirement,
): number {
  return component.formalRequirements.reduce(
    (total, requirement) => {
      const rule =
        requirement.componentReferenceRule;

      if (!rule) {
        return total;
      }

      return (
        total +
        rule.requiredCreditPoints
      );
    },
    0,
  );
}

function validateRequirementGroup(
  group: UsydRequirementGroup,
  errors: string[],
): void {
  if (
    group.requiredCreditPoints ===
    null
  ) {
    errors.push(
      `Requirement group "${group.name}" has no required credit points.`,
    );
  }

  if (
    group.units.length ===
    0
  ) {
    errors.push(
      `Requirement group "${group.name}" has no units.`,
    );
  }
}

function validateComponent(
  component: UsydComponentRequirement,
): UsydComponentValidationResult {
  const errors: string[] = [];

  const mappedGroupCP =
    getMappedGroupCreditPoints(
      component.requirementGroups,
    );

  const referencedComponentCP =
    getReferencedComponentCreditPoints(
      component,
    );

  const representedCP =
    mappedGroupCP +
    referencedComponentCP;

  const hasComponentReference =
    component.formalRequirements.some(
      (requirement) =>
        requirement.componentReferenceRule !=
        null,
    );

  /*
   * Some streams do not declare an overall CP total
   * in the heading.
   *
   * If we can still represent their requirements
   * through mapped groups / component references,
   * do not fail them purely for missing declared CP.
   */
  if (
    component.requiredCreditPoints ===
    null &&
    representedCP === 0
  ) {
    errors.push(
      'Component has no declared required credit points.',
    );
  }

  if (
    component.requirementGroups.length ===
    0 &&
    !hasComponentReference
  ) {
    errors.push(
      'Component has no mapped requirement groups.',
    );
  }

  for (
    const group
    of component.requirementGroups
  ) {
    validateRequirementGroup(
      group,
      errors,
    );
  }

  if (
    component.requiredCreditPoints !==
    null &&
    representedCP !==
    component.requiredCreditPoints
  ) {
    if (
      referencedComponentCP ===
      0
    ) {
      errors.push(
        `Requirement groups total ${mappedGroupCP} CP but component requires ${component.requiredCreditPoints} CP.`,
      );
    } else {
      errors.push(
        `Requirement groups total ${mappedGroupCP} CP + component references ${referencedComponentCP} CP = ${representedCP} CP but component requires ${component.requiredCreditPoints} CP.`,
      );
    }
  }
  for (
    const requirement
    of component.formalRequirements
  ) {
    validateConditionalRequirement(
      requirement,
      errors,
    );
  }

  return {
    componentName:
      component.name,
    valid:
      errors.length === 0,
    errors,
  };
}

export function validateUsydSubjectArea(
  table: UsydSubjectAreaTable,
): UsydValidationResult {
  const errors: string[] = [];

  const components =
    table.components.map(
      (component) =>
        validateComponent(
          component,
        ),
    );

  /*
   * Keep top-level errors because your existing
   * parser test runner reads validation.errors.
   *
   * At the moment there are no table-level
   * validation rules, so this stays empty.
   */
  if (
    table.components.length ===
    0
  ) {
    errors.push(
      'Subject area has no parsed components.',
    );
  }

  return {
    valid:
      errors.length === 0 &&
      components.every(
        (component) =>
          component.valid,
      ),

    errors,
    components,
  };
}

export const validateUsydSubjectAreaTable =
  validateUsydSubjectArea;