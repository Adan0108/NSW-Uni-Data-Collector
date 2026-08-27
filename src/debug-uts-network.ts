import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    headless: false,
  });

  const page = await browser.newPage();

  page.on('response', async (response) => {
    const url = response.url();

    // Ignore monitoring / analytics traffic.
    if (
      url.includes('go-mpulse.net') ||
      url.includes('google') ||
      url.includes('analytics')
    ) {
      return;
    }

    // We only care about the UTS Handbook API.
    if (
      !url.includes(
        '/api/search/browsepage-academic-items',
      )
    ) {
      return;
    }

    const request = response.request();

    console.log('\n===================================');
    console.log('UTS HANDBOOK API REQUEST');
    console.log('===================================');

    console.log('METHOD:');
    console.log(request.method());

    console.log('\nURL:');
    console.log(url);

    console.log('\nPOST DATA:');
    console.log(
      request.postData() ?? 'No POST data',
    );

    console.log('\nREQUEST HEADERS:');

    const requestHeaders =
      await request.allHeaders();

    console.log(
      JSON.stringify(
        requestHeaders,
        null,
        2,
      ),
    );

    console.log('\nRESPONSE STATUS:');
    console.log(response.status());

    try {
      const body = await response.json();

      console.log('\nRESPONSE STRUCTURE:');

      console.log(
        JSON.stringify(
          body,
          null,
          2,
        ).slice(0, 15000),
      );
    } catch (error) {
      console.log(
        'Could not parse response as JSON:',
        error,
      );
    }

    console.log(
      '\n===================================\n',
    );
  });

  await page.goto(
    'https://coursehandbook.uts.edu.au',
    {
      waitUntil: 'networkidle',
    },
  );

  console.log('\nBrowser ready.');
  console.log('');
  console.log('Please do these actions:');
  console.log('1. Search Bachelor of Business');
  console.log('2. Open the degree');
  console.log('3. Open Finance');
  console.log('4. Open one subject');
  console.log('');
  console.log(
    'Watch this terminal for API requests.',
  );

  await page.waitForTimeout(
    10 * 60 * 1000,
  );

  await browser.close();
}

main().catch((error) => {
  console.error(error);

  process.exit(1);
});
