import {
  callUtsApi,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

const SUBJECT_CODES = [
  '22321',
  '32543',
  '431008',
];

async function main() {
  for (const code of SUBJECT_CODES) {
    console.log(
      '\n=============================',
    );

    console.log(
      `SUBJECT: ${code}`,
    );

    console.log(
      '=============================\n',
    );

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
              '2026',
          },
          {
            queryField:
              'code',

            queryValue:
              code,
          },
        ],

        offset: 0,
        limit: 10,
      });

    const raw =
      response.data.data[0];

    if (!raw) {
      console.log(
        'NOT FOUND',
      );

      continue;
    }

    const subject =
      parseAcademicItem(
        raw,
      );

    console.log(
      `Code: ${subject.code ?? '-'}`,
    );

    console.log(
      `Name: ${
        subject.title ??
        subject.search_title ??
        '-'
      }`,
    );

    console.log(
      '\npre_requisites:',
    );

    console.dir(
      subject.pre_requisites,
      {
        depth: null,
      },
    );

    console.log(
      '\nrequisites:',
    );

    console.dir(
      subject.requisites,
      {
        depth: null,
      },
    );

    console.log(
      '\nrequisite_detail:',
    );

    console.dir(
      subject.requisite_detail,
      {
        depth: null,
      },
    );

    console.log(
      '\nexclusions:',
    );

    console.dir(
      subject.exclusions,
      {
        depth: null,
      },
    );

    console.log(
      '\nenrolment_rule:',
    );

    console.dir(
      subject.enrolment_rule,
      {
        depth: null,
      },
    );

    console.log(
      '\noffering:',
    );

    console.dir(
      subject.offering,
      {
        depth: null,
      },
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});