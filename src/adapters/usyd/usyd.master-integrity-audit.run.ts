import {
  USYD_INTEGRITY_REPORT_FILE,
  writeUsydFinalMasterIntegrityReport,
} from './usyd.master-integrity-audit';

async function main(): Promise<void> {
  const report = await writeUsydFinalMasterIntegrityReport();

  console.log(`[USYD final master integrity audit] ${report.status}`);
  console.log(`Checks: ${report.counts.checksRun}`);
  console.log(`Errors: ${report.counts.errors}`);
  console.log(`Warnings: ${report.counts.warnings}`);
  console.log(`Output: ${USYD_INTEGRITY_REPORT_FILE}`);

  if (report.status === 'FAIL') {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
