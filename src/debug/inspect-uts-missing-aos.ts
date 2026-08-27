import {
  collectUtsMaster,
} from '../adapters/uts/uts.master.collector.js';

import type {
  ParsedRequirementGroup,
} from '../adapters/uts/uts.structure.parser.js';

const MISSING_CODES =
  new Set([
    'SMJ08195',
    'SMJ10198',
    'SMJ10199',
    'SMJ10200',
    'SMJ10201',
    'SMJ10202',
    'STM91949',
    'CBK92373',
    'STM90794',
    'SMJ10085',
    'CBK90795',
    'SMJ10197',
    'STM91953',
    'MAJ08980',
    'MAJ01170',
    'MAJ01191',
    'MAJ01190',
    'MAJ01080',
  ]);

interface FoundReference {
  degreeCode: string;
  degreeName: string;

  code: string;
  name?: string;

  type: string;

  url?: string;

  creditPoints?: number;

  groupPath: string;
}

async function main() {
  const master =
    await collectUtsMaster(
      '2026',
    );

  const found:
    FoundReference[] = [];

  for (const course of master.courses) {
    if (!course.structure) {
      continue;
    }

    for (
      const group
      of course.structure.groups
    ) {
      inspectGroup(
        course.code,
        course.name,
        group,
        [],
        found,
      );
    }
  }

  const grouped =
    new Map<
      string,
      FoundReference[]
    >();

  for (const reference of found) {
    const existing =
      grouped.get(
        reference.code,
      );

    if (existing) {
      existing.push(
        reference,
      );
    } else {
      grouped.set(
        reference.code,
        [reference],
      );
    }
  }

  console.log(
    '\n=============================',
  );

  console.log(
    'MISSING AOS SOURCE DETAILS',
  );

  console.log(
    '=============================\n',
  );

  for (
    const code
    of [...MISSING_CODES]
      .sort()
  ) {
    const references =
      grouped.get(code) ?? [];

    console.log(
      `\n${code}`,
    );

    console.log(
      '-----------------------------',
    );

    if (
      references.length === 0
    ) {
      console.log(
        'No structure reference found.',
      );

      continue;
    }

    for (
      const reference
      of references
    ) {
      console.log(
        `Course: ${reference.degreeCode} - ${reference.degreeName}`,
      );

      console.log(
        `Name: ${reference.name ?? '-'}`,
      );

      console.log(
        `Type: ${reference.type}`,
      );

      console.log(
        `URL: ${reference.url ?? '-'}`,
      );

      console.log(
        `Credit points: ${reference.creditPoints ?? '-'}`,
      );

      console.log(
        `Path: ${reference.groupPath}`,
      );

      console.log('');
    }
  }
}

function inspectGroup(
  degreeCode: string,
  degreeName: string,
  group: ParsedRequirementGroup,
  parentPath: string[],
  found: FoundReference[],
) {
  const path = [
    ...parentPath,
    group.title,
  ];

  for (const item of group.items) {
    if (
      !item.code ||
      !MISSING_CODES.has(
        item.code,
      )
    ) {
      continue;
    }

    found.push({
      degreeCode,

      degreeName,

      code:
        item.code,

      name:
        item.name,

      type:
        item.type,

      url:
        item.url,

      creditPoints:
        item.creditPoints,

      groupPath:
        path.join(
          ' > ',
        ),
    });
  }

  for (
    const child
    of group.children
  ) {
    inspectGroup(
      degreeCode,
      degreeName,
      child,
      path,
      found,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});