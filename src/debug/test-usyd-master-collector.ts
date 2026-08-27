import {
  collectUsydMaster,
} from '../adapters/usyd/usyd.master.collector';

async function main(): Promise<void> {
  await collectUsydMaster();
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);