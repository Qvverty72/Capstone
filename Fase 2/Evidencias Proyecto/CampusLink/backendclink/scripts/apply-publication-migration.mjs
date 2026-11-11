import dotenv from 'dotenv';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
dotenv.config({ quiet: true });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: true } });
try {
  const { folder } = JSON.parse(await readFile('qa/local/backups/latest.json'));
  const result = JSON.parse(await readFile(folder + '/verification.json'));
  if (result.status !== 'restore-verified' || Date.now() - Date.parse(result.at) > 86400000) throw Error();
  await db.connect(); await db.query('BEGIN; SET LOCAL lock_timeout=5000; SET LOCAL statement_timeout=10000');
  await db.query(await readFile('src/database/supabase/migrations/20261110_publication_idempotency.sql', 'utf8'));
  await db.query('COMMIT'); console.log(JSON.stringify({ status: 'publication-migration-applied', additive: true }));
} catch { await db.query('ROLLBACK').catch(() => {}); console.error('Publication migration unavailable; requires a recent verified backup'); process.exitCode = 1; }
finally { await db.end(); }
