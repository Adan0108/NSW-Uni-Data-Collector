import { Prisma } from '../generated/prisma/client.js';

type Tx = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;
export interface FeeRow { degreeCode: string; rowJson: string }
export interface FeeSnapshot { usyd: FeeRow[]; uts: FeeRow[] }

// Explicitly inspected replacement graph. A new inbound table requires review.
const knownTables = new Set(['HandbookVersion', 'Degree', 'Component', 'DegreeComponent',
  'RequirementGroup', 'RequirementItem', 'RequirementCandidateSource', 'RequirementCandidateSubject',
  'Subject', 'SubjectAccessCondition', 'SubjectRequisiteGroup', 'SubjectRequisiteItem',
  'StudyPlan', 'StudyPlanYear', 'StudyPlanPeriod', 'StudyPlanItem', 'SourceRecord',
  'UnresolvedReference', 'DegreeRanking', 'RiasecScore', 'RiasecSubcategoryScore', 'CourseFee']);

export async function assertFeeSchema(tx: Tx): Promise<void> {
  const columns = await tx.$queryRaw<Array<{ name: string; type: string; nullable: boolean; precision: number | null; defaultValue: string | null }>>(Prisma.sql`
    SELECT column_name AS name, udt_name AS type, is_nullable = 'YES' AS nullable,
      datetime_precision AS precision, column_default AS "defaultValue" FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CourseFee' ORDER BY ordinal_position`);
  const expected = ['id:text:false:null', 'degreeId:text:false:null', 'feeYear:text:false:null',
    'domesticFee:int4:true:null', 'internationalFee:int4:true:null',
    'createdAt:timestamp:false:3', 'updatedAt:timestamp:false:3'];
  if (JSON.stringify(columns.map(c => `${c.name}:${c.type}:${c.nullable}:${c.precision}`)) !== JSON.stringify(expected)) {
    throw new Error('CourseFee schema changed; refusing handbook replacement');
  }
  if (columns.some(c => c.defaultValue !== (c.name === 'createdAt' ? 'CURRENT_TIMESTAMP' : null))) {
    throw new Error('CourseFee defaults changed');
  }
  const foreignKeys = await tx.$queryRaw<Array<{ schema: string; child: string; parent: string; definition: string }>>(Prisma.sql`
    WITH RECURSIVE affected AS (
      SELECT 'public."HandbookVersion"'::regclass::oid AS oid UNION
      SELECT c.conrelid FROM pg_constraint c JOIN affected a ON c.confrelid = a.oid WHERE c.contype = 'f'
    ) SELECT ns.nspname AS schema, cl.relname AS child, pcl.relname AS parent,
      pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c
    JOIN affected a ON c.confrelid = a.oid JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace JOIN pg_class pcl ON pcl.oid = c.confrelid
    WHERE c.contype = 'f'`);
  for (const fk of foreignKeys) {
    if (fk.schema !== 'public' || !knownTables.has(fk.child) ||
      (fk.child === 'CourseFee' && (fk.parent !== 'Degree' ||
        fk.definition !== 'FOREIGN KEY ("degreeId") REFERENCES "Degree"(id) ON DELETE CASCADE'))) {
      throw new Error(`Unreviewed replacement foreign key: ${fk.schema}.${fk.child}: ${fk.definition}`);
    }
  }
  if (!foreignKeys.some(fk => fk.child === 'CourseFee' && fk.parent === 'Degree')) {
    throw new Error('CourseFee degree foreign key missing');
  }
  const constraints = await tx.$queryRaw<Array<{ definition: string }>>(Prisma.sql`
    SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid = 'public."CourseFee"'::regclass AND contype IN ('p', 'u')`);
  if (constraints.length !== 2 || !constraints.some(c => c.definition === 'PRIMARY KEY (id)') ||
    !constraints.some(c => c.definition === 'UNIQUE ("degreeId", "feeYear")')) {
    throw new Error('CourseFee identity constraints changed');
  }
}

export async function readFees(tx: Tx, university: string, handbookId?: string): Promise<FeeRow[]> {
  return tx.$queryRaw<FeeRow[]>(Prisma.sql`
    SELECT d.code AS "degreeCode", to_jsonb(f)::text AS "rowJson" FROM public."CourseFee" f
    JOIN public."Degree" d ON d.id = f."degreeId"
    JOIN public."HandbookVersion" h ON h.id = d."handbookVersionId"
    JOIN public."University" u ON u.id = h."universityId"
    WHERE u.code = ${university} ${handbookId === undefined ? Prisma.empty : Prisma.sql`AND h.id = ${handbookId}`}
    ORDER BY d.code, f.id`);
}

