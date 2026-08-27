/**
 * ------------------------------------------------
 * USYD REQUISITE PARSER V6.3
 * ------------------------------------------------
 *
 * V6.3 is a NARROW post-freeze semantic correction pass.
 *
 * Adds:
 *
 * 1. MARK over credit-point requirements
 *
 *    A mark of 65 or greater in
 *    12 credit points of MATH2XXX
 *
 * 2. MARK over grouped CP selections
 *
 *    A mark of 65 or above in
 *    12 credit points from (MATH2XXX or STAT2XXX)
 *
 * 3. AVERAGE MARK over CP selections
 *
 *    An average mark of 65 or above in
 *    12 credit points from (...)
 *
 * 4. EXCEPT semantics
 *
 *    6 credit points of MATH1XXX
 *    except (MATH1XX5 or MATH1050 ...)
 *
 * 5. Mark propagation over alternatives
 *
 *    a mark of 65 or more in MATH1061 or MATH1064
 *
 * 6. Final punctuation cleanup.
 *
 * V6.3 fixes only two meaning-changing cases proven by the freeze audit:
 *
 * 7. Protect the subject name `Theatre and Performance Studies` so the
 *    tokenizer does not split the subject name at `and`.
 *
 * 8. Parse the PHYS4036 nested credit-point inclusions without flattening
 *    or dropping either required 6cp selection.
 *
 * NO broader grammar is added in this version.
 */

export type UsydRequisiteLogicalOperator =
  | 'AND'
  | 'OR';

export type UsydRequisiteGrade =
  | 'DISTINCTION'
  | 'CREDIT';

export type UsydRequisiteAtomType =
  | 'UNIT'
  | 'UNIT_PATTERN'
  | 'CREDIT_POINTS'
  | 'CREDIT_POINT_SELECTION'
  | 'SUBJECT_SCOPE'
  | 'LEVEL'
  | 'MARK'
  | 'GRADE'
  | 'WAM'
  | 'PASSED_UNIT'
  | 'PERMISSION'
  | 'ELIGIBILITY'
  | 'EQUIVALENT_STUDY'
  | 'EXTERNAL_ENTRY'
  | 'PRIOR_EXPERIENCE'
  | 'KNOWLEDGE'
  | 'TABLE_REFERENCE'
  | 'TEXT';

export interface UsydRequisiteUnitAtom {
  type: 'UNIT';

  code: string;

  rawText: string;
}

export interface UsydRequisiteUnitPatternAtom {
  type: 'UNIT_PATTERN';

  pattern: string;

  rawText: string;
}

export interface UsydRequisiteCreditPointAtom {
  type: 'CREDIT_POINTS';

  creditPoints: number;

  minimum: boolean;

  levels: number[];

  scope: string | null;

  rawText: string;
}

export interface UsydRequisiteCreditPointSelectionAtom {
  type: 'CREDIT_POINT_SELECTION';

  creditPoints: number;

  minimum: boolean;

  relation:
  | 'FROM'
  | 'INCLUDING'
  | 'OF';

  selection:
  UsydRequisiteNode | null;

  rawText: string;
}

export interface UsydRequisiteSubjectScopeAtom {
  type: 'SUBJECT_SCOPE';

  name: string;

  rawText: string;
}

export interface UsydRequisiteLevelAtom {
  type: 'LEVEL';

  levels: number[];

  scope: string | null;

  rawText: string;
}

export interface UsydRequisiteMarkAtom {
  type: 'MARK';

  minimumMark: number;

  scope:
  UsydRequisiteNode | null;

  rawText: string;
}

export interface UsydRequisiteGradeAtom {
  type: 'GRADE';

  grade:
  UsydRequisiteGrade;

  scope:
  UsydRequisiteNode | null;

  rawText: string;
}

export interface UsydRequisiteWamAtom {
  type: 'WAM';

  minimumWam: number;

  rawText: string;
}

export interface UsydRequisitePassedUnitAtom {
  type: 'PASSED_UNIT';

  code:
  string | null;

  pattern:
  string | null;

  rawText: string;
}

export interface UsydRequisitePermissionAtom {
  type: 'PERMISSION';

  rawText: string;
}

export interface UsydRequisiteEligibilityAtom {
  type: 'ELIGIBILITY';

  rawText: string;
}

export interface UsydRequisiteEquivalentStudyAtom {
  type: 'EQUIVALENT_STUDY';

  rawText: string;
}

export interface UsydRequisiteExternalEntryAtom {
  type: 'EXTERNAL_ENTRY';

  rawText: string;
}

export interface UsydRequisitePriorExperienceAtom {
  type: 'PRIOR_EXPERIENCE';

  rawText: string;
}

export interface UsydRequisiteKnowledgeAtom {
  type: 'KNOWLEDGE';

  rawText: string;
}

export interface UsydRequisiteTableReferenceAtom {
  type: 'TABLE_REFERENCE';

  tableName: string;

  rawText: string;
}

export interface UsydRequisiteTextAtom {
  type: 'TEXT';

  rawText: string;
}

export type UsydRequisiteAtom =
  | UsydRequisiteUnitAtom
  | UsydRequisiteUnitPatternAtom
  | UsydRequisiteCreditPointAtom
  | UsydRequisiteCreditPointSelectionAtom
  | UsydRequisiteSubjectScopeAtom
  | UsydRequisiteLevelAtom
  | UsydRequisiteMarkAtom
  | UsydRequisiteGradeAtom
  | UsydRequisiteWamAtom
  | UsydRequisitePassedUnitAtom
  | UsydRequisitePermissionAtom
  | UsydRequisiteEligibilityAtom
  | UsydRequisiteEquivalentStudyAtom
  | UsydRequisiteExternalEntryAtom
  | UsydRequisitePriorExperienceAtom
  | UsydRequisiteKnowledgeAtom
  | UsydRequisiteTableReferenceAtom
  | UsydRequisiteTextAtom;

export interface UsydRequisiteLogicalNode {
  type: 'LOGIC';

  operator:
  UsydRequisiteLogicalOperator;

  children:
  UsydRequisiteNode[];

  rawText: string;
}

/**
 * V6.2:
 *
 * Explicit exclusion semantics.
 *
 * Example:
 *
 * 6 credit points of MATH1XXX
 * except (MATH1XX5 or MATH1050 or MATH1111)
 */
export interface UsydRequisiteExceptNode {
  type: 'EXCEPT';

  base:
  UsydRequisiteNode;

  exclusions:
  UsydRequisiteNode;

  rawText: string;
}

export type UsydRequisiteNode =
  | UsydRequisiteAtom
  | UsydRequisiteLogicalNode
  | UsydRequisiteExceptNode;

export interface UsydParsedRequisite {
  rawText: string;

  normalizedText: string;

  root:
  UsydRequisiteNode | null;

  unitCodes: string[];

  unitPatterns: string[];

  containsUnparsedText:
  boolean;
}

/**
 * ------------------------------------------------
 * TOKENS
 * ------------------------------------------------
 */

type TokenType =
  | 'LPAREN'
  | 'RPAREN'
  | 'AND'
  | 'OR'
  | 'TEXT';

interface Token {
  type: TokenType;

  value: string;
}

/**
 * ------------------------------------------------
 * PROTECTED PHRASES
 * ------------------------------------------------
 */

const SENTINEL_OR_ABOVE =
  '__USYD_OR_ABOVE__';

const SENTINEL_OR_HIGHER =
  '__USYD_OR_HIGHER__';

const SENTINEL_OR_GREATER =
  '__USYD_OR_GREATER__';

const SENTINEL_OR_MORE =
  '__USYD_OR_MORE__';

const SENTINEL_OR_EQUIVALENT =
  '__USYD_OR_EQUIVALENT__';

const SENTINEL_LEVEL_OR =
  '__USYD_LEVEL_OR__';

const SUBJECT_SENTINEL_PREFIX =
  '__USYD_SUBJECT_';

const SUBJECT_SENTINEL_SUFFIX =
  '__';

const PROTECTED_SUBJECT_NAMES =
  [
    'Arabic Language and Cultures',
    'Arabic Languages and Cultures',
    'Arabic and Islamic Studies',
    'French and Francophone Studies',
    'Gender and Cultural Studies',
    'Government and International Relations',
    'International and Comparative Literary Studies',
    'International Comparative Literature and Translation Studies',
    'International and Global Studies',
    'Jewish Civilisation, Thought and Culture',
    'Jewish Civilisation Thought and Culture',
    'Biblical Studies and Classical Hebrew',
    'Spanish and Latin American Studies',
    'Media and Communication',
    'History and Philosophy of Science',
    'Theatre and Performance Studies',
    'Politics and International Relations',
    'Environmental, Agricultural and Resource Economics',
    'Animal and Veterinary Bioscience',
  ] as const;

const SUBJECT_SENTINELS =
  PROTECTED_SUBJECT_NAMES.map(
    (
      subject,
      index,
    ) => ({
      subject,

      sentinel:
        `${SUBJECT_SENTINEL_PREFIX}${index}${SUBJECT_SENTINEL_SUFFIX}`,
    }),
  );

