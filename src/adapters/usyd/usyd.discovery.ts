import axios from 'axios';
import * as cheerio from 'cheerio';

const UNIT_URL = 'https://www.sydney.edu.au/units/COMP2017';

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

async function main(): Promise<void> {
  const response = await axios.get<string>(UNIT_URL, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
    },
  });

  console.log('================================');
  console.log('USYD UNIT DETAIL DISCOVERY');
  console.log('================================');

  console.log(`URL: ${UNIT_URL}`);
  console.log(`Status: ${response.status}`);
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
  console.log('TABLES');

  $('table').each((index, table) => {
    console.log('');
    console.log(`----- TABLE ${index + 1} -----`);

    $(table)
      .find('tr')
      .each((rowIndex, row) => {
        const cells = $(row)
          .find('th, td')
          .map((_, cell) => normalizeText($(cell).text()))
          .get();

        if (cells.length > 0) {
          console.log(`ROW ${rowIndex + 1}: ${JSON.stringify(cells)}`);
        }
      });
  });

  console.log('');
  console.log('DEFINITION LISTS');

  $('dl').each((index, list) => {
    console.log(`DL ${index + 1}`);

    $(list)
      .find('dt, dd')
      .each((_, element) => {
        console.log(
          `${element.tagName.toUpperCase()}: ${normalizeText($(element).text())}`,
        );
      });
  });

  console.log('');
  console.log('LABEL / VALUE CANDIDATES');

  $('strong, b, dt, th').each((_, element) => {
    const text = normalizeText($(element).text());

    if (
      /credit|prereq|coreq|prohibition|assumed|session|semester|unit|faculty|school|description|outcome|enrol/i.test(
        text,
      )
    ) {
      console.log(`${element.tagName.toUpperCase()}: ${text}`);
    }
  });

  console.log('');
  console.log('MAIN TEXT');

  const mainText = normalizeText(
    $('main').length > 0 ? $('main').text() : $('body').text(),
  );

  console.log(mainText.slice(0, 15000));

  console.log('');
  console.log('LINKS');

  $('a[href]').each((_, element) => {
    const text = normalizeText($(element).text());
    const href = $(element).attr('href');

    if (!href) {
      return;
    }

    if (
      /\b[A-Z]{4}\d{4}\b/.test(text) ||
      /unit|handbook|course|outline/i.test(`${text} ${href}`)
    ) {
      try {
        console.log(
          `${text || '[no text]'} -> ${new URL(href, UNIT_URL).toString()}`,
        );
      } catch {
        // Ignore malformed URLs.
      }
    }
  });

  console.log('');
  console.log('SCRIPT / JSON CANDIDATES');

  $('script').each((index, script) => {
    const type = $(script).attr('type') ?? '';
    const src = $(script).attr('src');
    const content = $(script).html()?.trim() ?? '';

    if (src) {
      console.log(`SCRIPT ${index + 1} SRC: ${src}`);
    }

    if (
      type.includes('json') ||
      content.includes('COMP2017') ||
      content.includes('prerequisite') ||
      content.includes('creditPoint') ||
      content.includes('api/')
    ) {
      console.log(
        `SCRIPT ${index + 1} TYPE=${type}: ${content.slice(0, 3000)}`,
      );
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});