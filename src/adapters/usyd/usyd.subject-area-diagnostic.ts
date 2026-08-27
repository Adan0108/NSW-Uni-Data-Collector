import axios from 'axios';
import * as cheerio from 'cheerio';

const URLS = [
  'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/data-science/unit-of-study-table.html',
  'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/software-development/unit-of-study-table.html',
  'https://www.sydney.edu.au/handbooks/science/table-a/subject-areas/mathematics/unit-of-study-table.html',
];

function normalizeText(value: string): string {
  return value
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function inspect(url: string): Promise<void> {
  console.log('');
  console.log('================================');
  console.log(url);
  console.log('================================');

  const response = await axios.get<string>(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
    },
  });

  console.log(`Status: ${response.status}`);
  console.log(`Final URL: ${response.request?.res?.responseUrl ?? url}`);
  console.log(`HTML length: ${response.data.length}`);

  const $ = cheerio.load(response.data);

  console.log('');
  console.log('TITLE');
  console.log(normalizeText($('title').text()));

  console.log('');
  console.log('HEADINGS');

  $('h1, h2, h3, h4, h5, h6').each((_, element) => {
    const text = normalizeText($(element).text());

    if (text) {
      console.log(`${element.tagName.toUpperCase()}: ${text}`);
    }
  });

  console.log('');
  console.log(`TABLE COUNT: ${$('table').length}`);

  $('table').each((tableIndex, table) => {
    console.log('');
    console.log(`----- TABLE ${tableIndex + 1} -----`);

    const rows = $(table).find('tr').toArray();

    console.log(`Rows: ${rows.length}`);

    for (const [rowIndex, row] of rows.slice(0, 50).entries()) {
      const cells = $(row)
        .find('th, td')
        .map((_, cell) => normalizeText($(cell).text()))
        .get();

      if (cells.length > 0) {
        console.log(
          `ROW ${rowIndex + 1}: ${JSON.stringify(cells)}`,
        );
      }
    }
  });

  console.log('');
  console.log('MAIN TEXT SAMPLE');

  const mainText = normalizeText(
    $('main').length > 0 ? $('main').text() : $('body').text(),
  );

  console.log(mainText.slice(0, 6000));
}

async function main(): Promise<void> {
  for (const url of URLS) {
    await inspect(url);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});