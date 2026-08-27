import {
  discoverUsydGlobalComponents,
  type UsydDiscoveredComponent,
  type UsydGlobalComponentType,
} from './usyd.global-component-discovery';

import type {
  UsydHandbookCategory,
} from './usyd.handbook-discovery';

/**
 * ------------------------------------------------
 * USYD GLOBAL COMPONENT DISCOVERY AUDIT
 * ------------------------------------------------
 *
 * This validates discovery before we build the global
 * component parser.
 */

const EXPECTED_HANDBOOKS:
  UsydHandbookCategory[] = [
    'ARCHITECTURE',
    'ARTS',
    'BUSINESS',
    'ENGINEERING',
    'INTERDISCIPLINARY',
    'MEDICINE_HEALTH',
    'SCIENCE',
    'CONSERVATORIUM',
    'LAW',
  ];

const COMPONENT_TYPES:
  UsydGlobalComponentType[] = [
    'MAJOR',
    'MINOR',
    'PROGRAM',
    'STREAM',
    'SPECIALISATION',
    'OTHER',
  ];

function divider(): void {
  console.log(
    '================================',
  );
}

function componentFamilyKey(
  url: string,
): string {
  try {
    const parsed =
      new URL(
        url,
      );

    const specialisationMatch =
      parsed.pathname.match(
        /\/specialisations\/([^/]+?)-unit-of-study-table\.html$/i,
      );

    if (
      specialisationMatch
    ) {
      const parent =
        parsed.pathname.replace(
          /\/[^/]+\.html$/i,
          '/',
        );

      return (
        parsed.origin +
        parent +
        specialisationMatch[1] +
        '/'
      );
    }

    parsed.pathname =
      parsed.pathname.replace(
        /\/[^/]+\.html$/i,
        '/',
      );

    parsed.hash =
      '';

    return parsed.toString();
  } catch {
    return url;
  }
}

function printComponent(
  component:
    UsydDiscoveredComponent,
): void {
  console.log(
    `${component.type} — ${component.name}`,
  );

  console.log(
    `  Handbook: ${component.handbookCategory}`,
  );

  console.log(
    `  Overview: ${component.overviewUrl}`,
  );

  console.log(
    `  Primary table: ${
      component.unitTableUrl ??
      'NONE'
    }`,
  );

  console.log(
    `  Tables: ${component.tableUrls.length}`,
  );

  for (
    const tableUrl
    of component.tableUrls
  ) {
    console.log(
      `    - ${tableUrl}`,
    );
  }

  console.log(
    `  Learning outcomes: ${
      component.learningOutcomesUrl ??
      'NONE'
    }`,
  );

  console.log(
    `  Source: ${component.sourceUrl}`,
  );

  console.log('');
}

