import {
  resolve,
} from 'node:path';

import {
  collectUtsCourses,
  type CollectedUtsCourse,
} from './uts.course.collector.js';

import {
  type CollectedUtsAos,
} from './uts.aos.collector.js';

import {
  extractDegreeComponents,
} from './uts.degree-component.extractor.js';

import {
  callUtsApi,
  fetchAllUtsItems,
  parseAcademicItem,
} from './uts.api.js';

import {
  parseUtsCurriculumStructure,
} from './uts.structure.parser.js';

import {
  readJsonSnapshot,
  writeJsonSnapshot,
} from '../../storage/snapshot.storage.js';

const UTS_AOS_STUDY_LEVEL =
  '817ed8571b875d1002b942e7b04bcb4f';

const AOS_LEVELS = [
  'major',
  'sub_major',
  'stream',
];

const AOS_COLLECTION_PASSES =
  3;

type DegreeComponentReference =
  ReturnType<
    typeof extractDegreeComponents
  >[number];

export interface UtsMasterCollection {
  year: string;

  courses:
    CollectedUtsCourse[];

  aos:
    CollectedUtsAos[];

  degreeComponentReferences:
    DegreeComponentReference[];

  unresolvedAosReferences:
    DegreeComponentReference[];
}

export async function collectUtsMaster(
  year: string,
): Promise<UtsMasterCollection> {
  console.log(
    '\n=============================',
  );

  console.log(
    `COLLECTING UTS ${year}`,
  );

  console.log(
    '=============================\n',
  );

  /*
   * ------------------------------------------------
   * COURSES
   * ------------------------------------------------
   */

  const courses =
    await collectUtsCourses(
      year,
    );

  console.log(
    `\nCourses collected: ${courses.length}`,
  );

  /*
   * ------------------------------------------------
   * GLOBAL AOS
   * ------------------------------------------------
   *
   * CourseLoop pagination has occasionally returned
   * the same AOS twice while omitting another record.
   *
   * Because of that, we perform multiple passes and
   * union the results by code.
   */

  let collectedAos:
    CollectedUtsAos[] = [];

  for (
    let pass = 1;
    pass <= AOS_COLLECTION_PASSES;
    pass++
  ) {
    console.log(
      `\n=============================`,
    );

    console.log(
      `AOS COLLECTION PASS ${pass}/${AOS_COLLECTION_PASSES}`,
    );

    console.log(
      '=============================',
    );

    const passRecords:
      CollectedUtsAos[] = [];

    for (
      const level
      of AOS_LEVELS
    ) {
      console.log(
        `\nCollecting global AOS: ${level}`,
      );

      const records =
        await collectGlobalAos(
          year,
          level,
        );

      passRecords.push(
        ...records,
      );
    }

    const uniquePassRecords =
      deduplicateAos(
        passRecords,
      );

    console.log(
      `\nPass ${pass} raw AOS: ${passRecords.length}`,
    );

    console.log(
      `Pass ${pass} unique AOS: ${uniquePassRecords.length}`,
    );

    const before =
      deduplicateAos(
        collectedAos,
      ).length;

    collectedAos =
      deduplicateAos([
        ...collectedAos,
        ...uniquePassRecords,
      ]);

    const after =
      collectedAos.length;

    console.log(
      `Union AOS after pass ${pass}: ${after}`,
    );

    console.log(
      `New unique AOS found this pass: ${after - before}`,
    );
  }

  /*
   * ------------------------------------------------
   * PREVIOUS SNAPSHOT
   * ------------------------------------------------
   *
   * Preserve previously observed AOS records in case
   * UTS temporarily omits one from all current passes.
   */

  const snapshotPath =
    resolve(
      'data',
      'raw',
      'uts',
      year,
      'aos-snapshot.json',
    );

  const previousSnapshot =
    await readJsonSnapshot<
      CollectedUtsAos[]
    >(
      snapshotPath,
    );

  if (previousSnapshot) {
    console.log(
      `\nPrevious AOS snapshot: ${previousSnapshot.length}`,
    );

    const beforeSnapshotMerge =
      collectedAos.length;

    collectedAos =
      deduplicateAos([
        ...collectedAos,
        ...previousSnapshot,
      ]);

    console.log(
      `AOS after snapshot merge: ${collectedAos.length}`,
    );

    console.log(
      `Recovered from previous snapshot: ${
        collectedAos.length -
        beforeSnapshotMerge
      }`,
    );
  } else {
    console.log(
      '\nNo previous AOS snapshot found.',
    );
  }

  let uniqueAos =
    deduplicateAos(
      collectedAos,
    );

  console.log(
    `\nStable browse-listed AOS: ${uniqueAos.length}`,
  );

  /*
   * ------------------------------------------------
   * COURSE -> AOS RELATIONSHIPS
   * ------------------------------------------------
   */

  const degreeComponentReferences:
    DegreeComponentReference[] = [];

  for (const course of courses) {
    if (!course.structure) {
      continue;
    }

    const references =
      extractDegreeComponents(
        course.code,
        course.structure,
      );

    degreeComponentReferences.push(
      ...references,
    );
  }

  console.log(
    `Degree component relationships: ${degreeComponentReferences.length}`,
  );

  /*
   * ------------------------------------------------
   * FIND AOS REFERENCED BY COURSES BUT NOT BROWSE
   * ------------------------------------------------
   */

  const collectedCodes =
    new Set(
      uniqueAos.map(
        (item) =>
          item.code,
      ),
    );

  const missingCodes =
    new Set<string>();

  for (
    const reference
    of degreeComponentReferences
  ) {
    if (
      reference.componentCode &&
      !collectedCodes.has(
        reference.componentCode,
      )
    ) {
      missingCodes.add(
        reference.componentCode,
      );
    }
  }

  console.log(
    `Missing unique AOS codes: ${missingCodes.size}`,
  );

  /*
   * ------------------------------------------------
   * DIRECT AOS RECOVERY
   * ------------------------------------------------
   */

  const recoveredAos:
    CollectedUtsAos[] = [];

  for (
    const code
    of missingCodes
  ) {
    const recovered =
      await fetchAosByCode(
        year,
        code,
      );

    if (recovered) {
      recoveredAos.push(
        recovered,
      );

      console.log(
        `Recovered AOS: ${code}`,
      );
    } else {
      console.log(
        `Unresolved AOS: ${code}`,
      );
    }
  }

  uniqueAos =
    deduplicateAos([
      ...uniqueAos,
      ...recoveredAos,
    ]);

  console.log(
    `\nTotal AOS after recovery: ${uniqueAos.length}`,
  );

  /*
   * ------------------------------------------------
   * SAVE STABLE SNAPSHOT
   * ------------------------------------------------
   *
   * The snapshot contains all successfully collected
   * and directly recovered AOS records.
   *
   * Future runs merge against this snapshot.
   */

  await writeJsonSnapshot(
    snapshotPath,
    uniqueAos,
  );

  console.log(
    `AOS snapshot saved: ${snapshotPath}`,
  );

  /*
   * ------------------------------------------------
   * FINAL UNRESOLVED REFERENCES
   * ------------------------------------------------
   */

  const finalCodes =
    new Set(
      uniqueAos.map(
        (item) =>
          item.code,
      ),
    );

  const unresolvedAosReferences =
    degreeComponentReferences.filter(
      (reference) =>
        reference.componentCode &&
        !finalCodes.has(
          reference.componentCode,
        ),
    );

  const unresolvedUniqueCodes =
    new Set(
      unresolvedAosReferences
        .map(
          (reference) =>
            reference.componentCode,
        )
        .filter(
          (
            code,
          ): code is string =>
            Boolean(code),
        ),
    );

  console.log(
    `Unresolved AOS relationships: ${unresolvedAosReferences.length}`,
  );

  console.log(
    `Unresolved unique AOS codes: ${unresolvedUniqueCodes.size}`,
  );

  return {
    year,

    courses,

    aos:
      uniqueAos,

    degreeComponentReferences,

    unresolvedAosReferences,
  };
}