export function feePayload(rows: FeeRow[], degrees: Map<string, string>): string {
  const ids = new Set<string>(), logicalKeys = new Set<string>();
  if (new Set(degrees.values()).size !== degrees.size) throw new Error('Duplicate recreated degree IDs');
  return `[${rows.map(({ degreeCode, rowJson }) => {
    const row = JSON.parse(rowJson) as { id: string; feeYear: string };
    if (!degrees.has(degreeCode)) throw new Error(`Missing CourseFee degree mapping: ${degreeCode}`);
    const key = JSON.stringify([degreeCode, row.feeYear]);
    if (ids.has(row.id) || logicalKeys.has(key)) throw new Error('Duplicate captured CourseFee');
    ids.add(row.id); logicalKeys.add(key);
    // rowJson comes directly from PostgreSQL; never coerce timestamps through Date.
    return `{"degreeCode":${JSON.stringify(degreeCode)},"row":${rowJson}}`;
  }).join(',')}]`;
}

export async function captureFees(tx: Tx, previousId: string | undefined, proposedCodes: string[], lock = true): Promise<FeeSnapshot> {
  await assertFeeSchema(tx);
  if (new Set(proposedCodes).size !== proposedCodes.length) throw new Error('Duplicate proposed degree codes');
  if (previousId && lock) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM public."HandbookVersion" WHERE id = ${previousId} FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM public."Degree" WHERE "handbookVersionId" = ${previousId} ORDER BY id FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT f.id FROM public."CourseFee" f JOIN public."Degree" d ON d.id = f."degreeId"
      WHERE d."handbookVersionId" = ${previousId} ORDER BY f.id FOR UPDATE OF f`);
  }
  const usyd = previousId ? await readFees(tx, 'USYD', previousId) : [];
  feePayload(usyd, new Map(proposedCodes.map(code => [code, code])));
  return { usyd, uts: await readFees(tx, 'UTS') };
}

export function remappedFeeRecords(payload: string, handbookId: string) {
  return Prisma.sql`SELECT r.* FROM jsonb_array_elements(${payload}::jsonb) c(value)
    JOIN public."Degree" d ON d."handbookVersionId" = ${handbookId} AND d.code = c.value->>'degreeCode'
    CROSS JOIN LATERAL jsonb_populate_record(NULL::public."CourseFee",
      jsonb_set(c.value->'row', '{degreeId}', to_jsonb(d.id))) r`;
}

export async function restoreFees(tx: Tx, snapshot: FeeSnapshot, handbookId: string, degrees: Map<string, string>): Promise<void> {
  const payload = feePayload(snapshot.usyd, degrees);
  const count = await tx.$executeRaw(Prisma.sql`INSERT INTO public."CourseFee"
    (id, "degreeId", "feeYear", "domesticFee", "internationalFee", "createdAt", "updatedAt")
    ${remappedFeeRecords(payload, handbookId)}`);
  if (count !== snapshot.usyd.length) throw new Error('CourseFee restored count mismatch');
  await verifyFees(tx, snapshot, handbookId, degrees);
}

export async function verifyFees(tx: Tx, snapshot: FeeSnapshot, handbookId: string, degrees: Map<string, string>): Promise<void> {
  const actual = await readFees(tx, 'USYD', handbookId);
  feePayload(actual, degrees);
  const canonical = (rows: FeeRow[], remap: boolean) => rows.map(({ degreeCode, rowJson }) => {
    const row = JSON.parse(rowJson);
    if (remap) row.degreeId = degrees.get(degreeCode);
    return JSON.stringify([degreeCode, Object.entries(row).sort(([a], [b]) => a.localeCompare(b))]);
  }).sort();
  if (JSON.stringify(canonical(snapshot.usyd, true)) !== JSON.stringify(canonical(actual, false))) {
    throw new Error('CourseFee restored content mismatch');
  }
  if (JSON.stringify(await readFees(tx, 'UTS')) !== JSON.stringify(snapshot.uts)) {
    throw new Error('UTS CourseFee changed during USYD replacement');
  }
}

export function componentRequirementFields(group: Record<string, unknown>) {
  const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const required = number(group.requiredCreditPoints);
  const maximum = number(group.maxCreditPoints ?? group.maximumCreditPoints);
  if (group.logic === 'AT_LEAST') {
    const minimum = number(group.minCreditPoints);
    // Only the inspected exact quotas can be represented without a new enum/minimum field.
    if (minimum === null || minimum <= 0 || required !== minimum || maximum !== minimum) {
      throw new Error('AT_LEAST group cannot be represented losslessly by existing exact-quota fields');
    }
    return { logic: 'ANY' as const, requiredCreditPoints: minimum, maximumCreditPoints: maximum };
  }
  const logic = group.logic === 'ALL' || group.logic === 'ANY' || group.logic === 'ONE_OF' ? group.logic : 'UNKNOWN';
  return { logic, requiredCreditPoints: required, maximumCreditPoints: maximum } as const;
}
