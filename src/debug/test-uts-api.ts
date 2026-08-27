const UTS_API =
  'https://coursehandbook.uts.edu.au/api/search/browsepage-academic-items';

interface UtsApiRequest {
  siteId: string;
  contentType: string;
  queryParams: {
    queryField: string;
    queryValue: string;
  }[];
  offset: number;
  limit: number;
}

interface UtsApiItem {
  data: string;
  publishDate?: string;
  studyLevel?: string;
  inode?: string;
  CurriculumStructure?: string;
}

interface UtsApiResponse {
  data?: {
    data?: UtsApiItem[];
    [key: string]: unknown;
  };
}

async function callUtsApi(
  payload: UtsApiRequest,
): Promise<UtsApiResponse> {
  const response = await fetch(UTS_API, {
    method: 'POST',

    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      Accept: '*/*',
      Origin: 'https://coursehandbook.uts.edu.au',
      Referer:
        'https://coursehandbook.uts.edu.au/',
    },

    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      `UTS API failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as UtsApiResponse;
}

async function main() {
  const result = await callUtsApi({
    siteId: 'uts-prod-pres',

    contentType: 'course',

    queryParams: [
      {
        queryField: 'educationalArea',
        queryValue:
          'c6142b2fc3ddc2107fe22c4bb0013127',
      },
      {
        queryField: 'implementationYear',
        queryValue: '2026',
      },
      {
        queryField: 'studyLevel',
        queryValue:
          '0c2074dcdb6afc5087f743ea13961960',
      },
    ],

    offset: 0,

    // Make this larger than the browser's default 10.
    limit: 100,
  });

  console.log(
    'TOP LEVEL KEYS:',
    Object.keys(result),
  );

  console.log(
    'DATA KEYS:',
    Object.keys(result.data ?? {}),
  );

  const items = result.data?.data ?? [];

  console.log(
    '\nNUMBER OF RECORDS:',
    items.length,
  );

  for (const item of items) {
    try {
      const parsed = JSON.parse(item.data) as {
        code?: string;
        title?: string;
        implementation_year?: string;
        study_level_ref?: string;
        educational_area?: string;
        academic_item_type?: string;
        credit_points?: string;
      };

      console.log({
        code: parsed.code,
        title: parsed.title,
        year: parsed.implementation_year,
        studyLevel: parsed.study_level_ref,
        area: parsed.educational_area,
        type: parsed.academic_item_type,
        creditPoints: parsed.credit_points,
      });
    } catch (error) {
      console.error(
        'Could not parse item.data',
        error,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);

  process.exit(1);
});