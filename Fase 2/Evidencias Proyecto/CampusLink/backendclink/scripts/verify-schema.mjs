// Metadata only. Does not apply SQL/Mongo migrations, change grants or read user records.
import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { connectMongoDB, closeMongoDB } from '../dist/database/mongodb/client.js';
import { withPostgresTransaction, closePostgres } from '../dist/database/supabase/postgres.js';

try {
  const directory = new URL('../src/database/supabase/migrations/', import.meta.url);
  const sql = (await Promise.all((await readdir(directory)).filter(name => name.endsWith('.sql'))
    .map(name => readFile(new URL(name, directory), 'utf8')))).join('\n');
  const tables = [...new Set([...sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_]+)/gi)].map(m => m[1]))];
  const indexes = [...new Set([...sql.matchAll(/create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([a-z_]+)/gi)].map(m => m[1]))];
  const postgres = await withPostgresTransaction(async client => {
    await client.query('SET TRANSACTION READ ONLY');
    const existingTables = new Set((await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.map(row => row.tablename));
    const existingIndexes = new Set((await client.query("SELECT indexname FROM pg_indexes WHERE schemaname='public'")).rows.map(row => row.indexname));
    const role = (await client.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    return { tablesChecked: tables.length, missingTables: tables.filter(name => !existingTables.has(name)),
      indexesChecked: indexes.length, missingIndexes: indexes.filter(name => !existingIndexes.has(name)),
      role: { superuser: role.rolsuper, bypassRls: role.rolbypassrls } };
  });
  const db = await connectMongoDB();
  const required = { campus_maps: ['campus_version_uq', 'one_active_map_per_campus'],
    activities: ['series_occurrence_uq'], activity_participation: ['activity_user_uq'] };
  const mongodb = [];
  for (const [collection, names] of Object.entries(required)) {
    const indexes = await db.collection(collection).listIndexes().toArray();
    mongodb.push({ collection, missingIndexes: names.filter(name => !indexes.some(index => index.name === name && index.unique === true)) });
  }
  console.log(JSON.stringify({ postgres, mongodb }));
  if (postgres.missingTables.length || postgres.missingIndexes.length || mongodb.some(item => item.missingIndexes.length)) process.exitCode = 1;
} catch {
  console.error('Schema metadata verification unavailable; no migration or grant changes applied.');
  process.exitCode = 1;
} finally { await Promise.allSettled([closeMongoDB(), closePostgres()]); }
