import { fetchUsydUnit } from './usyd.unit-parser';

const TEST_CODES = [
  'COMP2017',
  'INFO1110',
  'COMP3888',
  'SCPU3001',
];

async function main(): Promise<void> {
  for (const code of TEST_CODES) {
    console.log('');
    console.log('================================');
    console.log(code);
    console.log('================================');

    try {
      const unit = await fetchUsydUnit(code);

      console.dir(unit, {
        depth: null,
      });
    } catch (error) {
      console.error(`Failed to parse ${code}`);
      console.error(error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});