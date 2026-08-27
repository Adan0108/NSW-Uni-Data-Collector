import { discoverUsydScienceSubjectAreas } from './usyd.subject-area-discovery';

async function main(): Promise<void> {
  console.log(
    '================================',
  );

  console.log(
    'USYD SCIENCE SUBJECT AREA DISCOVERY',
  );

  console.log(
    '================================',
  );

  const subjectAreas =
    await discoverUsydScienceSubjectAreas();

  console.log(
    `Discovered: ${subjectAreas.length}`,
  );

  console.log('');

  for (
    const area
    of subjectAreas
  ) {
    console.log(area.name);

    console.log(
      `  Overview: ${area.overviewUrl}`,
    );

    console.log(
      `  Unit table: ${area.unitTableUrl}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});