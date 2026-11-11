// Creates a new role only. Never rotates/overwrites an existing role or changes a running deployment.
import dotenv from 'dotenv';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, access, unlink } from 'node:fs/promises';
dotenv.config({ quiet: true });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: true } });
let stage = 'preflight';
let secretCreated = false;
try {
  if (!process.argv.includes('--apply')) throw Error('Use --apply after a verified backup');
  const verification = JSON.parse(await readFile('qa/local/backups/latest.json'));
  const result = JSON.parse(await readFile(verification.folder + '/verification.json'));
  if (result.status !== 'restore-verified' || Date.now() - Date.parse(result.at) > 86400000) throw Error('A recent verified restore is required');
  let exists = false; try { await access('.env.runtime.local'); exists = true; } catch {}
  if (exists) throw Error('Runtime env already exists; preserved');
  await db.connect(); await db.query('BEGIN');
  if ((await db.query("SELECT 1 FROM pg_roles WHERE rolname='campuslink_api'")).rowCount) throw Error('Runtime role already exists; preserved');
  const password = randomBytes(36).toString('hex');
  stage = 'create-role';
  await db.query(`CREATE ROLE campuslink_api LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
  stage = 'grants-and-policies';
  await db.query(await readFile('src/database/supabase/migrations/20261110_runtime_auth_directory.sql', 'utf8'));
  await db.query(await readFile('src/database/supabase/migrations/20261110_runtime_privileges.sql', 'utf8'));
  const url = new URL(process.env.SUPABASE_DB_URL), previous = decodeURIComponent(url.username);
  url.username = 'campuslink_api' + (previous.includes('.') ? previous.slice(previous.indexOf('.')) : ''); url.password = password;
  // Write before commit: a failed write rolls back the role. wx preserves any concurrent local file.
  await writeFile('.env.runtime.local', 'SUPABASE_DB_URL=' + url.toString() + '\n', { flag: 'wx', mode: 0o600 });
  secretCreated = true;
  await db.query('COMMIT');
  console.log(JSON.stringify({ status: 'runtime-role-created', role: 'campuslink_api', secretFile: '.env.runtime.local', renderChanged: false }));
} catch (error) {
  await db.query('ROLLBACK').catch(() => {});
  if (secretCreated) {
    // Preserve the credentials if COMMIT was ambiguous; remove only our file after confirmed rollback.
    try { if (!(await db.query("SELECT 1 FROM pg_roles WHERE rolname='campuslink_api'")).rowCount) await unlink('.env.runtime.local'); } catch {}
  }
  console.error(JSON.stringify({ status: 'failed', stage, sqlState: error.code, reason: /^(Use|A recent|Runtime)/.test(error.message) ? error.message : 'Runtime role provisioning unavailable; existing roles preserved' })); process.exitCode = 1;
} finally { await db.end(); }
