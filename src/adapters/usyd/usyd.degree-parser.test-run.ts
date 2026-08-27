import {
  fetchUsydDegreePage,
} from './usyd.degree-parser';

const TEST_URL =
  'https://www.sydney.edu.au/handbooks/science/coursework/science/overview.html';

async function main(): Promise<void> {
  const degree =
    await fetchUsydDegreePage(
      TEST_URL,
    );

  console.log(
    JSON.stringify(
      degree,
      null,
      2,
    ),
  );
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