async function collectGlobalAos(
  year: string,
  level: string,
): Promise<CollectedUtsAos[]> {
  const items =
    await fetchAllUtsItems({
      contentType:
        'aos',

      queryParams: [
        {
          queryField:
            'implementationYear',

          queryValue:
            year,
        },
        {
          queryField:
            'studyLevel',

          queryValue:
            UTS_AOS_STUDY_LEVEL,
        },
        {
          queryField:
            'level',

          queryValue:
            level,
        },
      ],
    });

  return items.map(
    (raw) =>
      mapAos(
        raw,
        level,
      ),
  );
}

async function fetchAosByCode(
  year: string,
  code: string,
): Promise<
  CollectedUtsAos | undefined
> {
  const response =
    await callUtsApi({
      siteId:
        'uts-prod-pres',

      contentType:
        'aos',

      queryParams: [
        {
          queryField:
            'implementationYear',

          queryValue:
            year,
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
    return undefined;
  }

  const parsed =
    parseAcademicItem(
      raw,
    );

  return mapAos(
    raw,

    parsed.academic_item_type ??
      'unknown',
  );
}

function mapAos(
  raw:
    Parameters<
      typeof parseAcademicItem
    >[0],

  fallbackType: string,
): CollectedUtsAos {
  const item =
    parseAcademicItem(
      raw,
    );

  return {
    code:
      item.code ?? '',

    name:
      item.search_title ??
      item.title ??
      '',

    type:
      item.academic_item_type ??
      fallbackType,

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

    structure:
      raw.CurriculumStructure
        ? parseUtsCurriculumStructure(
            raw.CurriculumStructure,
          )
        : undefined,
  };
}

function deduplicateAos(
  items:
    CollectedUtsAos[],
): CollectedUtsAos[] {
  const map =
    new Map<
      string,
      CollectedUtsAos
    >();

  for (const item of items) {
    if (!item.code) {
      continue;
    }

    if (
      !map.has(
        item.code,
      )
    ) {
      map.set(
        item.code,
        item,
      );
    }
  }

  return [
    ...map.values(),
  ];
}