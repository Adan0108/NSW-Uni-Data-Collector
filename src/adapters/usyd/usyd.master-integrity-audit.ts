import fs from 'node:fs/promises';
import path from 'node:path';

const DATA_DIR = path.resolve(
  process.cwd(),
  'data',
  'normalized',
  'usyd',
  '2026',
);

export const USYD_FINAL_MASTER_FILE = path.join(
  DATA_DIR,
  'usyd-master-final.json',
);

export const USYD_INTEGRITY_REPORT_FILE = path.join(
  DATA_DIR,
  'usyd-master-final.integrity-report.json',
);

type UnknownRecord = Record<string, unknown>;

export type IntegritySeverity = 'ERROR' | 'WARNING';

export interface IntegrityIssue {
  severity: IntegritySeverity;
  check: string;
  message: string;
  reference?: string;
}

export interface UsydMasterIntegrityReport {
  generatedAt: string;
  sourceFile: string;
  status: 'PASS' | 'FAIL';
  counts: {
    degrees: number;
    components: number;
    subjects: number;
    unresolvedSubjects: number;
    accessConditions: number;
    requisiteRules: number;
    degreeComponentRelationships: number;
    degreeRequirementClauses: number;
    degreeRequirementRoots: number;
    studyPlans: number;
    checksRun: number;
    errors: number;
    warnings: number;
  };
  checks: Array<{
    name: string;
    passed: boolean;
    issueCount: number;
  }>;
  issues: IntegrityIssue[];
}

interface AuditContext {
  issues: IntegrityIssue[];
  checks: UsydMasterIntegrityReport['checks'];
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value;
}