function protectMultiLevelExpressions(
  value: string,
): string {
  return value.replace(
    /\b([1-9]000)\s+or\s+([1-9]000)(?:\s+or\s+([1-9]000))?(?=\s*-?\s*level)/gi,
    (
      full,
      first: string,
      second: string,
      third?: string,
    ) => {
      if (
        third
      ) {
        return (
          `${first} ${SENTINEL_LEVEL_OR} ` +
          `${second} ${SENTINEL_LEVEL_OR} ${third}`
        );
      }

      return (
        `${first} ${SENTINEL_LEVEL_OR} ${second}`
      );
    },
  );
}

function protectPhrases(
  value: string,
): string {
  let result =
    protectMultiLevelExpressions(
      value,
    );

  result =
    result
      .replace(
        /\bor\s+above\b/gi,
        SENTINEL_OR_ABOVE,
      )
      .replace(
        /\bor\s+higher\b/gi,
        SENTINEL_OR_HIGHER,
      )
      .replace(
        /\bor\s+greater\b/gi,
        SENTINEL_OR_GREATER,
      )
      .replace(
        /\bor\s+more\b/gi,
        SENTINEL_OR_MORE,
      )
      .replace(
        /\bor\s+equivalent\b/gi,
        SENTINEL_OR_EQUIVALENT,
      );

  for (
    const {
      subject,
      sentinel,
    }
    of SUBJECT_SENTINELS
  ) {
    result =
      result.replaceAll(
        subject,
        sentinel,
      );
  }

  return result;
}

function restorePhrases(
  value: string,
): string {
  let result =
    value
      .replaceAll(
        SENTINEL_OR_ABOVE,
        'or above',
      )
      .replaceAll(
        SENTINEL_OR_HIGHER,
        'or higher',
      )
      .replaceAll(
        SENTINEL_OR_GREATER,
        'or greater',
      )
      .replaceAll(
        SENTINEL_OR_MORE,
        'or more',
      )
      .replaceAll(
        SENTINEL_OR_EQUIVALENT,
        'or equivalent',
      )
      .replaceAll(
        SENTINEL_LEVEL_OR,
        'or',
      );

  for (
    const {
      subject,
      sentinel,
    }
    of SUBJECT_SENTINELS
  ) {
    result =
      result.replaceAll(
        sentinel,
        subject,
      );
  }

  return result;
}

/**
 * ------------------------------------------------
 * NORMALISATION
 * ------------------------------------------------
 */

export function normalizeUsydRequisiteText(
  value: string,
): string {
  return value
    .replace(
      /\u00a0/g,
      ' ',
    )

    /**
     * Language-entry parenthetical marks.
     */
    .replace(
      /\(\s*with\s+a\s+mark\s+(above|below)\s+(\d+(?:\.\d+)?)\s*\)/gi,
      'with a mark $1 $2',
    )

    /**
     * Known handbook typo.
     *
     * A mark or 75 or above in
     * ->
     * A mark of 75 or above in
     */
    .replace(
      /\bA\s+mark\s+or\s+(\d+(?:\.\d+)?)\s+or\s+above\s+in\b/gi,
      'A mark of $1 or above in',
    )

    /**
     * Alternate CP ordering.
     *
     * Use function replacement rather than "$2000",
     * avoiding ambiguous replacement-group syntax.
     */
    .replace(
      /\b(\d+(?:\.\d+)?)\s+at\s+((?:[1-9]000\s+or\s+)+[1-9]000)\s*-?\s*level\s+credit\s+points?\s+(from|in|of)\b/gi,
      (
        full,
        amount: string,
        levels: string,
        relation: string,
      ) =>
        `${amount} credit points at ${levels} level ${relation}`,
    )

    /**
     * 12 1000-level credit points from X
     */
    .replace(
      /\b(\d+(?:\.\d+)?)\s+([1-9])000-?level\s+credit\s+points?\s+(from|in|of)\b/gi,
      (
        full,
        amount: string,
        level: string,
        relation: string,
      ) =>
        `${amount} credit points at ${level}000 level ${relation}`,
    )

    .replace(
      /\[/g,
      '(',
    )
    .replace(
      /\]/g,
      ')',
    )
    .replace(
      /\{/g,
      '(',
    )
    .replace(
      /\}/g,
      ')',
    )
    .replace(
      /\b(or|and)(?=[A-Z]{4}[0-9X]{3,4}\b)/gi,
      '$1 ',
    )
    .replace(
      /\s*&\s*/g,
      ' and ',
    )
    .replace(
      /creditpoints/gi,
      'credit points',
    )
    .replace(
      /\bcredits points\b/gi,
      'credit points',
    )
    .replace(
      /\bmarkof\b/gi,
      'mark of',
    )

    /**
     * Final punctuation is presentation, not grammar.
     */
    .replace(
      /\s*\.\s*$/,
      '',
    )

    /**
     * Handbook list punctuation:
     * MGRK2603, -> MGRK2603
     */
    .replace(
      /^([A-Z]{4}[0-9X]{3,4}),$/,
      '$1',
    )

    .replace(
      /\s+/g,
      ' ',
    )
    .trim();
}

function normalizeNullable(
  value:
    string | undefined,
): string | null {
  if (
    !value
  ) {
    return null;
  }

  const normalized =
    normalizeUsydRequisiteText(
      value,
    );

  return normalized ||
    null;
}

/**
 * ------------------------------------------------
 * UNIT REFERENCES
 * ------------------------------------------------
 */

function isExactUnitCode(
  value: string,
): boolean {
  return /^[A-Z]{4}\d{4}$/i.test(
    value.trim(),
  );
}

function isUnitPattern(
  value: string,
): boolean {
  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    !/^[A-Z]{4}[0-9X]{3,4}$/.test(
      normalized,
    )
  ) {
    return false;
  }

  return normalized
    .slice(
      4,
    )
    .includes(
      'X',
    );
}

function createUnitReference(
  value: string,
): UsydRequisiteNode | null {
  const normalized =
    value
      .trim()
      .toUpperCase();

  if (
    isExactUnitCode(
      normalized,
    )
  ) {
    return {
      type:
        'UNIT',

      code:
        normalized,

      rawText:
        normalized,
    };
  }

  if (
    isUnitPattern(
      normalized,
    )
  ) {
    return {
      type:
        'UNIT_PATTERN',

      pattern:
        normalized,

      rawText:
        normalized,
    };
  }

  return null;
}

/**
 * ------------------------------------------------
 * LOGIC HELPERS
 * ------------------------------------------------
 */

function makeLogic(
  operator:
    UsydRequisiteLogicalOperator,
  children:
    UsydRequisiteNode[],
  rawText:
    string,
): UsydRequisiteNode {
  if (
    children.length ===
    1
  ) {
    return children[0];
  }

  return {
    type:
      'LOGIC',

    operator,

    children,

    rawText,
  };
}

function stripBalancedOuterParentheses(
  rawValue: string,
): string {
  let value =
    rawValue.trim();

  while (
    value.startsWith(
      '(',
    ) &&
    value.endsWith(
      ')',
    )
  ) {
    let depth =
      0;

    let wrapsWholeExpression =
      true;

    for (
      let index =
        0;
      index <
      value.length;
      index +=
      1
    ) {
      if (
        value[index] ===
        '('
      ) {
        depth +=
          1;
      }

      if (
        value[index] ===
        ')'
      ) {
        depth -=
          1;
      }

      if (
        depth ===
        0 &&
        index <
        value.length -
        1
      ) {
        wrapsWholeExpression =
          false;

        break;
      }

      if (
        depth <
        0
      ) {
        wrapsWholeExpression =
          false;

        break;
      }
    }

    if (
      !wrapsWholeExpression ||
      depth !==
      0
    ) {
      break;
    }

    value =
      value
        .slice(
          1,
          -1,
        )
        .trim();
  }

  return value;
}

function splitTopLevel(
  rawValue: string,
  separator:
    'and'
    | 'or',
): string[] {
  const value =
    rawValue.trim();

  const lower =
    value.toLowerCase();

  const result:
    string[] =
    [];

  let depth =
    0;

  let start =
    0;

  let index =
    0;

  const target =
    ` ${separator} `;

  while (
    index <
    value.length
  ) {
    const character =
      value[index];

    if (
      character ===
      '('
    ) {
      depth +=
        1;

      index +=
        1;

      continue;
    }

    if (
      character ===
      ')'
    ) {
      depth =
        Math.max(
          0,
          depth -
          1,
        );

      index +=
        1;

      continue;
    }

    if (
      depth ===
      0 &&
      lower.startsWith(
        target,
        index,
      )
    ) {
      result.push(
        value
          .slice(
            start,
            index,
          )
          .trim(),
      );

      index +=
        target.length;

      start =
        index;

      continue;
    }

    index +=
      1;
  }

  result.push(
    value
      .slice(
        start,
      )
      .trim(),
  );

  return result.filter(
    Boolean,
  );
}

/**
 * ------------------------------------------------
 * SUBJECT SCOPE
 * ------------------------------------------------
 */

