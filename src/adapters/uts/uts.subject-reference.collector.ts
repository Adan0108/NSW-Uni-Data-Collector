import {
  type CollectedUtsCourse,
} from './uts.course.collector.js';

import {
  type CollectedUtsAos,
} from './uts.aos.collector.js';

import type {
  ParsedRequirementGroup,
  ParsedStructureSubject,
} from './uts.structure.parser.js';

export interface UtsSubjectReference {
  code: string;
  name: string;
  creditPoints?: number;
  url?: string;

  sourceType:
    | 'COURSE'
    | 'AOS';

  sourceCode: string;
  sourceName: string;

  groupPath: string;
}

export function collectSubjectReferences(
  courses: CollectedUtsCourse[],
  aos: CollectedUtsAos[],
): UtsSubjectReference[] {
  const references:
    UtsSubjectReference[] = [];

  for (const course of courses) {
    if (!course.structure) {
      continue;
    }

    for (
      const group
      of course.structure.groups
    ) {
      collectFromGroup(
        group,
        [],
        {
          type: 'COURSE',
          code:
            course.code,
          name:
            course.name,
        },
        references,
      );
    }
  }

  for (const item of aos) {
    if (!item.structure) {
      continue;
    }

    for (
      const group
      of item.structure.groups
    ) {
      collectFromGroup(
        group,
        [],
        {
          type: 'AOS',
          code:
            item.code,
          name:
            item.name,
        },
        references,
      );
    }
  }

  return references;
}

export function getUniqueSubjectReferences(
  references: UtsSubjectReference[],
): UtsSubjectReference[] {
  const map =
    new Map<
      string,
      UtsSubjectReference
    >();

  for (const reference of references) {
    if (
      !map.has(
        reference.code,
      )
    ) {
      map.set(
        reference.code,
        reference,
      );
    }
  }

  return [
    ...map.values(),
  ];
}

interface SourceContext {
  type:
    | 'COURSE'
    | 'AOS';

  code: string;
  name: string;
}

function collectFromGroup(
  group: ParsedRequirementGroup,
  parentPath: string[],
  source: SourceContext,
  output: UtsSubjectReference[],
) {
  const path = [
    ...parentPath,
    group.title,
  ];

  for (
    const subject
    of group.subjects
  ) {
    output.push(
      mapSubject(
        subject,
        source,
        path,
      ),
    );
  }

  for (
    const child
    of group.children
  ) {
    collectFromGroup(
      child,
      path,
      source,
      output,
    );
  }
}

function mapSubject(
  subject: ParsedStructureSubject,
  source: SourceContext,
  path: string[],
): UtsSubjectReference {
  return {
    code:
      subject.code,

    name:
      subject.name,

    creditPoints:
      subject.creditPoints,

    url:
      subject.url,

    sourceType:
      source.type,

    sourceCode:
      source.code,

    sourceName:
      source.name,

    groupPath:
      path.join(
        ' > ',
      ),
  };
}