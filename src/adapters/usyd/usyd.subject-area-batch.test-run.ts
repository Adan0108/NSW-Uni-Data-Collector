import { discoverUsydScienceSubjectAreas } from './usyd.subject-area-discovery';
import { fetchUsydSubjectAreaTable } from './usyd.subject-area-parser';
import { validateUsydSubjectArea } from './usyd.subject-area-validator';

async function main(): Promise<void> {
  console.log('================================');
  console.log('USYD SCIENCE BATCH VALIDATION');
  console.log('================================');

  const subjectAreas =
    await discoverUsydScienceSubjectAreas();

  console.log(
    `Discovered subject areas: ${subjectAreas.length}`,
  );

  let parsedCount = 0;
  let validCount = 0;
  let failedCount = 0;

  const failures: Array<{
    name: string;
    url: string;
    error: string;
  }> = [];

  const invalidStructures: Array<{
    name: string;
    url: string;
    errors: string[];
  }> = [];

  for (const area of subjectAreas) {
    console.log('');
    console.log(`Checking: ${area.name}`);

    try {
      const parsed =
        await fetchUsydSubjectAreaTable(
          area.unitTableUrl,
        );

      parsedCount += 1;

      const validation =
        validateUsydSubjectArea(parsed);

      const componentSummary =
        parsed.components
          .map((component) => {
            const groups =
              component.requirementGroups
                .map(
                  (group) =>
                    `${group.level ?? '-'} ${group.name} ${group.requiredCreditPoints ?? '?'}CP`,
                )
                .join(', ');

            return `${component.name} (${component.requiredCreditPoints ?? '?'}CP) [${groups}]`;
          })
          .join(' | ');

      console.log(
        `  Parsed: ${parsed.components.length} component(s)`,
      );

      console.log(
        `  Structure: ${componentSummary || 'No components'}`,
      );

      if (validation.valid) {
        validCount += 1;

        console.log('  Validation: PASS');
      } else {
        console.log('  Validation: FAIL');

        const errors =
          validation.components.flatMap(
            (component) =>
              component.errors.map(
                (error) =>
                  `${component.componentName}: ${error}`,
              ),
          );

        invalidStructures.push({
          name: area.name,
          url: area.unitTableUrl,
          errors,
        });

        for (const error of errors) {
          console.log(`    - ${error}`);
        }
      }
    } catch (error) {
      failedCount += 1;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      failures.push({
        name: area.name,
        url: area.unitTableUrl,
        error: message,
      });

      console.log(
        `  Parser error: ${message}`,
      );
    }
  }

  console.log('');
  console.log('================================');
  console.log('SUMMARY');
  console.log('================================');

  console.log(
    `Discovered: ${subjectAreas.length}`,
  );

  console.log(
    `Parsed: ${parsedCount}`,
  );

  console.log(
    `Validation pass: ${validCount}`,
  );

  console.log(
    `Validation fail: ${invalidStructures.length}`,
  );

  console.log(
    `Parser failures: ${failedCount}`,
  );

  if (invalidStructures.length > 0) {
    console.log('');
    console.log('INVALID STRUCTURES');

    for (const item of invalidStructures) {
      console.log('');
      console.log(item.name);
      console.log(item.url);

      for (const error of item.errors) {
        console.log(`  - ${error}`);
      }
    }
  }

  if (failures.length > 0) {
    console.log('');
    console.log('PARSER FAILURES');

    for (const failure of failures) {
      console.log('');
      console.log(failure.name);
      console.log(failure.url);
      console.log(
        `  ${failure.error}`,
      );
    }
  }

  if (
    invalidStructures.length > 0 ||
    failedCount > 0
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});