function isLikelySubjectScope(
  value: string,
): boolean {
  const text =
    value.trim();

  if (
    !text
  ) {
    return false;
  }

  if (
    /\d/.test(
      text,
    )
  ) {
    return false;
  }

  if (
    /^(?:minimum|maximum|at least|either|students?|completion|must)\b/i.test(
      text,
    )
  ) {
    return false;
  }

  if (
    /\b(?:mark|average|credit points?|WAM|permission|eligible|passed|HSC|IB)\b/i.test(
      text,
    )
  ) {
    return false;
  }

  if (
    /^[A-Z]{3,5}$/.test(
      text,
    )
  ) {
    return true;
  }

  return /^[A-Za-z][A-Za-z\s,&/'-]*$/.test(
    text,
  );
}

/**
 * ------------------------------------------------
 * REFERENCE GROUP
 * ------------------------------------------------
 */

function parseSimpleReferenceGroup(
  rawValue: string,
): UsydRequisiteNode | null {
  const value =
    stripBalancedOuterParentheses(
      rawValue,
    );

  const orParts =
    splitTopLevel(
      value,
      'or',
    );

  if (
    orParts.length >
    1
  ) {
    return makeLogic(
      'OR',

      orParts.map(
        (
          part,
        ) =>
          parseSimpleReferenceGroup(
            part,
          ) ??
          parseAtom(
            part,
          ),
      ),

      value,
    );
  }

  const andParts =
    splitTopLevel(
      value,
      'and',
    );

  if (
    andParts.length >
    1
  ) {
    return makeLogic(
      'AND',

      andParts.map(
        (
          part,
        ) =>
          parseSimpleReferenceGroup(
            part,
          ) ??
          parseAtom(
            part,
          ),
      ),

      value,
    );
  }

  const reference =
    createUnitReference(
      value,
    );

  if (
    reference
  ) {
    return reference;
  }

  if (
    isLikelySubjectScope(
      value,
    )
  ) {
    return {
      type:
        'SUBJECT_SCOPE',

      name:
        value,

      rawText:
        value,
    };
  }

  return null;
}

/**
 * ------------------------------------------------
 * LEVEL EXTRACTION
 * ------------------------------------------------
 */

function extractLevels(
  value: string,
): number[] {
  const levels:
    number[] =
    [];

  const normalized =
    restorePhrases(
      value,
    );

  for (
    const match
    of normalized.matchAll(
      /\b([1-9])000(?:-|\s*)level\b/gi,
    )
  ) {
    levels.push(
      Number(
        match[1],
      ),
    );
  }

  const grouped =
    normalized.match(
      /\b((?:[1-9]000\s*(?:,|or|\/)\s*)+)([1-9]000)\s*-?\s*level\b/i,
    );

  if (
    grouped
  ) {
    const combined =
      `${grouped[1]} ${grouped[2]}`;

    for (
      const match
      of combined.matchAll(
        /\b([1-9])000\b/g,
      )
    ) {
      levels.push(
        Number(
          match[1],
        ),
      );
    }
  }

  return [
    ...new Set(
      levels,
    ),
  ].sort();
}

/**
 * ------------------------------------------------
 * CREDIT POINT SELECTION HELPERS
 * ------------------------------------------------
 */

function createCreditPointSelection(
  creditPoints: number,
  relation:
    'FROM'
    | 'INCLUDING'
    | 'OF',
  selection:
    UsydRequisiteNode | null,
  rawText:
    string,
  minimum =
    false,
): UsydRequisiteCreditPointSelectionAtom {
  return {
    type:
      'CREDIT_POINT_SELECTION',

    creditPoints,

    minimum,

    relation,

    selection,

    rawText,
  };
}

/**
 * ------------------------------------------------
 * V6.2 MARK OVER CP
 * ------------------------------------------------
 */

function parseDirectMarkOverCreditPoints(
  rawValue: string,
): UsydRequisiteMarkAtom | null {
  const text =
    stripBalancedOuterParentheses(
      normalizeUsydRequisiteText(
        rawValue,
      ),
    );

  /**
   * Examples:
   *
   * A mark of 65 or greater in
   * 12 credit points of MATH2XXX units of study
   *
   * A mark of 65 or above in
   * 12 credit points of MATH2XXX
   *
   * An average mark of 75 or above in
   * 12 credit points of BIOL2XXX
   */
  const match =
    text.match(
      /^(?:an?\s+)?(?:average\s+)?mark\s+of\s+(\d+(?:\.\d+)?)%?\s+(?:or\s+(?:above|greater|higher|more))\s+in\s+(\d+(?:\.\d+)?)\s*(?:cp|credit\s+points?)\s+(of|from)\s+([A-Z]{4}[0-9X]{3,4})(?:\s+units?\s+of\s+study)?$/i,
    );

  if (
    !match
  ) {
    return null;
  }

  const selection =
    createUnitReference(
      match[4],
    );

  if (
    !selection
  ) {
    return null;
  }

  return {
    type:
      'MARK',

    minimumMark:
      Number(
        match[1],
      ),

    scope:
      createCreditPointSelection(
        Number(
          match[2],
        ),

        match[3]
          .toLowerCase() ===
          'from'
          ? 'FROM'
          : 'OF',

        selection,

        `${match[2]} credit points ${match[3]} ${match[4]}`,
      ),

    rawText:
      text,
  };
}

/**
 * ------------------------------------------------
 * V6.1 MINIMUM MARK RULE
 * ------------------------------------------------
 */

function parseMinimumMarkSegment(
  rawValue: string,
): UsydRequisiteNode | null {
  let value =
    stripBalancedOuterParentheses(
      rawValue,
    );

  value =
    value.replace(
      /^(?:a\s+)?minimum\s+of\s+/i,
      '',
    );

  value =
    stripBalancedOuterParentheses(
      value,
    );

  const orParts =
    splitTopLevel(
      value,
      'or',
    );

  if (
    orParts.length >
    1
  ) {
    const children =
      orParts
        .map(
          (
            part,
          ) =>
            parseMinimumMarkSegment(
              part,
            ),
        )
        .filter(
          (
            child,
          ): child is UsydRequisiteNode =>
            child !==
            null,
        );

    if (
      children.length ===
      orParts.length
    ) {
      return makeLogic(
        'OR',
        children,
        value,
      );
    }
  }

  const directUnit =
    value.match(
      /^(\d+(?:\.\d+)?)%?\s+in\s+([A-Z]{4}[0-9X]{3,4})$/i,
    );

  if (
    directUnit
  ) {
    return {
      type:
        'MARK',

      minimumMark:
        Number(
          directUnit[1],
        ),

      scope:
        createUnitReference(
          directUnit[2],
        ),

      rawText:
        rawValue.trim(),
    };
  }

  const grouped =
    value.match(
      /^(\d+(?:\.\d+)?)%?\s+in\s+\((.+)\)$/i,
    );

  if (
    grouped
  ) {
    const scope =
      parseSimpleReferenceGroup(
        grouped[2],
      );

    if (
      scope
    ) {
      return {
        type:
          'MARK',

        minimumMark:
          Number(
            grouped[1],
          ),

        scope,

        rawText:
          rawValue.trim(),
      };
    }
  }

  return null;
}

function parseV61MinimumRule(
  rawValue: string,
): UsydRequisiteNode | null {
  const value =
    stripBalancedOuterParentheses(
      rawValue,
    );

  if (
    !/\bminimum\s+of\b/i.test(
      value,
    )
  ) {
    return null;
  }

  const lower =
    value.toLowerCase();

  const marker =
    ' and minimum of ';

  const parts:
    string[] =
    [];

  let depth =
    0;

  let start =
    0;

  let index =
    0;

  while (
    index <
    value.length
  ) {
    const character =
      value[index];

    if (
      character ===
      '('
    ) {
      depth +=
        1;
    }

    if (
      character ===
      ')'
    ) {
      depth =
        Math.max(
          0,
          depth -
          1,
        );
    }

    if (
      depth ===
      0 &&
      lower.startsWith(
        marker,
        index,
      )
    ) {
      parts.push(
        value
          .slice(
            start,
            index,
          )
          .trim(),
      );

      index +=
        marker.length;

      start =
        index;

      continue;
    }

    index +=
      1;
  }

  parts.push(
    value
      .slice(
        start,
      )
      .trim(),
  );

  if (
    parts.length ===
    1
  ) {
    return parseMinimumMarkSegment(
      parts[0],
    );
  }

  const children =
    parts.map(
      (
        part,
        partIndex,
      ) =>
        parseMinimumMarkSegment(
          partIndex ===
            0
            ? part
            : `minimum of ${part}`,
        ),
    );

  if (
    children.some(
      (
        child,
      ) =>
        child ===
        null,
    )
  ) {
    return null;
  }

  return makeLogic(
    'AND',
    children as
    UsydRequisiteNode[],
    value,
  );
}

/**
 * ------------------------------------------------
 * TOKENIZER
 * ------------------------------------------------
 */

