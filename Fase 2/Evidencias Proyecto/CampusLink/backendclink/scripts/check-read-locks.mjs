// Real, non-mutating concurrency proof on an existing synthetic QA profile.
import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
dotenv.config({ quiet: true }); dotenv.config({ path: '.env.runtime.local', override: true, quiet: true });
const clients = [0,1,2].map(() => new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: true }, query_timeout: 5000 }));
try {
  const manifest = JSON.parse(await readFile('qa/local/manifest.json'));
  const actor = manifest.users.find(u => u.actor === 'receptor');
  assert.ok(manifest.steps.complete && !manifest.cleaned && actor?.email.endsWith('@campuslink.invalid'));
  const { lockAccountContext } = await import('../dist/modules/auth/public.js');
  await Promise.all(clients.map(client => client.connect()));
  const [first, second, writer] = clients;
  for (const reader of [first,second]) {
    await reader.query('BEGIN; SET LOCAL lock_timeout=500; SET LOCAL statement_timeout=3000');
    const context = await lockAccountContext(reader, actor.id, 'read'); assert.equal(context.profile?.id, actor.id);
  }
  await writer.query('BEGIN');
  await assert.rejects(writer.query('SELECT id FROM public.perfil_usuario WHERE id=$1 FOR NO KEY UPDATE NOWAIT', [actor.id]), { code: '55P03' });
  await writer.query('ROLLBACK'); await second.query('ROLLBACK'); await first.query('ROLLBACK');
  await writer.query('BEGIN'); assert.equal((await writer.query('SELECT id FROM public.perfil_usuario WHERE id=$1 FOR NO KEY UPDATE NOWAIT', [actor.id])).rowCount, 1);
  await writer.query('ROLLBACK');
  const report = { status: 'passed', at: new Date().toISOString(), parallelReads: true, accountWritesBlockedUntilReadsFinish: true, businessRowsModified: 0 };
  await writeFile('qa/local/logs/read-locks.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) { console.error(JSON.stringify({ status: 'failed', code: error.code, businessRowsModified: 0 })); process.exitCode = 1; }
finally { for (const client of clients) { await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}); } }
