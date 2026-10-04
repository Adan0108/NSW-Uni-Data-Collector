import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertFeeSchema, componentRequirementFields, feePayload, restoreFees, verifyFees, type FeeRow } from './usyd-import-fidelity.js';

const original: FeeRow = { degreeCode: 'D', rowJson: JSON.stringify({ id: 'fee-id', degreeId: 'old', feeYear: '2026', domesticFee: null, internationalFee: 12345, createdAt: '2026-01-01T01:02:03.123', updatedAt: '2026-01-02T01:02:03.456' }) };
const degrees = new Map([['D', 'new']]);
const restored = { ...original, rowJson: JSON.stringify({ ...JSON.parse(original.rowJson), degreeId: 'new' }) };
const snapshot = { usyd: [original], uts: [original] };
function mock(count: number, reads: FeeRow[][]) {
  const writes: unknown[] = [];
  return { writes, tx: { $executeRaw: async (sql: unknown) => { writes.push(sql); return count; },
    $queryRaw: async () => reads.shift() } as unknown as Parameters<typeof restoreFees>[0] };
}
test('preserves IDs, nullable amounts, feeYear text, and exact timestamp strings', async () => {
  const { tx, writes } = mock(1, [[restored], [original]]);
  await restoreFees(tx, snapshot, 'handbook', degrees);
  assert.equal(writes.length, 1);
  const sql = writes[0] as { text: string; values: unknown[] };
  assert.match(sql.text, /jsonb_populate_record/);
  assert.ok(!sql.text.includes('fee-id'));
  assert.deepEqual(JSON.parse(String(sql.values[0]))[0].row, JSON.parse(original.rowJson));
});
test('missing or duplicate identities fail before insertion', async () => {
  assert.throws(() => feePayload([original], new Map()), /Missing/);
  assert.throws(() => feePayload([original, original], degrees), /Duplicate/);
  assert.throws(() => feePayload([original], new Map([['D', 'new'], ['E', 'new']])), /Duplicate/);
  const { tx, writes } = mock(1, []);
  await assert.rejects(restoreFees(tx, snapshot, 'h', new Map()), /Missing/);
  assert.equal(writes.length, 0);
});
test('count, content, and UTS mismatches throw for transaction rollback', async () => {
  await assert.rejects(restoreFees(mock(0, []).tx, snapshot, 'h', degrees), /count mismatch/);
  await assert.rejects(verifyFees(mock(1, [[original]]).tx, snapshot, 'h', degrees), /content mismatch/);
  await assert.rejects(verifyFees(mock(1, [[restored], []]).tx, snapshot, 'h', degrees), /UTS/);
});
test('five real AT_LEAST groups preserve their exact bounds; unsupported cases fail closed', () => {
  const master = JSON.parse(readFileSync('data/normalized/usyd/2026/usyd-master-final.database-ready.json', 'utf8'));
  const groups: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if ((value as Record<string, unknown>).logic === 'AT_LEAST') groups.push(value as Record<string, unknown>);
    for (const child of Object.values(value)) visit(child);
  };
  visit(master.componentRequirementObjects);
  assert.equal(groups.length, 5);
  for (const group of groups) assert.deepEqual(componentRequirementFields(group), {
    logic: 'ANY', requiredCreditPoints: group.minCreditPoints, maximumCreditPoints: group.maxCreditPoints,
  });
  assert.throws(() => componentRequirementFields({ logic: 'AT_LEAST', minCreditPoints: 6, requiredCreditPoints: 6 }), /losslessly/);
});
test('production preservation stays inside the replacement transaction', () => {
  const source = readFileSync('src/import/usyd-2026.import.ts', 'utf8');
  assert.ok(source.indexOf('await captureFees(') < source.indexOf('await tx.handbookVersion.delete('));
  assert.ok(source.indexOf('await restoreFees(') > source.indexOf('counts.degrees = degreeIdByCode.size'));
  assert.ok(source.indexOf('await verifyFees(') < source.indexOf('return counts;'));
});
test('schema guard rejects additional inbound drift tables and altered columns or constraints', async () => {
  const columns = ['id', 'degreeId', 'feeYear', 'domesticFee', 'internationalFee', 'createdAt', 'updatedAt'].map((name, i) => ({
    name, type: i < 3 ? 'text' : i < 5 ? 'int4' : 'timestamp', nullable: i === 3 || i === 4,
    precision: i > 4 ? 3 : null, defaultValue: name === 'createdAt' ? 'CURRENT_TIMESTAMP' : null,
  }));
  const foreignKeys = [{ schema: 'public', child: 'CourseFee', parent: 'Degree', definition: 'FOREIGN KEY ("degreeId") REFERENCES "Degree"(id) ON DELETE CASCADE' }];
  const constraints = [{ definition: 'PRIMARY KEY (id)' }, { definition: 'UNIQUE ("degreeId", "feeYear")' }];
  const schemaTx = (reads: unknown[]) => ({ $queryRaw: async () => reads.shift() }) as unknown as Parameters<typeof assertFeeSchema>[0];
  await assertFeeSchema(schemaTx([columns, foreignKeys, constraints]));
  await assert.rejects(assertFeeSchema(schemaTx([[...columns, { name: 'extra' }]])), /schema changed/);
  await assert.rejects(assertFeeSchema(schemaTx([columns, [...foreignKeys, { schema: 'public', child: 'Unmodeled', parent: 'Subject', definition: 'new FK' }]])), /Unreviewed/);
  await assert.rejects(assertFeeSchema(schemaTx([columns, foreignKeys, []])), /identity constraints/);
});