function tokenize(
  rawValue: string,
): Token[] {
  const normalized =
    protectPhrases(
      normalizeUsydRequisiteText(
        rawValue,
      ),
    );

  const tokens:
    Token[] =
    [];

  let buffer =
    '';

  function flush():
    void {
    const text =
      restorePhrases(
        buffer.trim(),
      );

    if (
      text
    ) {
      tokens.push({
        type:
          'TEXT',

        value:
          text,
      });
    }

    buffer =
      '';
  }

  let index =
    0;

  while (
    index <
    normalized.length
  ) {
    const character =
      normalized[
      index
      ];

    if (
      character ===
      '('
    ) {
      flush();

      tokens.push({
        type:
          'LPAREN',

        value:
          '(',
      });

      index +=
        1;

      continue;
    }

    if (
      character ===
      ')'
    ) {
      flush();

      tokens.push({
        type:
          'RPAREN',

        value:
          ')',
      });

      index +=
        1;

      continue;
    }

    const remaining =
      normalized.slice(
        index,
      );

    const conjunction =
      remaining.match(
        /^\s+(and|or)\s+/i,
      );

    if (
      conjunction
    ) {
      flush();

      tokens.push({
        type:
          conjunction[1]
            .toLowerCase() ===
            'and'
            ? 'AND'
            : 'OR',

        value:
          conjunction[1]
            .toLowerCase(),
      });

      index +=
        conjunction[0]
          .length;

      continue;
    }

    buffer +=
      character;

    index +=
      1;
  }

  flush();

  return tokens;
}

/**
 * ------------------------------------------------
 * ATOM PARSER
 * ------------------------------------------------
 */

function parseAtom(
  rawText: string,
): UsydRequisiteAtom {
  const text =
    normalizeUsydRequisiteText(
      rawText,
    );

  const upper =
    text.toUpperCase();

  if (
    isExactUnitCode(
      upper,
    )
  ) {
    return {
      type:
        'UNIT',

      code:
        upper,

      rawText:
        text,
    };
  }

  if (
    isUnitPattern(
      upper,
    )
  ) {
    return {
      type:
        'UNIT_PATTERN',

      pattern:
        upper,

      rawText:
        text,
    };
  }

  const titledUnit =
    text.match(
      /^([A-Z]{4}\d{4})\s+.+$/,
    );

  if (
    titledUnit
  ) {
    return {
      type:
        'UNIT',

      code:
        titledUnit[1]
          .toUpperCase(),

      rawText:
        text,
    };
  }

  const passed =
    text.match(
      /^(?:students?\s+)?(?:must\s+)?(?:have\s+)?passed\s+([A-Z]{4}[0-9X]{3,4})$/i,
    );

  if (
    passed
  ) {
    const reference =
      passed[1]
        .toUpperCase();

    return {
      type:
        'PASSED_UNIT',

      code:
        isExactUnitCode(
          reference,
        )
          ? reference
          : null,

      pattern:
        isUnitPattern(
          reference,
        )
          ? reference
          : null,

      rawText:
        text,
    };
  }

  if (
    /^must\s+be\s+in\s+the\s+.+\s+stream$/i.test(
      text,
    )
  ) {
    return {
      type:
        'ELIGIBILITY',

      rawText:
        text,
    };
  }

  const directCpMark =
    parseDirectMarkOverCreditPoints(
      text,
    );

  if (
    directCpMark
  ) {
    return directCpMark;
  }

  const distinctionUnit =
    text.match(
      /^(?:with\s+)?Distinction(?:-|\s+)?(?:level\s+)?results?\s+in\s+([A-Z]{4}[0-9X]{3,4})$|^Distinction\s+in\s+([A-Z]{4}[0-9X]{3,4})$/i,
    );

  if (
    distinctionUnit
  ) {
    const reference =
      (
        distinctionUnit[1] ??
        distinctionUnit[2]
      ).toUpperCase();

    return {
      type:
        'GRADE',

      grade:
        'DISTINCTION',

      scope:
        createUnitReference(
          reference,
        ),

      rawText:
        text,
    };
  }

  const unitWithMark =
    text.match(
      /^([A-Z]{4}[0-9X]{3,4})\s+with\s+(?:a\s+)?mark\s+of\s+(\d+(?:\.\d+)?)%?(?:\s+Distinction)?(?:\s+or\s+(?:above|higher|greater))?$/i,
    );

  if (
    unitWithMark
  ) {
    return {
      type:
        'MARK',

      minimumMark:
        Number(
          unitWithMark[2],
        ),

      scope:
        createUnitReference(
          unitWithMark[1],
        ),

      rawText:
        text,
    };
  }

  const minimumUnitMark =
    text.match(
      /^(?:a\s+)?minimum\s+of\s+(\d+(?:\.\d+)?)%?\s+in\s+([A-Z]{4}[0-9X]{3,4})$/i,
    );

  if (
    minimumUnitMark
  ) {
    return {
      type:
        'MARK',

      minimumMark:
        Number(
          minimumUnitMark[1],
        ),

      scope:
        createUnitReference(
          minimumUnitMark[2],
        ),

      rawText:
        text,
    };
  }

  const bareMark =
    text.match(
      /^(\d+(?:\.\d+)?)%?(?:\s+or\s+(?:above|higher|greater|more))?\s+(?:in|from)\s+([A-Z]{4}[0-9X]{3,4})$/i,
    );

  if (
    bareMark
  ) {
    return {
      type:
        'MARK',

      minimumMark:
        Number(
          bareMark[1],
        ),

      scope:
        createUnitReference(
          bareMark[2],
        ),

      rawText:
        text,
    };
  }

  const directMark =
    text.match(
      /^(?:an?\s+)?(?:average\s+)?mark(?:\s+of)?\s*(?:at\s+least\s+)?(\d+(?:\.\d+)?)%?(?:\s+or\s+(?:above|higher|greater|more))?\s+(?:in|from)\s+([A-Z]{4}[0-9X]{3,4})$/i,
    );

  if (
    directMark
  ) {
    return {
      type:
        'MARK',

      minimumMark:
        Number(
          directMark[1],
        ),

      scope:
        createUnitReference(
          directMark[2],
        ),

      rawText:
        text,
    };
  }

  /**
   * ------------------------------------------------
   * FINAL: AVERAGE OVER COMPLETED CREDIT POINTS
   * ------------------------------------------------
   *
   * Example:
   *
   * An average of at least 65 in 144 credit points of units
   */
  const averageOverCp =
    text.match(
      /^An?\s+average\s+of\s+at\s+least\s+(\d+(?:\.\d+)?)%?\s+in\s+(\d+(?:\.\d+)?)\s+credit\s+points?\s+of\s+units(?:\s+of\s+study)?$/i,
    );

  if (
    averageOverCp
  ) {
    return {
      type:
        'MARK',

      minimumMark:
        Number(
          averageOverCp[1],
        ),

      scope: {
        type:
          'CREDIT_POINTS',

        creditPoints:
          Number(
            averageOverCp[2],
          ),

        minimum:
          false,

        levels:
          [],

        scope:
          'units',

        rawText:
          `${averageOverCp[2]} credit points of units`,
      },

      rawText:
        text,
    };
  }

  const wam =
    text.match(
      /^(?:an?\s+)?(?:minimum\s+)?(?:overall\s+)?WAM(?:\s+of|\s*>=|\s+greater\s+than)?\s*(\d+(?:\.\d+)?)%?(?:\s+or\s+(?:above|higher|greater))?$/i,
    );

  if (
    wam
  ) {
    return {
      type:
        'WAM',

      minimumWam:
        Number(
          wam[1],
        ),

      rawText:
        text,
    };
  }

  const simpleMark =
    text.match(
      /^(?:an?\s+)?(?:annual\s+)?(?:average\s+)?mark(?:\s+of)?\s*(?:at\s+least\s+)?(\d+(?:\.\d+)?)%?(?:\s+or\s+(?:above|higher|greater))?(?:\s+in\s+(?:the\s+)?previous\s+year)?$/i,
    );

  if (
    simpleMark
  ) {
    return {
      type:
        'MARK',

      minimumMark:
        Number(
          simpleMark[1],
        ),

      scope:
        null,

      rawText:
        text,
    };
  }

  if (
    /\bHSC\b/i.test(
      text,
    ) ||
    /\bInternational Baccalaureate\b/i.test(
      text,
    ) ||
    /\bIB\b/i.test(
      text,
    ) ||
    /\bContinuers\b/i.test(
      text,
    ) ||
    /\bBeginners\b/i.test(
      text,
    ) ||
    /\bExtension\b/i.test(
      text,
    ) ||
    /\bnative speakers?\b/i.test(
      text,
    ) ||
    /\bnear[- ]?native\b/i.test(
      text,
    ) ||
    /\bbackground speakers?\b/i.test(
      text,
    )
  ) {
    return {
      type:
        'EXTERNAL_ENTRY',

      rawText:
        text,
    };
  }

  if (
    /\bor equivalent\b/i.test(
      text,
    ) ||
    /^(?:or\s+)?equivalent$/i.test(
      text,
    ) ||
    (
      /\b(?:tertiary|previous|prior)\b/i.test(
        text,
      ) &&
      /\b(?:study|year|language|qualification|level)\b/i.test(
        text,
      )
    )
  ) {
    return {
      type:
        'EQUIVALENT_STUDY',

      rawText:
        text,
    };
  }

  if (
    /\bprior experience\b/i.test(
      text,
    )
  ) {
    return {
      type:
        'PRIOR_EXPERIENCE',

      rawText:
        text,
    };
  }

  if (
    /\bknowledge of\b/i.test(
      text,
    ) ||
    /\bassumed knowledge\b/i.test(
      text,
    )
  ) {
    return {
      type:
        'KNOWLEDGE',

      rawText:
        text,
    };
  }

  if (
    /\b(?:permission|consent|approval)\b/i.test(
      text,
    )
  ) {
    return {
      type:
        'PERMISSION',

      rawText:
        text,
    };
  }

  if (
    /\b(?:eligible|eligibility|entry to this unit|admission to|enrolment in)\b/i.test(
      text,
    )
  ) {
    return {
      type:
        'ELIGIBILITY',

      rawText:
        text,
    };
  }

  const table =
    text.match(
      /\b((?:(?:Science|Medicine and Health|Health|FMH)\s+)?Table\s+[A-Z])\b/i,
    );

  if (
    table
  ) {
    return {
      type:
        'TABLE_REFERENCE',

      tableName:
        table[1],

      rawText:
        text,
    };
  }
  /**
 * ------------------------------------------------
 * V6.2.1 JUNIOR / SENIOR CREDIT POINTS
 * ------------------------------------------------
 *
 * Examples:
 *
 * 12 Junior credit points of History
 * 12 junior credit points in Ancient History
 * 12 senior credit points from Government and International Relations
 * 6 Senior credit points in Media and Communications
 * 18 junior credit points
 */
  const juniorSeniorCp =
    text.match(
      /^(\d+(?:\.\d+)?)\s+(Junior|Senior)\s+credit\s+points?(?:\s+(?:from|of|in)\s+(.+))?$/i,
    );

  if (
    juniorSeniorCp
  ) {
    const levelName =
      juniorSeniorCp[2]
        .toUpperCase();

    const subject =
      normalizeNullable(
        juniorSeniorCp[3],
      );

    return {
      type:
        'CREDIT_POINTS',

      creditPoints:
        Number(
          juniorSeniorCp[1],
        ),

      minimum:
        false,

      /**
       * USYD "Junior"/"Senior" is preserved as semantic
       * scope text rather than incorrectly converting it
       * to a numeric level.
       */
      levels:
        [],

      scope:
        subject
          ? `${levelName} | ${subject}`
          : levelName,

      rawText:
        text,
    };
  }

  const eitherCp =
    text.match(
      /^Either\s+(\d+(?:\.\d+)?)\s*(?:cp|credit\s+points?)\s+(?:of|from|in)\s+(.+)$/i,
    );

  if (
    eitherCp
  ) {
    return {
      type:
        'CREDIT_POINTS',

      creditPoints:
        Number(
          eitherCp[1],
        ),

      minimum:
        false,

      levels:
        extractLevels(
          eitherCp[2],
        ),

      scope:
        normalizeNullable(
          eitherCp[2],
        ),

      rawText:
        text,
    };
  }

  const cpUnit =
    text.match(
      /^(?:(?:an?\s+)?additional\s+)?(\d+(?:\.\d+)?)\s*(?:cp|credit\s+points?|credit\s+point)\s+(from|of)\s+([A-Z]{4}[0-9X]{3,4})(?:\s+units?\s+of\s+study)?$/i,
    );

  if (
    cpUnit
  ) {
    return createCreditPointSelection(
      Number(
        cpUnit[1],
      ),

      cpUnit[2]
        .toLowerCase() ===
        'from'
        ? 'FROM'
        : 'OF',

      createUnitReference(
        cpUnit[3],
      ),

      text,
    );
  }

  const multiLevelCp =
    text.match(
      /^(?:(?:a\s+)?minimum\s+of\s+|at\s+least\s+)?(\d+(?:\.\d+)?)\s*(?:cp|credit\s+points?|credit\s+point)\s+at\s+((?:[1-9]000\s+or\s+)+[1-9]000)\s*-?\s*level(?:\s+(?:in|from|of)\s+(.+))?$/i,
    );

  if (
    multiLevelCp
  ) {
    const levels =
      [
        ...multiLevelCp[2]
          .matchAll(
            /\b([1-9])000\b/g,
          ),
      ].map(
        (
          match,
        ) =>
          Number(
            match[1],
          ),
      );

    return {
      type:
        'CREDIT_POINTS',

      creditPoints:
        Number(
          multiLevelCp[1],
        ),

      minimum:
        /\b(?:minimum|at least)\b/i.test(
          text,
        ),

      levels:
        [
          ...new Set(
            levels,
          ),
        ].sort(),

      scope:
        normalizeNullable(
          multiLevelCp[3],
        ),

      rawText:
        text,
    };
  }

  const cp =
    text.match(
      /^(?:(?:students?\s+will\s+need\s+to\s+have\s+completed|students?\s+must\s+have\s+completed|completed|completion\s+of)\s+)?(?:(?:a\s+)?minimum\s+of\s+|at\s+least\s+)?(\d+(?:\.\d+)?)\s*(?:cp|credit\s+points?|credit\s+point|credits?|credits?\s+points?)\b(.*)$/i,
    );

  if (
    cp
  ) {
    const remainder =
      normalizeUsydRequisiteText(
        cp[2] ??
        '',
      );

    const levels =
      extractLevels(
        remainder,
      );

    const scopeMatch =
      remainder.match(
        /\b(?:in|from|of)\s+(.+)$/i,
      );

    return {
      type:
        'CREDIT_POINTS',

      creditPoints:
        Number(
          cp[1],
        ),

      minimum:
        /\b(?:minimum|at least)\b/i.test(
          text,
        ),

      levels,

      scope:
        normalizeNullable(
          scopeMatch?.[1],
        ),

      rawText:
        text,
    };
  }

  const level =
    text.match(
      /^([1-9])000(?:-|\s*)level(?:\s+(?:in|from|of)\s+(.+)|\s+(.+))?$/i,
    );

  if (
    level
  ) {
    return {
      type:
        'LEVEL',

      levels: [
        Number(
          level[1],
        ),
      ],

      scope:
        normalizeNullable(
          level[2] ??
          level[3],
        ),

      rawText:
        text,
    };
  }

  if (
    isLikelySubjectScope(
      text,
    )
  ) {
    return {
      type:
        'SUBJECT_SCOPE',

      name:
        text,

      rawText:
        text,
    };
  }

  return {
    type:
      'TEXT',

    rawText:
      text,
  };
}

