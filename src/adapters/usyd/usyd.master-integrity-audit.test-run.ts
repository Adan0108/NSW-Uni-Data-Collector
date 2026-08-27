import { auditUsydFinalMaster } from './usyd.master-integrity-audit';

function divider(): void {
  console.log('================================');
}

async function main(): Promise<void> {
  divider();
  console.log('USYD FINAL MASTER INTEGRITY AUDIT');
  divider();

  const report = await auditUsydFinalMaster();

  for (const check of report.checks) {
    console.log(
      `${check.passed ? 'PASS' : 'FAIL'}: ${check.name}` +
        (check.issueCount === 0 ? '' : ` (${check.issueCount} issue(s))`),
    );
  }

  divider();
  console.log(`Errors: ${report.counts.errors}`);
  console.log(`Warnings: ${report.counts.warnings}`);

  if (report.issues.length > 0) {
    divider();
    console.log('ISSUES');
    divider();

    for (const issue of report.issues) {
      console.log(
        `- [${issue.severity}] ${issue.check}: ${issue.message}` +
          (issue.reference === undefined ? '' : ` (${issue.reference})`),
      );
    }
  }

  divider();
  console.log(`RESULT: ${report.status}`);

  if (report.status === 'FAIL') {
    console.log('Fix ERROR records before Prisma mapping.');
    process.exitCode = 1;
    return;
  }

  console.log('USYD FINAL MASTER IS REFERENTIALLY CLEAN FOR PRISMA MAPPING.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
