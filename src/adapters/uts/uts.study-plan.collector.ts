import type {
  CollectedUtsCourse,
} from './uts.course.collector.js';

import {
  parseUtsStudyPlans,
  type ParsedUtsStudyPlan,
} from './uts.study-plan.parser.js';

export interface CollectedUtsStudyPlan
  extends ParsedUtsStudyPlan {
  sourceCourseCode: string;
  sourceCourseName: string;
  handbookYear?: string;
}

export function collectUtsStudyPlans(
  courses: CollectedUtsCourse[],
): CollectedUtsStudyPlan[] {
  const plans:
    CollectedUtsStudyPlan[] = [];

  for (const course of courses) {
    const parsed =
      parseUtsStudyPlans(
        course.studyPlans,
      );

    for (const plan of parsed) {
      plans.push({
        ...plan,

        sourceCourseCode:
          course.code,

        sourceCourseName:
          course.name,

        handbookYear:
          course.year,
      });
    }
  }

  return plans;
}