/**
 * ------------------------------------------------
 * PARSER
 * ------------------------------------------------
 */

class Parser {
  private index =
    0;

  constructor(
    private readonly tokens:
      Token[],
  ) { }

  parse():
    UsydRequisiteNode | null {
    const root =
      this.parseOr();

    if (
      !root
    ) {
      return null;
    }

    const remainingTokens =
      this.tokens
        .slice(
          this.index,
        )
        .filter(
          (
            token,
          ) =>
            token.type !==
            'RPAREN',
        );

    if (
      remainingTokens.length ===
      0
    ) {
      return postProcessNode(
        root,
      );
    }

    const remaining =
      remainingTokens
        .map(
          (
            token,
          ) =>
            token.value,
        )
        .join(
          ' ',
        )
        .trim();

    if (
      !remaining ||
      isSyntaxOnlyText(
        remaining,
      )
    ) {
      return postProcessNode(
        root,
      );
    }

    return postProcessNode({
      type:
        'LOGIC',

      operator:
        'AND',

      children: [
        root,
        parseAtom(
          remaining,
        ),
      ],

      rawText:
        `${nodeToRawText(root)} ${remaining}`,
    });
  }

  private parseOr():
    UsydRequisiteNode | null {
    const first =
      this.parseAnd();

    if (
      !first
    ) {
      return null;
    }

    const children:
      UsydRequisiteNode[] =
      [
        first,
      ];

    while (
      this.peek(
        'OR',
      )
    ) {
      this.index +=
        1;

      if (
        this.peek(
          'RPAREN',
        )
      ) {
        break;
      }

      const child =
        this.parseAnd();

      if (
        !child
      ) {
        break;
      }

      children.push(
        child,
      );
    }

    return makeLogic(
      'OR',
      children,
      children
        .map(
          nodeToRawText,
        )
        .join(
          ' or ',
        ),
    );
  }

  private parseAnd():
    UsydRequisiteNode | null {
    const first =
      this.parsePrimary();

    if (
      !first
    ) {
      return null;
    }

    const children:
      UsydRequisiteNode[] =
      [
        first,
      ];

    while (
      this.peek(
        'AND',
      )
    ) {
      this.index +=
        1;

      if (
        this.peek(
          'RPAREN',
        )
      ) {
        break;
      }

      const child =
        this.parsePrimary();

      if (
        !child
      ) {
        break;
      }

      children.push(
        child,
      );
    }

    return makeLogic(
      'AND',
      children,
      children
        .map(
          nodeToRawText,
        )
        .join(
          ' and ',
        ),
    );
  }