async function main(): Promise<void> {
  divider();

  console.log(
    'USYD GLOBAL COMPONENT DISCOVERY AUDIT',
  );

  divider();

  const components =
    await discoverUsydGlobalComponents();

  /**
   * ------------------------------------------------
   * BY HANDBOOK
   * ------------------------------------------------
   */

  const byHandbook =
    new Map<
      UsydHandbookCategory,
      number
    >();

  for (
    const category
    of EXPECTED_HANDBOOKS
  ) {
    byHandbook.set(
      category,
      0,
    );
  }

  for (
    const component
    of components
  ) {
    byHandbook.set(
      component.handbookCategory,

      (
        byHandbook.get(
          component.handbookCategory,
        ) ??
        0
      ) +
      1,
    );
  }

  divider();

  console.log(
    'COMPONENTS BY HANDBOOK',
  );

  divider();

  for (
    const category
    of EXPECTED_HANDBOOKS
  ) {
    console.log(
      `${category}: ${
        byHandbook.get(
          category,
        ) ??
        0
      }`,
    );
  }

  const emptyHandbooks =
    EXPECTED_HANDBOOKS.filter(
      (category) =>
        (
          byHandbook.get(
            category,
          ) ??
          0
        ) ===
        0,
    );

  divider();

  console.log(
    'HANDBOOKS WITH ZERO COMPONENTS',
  );

  divider();

  if (
    emptyHandbooks.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const category
      of emptyHandbooks
    ) {
      console.log(
        category,
      );
    }
  }

  /**
   * ------------------------------------------------
   * BY TYPE
   * ------------------------------------------------
   */

  const byType =
    new Map<
      UsydGlobalComponentType,
      number
    >();

  for (
    const type
    of COMPONENT_TYPES
  ) {
    byType.set(
      type,
      0,
    );
  }

  for (
    const component
    of components
  ) {
    byType.set(
      component.type,

      (
        byType.get(
          component.type,
        ) ??
          0
      ) +
      1,
    );
  }

  divider();

  console.log(
    'COMPONENTS BY TYPE',
  );

  divider();

  for (
    const type
    of COMPONENT_TYPES
  ) {
    console.log(
      `${type}: ${
        byType.get(
          type,
        ) ??
        0
      }`,
    );
  }

  /**
   * ------------------------------------------------
   * UNKNOWN TYPES
   * ------------------------------------------------
   */

  const unknownTypes =
    components.filter(
      (component) =>
        component.type ===
        'OTHER',
    );

  divider();

  console.log(
    'OTHER / UNKNOWN COMPONENT TYPES',
  );

  divider();

  if (
    unknownTypes.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const component
      of unknownTypes
    ) {
      printComponent(
        component,
      );
    }
  }

  /**
   * ------------------------------------------------
   * BUSINESS CLASSIFICATION REGRESSION
   * ------------------------------------------------
   *
   * The previous run classified Commerce subject areas
   * such as Accounting and Finance as OTHER.
   */

  const businessSubjectAreas =
    components.filter(
      (component) =>
        component.handbookCategory ===
          'BUSINESS' &&
        /\/commerce-subject-areas\/[^/]+\//i.test(
          component.overviewUrl,
        ),
    );

  const badBusinessTypes =
    businessSubjectAreas.filter(
      (component) =>
        component.type ===
        'OTHER',
    );

  divider();

  console.log(
    'BUSINESS SUBJECT-AREA CLASSIFICATION',
  );

  divider();

  console.log(
    `Business subject areas: ${businessSubjectAreas.length}`,
  );

  console.log(
    `Still classified OTHER: ${badBusinessTypes.length}`,
  );

  if (
    badBusinessTypes.length >
    0
  ) {
    for (
      const component
      of badBusinessTypes
    ) {
      printComponent(
        component,
      );
    }
  }

  /**
   * ------------------------------------------------
   * MISSING TABLES
   * ------------------------------------------------
   */

  const missingTables =
    components.filter(
      (component) =>
        component.tableUrls.length ===
        0,
    );

  divider();

  console.log(
    'COMPONENTS WITH NO UNIT TABLE',
  );

  divider();

  if (
    missingTables.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const component
      of missingTables
    ) {
      printComponent(
        component,
      );
    }
  }

  /**
   * ------------------------------------------------
   * INVALID NAMES
   * ------------------------------------------------
   */

  const invalidNames =
    components.filter(
      (component) => {
        const name =
          component.name.trim();

        return (
          name.length <
            2 ||
          /^(?:overview|learning outcomes?|unit of study table|units of study)$/i.test(
            name,
          )
        );
      },
    );

  divider();

  console.log(
    'INVALID COMPONENT NAMES',
  );

  divider();

  if (
    invalidNames.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const component
      of invalidNames
    ) {
      printComponent(
        component,
      );
    }
  }

  /**
   * ------------------------------------------------
   * DUPLICATE FAMILY RECORDS
   * ------------------------------------------------
   */

  const familyMap =
    new Map<
      string,
      UsydDiscoveredComponent[]
    >();

  for (
    const component
    of components
  ) {
    const key =
      [
        component.handbookCategory,
        componentFamilyKey(
          component.overviewUrl,
        ),
      ].join(
        '::',
      );

    const existing =
      familyMap.get(
        key,
      ) ??
      [];

    existing.push(
      component,
    );

    familyMap.set(
      key,
      existing,
    );
  }

  const duplicateFamilies =
    [
      ...familyMap.entries(),
    ].filter(
      (
        [
          ,
          items,
        ],
      ) =>
        items.length >
        1,
    );

  divider();

  console.log(
    'DUPLICATE COMPONENT FAMILIES',
  );

  divider();

  if (
    duplicateFamilies.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const [
        key,
        items,
      ]
      of duplicateFamilies
    ) {
      console.log(
        key,
      );

      for (
        const component
        of items
      ) {
        printComponent(
          component,
        );
      }
    }
  }

  /**
   * ------------------------------------------------
   * DUPLICATE NAMES WITHIN HANDBOOK
   * ------------------------------------------------
   */

  const nameMap =
    new Map<
      string,
      UsydDiscoveredComponent[]
    >();

  for (
    const component
    of components
  ) {
    const key =
      [
        component.handbookCategory,
        component.name
          .trim()
          .toLowerCase(),
      ].join(
        '::',
      );

    const existing =
      nameMap.get(
        key,
      ) ??
      [];

    existing.push(
      component,
    );

    nameMap.set(
      key,
      existing,
    );
  }

  const duplicateNames =
    [
      ...nameMap.entries(),
    ].filter(
      (
        [
          ,
          items,
        ],
      ) =>
        items.length >
        1,
    );

  divider();

  console.log(
    'DUPLICATE NAMES WITHIN SAME HANDBOOK',
  );

  divider();

  if (
    duplicateNames.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const [
        key,
        items,
      ]
      of duplicateNames
    ) {
      console.log(
        key,
      );

      for (
        const component
        of items
      ) {
        console.log(
          `  ${component.type}`,
        );

        console.log(
          `  ${component.name}`,
        );

        console.log(
          `  ${component.overviewUrl}`,
        );
      }

      console.log('');
    }
  }

  /**
   * ------------------------------------------------
   * PAGE VARIANT REGRESSION
   * ------------------------------------------------
   */

  const pageVariantComponents =
    components.filter(
      (component) =>
        /\/(?:learning-outcomes|honours-unit-of-study-table|introductory-unit-of-study-table|intermediate-unit-of-study-table|advanced-unit-of-study-table)\.html$/i.test(
          component.overviewUrl,
        ),
    );

  divider();

  console.log(
    'PAGE VARIANTS INCORRECTLY USED AS COMPONENTS',
  );

  divider();

  if (
    pageVariantComponents.length ===
    0
  ) {
    console.log(
      'NONE',
    );
  } else {
    for (
      const component
      of pageVariantComponents
    ) {
      printComponent(
        component,
      );
    }
  }

  /**
   * ------------------------------------------------
   * SCIENCE REGRESSION
   * ------------------------------------------------
   */

  const scienceComponents =
    components.filter(
      (component) =>
        component.handbookCategory ===
        'SCIENCE',
    );

  const scienceSubjectAreas =
    scienceComponents.filter(
      (component) =>
        /\/science\/table-a\/subject-areas\/[^/]+\//i.test(
          component.overviewUrl,
        ),
    );

  const scienceCoveragePass =
    scienceSubjectAreas.length >=
    45;

  divider();

  console.log(
    'SCIENCE COVERAGE REGRESSION',
  );

  divider();

  console.log(
    `Science components total: ${scienceComponents.length}`,
  );

  console.log(
    `Science Table A subject areas: ${scienceSubjectAreas.length}`,
  );

  console.log(
    'Expected known subject-area baseline: 45',
  );

  console.log(
    `${
      scienceCoveragePass
        ? 'PASS'
        : 'FAIL'
    } Science subject-area baseline`,
  );

  /**
   * ------------------------------------------------
   * ENGINEERING SPECIALISATIONS
   * ------------------------------------------------
   */

  const engineeringSpecialisations =
    components.filter(
      (component) =>
        component.handbookCategory ===
          'ENGINEERING' &&
        /\/specialisations\//i.test(
          component.overviewUrl,
        ),
    );

  const badEngineeringSpecialisationTypes =
    engineeringSpecialisations.filter(
      (component) =>
        component.type !==
        'SPECIALISATION',
    );

  divider();

  console.log(
    'ENGINEERING SPECIALISATION CHECK',
  );

  divider();

  console.log(
    `Specialisation components: ${engineeringSpecialisations.length}`,
  );

  console.log(
    `Incorrectly classified: ${badEngineeringSpecialisationTypes.length}`,
  );

  if (
    badEngineeringSpecialisationTypes.length >
    0
  ) {
    for (
      const component
      of badEngineeringSpecialisationTypes
    ) {
      printComponent(
        component,
      );
    }
  }

  /**
   * ------------------------------------------------
   * SPECIALISATION NAME CHECK
   * ------------------------------------------------
   *
   * Previous output had many specialisations all named
   * after their parent Engineering stream.
   */

  const suspiciousSpecialisationNames =
    engineeringSpecialisations.filter(
      (component) =>
        /\bengineering stream\b/i.test(
          component.name,
        ) ||
        /^Bachelor of Engineering Honours$/i.test(
          component.name,
        ),
    );

  divider();

  console.log(
    'ENGINEERING SPECIALISATION NAME CHECK',
  );

  divider();

  console.log(
    `Suspicious names: ${suspiciousSpecialisationNames.length}`,
  );

  if (
    suspiciousSpecialisationNames.length >
    0
  ) {
    for (
      const component
      of suspiciousSpecialisationNames
    ) {
      printComponent(
        component,
      );
    }
  }

  /**
   * ------------------------------------------------
   * MULTI-TABLE COMPONENTS
   * ------------------------------------------------
   */

  const multiTableComponents =
    components.filter(
      (component) =>
        component.tableUrls.length >
        1,
    );

  divider();

  console.log(
    'MULTI-TABLE COMPONENTS',
  );

  divider();

  console.log(
    `Count: ${multiTableComponents.length}`,
  );

  for (
    const component
    of multiTableComponents.slice(
      0,
      20,
    )
  ) {
    printComponent(
      component,
    );
  }

  /**
   * ------------------------------------------------
   * SAMPLE BY HANDBOOK
   * ------------------------------------------------
   */

  divider();

  console.log(
    'SAMPLE BY HANDBOOK',
  );

  divider();

  for (
    const category
    of EXPECTED_HANDBOOKS
  ) {
    const categoryComponents =
      components.filter(
        (component) =>
          component.handbookCategory ===
          category,
      );

    console.log(
      `${category} (${categoryComponents.length})`,
    );

    for (
      const component
      of categoryComponents.slice(
        0,
        5,
      )
    ) {
      console.log(
        `  ${component.type} — ${component.name}`,
      );
    }

    console.log('');
  }

  /**
   * ------------------------------------------------
   * FINAL SUMMARY
   * ------------------------------------------------
   */

  divider();

  console.log(
    'GLOBAL COMPONENT DISCOVERY SUMMARY',
  );

  divider();

  console.log(
    `Total component families: ${components.length}`,
  );

  console.log(
    `Handbooks with components: ${
      EXPECTED_HANDBOOKS.length -
      emptyHandbooks.length
    }/${EXPECTED_HANDBOOKS.length}`,
  );

  console.log(
    `Handbooks with zero components: ${emptyHandbooks.length}`,
  );

  console.log(
    `Components with no table: ${missingTables.length}`,
  );

  console.log(
    `OTHER types: ${unknownTypes.length}`,
  );

  console.log(
    `Business subject areas still OTHER: ${badBusinessTypes.length}`,
  );

  console.log(
    `Duplicate families: ${duplicateFamilies.length}`,
  );

  console.log(
    `Duplicate names within handbook: ${duplicateNames.length}`,
  );

  console.log(
    `Invalid names: ${invalidNames.length}`,
  );

  console.log(
    `Page variants incorrectly separate: ${pageVariantComponents.length}`,
  );

  console.log(
    `Science Table A subject areas: ${scienceSubjectAreas.length}`,
  );

  console.log(
    `Engineering specialisations: ${engineeringSpecialisations.length}`,
  );

  console.log(
    `Engineering specialisation classification failures: ${badEngineeringSpecialisationTypes.length}`,
  );

  console.log(
    `Engineering suspicious specialisation names: ${suspiciousSpecialisationNames.length}`,
  );

  /**
   * ------------------------------------------------
   * HARD FAILURE
   * ------------------------------------------------
   */

  const hardFailure =
    components.length ===
      0 ||
    duplicateFamilies.length >
      0 ||
    invalidNames.length >
      0 ||
    pageVariantComponents.length >
      0 ||
    !scienceCoveragePass ||
    badBusinessTypes.length >
      0 ||
    badEngineeringSpecialisationTypes.length >
      0 ||
    suspiciousSpecialisationNames.length >
      0;

  console.log('');

  console.log(
    `RESULT: ${
      hardFailure
        ? 'FAIL'
        : 'PASS'
    }`,
  );

  /**
   * Zero-component handbooks are still REVIEW.
   *
   * Architecture, Medicine/Health and Law may express
   * requirements primarily through course-specific
   * tables instead of reusable major/minor catalogues.
   *
   * We should inspect them rather than fabricate
   * components.
   */
  if (
    !hardFailure &&
    (
      emptyHandbooks.length >
        0 ||
      missingTables.length >
        0 ||
      unknownTypes.length >
        0 ||
      duplicateNames.length >
        0
    )
  ) {
    console.log(
      'COVERAGE STATUS: REVIEW',
    );

    console.log(
      'Structural discovery passed. Review remaining zero-component handbooks, missing tables, OTHER types and genuine same-name component cases.',
    );
  } else if (
    !hardFailure
  ) {
    console.log(
      'COVERAGE STATUS: CLEAN',
    );
  }

  if (
    hardFailure
  ) {
    process.exitCode =
      1;
  }
}

main().catch(
  (error) => {
    console.error(
      error,
    );

    process.exitCode =
      1;
  },
);