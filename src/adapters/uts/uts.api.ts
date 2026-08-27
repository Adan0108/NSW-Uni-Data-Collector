import type {
  UtsAcademicItem,
  UtsApiItem,
  UtsApiRequest,
  UtsApiResponse,
  UtsQueryParam,
} from './uts.types.js';

const UTS_API =
  'https://coursehandbook.uts.edu.au/api/search/browsepage-academic-items';

export async function callUtsApi(
  payload: UtsApiRequest,
): Promise<UtsApiResponse> {
  const response = await fetch(
    UTS_API,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'text/plain;charset=UTF-8',

        Accept: '*/*',

        Origin:
          'https://coursehandbook.uts.edu.au',

        Referer:
          'https://coursehandbook.uts.edu.au/',
      },

      body:
        JSON.stringify(
          payload,
        ),
    },
  );

  if (!response.ok) {
    throw new Error(
      `UTS API failed: ${response.status} ${response.statusText}`,
    );
  }

  return (
    await response.json()
  ) as UtsApiResponse;
}

export function parseAcademicItem(
  item: UtsApiItem,
): UtsAcademicItem {
  const parsed =
    JSON.parse(
      item.data,
    ) as UtsAcademicItem;

  /*
   * Some UTS CourseLoop browse queries
   * do not return a separate "code" field.
   *
   * Example:
   *
   * search_title:
   * "MAJ08437 - Accounting"
   *
   * In those cases we safely recover the
   * code from search_title.
   */
  if (
    !parsed.code &&
    parsed.search_title
  ) {
    const code =
      extractCodeFromSearchTitle(
        parsed.search_title,
      );

    if (code) {
      parsed.code = code;
    }
  }

  return parsed;
}

export async function fetchAllUtsItems(
  params: {
    contentType: string;
    queryParams: UtsQueryParam[];
    pageSize?: number;
  },
): Promise<UtsApiItem[]> {
  const limit =
    params.pageSize ?? 100;

  let offset = 0;

  const allItems:
    UtsApiItem[] = [];

  while (true) {
    const response =
      await callUtsApi({
        siteId:
          'uts-prod-pres',

        contentType:
          params.contentType,

        queryParams:
          params.queryParams,

        offset,

        limit,
      });

    const items =
      response.data.data;

    allItems.push(
      ...items,
    );

    console.log(
      `Fetched ${allItems.length} ${params.contentType} records`,
    );

    /*
     * CourseLoop's "count" value is
     * page-related, not a reliable total.
     *
     * Pagination therefore stops only
     * when the returned page is smaller
     * than the requested page size.
     */
    if (
      items.length < limit
    ) {
      break;
    }

    offset +=
      items.length;
  }

  return allItems;
}

function extractCodeFromSearchTitle(
  searchTitle: string,
): string | undefined {
  const separatorIndex =
    searchTitle.indexOf(' - ');

  if (
    separatorIndex === -1
  ) {
    return undefined;
  }

  const code =
    searchTitle
      .slice(
        0,
        separatorIndex,
      )
      .trim();

  return code || undefined;
}