  private parsePrimary():
    UsydRequisiteNode | null {
    const token =
      this.tokens[
      this.index
      ];

    if (
      !token
    ) {
      return null;
    }

    if (
      token.type ===
      'RPAREN'
    ) {
      return null;
    }

    if (
      token.type ===
      'LPAREN'
    ) {
      return this.parseGroup();
    }

    if (
      token.type !==
      'TEXT'
    ) {
      this.index +=
        1;

      return null;
    }

    const next =
      this.tokens[
      this.index +
      1
      ];

    /**
     * ------------------------------------------------
     * FINAL: CP INCLUDING GROUP
     * ------------------------------------------------
     *
     * Examples:
     *
     * 144 credit points of units including (...)
     *
     * 144 credit points of units of study including (...)
     */
    if (
      next?.type ===
      'LPAREN'
    ) {
      const cpIncluding =
        token.value.match(
          /^(\d+(?:\.\d+)?)\s+credit\s+points?\s+of\s+(units(?:\s+of\s+study)?)\s+including\s*$/i,
        );

      if (
        cpIncluding
      ) {
        this.index +=
          1;

        const included =
          this.parseGroup();

        if (
          included
        ) {
          return {
            type:
              'LOGIC',

            operator:
              'AND',

            children: [
              {
                type:
                  'CREDIT_POINTS',

                creditPoints:
                  Number(
                    cpIncluding[1],
                  ),

                minimum:
                  false,

                levels:
                  [],

                scope:
                  cpIncluding[2],

                rawText:
                  `${cpIncluding[1]} credit points of ${cpIncluding[2]}`,
              },

              included,
            ],

            rawText:
              `${token.value} (${nodeToRawText(included)})`,
          };
        }
      }
    }

    /**
     * ------------------------------------------------
     * FINAL: AVERAGE + CP INCLUDING GROUP
     * ------------------------------------------------
     *
     * Example:
     *
     * An average of at least 65 in
     * 144 credit points of units including (...)
     */
    if (
      next?.type ===
      'LPAREN'
    ) {
      const averageCpIncluding =
        token.value.match(
          /^An?\s+average\s+of\s+at\s+least\s+(\d+(?:\.\d+)?)%?\s+in\s+(\d+(?:\.\d+)?)\s+credit\s+points?\s+of\s+(units(?:\s+of\s+study)?)\s+including\s*$/i,
        );

      if (
        averageCpIncluding
      ) {
        this.index +=
          1;

        const included =
          this.parseGroup();

        if (
          included
        ) {
          const cpRequirement:
            UsydRequisiteNode =
            {
              type:
                'CREDIT_POINTS',

              creditPoints:
                Number(
                  averageCpIncluding[2],
                ),

              minimum:
                false,

              levels:
                [],

              scope:
                averageCpIncluding[3],

              rawText:
                `${averageCpIncluding[2]} credit points of ${averageCpIncluding[3]}`,
            };

          return {
            type:
              'MARK',

            minimumMark:
              Number(
                averageCpIncluding[1],
              ),

            scope: {
              type:
                'LOGIC',

              operator:
                'AND',

              children: [
                cpRequirement,
                included,
              ],

              rawText:
                `${nodeToRawText(cpRequirement)} including (${nodeToRawText(included)})`,
            },

            rawText:
              `${token.value} (${nodeToRawText(included)})`,
          };
        }
      }
    }

    /**
     * ------------------------------------------------
     * V6.2 EXCEPT
     * ------------------------------------------------
     *
     * 6 credit points of MATH1XXX except (...)
     */
    if (
      next?.type ===
      'LPAREN'
    ) {
      const exceptMatch =
        token.value.match(
          /^(\d+(?:\.\d+)?)\s*(?:cp|credit\s+points?)\s+of\s+([A-Z]{4}[0-9X]{3,4})\s+except\s*$/i,
        );

      if (
        exceptMatch
      ) {
        this.index +=
          1;

        const exclusions =
          this.parseGroup();

        const baseSelection =
          createUnitReference(
            exceptMatch[2],
          );

        if (
          exclusions &&
          baseSelection
        ) {
          return {
            type:
              'EXCEPT',

            base:
              createCreditPointSelection(
                Number(
                  exceptMatch[1],
                ),

                'OF',

                baseSelection,

                `${exceptMatch[1]} credit points of ${exceptMatch[2]}`,
              ),

            exclusions,

            rawText:
              `${token.value} (${nodeToRawText(exclusions)})`,
          };
        }
      }
    }

    /**
     * ------------------------------------------------
     * V6.2 MARK OVER GROUPED CP SELECTION
     * ------------------------------------------------
     *
     * An average mark of 65 or above in
     * 12 credit points from (...)
     */
    if (
      next?.type ===
      'LPAREN'
    ) {
      const markCp =
        token.value.match(
          /^(?:an?\s+)?(?:average\s+)?mark\s+of\s+(\d+(?:\.\d+)?)%?\s+(?:or\s+(?:above|greater|higher|more))\s+(?:in\s+)?(\d+(?:\.\d+)?)\s*(?:cp|credit\s+points?)\s+(from|of)(?:\s+the\s+following\s+units?)?\s*$/i,
        );

      if (
        markCp
      ) {
        this.index +=
          1;

        const selection =
          this.parseGroup();

        if (
          selection
        ) {
          return {
            type:
              'MARK',

            minimumMark:
              Number(
                markCp[1],
              ),

            scope:
              createCreditPointSelection(
                Number(
                  markCp[2],
                ),

                markCp[3]
                  .toLowerCase() ===
                  'from'
                  ? 'FROM'
                  : 'OF',

                selection,

                `${markCp[2]} credit points ${markCp[3]}`,
              ),

            rawText:
              `${token.value} (${nodeToRawText(selection)})`,
          };
        }
      }
    }

    /**
     * Existing grouped prefix.
     */
    if (
      next?.type ===
      'LPAREN'
    ) {
      const prefix =
        this.parseGroupedPrefix(
          token.value,
        );

      if (
        prefix
      ) {
        this.index +=
          1;

        const group =
          this.parseGroup();

        if (
          prefix.type ===
          'CREDIT_POINT_SELECTION'
        ) {
          return {
            ...prefix,

            selection:
              group,

            rawText:
              `${prefix.rawText} (${nodeToRawText(group)})`,
          };
        }

        if (
          prefix.type ===
          'MARK'
        ) {
          return {
            ...prefix,

            scope:
              group,

            rawText:
              `${prefix.rawText} (${nodeToRawText(group)})`,
          };
        }

        if (
          prefix.type ===
          'GRADE'
        ) {
          return {
            ...prefix,

            scope:
              group,

            rawText:
              `${prefix.rawText} (${nodeToRawText(group)})`,
          };
        }
      }
    }

    this.index +=
      1;

    return parseAtom(
      token.value,
    );
  }

  private parseGroupedPrefix(
    rawText: string,
  ):
    | UsydRequisiteCreditPointSelectionAtom
    | UsydRequisiteMarkAtom
    | UsydRequisiteGradeAtom
    | null {
    const text =
      normalizeUsydRequisiteText(
        rawText,
      );

    const cp =
      text.match(
        /^(?:(?:completion\s+of\s+)?(?:an?\s+additional\s+)?(?:at\s+least\s+)?)?(\d+(?:\.\d+)?)\s*(?:cp|credit\s+points?|credit\s+point|credits?)\s+(from|including|of)\s*$/i,
      );

    if (
      cp
    ) {
      return createCreditPointSelection(
        Number(
          cp[1],
        ),

        cp[2]
          .toUpperCase() as
        | 'FROM'
        | 'INCLUDING'
        | 'OF',

        null,

        text,

        /\bat\s+least\b/i.test(
          text,
        ),
      );
    }

    if (
      /^Distinction(?:-|\s+)?(?:level\s+)?results?\s+in\s*$/i.test(
        text,
      )
    ) {
      return {
        type:
          'GRADE',

        grade:
          'DISTINCTION',

        scope:
          null,

        rawText:
          text,
      };
    }

    if (
      /^Credit\s+or\s+greater\s+in\s*$/i.test(
        text,
      )
    ) {
      return {
        type:
          'GRADE',

        grade:
          'CREDIT',

        scope:
          null,

        rawText:
          text,
      };
    }

    const mark =
      text.match(
        /^(?:(?:an?\s+)?(?:annual\s+)?(?:average\s+)?mark(?:\s+of)?|(?:an?\s+)?average\s+of|(?:a\s+)?minimum\s+of)?\s*(?:at\s+least\s+)?(\d+(?:\.\d+)?)%?\s*(?:or\s+(?:above|higher|greater|more))?\s+(?:in|from)\s*$/i,
      );

    if (
      mark
    ) {
      return {
        type:
          'MARK',

        minimumMark:
          Number(
            mark[1],
          ),

        scope:
          null,

        rawText:
          text,
      };
    }

    return null;
  }

