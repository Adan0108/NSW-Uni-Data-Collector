import {
  fetchAllUtsItems,
  parseAcademicItem,
} from '../adapters/uts/uts.api.js';

async function main() {
  const items = await fetchAllUtsItems({
    contentType: 'aos',

    queryParams: [
      {
        queryField: 'implementationYear',
        queryValue: '2026',
      },
      {
        queryField: 'studyLevel',
        queryValue:
          '817ed8571b875d1002b942e7b04bcb4f',
      },
      {
        queryField: 'level',
        queryValue: 'major',
      },
    ],
  });

  const sampleCodes = [
    'MAJ08437', // Business
    'MAJ03523', // Software Engineering
    'MAJ01100', // Chemistry
    'MAJ09481', // Media Arts and Production
  ];

  for (const code of sampleCodes) {
    const raw = items.find((item) => {
      const parsed =
        parseAcademicItem(item);

      return parsed.code === code;
    });

    if (!raw) {
      console.log(`${code}: NOT FOUND`);
      continue;
    }

    const parsed =
      parseAcademicItem(raw);

    console.log('\n=============================');
    console.log(code);
    console.log('=============================');

    console.log(
      JSON.stringify(
        {
          code: parsed.code,
          title: parsed.title,
          search_title:
            parsed.search_title,

          educational_area:
            parsed.educational_area,

          parent_academic_org:
            parsed.parent_academic_org,

          academic_org:
            parsed.academic_org,

          sub_academic_org:
            parsed.sub_academic_org,

          faculty_detail:
            parsed.faculty_detail,

          school_detail:
            parsed.school_detail,
        },
        null,
        2,
      ),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});