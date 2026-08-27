import {
  collectUsydStudyPlanSubjectSupplement,
  USYD_STUDY_PLAN_SUBJECT_SUPPLEMENT_FILE,
} from './usyd.study-plan-subject-supplement';

async function main(): Promise<void> {
  const result = await collectUsydStudyPlanSubjectSupplement();

  console.log('[USYD study-plan subject supplement] PASS');
  console.log(`Collected: ${result.counts.collected}/${result.counts.requested}`);
  console.log(`Codes: ${result.units.map((unit) => unit.code).join(', ')}`);
  console.log(`Output: ${USYD_STUDY_PLAN_SUBJECT_SUPPLEMENT_FILE}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
