import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
dotenv.config({ quiet: true });
const admin = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: true } });
let runtime;
try {
  await admin.connect();
  const denied = (await admin.query(`SELECT has_schema_privilege('campuslink_api','public','CREATE') create_objects,
    has_schema_privilege('campuslink_api','auth','USAGE') raw_auth_schema,
    has_table_privilege('campuslink_api','public.auditoria','UPDATE') modify_audit,
    has_table_privilege('campuslink_api','public.auditoria','DELETE') delete_audit,
    has_table_privilege('campuslink_api','public.auditoria','TRUNCATE') truncate_audit,
    has_table_privilege('anon','public.campuslink_auth_directory','SELECT') anonymous_directory,
    has_table_privilege('authenticated','public.campuslink_auth_directory','SELECT') client_directory,
    has_column_privilege('campuslink_api','auth.users','encrypted_password','SELECT') password_hashes,
    pg_has_role('campuslink_api','authenticated','MEMBER') client_role,
    pg_has_role('campuslink_api','service_role','MEMBER') service_role`)).rows[0];
  for (const value of Object.values(denied)) assert.equal(value, false);
  const columns = (await admin.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='campuslink_auth_directory' ORDER BY ordinal_position")).rows.map(r => r.column_name);
  assert.deepEqual(columns, ['id','email','created_at']);
  const source = await admin.query("SELECT count(*)::int n FROM public.rol");
  dotenv.config({ path: '.env.runtime.local', override: true, quiet: true });
  runtime = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: true } });
  await runtime.connect();
  const flags = (await runtime.query('SELECT current_user,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=current_user')).rows[0];
  assert.equal(flags.current_user, 'campuslink_api');
  for (const [name,value] of Object.entries(flags)) if (name !== 'current_user') assert.equal(value, false);
  await runtime.query('BEGIN');
  const visible = await runtime.query('SELECT id FROM public.rol FOR SHARE'); assert.equal(visible.rowCount, source.rows[0].n);
  await runtime.query('SELECT id,email,created_at FROM public.campuslink_auth_directory LIMIT 0');
  await runtime.query('ROLLBACK');
  const report = { status: 'passed', at: new Date().toISOString(), flags, denied, directoryColumns: columns, roleVisibilityMatchesOperator: true };
  await mkdir('qa/local/logs', { recursive: true }); await writeFile('qa/local/logs/runtime-permissions.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch { console.error('Runtime privilege verification failed; no provider data modified'); process.exitCode = 1; }
finally { await runtime?.end(); await admin.end(); }
