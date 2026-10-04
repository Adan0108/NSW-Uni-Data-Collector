// Verified against the 2026 handbook tables and course resolutions, section 9(4).
// These are formal components, independent of recommended CUSP schedules.
export const ENGINEERING_HANDBOOK = 'https://www.sydney.edu.au/handbooks/engineering/engineering-honours/';
export const SPECIALISATION_RESOLUTIONS = `${ENGINEERING_HANDBOOK}course-resolutions.html`;
export const BREADTH_SPECIALISATIONS = [
  {
    title: 'Engineering Data Science', slug: 'data-science', excluded: ['software'],
    groups: [
      { cp: 18, codes: ['DATA2001', 'DATA2901', 'DATA2002', 'DATA2902', 'STAT2011', 'STAT2911'] },
      { cp: 6, codes: ['COMP3308', 'COMP3608', 'DATA3404', 'DATA3406'] },
    ],
  },
  {
    title: 'Humanitarian Engineering', slug: 'humanitarian-engineering',
    excluded: ['civil', 'electrical', 'chemical-biomolecular'],
    groups: [
      { cp: 12, codes: ['CIVL3310', 'CIVL5320'] },
      { cp: 12, codes: ['CIVL5330', 'ENGG3801', 'PMGT3857'] },
    ],
  },
  {
    title: 'Innovation and Entrepreneurship', slug: 'innovation-entrepreneurship',
    excluded: ['chemical-biomolecular'],
    groups: [
      { cp: 18, codes: ['SIEN1000', 'SIEN1001', 'SIEN2001'] },
      { cp: 6, codes: ['ENGG3216', 'SIEN3001', 'PMGT3856', 'INFS2030', 'SIEN2210', 'MKTG3114', 'MKTG3120', 'CLAW2209', 'SIEN3204', 'DECO2016', 'DECO2015'] },
    ],
  },
  {
    title: 'Computer Systems', slug: 'computer-systems',
    excluded: ['electrical', 'software', 'chemical-biomolecular'],
    groups: [
      { cp: 18, codes: ['ELEC1601', 'ELEC2602', 'ELEC3607'] },
      { cp: 6, codes: ['ELEC3608', 'ELEC3305'] },
    ],
  },
];

export const INDUSTRIAL_DESIGN_GROUPS = [
  { cp: 6, codes: ['AMME4401'] },
  { cp: 6, codes: ['MECH4460', 'AMME5902', 'MECH5310'] },
  { cp: 6, codes: ['DECO2016'] },
];

export const breadthName = (title: string): string => `${title} (Breadth)`;
export const breadthUrl = (slug: string): string =>
  `${ENGINEERING_HANDBOOK}breadth-specialisations/${slug}-unit-of-study-table.html`;