  private parseGroup():
    UsydRequisiteNode | null {
    if (
      !this.peek(
        'LPAREN',
      )
    ) {
      return null;
    }

    this.index +=
      1;

    const child =
      this.parseOr();

    if (
      this.peek(
        'RPAREN',
      )
    ) {
      this.index +=
        1;
    }

    return child;
  }

  private peek(
    type:
      TokenType,
  ): boolean {
    return (
      this.tokens[
        this.index
      ]?.type ===
      type
    );
  }
}

/**
 * ------------------------------------------------
 * CLEANUP
 * ------------------------------------------------
 */

function isSyntaxOnlyText(
  value: string,
): boolean {
  const normalized =
    value.trim();

  if (
    !normalized
  ) {
    return true;
  }

  return /^[()\[\]{},:;.]+$/.test(
    normalized,
  );
}

function flattenSameOperator(
  node:
    UsydRequisiteLogicalNode,
): UsydRequisiteLogicalNode {
  const children:
    UsydRequisiteNode[] =
    [];

  for (
    const child
    of node.children
  ) {
    if (
      child.type ===
      'LOGIC' &&
      child.operator ===
      node.operator
    ) {
      children.push(
        ...child.children,
      );
    } else {
      children.push(
        child,
      );
    }
  }

  return {
    ...node,

    children,
  };
}

/**
 * ------------------------------------------------
 * V6.2 MARK PROPAGATION
 * ------------------------------------------------
 *
 * Example:
 *
 * MARK >=65 MATH1061 OR MATH1064
 *
 * becomes:
 *
 * MARK >=65
 *   OR
 *     MATH1061
 *     MATH1064
 *
 * Only contiguous UNIT / UNIT_PATTERN siblings immediately
 * following a MARK are absorbed.
 */
function foldMarkAcrossOrAlternatives(
  node:
    UsydRequisiteLogicalNode,
): UsydRequisiteNode {
  if (
    node.operator !==
    'OR'
  ) {
    return node;
  }

  const output:
    UsydRequisiteNode[] =
    [];

  let index =
    0;

  while (
    index <
    node.children.length
  ) {
    const child =
      node.children[
      index
      ];

    if (
      child.type !==
      'MARK' ||
      !child.scope ||
      !/\bin\s+[A-Z]{4}[0-9X]{3,4}$/i.test(
        child.rawText,
      )
    ) {
      output.push(
        child,
      );

      index +=
        1;

      continue;
    }

    const alternatives:
      UsydRequisiteNode[] =
      [
        child.scope,
      ];

    let cursor =
      index +
      1;

    while (
      cursor <
      node.children.length
    ) {
      const candidate =
        node.children[
        cursor
        ];

      if (
        candidate.type !==
        'UNIT' &&
        candidate.type !==
        'UNIT_PATTERN'
      ) {
        break;
      }

      alternatives.push(
        candidate,
      );

      cursor +=
        1;
    }

    if (
      alternatives.length ===
      1
    ) {
      output.push(
        child,
      );

      index +=
        1;

      continue;
    }

    output.push({
      ...child,

      scope:
        makeLogic(
          'OR',
          alternatives,
          alternatives
            .map(
              nodeToRawText,
            )
            .join(
              ' or ',
            ),
        ),
    });

    index =
      cursor;
  }

  if (
    output.length ===
    1
  ) {
    return output[0];
  }

  return {
    ...node,

    children:
      output,
  };
}

function postProcessNode(
  node:
    UsydRequisiteNode,
): UsydRequisiteNode {
  if (
    node.type ===
    'EXCEPT'
  ) {
    return {
      ...node,

      base:
        postProcessNode(
          node.base,
        ),

      exclusions:
        postProcessNode(
          node.exclusions,
        ),
    };
  }

  if (
    node.type ===
    'MARK' ||
    node.type ===
    'GRADE'
  ) {
    return {
      ...node,

      scope:
        node.scope
          ? postProcessNode(
            node.scope,
          )
          : null,
    };
  }

  if (
    node.type ===
    'CREDIT_POINT_SELECTION'
  ) {
    return {
      ...node,

      selection:
        node.selection
          ? postProcessNode(
            node.selection,
          )
          : null,
    };
  }

  if (
    node.type !==
    'LOGIC'
  ) {
    return node;
  }

  const children =
    node.children
      .map(
        postProcessNode,
      )
      .filter(
        (
          child,
        ) =>
          !(
            child.type ===
            'TEXT' &&
            isSyntaxOnlyText(
              child.rawText,
            )
          ),
      );

  if (
    children.length ===
    1
  ) {
    return children[0];
  }

  let processed:
    UsydRequisiteNode =
    flattenSameOperator({
      ...node,

      children,
    });

  if (
    processed.type ===
    'LOGIC' &&
    processed.operator ===
    'OR'
  ) {
    processed =
      foldMarkAcrossOrAlternatives(
        processed,
      );
  }

  return processed;
}

/**
 * ------------------------------------------------
 * TREE HELPERS
 * ------------------------------------------------
 */

function nodeToRawText(
  node:
    UsydRequisiteNode | null,
): string {
  if (
    !node
  ) {
    return '';
  }

  if (
    node.type ===
    'LOGIC'
  ) {
    return (
      '(' +
      node.children
        .map(
          nodeToRawText,
        )
        .join(
          node.operator ===
            'AND'
            ? ' and '
            : ' or ',
        ) +
      ')'
    );
  }

  if (
    node.type ===
    'EXCEPT'
  ) {
    return (
      `${nodeToRawText(node.base)} except ` +
      `(${nodeToRawText(node.exclusions)})`
    );
  }

  return node.rawText;
}

function collectUnitCodes(
  node:
    UsydRequisiteNode | null,
): string[] {
  if (
    !node
  ) {
    return [];
  }

  if (
    node.type ===
    'UNIT'
  ) {
    return [
      node.code,
    ];
  }

  if (
    node.type ===
    'PASSED_UNIT' &&
    node.code
  ) {
    return [
      node.code,
    ];
  }

  if (
    node.type ===
    'EXCEPT'
  ) {
    return [
      ...collectUnitCodes(
        node.base,
      ),

      ...collectUnitCodes(
        node.exclusions,
      ),
    ];
  }

  if (
    node.type ===
    'MARK' ||
    node.type ===
    'GRADE'
  ) {
    return collectUnitCodes(
      node.scope,
    );
  }

  if (
    node.type ===
    'CREDIT_POINT_SELECTION'
  ) {
    return collectUnitCodes(
      node.selection,
    );
  }

  if (
    node.type ===
    'LOGIC'
  ) {
    return node.children.flatMap(
      collectUnitCodes,
    );
  }

  return [
    ...node.rawText.matchAll(
      /\b[A-Z]{4}\d{4}\b/g,
    ),
  ].map(
    (
      match,
    ) =>
      match[0],
  );
}

function collectUnitPatterns(
  node:
    UsydRequisiteNode | null,
): string[] {
  if (
    !node
  ) {
    return [];
  }

  if (
    node.type ===
    'UNIT_PATTERN'
  ) {
    return [
      node.pattern,
    ];
  }

  if (
    node.type ===
    'PASSED_UNIT' &&
    node.pattern
  ) {
    return [
      node.pattern,
    ];
  }

  if (
    node.type ===
    'EXCEPT'
  ) {
    return [
      ...collectUnitPatterns(
        node.base,
      ),

      ...collectUnitPatterns(
        node.exclusions,
      ),
    ];
  }

  if (
    node.type ===
    'MARK' ||
    node.type ===
    'GRADE'
  ) {
    return collectUnitPatterns(
      node.scope,
    );
  }

  if (
    node.type ===
    'CREDIT_POINT_SELECTION'
  ) {
    return collectUnitPatterns(
      node.selection,
    );
  }

  if (
    node.type ===
    'LOGIC'
  ) {
    return node.children.flatMap(
      collectUnitPatterns,
    );
  }

  return [
    ...node.rawText.matchAll(
      /\b[A-Z]{4}[0-9X]{3,4}\b/g,
    ),
  ]
    .map(
      (
        match,
      ) =>
        match[0]
          .toUpperCase(),
    )
    .filter(
      (
        value,
      ) =>
        value
          .slice(
            4,
          )
          .includes(
            'X',
          ),
    );
}

function containsTextAtom(
  node:
    UsydRequisiteNode | null,
): boolean {
  if (
    !node
  ) {
    return false;
  }

  if (
    node.type ===
    'TEXT'
  ) {
    return (
      !!node.rawText.trim() &&
      !isSyntaxOnlyText(
        node.rawText,
      )
    );
  }

  if (
    node.type ===
    'EXCEPT'
  ) {
    return (
      containsTextAtom(
        node.base,
      ) ||
      containsTextAtom(
        node.exclusions,
      )
    );
  }

  if (
    node.type ===
    'MARK' ||
    node.type ===
    'GRADE'
  ) {
    return containsTextAtom(
      node.scope,
    );
  }

  if (
    node.type ===
    'CREDIT_POINT_SELECTION'
  ) {
    return containsTextAtom(
      node.selection,
    );
  }

  if (
    node.type ===
    'LOGIC'
  ) {
    return node.children.some(
      containsTextAtom,
    );
  }

  return false;
}

