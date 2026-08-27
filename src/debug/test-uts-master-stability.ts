import {
  collectUtsMaster,
} from '../adapters/uts/uts.master.collector.js';

async function main() {
  const master =
    await collectUtsMaster(
      '2026',
    );

  const hasCbk92407 =
    master.aos.some(
      (item) =>
        item.code ===
        'CBK92407',
    );

  const hasCbk92405 =
    master.aos.some(
      (item) =>
        item.code ===
        'CBK92405',
    );

  console.log(
    '\n=============================',
  );

  console.log(
    'UTS MASTER STABILITY CHECK',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Courses: ${master.courses.length}`,
  );

  console.log(
    `AOS: ${master.aos.length}`,
  );

  console.log(
    `Degree component relationships: ${master.degreeComponentReferences.length}`,
  );

  console.log(
    `Unresolved AOS relationships: ${master.unresolvedAosReferences.length}`,
  );

  console.log(
    `CBK92405 present: ${hasCbk92405}`,
  );

  console.log(
    `CBK92407 present: ${hasCbk92407}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});