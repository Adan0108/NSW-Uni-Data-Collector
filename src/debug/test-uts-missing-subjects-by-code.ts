import {
  callUtsApi,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

interface MissingSubject {
  code: string;
  year: string;
  url: string;
}

const SUBJECTS: MissingSubject[] = [
  {
    code: '22107',
    year: '2025',
    url: '/subject/2025/22107',
  },
  {
    code: '21228',
    year: '2026',
    url: '/subject/2026/21228',
  },
  {
    code: '21129',
    year: '2025',
    url: '/subject/2025/21129',
  },
  {
    code: '24108',
    year: '2025',
    url: '/subject/2025/24108',
  },
  {
    code: '41308',
    year: '2026',
    url: '/subject/2026/41308',
  },
  {
    code: '25627',
    year: '2026',
    url: '/subject/2026/25627',
  },
  {
    code: '25500',
    year: '2026',
    url: '/subject/2026/25500',
  },
  {
    code: '48210',
    year: '2026',
    url: '/subject/2026/48210',
  },
  {
    code: '95748',
    year: '2026',
    url: '/subject/2026/95748',
  },
  {
    code: '95751',
    year: '2026',
    url: '/subject/2026/95751',
  },
  {
    code: '95755',
    year: '2026',
    url: '/subject/2026/95755',
  },
  {
    code: '95754',
    year: '2026',
    url: '/subject/2026/95754',
  },
  {
    code: '95744',
    year: '2026',
    url: '/subject/2026/95744',
  },
  {
    code: '95732',
    year: '2025',
    url: '/subject/2025/95732',
  },
  {
    code: '22240',
    year: '2026',
    url: '/subject/2026/22240',
  },
  {
    code: '24205',
    year: '2026',
    url: '/subject/2026/24205',
  },
  {
    code: '24212',
    year: '2026',
    url: '/subject/2026/24212',
  },
  {
    code: '49322',
    year: '2026',
    url: '/subject/2026/49322',
  },
  {
    code: '16260',
    year: '2025',
    url: '/subject/2025/16260',
  },
  {
    code: '16074',
    year: '2025',
    url: '/subject/2025/16074',
  },
  {
    code: '16075',
    year: '2025',
    url: '/subject/2025/16075',
  },
  {
    code: '16076',
    year: '2025',
    url: '/subject/2025/16076',
  },
  {
    code: '16077',
    year: '2025',
    url: '/subject/2025/16077',
  },
  {
    code: '93470',
    year: '2026',
    url: '/subject/2026/93470',
  },
  {
    code: '92470',
    year: '2026',
    url: '/subject/2026/92470',
  },
  {
    code: '92471',
    year: '2026',
    url: '/subject/2026/92471',
  },
  {
    code: '92472',
    year: '2026',
    url: '/subject/2026/92472',
  },
  {
    code: '92474',
    year: '2026',
    url: '/subject/2026/92474',
  },
  {
    code: '92478',
    year: '2026',
    url: '/subject/2026/92478',
  },
  {
    code: '92480',
    year: '2025',
    url: '/subject/2025/92480',
  },
  {
    code: '92481',
    year: '2026',
    url: '/subject/2026/92481',
  },
  {
    code: '92482',
    year: '2026',
    url: '/subject/2026/92482',
  },
  {
    code: '92577',
    year: '2026',
    url: '/subject/2026/92577',
  },
  {
    code: '92574',
    year: '2026',
    url: '/subject/2026/92574',
  },
  {
    code: '54420',
    year: '2026',
    url: '/subject/2026/54420',
  },
  {
    code: '99215',
    year: '2025',
    url: '/subject/2025/99215',
  },
  {
    code: '260777',
    year: '2026',
    url: '/subject/2026/260777',
  },
  {
    code: '260776',
    year: '2026',
    url: '/subject/2026/260776',
  },
  {
    code: '420100',
    year: '2026',
    url: '/subject/2026/420100',
  },
  {
    code: '96342',
    year: '2025',
    url: '/subject/2025/96342',
  },
  {
    code: '096332',
    year: '2025',
    url: '/subject/2025/096332',
  },
  {
    code: '096331',
    year: '2026',
    url: '/subject/2026/096331',
  },
  {
    code: '090044',
    year: '2025',
    url: '/subject/2025/090044',
  },
  {
    code: '090059',
    year: '2026',
    url: '/subject/2026/090059',
  },
];

async function main() {
  let recovered2026 = 0;
  let recovered2025 = 0;

  const unresolved2026:
    MissingSubject[] = [];

  const unresolved2025:
    MissingSubject[] = [];

  for (const subject of SUBJECTS) {
    const response =
      await callUtsApi({
        siteId:
          'uts-prod-pres',

        contentType:
          'subject',

        queryParams: [
          {
            queryField:
              'implementationYear',

            queryValue:
              subject.year,
          },
          {
            queryField:
              'code',

            queryValue:
              subject.code,
          },
        ],

        offset: 0,
        limit: 10,
      });

    const raw =
      response.data.data[0];

    if (!raw) {
      console.log(
        `${subject.code} (${subject.year}): NOT FOUND`,
      );

      if (
        subject.year ===
        '2026'
      ) {
        unresolved2026.push(
          subject,
        );
      } else {
        unresolved2025.push(
          subject,
        );
      }

      continue;
    }

    const item =
      parseAcademicItem(
        raw,
      );

    console.log(
      `${subject.code} (${subject.year}): FOUND | ${
        item.title ??
        item.search_title ??
        '-'
      }`,
    );

    if (
      subject.year ===
      '2026'
    ) {
      recovered2026++;
    } else {
      recovered2025++;
    }
  }

  console.log(
    '\n=============================',
  );

  console.log(
    'MISSING SUBJECT RECOVERY',
  );

  console.log(
    '=============================\n',
  );

  console.log(
    `Recovered 2026: ${recovered2026}`,
  );

  console.log(
    `Unresolved 2026: ${unresolved2026.length}`,
  );

  console.log(
    `Recovered 2025 references: ${recovered2025}`,
  );

  console.log(
    `Unresolved 2025 references: ${unresolved2025.length}`,
  );

  if (
    unresolved2026.length > 0
  ) {
    console.log(
      '\nUnresolved 2026:',
    );

    for (
      const subject
      of unresolved2026
    ) {
      console.log(
        subject.code,
      );
    }
  }

  if (
    unresolved2025.length > 0
  ) {
    console.log(
      '\nUnresolved 2025:',
    );

    for (
      const subject
      of unresolved2025
    ) {
      console.log(
        subject.code,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});