/**
 * ------------------------------------------------
 * V6.3 NARROW FREEZE-AUDIT FIXES
 * ------------------------------------------------
 */

/**
 * Parse the specific nested inclusion shape used by PHYS4036:
 *
 * 144 credit points of units of study including
 * 6 credit points of (A or B or C) and
 * 6 credit points of (D or E or F)
 *
 * This is intentionally narrow. It does not introduce a generic recursive
 * credit-point grammar after the freeze audit.
 */
function parseNestedCreditPointInclusions(
  value: string,
): UsydRequisiteNode | null {
  const normalized =
    normalizeUsydRequisiteText(
      value,
    );

  const match =
    normalized.match(
      /^(\d+)\s+credit\s+points?\s+of\s+units\s+of\s+study\s+including\s+(\d+)\s+credit\s+points?\s+of\s*\(([^()]+)\)\s+and\s+(\d+)\s+credit\s+points?\s+of\s*\(([^()]+)\)$/i,
    );

  if (
    !match
  ) {
    return null;
  }

  const totalCreditPoints =
    Number(
      match[1],
    );

  const firstCreditPoints =
    Number(
      match[2],
    );

  const firstSelectionRaw =
    match[3];

  const secondCreditPoints =
    Number(
      match[4],
    );

  const secondSelectionRaw =
    match[5];

  function parseOrSelection(
    rawSelection: string,
  ): UsydRequisiteNode | null {
    const parts =
      rawSelection
        .split(
          /\s+or\s+/i,
        )
        .map(
          (part) =>
            part.trim(),
        )
        .filter(
          Boolean,
        );

    if (
      parts.length <
      2
    ) {
      return null;
    }

    const children =
      parts.map(
        createUnitReference,
      );

    if (
      children.some(
        (child) =>
          child ===
          null,
      )
    ) {
      return null;
    }

    return makeLogic(
      'OR',
      children as UsydRequisiteNode[],
      rawSelection,
    );
  }

  const firstSelection =
    parseOrSelection(
      firstSelectionRaw,
    );

  const secondSelection =
    parseOrSelection(
      secondSelectionRaw,
    );

  if (
    !firstSelection ||
    !secondSelection
  ) {
    return null;
  }

  const totalNode:
    UsydRequisiteCreditPointAtom = {
      type:
        'CREDIT_POINTS',

      creditPoints:
        totalCreditPoints,

      minimum:
        false,

      levels:
        [],

      scope:
        'units of study',

      rawText:
        `${totalCreditPoints} credit points of units of study`,
    };

  const firstInclusion:
    UsydRequisiteCreditPointSelectionAtom = {
      type:
        'CREDIT_POINT_SELECTION',

      creditPoints:
        firstCreditPoints,

      minimum:
        false,

      relation:
        'INCLUDING',

      selection:
        firstSelection,

      rawText:
        `${firstCreditPoints} credit points of (${firstSelectionRaw})`,
    };

  const secondInclusion:
    UsydRequisiteCreditPointSelectionAtom = {
      type:
        'CREDIT_POINT_SELECTION',

      creditPoints:
        secondCreditPoints,

      minimum:
        false,

      relation:
        'INCLUDING',

      selection:
        secondSelection,

      rawText:
        `${secondCreditPoints} credit points of (${secondSelectionRaw})`,
    };

  return makeLogic(
    'AND',
    [
      totalNode,
      firstInclusion,
      secondInclusion,
    ],
    normalized,
  );
}

/**
 * ------------------------------------------------
 * PUBLIC API
 * ------------------------------------------------
 */

export function parseUsydRequisite(
  rawText:
    string | null | undefined,
): UsydParsedRequisite | null {
  if (
    !rawText
  ) {
    return null;
  }

  const normalizedText =
    normalizeUsydRequisiteText(
      rawText,
    );

  if (
    !normalizedText ||
    /^none$/i.test(
      normalizedText,
    )
  ) {
    return null;
  }

  /**
   * Dedicated complete-rule parsers get first chance.
   */
  const specialMinimumRoot =
    parseV61MinimumRule(
      normalizedText,
    );

  const directMarkCpRoot =
    parseDirectMarkOverCreditPoints(
      normalizedText,
    );

  const nestedCreditPointRoot =
    parseNestedCreditPointInclusions(
      normalizedText,
    );

  const parsedRoot =
    specialMinimumRoot ??
    directMarkCpRoot ??
    nestedCreditPointRoot ??
    new Parser(
      tokenize(
        normalizedText,
      ),
    ).parse();

  const root =
    parsedRoot
      ? postProcessNode(
        parsedRoot,
      )
      : null;

  return {
    rawText,

    normalizedText,

    root,

    unitCodes:
      [
        ...new Set(
          collectUnitCodes(
            root,
          ),
        ),
      ].sort(),

    unitPatterns:
      [
        ...new Set(
          collectUnitPatterns(
            root,
          ),
        ),
      ].sort(),

    containsUnparsedText:
      containsTextAtom(
        root,
      ),
  };
}

/**
 * ------------------------------------------------
 * FORMATTER
 * ------------------------------------------------
 */

export function formatUsydRequisiteTree(
  node:
    UsydRequisiteNode | null,
  indent =
    '',
): string {
  if (
    !node
  ) {
    return `${indent}EMPTY`;
  }

  if (
    node.type ===
    'LOGIC'
  ) {
    return [
      `${indent}${node.operator}`,

      ...node.children.map(
        (
          child,
        ) =>
          formatUsydRequisiteTree(
            child,
            `${indent}  `,
          ),
      ),
    ].join(
      '\n',
    );
  }

  if (
    node.type ===
    'EXCEPT'
  ) {
    return [
      `${indent}EXCEPT`,

      `${indent}  BASE`,

      formatUsydRequisiteTree(
        node.base,
        `${indent}    `,
      ),

      `${indent}  EXCLUSIONS`,

      formatUsydRequisiteTree(
        node.exclusions,
        `${indent}    `,
      ),
    ].join(
      '\n',
    );
  }

  switch (
  node.type
  ) {
    case 'UNIT':
      return `${indent}UNIT ${node.code}`;

    case 'UNIT_PATTERN':
      return `${indent}UNIT_PATTERN ${node.pattern}`;

    case 'SUBJECT_SCOPE':
      return `${indent}SUBJECT_SCOPE | ${node.name}`;

    case 'CREDIT_POINTS':
      return [
        `${indent}CREDIT_POINTS ${node.creditPoints}`,

        node.minimum
          ? 'MINIMUM'
          : null,

        node.levels.length >
          0
          ? `LEVELS ${node.levels.join(',')}`
          : null,

        node.scope
          ? `SCOPE ${node.scope}`
          : null,
      ]
        .filter(
          Boolean,
        )
        .join(
          ' | ',
        );

    case 'CREDIT_POINT_SELECTION':
      return [
        `${indent}CREDIT_POINT_SELECTION ${node.creditPoints} | ${node.relation}`,

        formatUsydRequisiteTree(
          node.selection,
          `${indent}  `,
        ),
      ].join(
        '\n',
      );

    case 'LEVEL':
      return (
        `${indent}LEVEL ${node.levels.join(',')}` +
        (
          node.scope
            ? ` | ${node.scope}`
            : ''
        )
      );

    case 'MARK':
      return [
        `${indent}MARK >= ${node.minimumMark}`,

        node.scope
          ? formatUsydRequisiteTree(
            node.scope,
            `${indent}  `,
          )
          : null,
      ]
        .filter(
          Boolean,
        )
        .join(
          '\n',
        );

    case 'GRADE':
      return [
        `${indent}GRADE >= ${node.grade}`,

        node.scope
          ? formatUsydRequisiteTree(
            node.scope,
            `${indent}  `,
          )
          : null,
      ]
        .filter(
          Boolean,
        )
        .join(
          '\n',
        );

    case 'WAM':
      return `${indent}WAM >= ${node.minimumWam}`;

    case 'PASSED_UNIT':
      return (
        `${indent}PASSED_UNIT ` +
        (
          node.code ??
          node.pattern ??
          'UNKNOWN'
        )
      );

    case 'PERMISSION':
      return `${indent}PERMISSION | ${node.rawText}`;

    case 'ELIGIBILITY':
      return `${indent}ELIGIBILITY | ${node.rawText}`;

    case 'EQUIVALENT_STUDY':
      return `${indent}EQUIVALENT_STUDY | ${node.rawText}`;

    case 'EXTERNAL_ENTRY':
      return `${indent}EXTERNAL_ENTRY | ${node.rawText}`;

    case 'PRIOR_EXPERIENCE':
      return `${indent}PRIOR_EXPERIENCE | ${node.rawText}`;

    case 'KNOWLEDGE':
      return `${indent}KNOWLEDGE | ${node.rawText}`;

    case 'TABLE_REFERENCE':
      return `${indent}TABLE_REFERENCE | ${node.tableName}`;

    case 'TEXT':
      return `${indent}TEXT | ${node.rawText}`;
  }
}