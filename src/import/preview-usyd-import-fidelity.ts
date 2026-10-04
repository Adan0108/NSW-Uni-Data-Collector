import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { captureFees, feePayload, remappedFeeRecords, verifyFees, type FeeRow } from './usyd-import-fidelity.js';

async function main() {
  const master = JSON.parse(readFileSync('data/normalized/usyd/2026/usyd-master-final.database-ready.json', 'utf8'));
  assert.equal(master.degrees.length, 109); assert.equal(master.components.length, 371);
  assert.equal(master.subjects.length, 3119); assert.equal(master.studyPlans.length, 531);
  assert.equal(master.studyPlans.filter((p: { degreeCode: string }) => p.degreeCode === 'BHENGINE-04').length, 196);
  assert.equal(master.requirementCandidateSources.length, 33);
  assert.equal(master.requirementCandidateSources.reduce((sum: number, source: { subjectCodes: string[] }) => sum + new Set(source.subjectCodes).size, 0), 2270);
  assert.equal(master.metadata.counts.engineeringFreeElectiveEngineeringSubjects, 271);
  assert.equal(master.metadata.counts.engineeringFreeElectiveTableSSubjects, 1472);
  assert.equal(master.metadata.counts.tableDSubjects, 17);
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 20000 });
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tx = { $queryRaw: async (sql: { text: string; values: unknown[] }) => {
      // No write-capable client is exposed to preservation helpers in this preview.
      assert.match(sql.text.trim(), /^(SELECT|WITH)\b/i);
      return (await client.query(sql.text, sql.values)).rows;
    } } as unknown as Parameters<typeof captureFees>[0];
    const versions = (await client.query(`SELECT h.id, u.code FROM "HandbookVersion" h JOIN "University" u ON u.id=h."universityId" WHERE h.year=2026 AND u.code IN ('USYD','UTS')`)).rows;
    const previousId = versions.find(v => v.code === 'USYD').id as string;
    const snapshot = await captureFees(tx, previousId, master.degrees.map((d: { code: string }) => d.code), false);
    assert.equal(snapshot.usyd.length, 109); assert.equal(snapshot.uts.length, 162);
    const degreeRows = (await client.query('SELECT code, id FROM "Degree" WHERE "handbookVersionId"=$1', [previousId])).rows;
    const degrees = new Map<string, string>(degreeRows.map(d => [d.code, d.id]));
    assert.equal(degrees.size, 109);
    await verifyFees(tx, snapshot, previousId, degrees);
    const payload = feePayload(snapshot.usyd, degrees);
    const typed = remappedFeeRecords(payload, previousId);
    const roundTrip = (await client.query(`SELECT to_jsonb(r)::text AS "rowJson" FROM (${typed.text}) r`, typed.values)).rows;
    assert.deepEqual(roundTrip.map((r: FeeRow) => r.rowJson).sort(), snapshot.usyd.map(r => r.rowJson).sort());
    // Exercise changed IDs through the same PostgreSQL record conversion, using SELECT only.
    const changed = (await client.query(`SELECT to_jsonb(r)::text AS "rowJson" FROM jsonb_array_elements($1::jsonb) c(value)
      CROSS JOIN LATERAL jsonb_populate_record(NULL::public."CourseFee", jsonb_set(c.value->'row', '{degreeId}', to_jsonb(('preview:' || (c.value->>'degreeCode'))::text))) r`, [payload])).rows;
    assert.deepEqual(changed.map(r => { const row = JSON.parse(r.rowJson); delete row.degreeId; return JSON.stringify(row); }).sort(),
      snapshot.usyd.map(r => { const row = JSON.parse(r.rowJson); delete row.degreeId; return JSON.stringify(row); }).sort());
    const uts = versions.find(v => v.code === 'UTS').id;
    for (const [table, expected] of [['Degree', 162], ['Component', 554], ['Subject', 3540]] as const) {
      const result = await client.query(`SELECT count(*)::int AS count FROM public."${table}" WHERE "handbookVersionId"=$1`, [uts]);
      assert.equal(result.rows[0].count, expected);
    }
    assert.equal((await client.query('SELECT count(*)::int AS count FROM "StudyPlan" p JOIN "Degree" d ON d.id=p."degreeId" WHERE d."handbookVersionId"=$1', [uts])).rows[0].count, 412);
    assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
    console.log('READ ONLY preview passed: USYD fees 109 -> 109; UTS fees 162 unchanged; PostgreSQL typed round-trip and changed-ID projection passed. No INSERT/DELETE/UPDATE executed.');
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