function stringField(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function numberField(record: UnknownRecord, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function addIssue(
  context: AuditContext,
  severity: IntegritySeverity,
  check: string,
  message: string,
  reference?: string,
): void {
  context.issues.push({
    severity,
    check,
    message,
    ...(reference === undefined ? {} : { reference }),
  });
}

/**
 * Records one named audit result. A check passes when it adds no ERROR issues.
 * Warnings remain visible but do not block Prisma mapping by themselves.
 */
function runCheck(
  context: AuditContext,
  name: string,
  check: () => void,
): void {
  const issueStart = context.issues.length;
  check();
  const newIssues = context.issues.slice(issueStart);

  context.checks.push({
    name,
    passed: !newIssues.some((issue) => issue.severity === 'ERROR'),
    issueCount: newIssues.length,
  });
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates].sort();
}

function normalizeIdentityPart(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-AU');
}

function canonicalComponentKey(record: UnknownRecord): string | null {
  const name = stringField(record, 'name');
  // The 358 discovered components use `handbookCategory`; the nine
  // evidence-backed supplemental components use `handbook`.
  const handbook =
    stringField(record, 'handbookCategory') ?? stringField(record, 'handbook');

  if (name === null || handbook === null) {
    return null;
  }

  return `${normalizeIdentityPart(handbook)}|${normalizeIdentityPart(name)}`;
}

function relationshipComponentKey(record: UnknownRecord): string | null {
  // Table S and qualified Table A candidates use componentName/componentHandbook.
  // The final unqualified Table A layer preserves its source fields as
  // name/handbook. Both shapes identify the same canonical component entity.
  const name = stringField(record, 'componentName') ?? stringField(record, 'name');
  const handbook =
    stringField(record, 'componentHandbook') ?? stringField(record, 'handbook');

  if (name === null || handbook === null) {
    return null;
  }

  return `${normalizeIdentityPart(handbook)}|${normalizeIdentityPart(name)}`;
}

function auditUniqueRequiredKeys(
  context: AuditContext,
  check: string,
  records: unknown[],
  keyName: string,
): Set<string> {
  const keys: string[] = [];

  records.forEach((value, index) => {
    const record = requireRecord(value, `${check}[${index}]`);
    const key = stringField(record, keyName);

    if (key === null) {
      addIssue(
        context,
        'ERROR',
        check,
        `Record ${index} is missing required ${keyName}.`,
      );
      return;
    }

    keys.push(key);
  });

  for (const duplicate of findDuplicates(keys)) {
    addIssue(
      context,
      'ERROR',
      check,
      `Duplicate ${keyName}: ${duplicate}.`,
      duplicate,
    );
  }

  return new Set(keys);
}

function requireKnownDegree(
  context: AuditContext,
  check: string,
  degreeCodes: Set<string>,
  record: UnknownRecord,
  reference: string,
): void {
  const degreeCode = stringField(record, 'degreeCode');

  if (degreeCode === null) {
    addIssue(context, 'ERROR', check, 'Missing degreeCode.', reference);
    return;
  }

  if (!degreeCodes.has(degreeCode)) {
    addIssue(
      context,
      'ERROR',
      check,
      `Unknown degreeCode ${degreeCode}.`,
      reference,
    );
  }
}

function auditMetadataCounts(
  context: AuditContext,
  master: UnknownRecord,
  actualCounts: Record<string, number>,
): void {
  const metadata = requireRecord(master['metadata'], 'metadata');
  const counts = requireRecord(metadata['counts'], 'metadata.counts');

  for (const [key, actual] of Object.entries(actualCounts)) {
    const declared = numberField(counts, key);

    if (declared === null) {
      addIssue(
        context,
        'ERROR',
        'metadata-counts',
        `metadata.counts.${key} is missing or not numeric.`,
      );
    } else if (declared !== actual) {
      addIssue(
        context,
        'ERROR',
        'metadata-counts',
        `metadata.counts.${key} declares ${declared}, but the array contains ${actual}.`,
      );
    }
  }
}

function auditDegreeComponentRelationships(
  context: AuditContext,
  relationships: unknown[],
  degreeCodes: Set<string>,
  componentKeys: Set<string>,
): void {
  const unresolvedAuthoritativeSupplements = new Map<string, number>();

  relationships.forEach((value, index) => {
    const wrapper = requireRecord(value, `degreeComponents[${index}]`);
    const kind = stringField(wrapper, 'relationshipKind');
    const data = requireRecord(wrapper['data'], `degreeComponents[${index}].data`);
    const reference = `degreeComponents[${index}]`;

    requireKnownDegree(context, 'degree-component-references', degreeCodes, data, reference);

    if (kind === 'EXPLICIT_NAMED') {
      const key = relationshipComponentKey(data);
      if (key === null || !componentKeys.has(key)) {
        addIssue(
          context,
          'ERROR',
          'degree-component-references',
          `Explicit relationship does not resolve to a canonical component source: ${String(key)}.`,
          reference,
        );
      }
      return;
    }

    if (kind === 'CHOICE_POOL') {
      const candidates = requireArray(data['candidates'], `${reference}.data.candidates`);
      if (candidates.length === 0) {
        addIssue(
          context,
          'ERROR',
          'degree-component-references',
          'Choice pool has no candidates.',
          reference,
        );
      }

      candidates.forEach((candidateValue, candidateIndex) => {
        const candidate = requireRecord(
          candidateValue,
          `${reference}.data.candidates[${candidateIndex}]`,
        );
        const key = relationshipComponentKey(candidate);

        const identitySource = stringField(candidate, 'identitySource');
        const isAuthoritativeRoleSupplement =
          identitySource === 'AUTHORITATIVE_ROLE_SUPPLEMENT';

        if (key === null || (!componentKeys.has(key) && !isAuthoritativeRoleSupplement)) {
          addIssue(
            context,
            'ERROR',
            'degree-component-references',
            `Choice candidate does not resolve to a canonical component source: ${String(key)}.`,
            `${reference}.candidates[${candidateIndex}]`,
          );
        }

        // These relationship identities were proved by an authoritative role
        // catalogue even though no standalone canonical component page exists.
        // Keep them valid, but surface missing requirement content for later
        // enrichment without blocking relationship import.
        if (
          isAuthoritativeRoleSupplement &&
          candidate['requirementsSourceResolved'] === false
        ) {
          const label =
            stringField(candidate, 'name') ??
            stringField(candidate, 'componentName') ??
            `candidate-${candidateIndex}`;
          unresolvedAuthoritativeSupplements.set(
            label,
            (unresolvedAuthoritativeSupplements.get(label) ?? 0) + 1,
          );
        }
      });
      return;
    }

    addIssue(
      context,
      'ERROR',
      'degree-component-references',
      `Unsupported relationshipKind ${String(kind)}.`,
      reference,
    );
  });

  for (const [name, occurrences] of unresolvedAuthoritativeSupplements) {
    addIssue(
      context,
      'WARNING',
      'degree-component-references',
      `Authoritative role supplement ${name} has no resolved requirement source (${occurrences} relationship occurrence(s)).`,
      name,
    );
  }
}

function auditDegreeRequirementSemantics(
  context: AuditContext,
  clauses: unknown[],
  roots: unknown[],
  degreeCodes: Set<string>,
): void {
  const clauseKeys = new Set<string>();

  clauses.forEach((value, index) => {
    const clause = requireRecord(value, `degreeRequirements[${index}]`);
    const degreeCode = stringField(clause, 'degreeCode');
    const sourcePath = stringField(clause, 'sourcePath');
    const sourceIndex = numberField(clause, 'sourceIndex');
    const reference = `degreeRequirements[${index}]`;

    requireKnownDegree(context, 'degree-requirement-references', degreeCodes, clause, reference);

    if (degreeCode === null || sourcePath === null || sourceIndex === null) {
      addIssue(
        context,
        'ERROR',
        'degree-requirement-references',
        'Requirement clause is missing its source identity.',
        reference,
      );
      return;
    }

    const key = `${degreeCode}|${sourcePath}|${sourceIndex}`;
    if (clauseKeys.has(key)) {
      addIssue(
        context,
        'ERROR',
        'degree-requirement-references',
        `Duplicate requirement source identity ${key}.`,
        reference,
      );
    }
    clauseKeys.add(key);
  });

  const rootDegreeCodes: string[] = [];

  roots.forEach((value, index) => {
    const root = requireRecord(value, `degreeRequirementRoots[${index}]`);
    const degreeCode = stringField(root, 'degreeCode');
    const reference = `degreeRequirementRoots[${index}]`;

    requireKnownDegree(context, 'degree-requirement-references', degreeCodes, root, reference);

    if (degreeCode !== null) {
      rootDegreeCodes.push(degreeCode);
    }

    const sourceRoots = requireArray(root['sourceRoots'], `${reference}.sourceRoots`);
    if (sourceRoots.length === 0) {
      addIssue(
        context,
        'ERROR',
        'degree-requirement-references',
        'Semantic root has no source roots.',
        reference,
      );
    }

    sourceRoots.forEach((sourceValue, sourceIndexInRoot) => {
      const source = requireRecord(
        sourceValue,
        `${reference}.sourceRoots[${sourceIndexInRoot}]`,
      );
      const sourcePath = stringField(source, 'sourcePath');
      const sourceIndex = numberField(source, 'sourceIndex');

      if (
        degreeCode === null ||
        sourcePath === null ||
        sourceIndex === null ||
        !clauseKeys.has(`${degreeCode}|${sourcePath}|${sourceIndex}`)
      ) {
        addIssue(
          context,
          'ERROR',
          'degree-requirement-references',
          'Semantic source root does not resolve to an enriched requirement clause.',
          `${reference}.sourceRoots[${sourceIndexInRoot}]`,
        );
      }
    });
  });

  for (const duplicate of findDuplicates(rootDegreeCodes)) {
    addIssue(
      context,
      'ERROR',
      'degree-requirement-references',
      `Degree ${duplicate} has more than one canonical semantic root.`,
      duplicate,
    );
  }

  for (const degreeCode of degreeCodes) {
    if (!rootDegreeCodes.includes(degreeCode)) {
      addIssue(
        context,
        'ERROR',
        'degree-requirement-references',
        `Degree ${degreeCode} has no canonical semantic root.`,
        degreeCode,
      );
    }
  }
}

function auditStudyPlans(
  context: AuditContext,
  plans: unknown[],
  degreeCodes: Set<string>,
  subjectCodes: Set<string>,
): void {
  const planKeys: string[] = [];
  const missingSubjects = new Map<
    string,
    {
      occurrences: number;
      firstReference: string;
    }
  >();

  plans.forEach((value, planIndex) => {
    const plan = requireRecord(value, `studyPlans[${planIndex}]`);
    const degreeCode = stringField(plan, 'degreeCode');
    const pathway = stringField(plan, 'pathway') ?? '';
    const variantNumber = numberField(plan, 'variantNumber');
    const reference = `studyPlans[${planIndex}]`;

    requireKnownDegree(context, 'study-plan-references', degreeCodes, plan, reference);

    if (degreeCode !== null && variantNumber !== null) {
      planKeys.push(`${degreeCode}|${pathway}|${variantNumber}`);
    }

    const years = requireArray(plan['years'], `${reference}.years`);
    let calculatedPlanCreditPoints = 0;

    years.forEach((yearValue, yearIndex) => {
      const year = requireRecord(yearValue, `${reference}.years[${yearIndex}]`);
      const periods = requireArray(year['periods'], `${reference}.years[${yearIndex}].periods`);

      periods.forEach((periodValue, periodIndex) => {
        const period = requireRecord(
          periodValue,
          `${reference}.years[${yearIndex}].periods[${periodIndex}]`,
        );
        const items = requireArray(
          period['items'],
          `${reference}.years[${yearIndex}].periods[${periodIndex}].items`,
        );
        const periodReference = `${reference}.years[${yearIndex}].periods[${periodIndex}]`;
        let calculatedPeriodCreditPoints = 0;
        const sortOrders: string[] = [];

        items.forEach((itemValue, itemIndex) => {
          const item = requireRecord(itemValue, `${periodReference}.items[${itemIndex}]`);
          const itemType = stringField(item, 'itemType');
          const creditPoints = numberField(item, 'creditPoints');
          const sortOrder = numberField(item, 'sortOrder');

          if (creditPoints === null || creditPoints < 0) {
            addIssue(
              context,
              'ERROR',
              'study-plan-references',
              'Study-plan item has invalid creditPoints.',
              `${periodReference}.items[${itemIndex}]`,
            );
          } else {
            calculatedPeriodCreditPoints += creditPoints;
          }

          if (sortOrder === null) {
            addIssue(
              context,
              'ERROR',
              'study-plan-references',
              'Study-plan item is missing sortOrder.',
              `${periodReference}.items[${itemIndex}]`,
            );
          } else {
            sortOrders.push(String(sortOrder));
          }

          if (itemType === 'SUBJECT') {
            const subjectCode = stringField(item, 'subjectCode');
            if (subjectCode === null || !subjectCodes.has(subjectCode)) {
              const label = subjectCode ?? '<missing-code>';
              const current = missingSubjects.get(label);
              missingSubjects.set(label, {
                occurrences: (current?.occurrences ?? 0) + 1,
                firstReference:
                  current?.firstReference ?? `${periodReference}.items[${itemIndex}]`,
              });
            }
          } else if (itemType === 'CHOICE') {
            if (stringField(item, 'choiceText') === null) {
              addIssue(
                context,
                'ERROR',
                'study-plan-references',
                'CHOICE item is missing choiceText.',
                `${periodReference}.items[${itemIndex}]`,
              );
            }
          } else {
            addIssue(
              context,
              'ERROR',
              'study-plan-references',
              `Unsupported study-plan itemType ${String(itemType)}.`,
              `${periodReference}.items[${itemIndex}]`,
            );
          }
        });

        for (const duplicate of findDuplicates(sortOrders)) {
          addIssue(
            context,
            'ERROR',
            'study-plan-references',
            `Duplicate item sortOrder ${duplicate}.`,
            periodReference,
          );
        }

        const declaredPeriodCreditPoints = numberField(period, 'totalCreditPoints');
        if (declaredPeriodCreditPoints !== calculatedPeriodCreditPoints) {
          addIssue(
            context,
            'ERROR',
            'study-plan-credit-points',
            `Period declares ${String(declaredPeriodCreditPoints)} credit points but items total ${calculatedPeriodCreditPoints}.`,
            periodReference,
          );
        }

        calculatedPlanCreditPoints += calculatedPeriodCreditPoints;
      });
    });

    const declaredPlanCreditPoints = numberField(plan, 'totalCreditPoints');
    if (declaredPlanCreditPoints !== calculatedPlanCreditPoints) {
      addIssue(
        context,
        'ERROR',
        'study-plan-credit-points',
        `Plan declares ${String(declaredPlanCreditPoints)} credit points but periods total ${calculatedPlanCreditPoints}.`,
        reference,
      );
    }
  });

  for (const duplicate of findDuplicates(planKeys)) {
    addIssue(
      context,
      'ERROR',
      'study-plan-references',
      `Duplicate study-plan identity ${duplicate}.`,
      duplicate,
    );
  }

  for (const [subjectCode, details] of missingSubjects) {
    addIssue(
      context,
      'ERROR',
      'study-plan-references',
      `Study-plan subject ${subjectCode} is absent from subjects[] (${details.occurrences} occurrence(s)).`,
      details.firstReference,
    );
  }
}

export async function auditUsydFinalMaster(
  sourceFile = USYD_FINAL_MASTER_FILE,
): Promise<UsydMasterIntegrityReport> {
  const sourceText = await fs.readFile(sourceFile, 'utf8');
  const master = requireRecord(JSON.parse(sourceText) as unknown, 'USYD final master');

  const degrees = requireArray(master['degrees'], 'degrees');
  const components = requireArray(master['components'], 'components');
  const subjects = requireArray(master['subjects'], 'subjects');
  const unresolvedSubjects = requireArray(
    master['unresolvedSubjectDetails'],
    'unresolvedSubjectDetails',
  );
  const accessConditions = requireArray(
    master['subjectAccessConditions'],
    'subjectAccessConditions',
  );
  const requisiteRules = requireArray(master['subjectRequisites'], 'subjectRequisites');
  const degreeComponents = requireArray(master['degreeComponents'], 'degreeComponents');
  const degreeRequirements = requireArray(master['degreeRequirements'], 'degreeRequirements');
  const degreeRequirementRoots = requireArray(
    master['degreeRequirementRoots'],
    'degreeRequirementRoots',
  );
  const studyPlans = requireArray(master['studyPlans'], 'studyPlans');

  const context: AuditContext = { issues: [], checks: [] };
  let degreeCodes = new Set<string>();
  let subjectCodes = new Set<string>();
  let componentKeys = new Set<string>();

  runCheck(context, 'unique-degree-codes', () => {
    degreeCodes = auditUniqueRequiredKeys(context, 'unique-degree-codes', degrees, 'code');
  });

  runCheck(context, 'unique-subject-codes', () => {
    subjectCodes = auditUniqueRequiredKeys(context, 'unique-subject-codes', subjects, 'code');
  });

  runCheck(context, 'canonical-component-identities', () => {
    const keys: string[] = [];
    components.forEach((value, index) => {
      const record = requireRecord(value, `components[${index}]`);
      const key = canonicalComponentKey(record);
      if (key === null) {
        addIssue(
          context,
          'ERROR',
          'canonical-component-identities',
          'Canonical component is missing name or handbook identity.',
          `components[${index}]`,
        );
      } else {
        keys.push(key);
      }
    });
    componentKeys = new Set(keys);
  });

  runCheck(context, 'subject-dependent-records', () => {
    const dependentGroups: Array<[string, unknown[]]> = [
      ['subjectAccessConditions', accessConditions],
      ['subjectRequisites', requisiteRules],
    ];

    for (const [label, records] of dependentGroups) {
      records.forEach((value, index) => {
        const record = requireRecord(value, `${label}[${index}]`);
        const unitCode = stringField(record, 'unitCode');
        if (unitCode === null || !subjectCodes.has(unitCode)) {
          addIssue(
            context,
            'ERROR',
            'subject-dependent-records',
            `${label} references missing subject ${String(unitCode)}.`,
            `${label}[${index}]`,
          );
        }
      });
    }
  });

  runCheck(context, 'resolved-unresolved-subject-separation', () => {
    unresolvedSubjects.forEach((value, index) => {
      const record = requireRecord(value, `unresolvedSubjectDetails[${index}]`);
      const code = stringField(record, 'code');
      if (code !== null && subjectCodes.has(code)) {
        addIssue(
          context,
          'ERROR',
          'resolved-unresolved-subject-separation',
          `Subject ${code} appears in both resolved and unresolved collections.`,
          code,
        );
      }
    });
  });

  runCheck(context, 'degree-component-references', () => {
    auditDegreeComponentRelationships(
      context,
      degreeComponents,
      degreeCodes,
      componentKeys,
    );
  });

  runCheck(context, 'degree-requirement-references', () => {
    auditDegreeRequirementSemantics(
      context,
      degreeRequirements,
      degreeRequirementRoots,
      degreeCodes,
    );
  });

  runCheck(context, 'study-plan-references-and-credit-points', () => {
    auditStudyPlans(context, studyPlans, degreeCodes, subjectCodes);
  });

  runCheck(context, 'metadata-counts', () => {
    auditMetadataCounts(context, master, {
      degrees: degrees.length,
      canonicalComponents: components.length,
      subjects: subjects.length,
      unresolvedSubjects: unresolvedSubjects.length,
      accessConditions: accessConditions.length,
      requisiteRules: requisiteRules.length,
      totalDegreeComponentRelationshipRecords: degreeComponents.length,
      degreeRequirementClauses: degreeRequirements.length,
      degreeRequirementRoots: degreeRequirementRoots.length,
      studyPlans: studyPlans.length,
    });
  });

  const errors = context.issues.filter((issue) => issue.severity === 'ERROR').length;
  const warnings = context.issues.filter((issue) => issue.severity === 'WARNING').length;

  return {
    generatedAt: new Date().toISOString(),
    sourceFile,
    status: errors === 0 ? 'PASS' : 'FAIL',
    counts: {
      degrees: degrees.length,
      components: components.length,
      subjects: subjects.length,
      unresolvedSubjects: unresolvedSubjects.length,
      accessConditions: accessConditions.length,
      requisiteRules: requisiteRules.length,
      degreeComponentRelationships: degreeComponents.length,
      degreeRequirementClauses: degreeRequirements.length,
      degreeRequirementRoots: degreeRequirementRoots.length,
      studyPlans: studyPlans.length,
      checksRun: context.checks.length,
      errors,
      warnings,
    },
    checks: context.checks,
    issues: context.issues,
  };
}

export async function writeUsydFinalMasterIntegrityReport(
  outputFile = USYD_INTEGRITY_REPORT_FILE,
): Promise<UsydMasterIntegrityReport> {
  const report = await auditUsydFinalMaster();
  await fs.writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}
