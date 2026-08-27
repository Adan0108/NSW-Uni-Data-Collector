import {
  callUtsApi,
  parseAcademicItem,
} from './uts.api.js';

import type {
  UtsApiItem,
  UtsQueryParam,
} from './uts.types.js';

export interface CollectedUtsSubject {
  code: string;
  name: string;

  creditPoints?: number;

  year?: string;

  area?: string;

  description?: unknown;

  overview?: unknown;

  assessment?: unknown;

  learningOutcomes?: unknown;

  offerings?: unknown;

  requisiteDetail?: unknown;

  preRequisites?: unknown;

  requisites?: unknown;

  exclusions?: unknown;

  enrolmentRule?: unknown;

  raw: ReturnType<
    typeof parseAcademicItem
  >;
}

export async function collectUtsSubjects(
  year: string,
): Promise<CollectedUtsSubject[]> {
  const items =
    await fetchAllSubjectsWithRetry(
      [
        {
          queryField:
            'implementationYear',

          queryValue:
            year,
        },
      ],
    );

  const subjects =
    items.map(
      (raw) => {
        const item =
          parseAcademicItem(
            raw,
          );

        return {
          code:
            item.code ?? '',

          name:
            item.title ??
            item.search_title ??
            '',

          creditPoints:
            item.credit_points
              ? Number(
                  item.credit_points,
                )
              : undefined,

          year:
            item.implementation_year,

          area:
            item.educational_area,

          description:
            item.description,

          overview:
            item.overview,

          assessment:
            item.assessment,

          learningOutcomes:
            item.unit_learning_outcomes,

          offerings:
            item.offering,

          requisiteDetail:
            item.requisite_detail,

          preRequisites:
            item.pre_requisites,

          requisites:
            item.requisites,

          exclusions:
            item.exclusions,

          enrolmentRule:
            item.enrolment_rule,

          raw:
            item,
        };
      },
    );

  return deduplicateSubjects(
    subjects,
  );
}

async function fetchAllSubjectsWithRetry(
  queryParams: UtsQueryParam[],
): Promise<UtsApiItem[]> {
  const limit = 50;

  let offset = 0;

  const allItems:
    UtsApiItem[] = [];

  while (true) {
    const items =
      await fetchSubjectPageWithRetry(
        queryParams,
        offset,
        limit,
      );

    allItems.push(
      ...items,
    );

    console.log(
      `Fetched ${allItems.length} subject records`,
    );

    if (
      items.length < limit
    ) {
      break;
    }

    offset +=
      items.length;

    /*
     * Small delay between pages to reduce
     * the chance of triggering UTS
     * rate limiting.
     */
    await sleep(
      250,
    );
  }

  return allItems;
}

async function fetchSubjectPageWithRetry(
  queryParams: UtsQueryParam[],
  offset: number,
  limit: number,
): Promise<UtsApiItem[]> {
  const maxAttempts = 5;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      const response =
        await callUtsApi({
          siteId:
            'uts-prod-pres',

          contentType:
            'subject',

          queryParams,

          offset,

          limit,
        });

      return response.data.data;
    } catch (error) {
      if (
        attempt ===
        maxAttempts
      ) {
        throw error;
      }

      const delay =
        attempt * 2000;

      console.log(
        `Subject request failed at offset ${offset}. Retrying in ${delay}ms (${attempt}/${maxAttempts})...`,
      );

      await sleep(
        delay,
      );
    }
  }

  return [];
}

function deduplicateSubjects(
  subjects: CollectedUtsSubject[],
): CollectedUtsSubject[] {
  const map =
    new Map<
      string,
      CollectedUtsSubject
    >();

  for (const subject of subjects) {
    if (!subject.code) {
      continue;
    }

    if (
      !map.has(
        subject.code,
      )
    ) {
      map.set(
        subject.code,
        subject,
      );
    }
  }

  return [
    ...map.values(),
  ];
}

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}