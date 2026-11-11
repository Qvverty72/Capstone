// Local encrypted application backup. No cloud writes. Restore verification uses disposable Docker containers only.
import dotenv from 'dotenv';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { rootCertificates } from 'node:tls';
import pg from 'pg';
import { MongoClient, BSON } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from './backup-crypto.mjs';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
dotenv.config({ quiet: true });
const docker = process.env.DOCKER_BINARY ?? (process.platform === 'win32' ? 'C:/Program Files/Docker/Docker/resources/bin/docker.exe' : 'docker');
const root = resolve('qa/local/backups'), keyPath = resolve(process.env.BACKUP_KEY_FILE ?? 'qa/local/backup-key.bin');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const quote = value => '"' + value.replaceAll('"', '""') + '"';
let stage = 'initialization';
function child(args, env = {}) {
  const p = spawn(docker, args, { env: { ...process.env, ...env }, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let diagnostic = '';
  p.stderr.on('data', chunk => { if (diagnostic.length < 8192) diagnostic += chunk.toString(); });
  p.done = new Promise((res, rej) => { p.once('error', () => rej(Error('Docker unavailable'))); p.once('close', code => {
    if (code === 0) return res();
    // Only classify failures; never forward rows, connection strings or provider error text.
    const category = /certificate|SSL error|root certificate/i.test(diagnostic) ? 'TLS verification' : /permission denied/i.test(diagnostic) ? 'permissions' : /does not exist/i.test(diagnostic) ? 'missing restore dependency' : /could not connect|connection.*failed|timeout/i.test(diagnostic) ? 'connection' : /snapshot/i.test(diagnostic) ? 'snapshot' : /authentication|password/i.test(diagnostic) ? 'authentication' : 'tool execution';
    const sqlState = diagnostic.match(/ERROR:\s+([0-9A-Z]{5})\b/)?.[1];
    const ddl = stage === 'restore-pg-dump' ? diagnostic.split('\n').find(line => line.includes('ERROR:'))?.replace(/"[^"\n]*"|'[^'\n]*'/g, '[identifier]').slice(0, 250) : undefined;
    rej(Error('Docker operation failed: ' + category + (sqlState ? ' SQLSTATE=' + sqlState : '') + (ddl ? ' ' + ddl : '')));
  }); });
  // The promise may reject while its output stream is still being consumed.
  p.done.catch(() => {});
  return p;
}
async function run(args, input, environment = {}) {
  const p = child(args, environment), chunks = []; p.stdin.on('error', () => {}); p.stdin.end(input);
  for await (const chunk of p.stdout) chunks.push(chunk); await p.done; return Buffer.concat(chunks).toString().trim();
}
async function key(create = false) {
  try { const bytes = await readFile(keyPath); if (bytes.length !== 32) throw Error(); return bytes; }
  catch (error) { if (!create || error.code !== 'ENOENT') throw Error('Backup key missing or invalid'); }
  await mkdir(resolve(keyPath, '..'), { recursive: true }); const bytes = randomBytes(32);
  await writeFile(keyPath, bytes, { flag: 'wx', mode: 0o600 }); return bytes;
}
async function backup() {
  await mkdir(root, { recursive: true });
  const folder = join(root, new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8));
  await mkdir(folder); const secret = await key(true);
  const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: true } });
  const mongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const manifest = { format: 'campuslink-backup-v1', startedAt: new Date().toISOString(),
    consistency: 'PostgreSQL exported snapshot; MongoDB snapshot transaction; Storage bytes verified separately. No cross-provider atomic snapshot.',
    scope: 'public/auth/storage schemas, application MongoDB collections and every referenced Storage object; excludes provider infrastructure/configuration',
    tables: [], collections: [], objects: [], roles: [] };
  try {
    stage = 'backup-postgres';
    await db.connect(); await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot = (await db.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    const tables = (await db.query("SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema IN ('public','auth','storage') AND table_type='BASE TABLE' ORDER BY 1,2")).rows;
    for (const t of tables) manifest.tables.push({ schema: t.table_schema, name: t.table_name,
      count: (await db.query(`SELECT count(*)::int AS n FROM ${quote(t.table_schema)}.${quote(t.table_name)}`)).rows[0].n });
    manifest.roles = (await db.query("SELECT DISTINCT unnest(roles)::text AS name FROM pg_policies WHERE schemaname IN ('public','auth','storage')")).rows.map(r => r.name).filter(r => r !== 'public' && r !== 'postgres');
    const objects = (await db.query('SELECT bucket_id,name FROM storage.objects ORDER BY bucket_id,name')).rows;
    const u = new URL(process.env.SUPABASE_DB_URL);
    if (db.connection.stream.authorized !== true) throw Error('Backup requires verified TLS');
    const configuredCA = db.connectionParameters.ssl?.ca;
    const ca = join(root, 'trusted-ca.pem'); await writeFile(ca, rootCertificates.join('\n') + '\n' + (configuredCA ?? ''));
    const p = child(['run', '--rm', '-i', '-v', ca + ':/campuslink-ca.pem:ro', '-e', 'PGPASSWORD', '-e', 'PGSSLMODE', '-e', 'PGSSLROOTCERT', 'postgres:18.6', 'pg_dump',
      '-h', u.hostname, '-p', u.port || '5432', '-U', decodeURIComponent(u.username), '-d', u.pathname.slice(1),
      '--format=custom', '--no-owner', '--no-acl', '--lock-wait-timeout=5000', '--schema=public', '--schema=auth', '--schema=storage', '--snapshot=' + snapshot],
    { PGPASSWORD: decodeURIComponent(u.password), PGSSLMODE: 'verify-full', PGSSLROOTCERT: '/campuslink-ca.pem' });
    p.stdin.end(); await encrypt(p.stdout, join(folder, 'postgres.enc'), secret); await p.done;
    await db.query('COMMIT');
    stage = 'backup-mongo';
    await mongo.connect(); const mdb = mongo.db(process.env.MONGODB_DB_NAME);
    const collections = await mdb.listCollections({}, { nameOnly: false }).toArray();
    const session = mongo.startSession();
    try { session.startTransaction({ readConcern: { level: 'snapshot' } });
      for (const c of collections.filter(c => c.type === 'collection' && !c.name.startsWith('system.'))) {
        const documents = await mdb.collection(c.name).find({}, { session }).toArray();
        const indexes = await mdb.collection(c.name).listIndexes().toArray();
        const bytes = Buffer.from(BSON.EJSON.stringify({ name: c.name, options: c.options, indexes, documents }, { relaxed: false }));
        const file = `mongo-${manifest.collections.length}.enc`; await encrypt(bytes, join(folder, file), secret);
        manifest.collections.push({ name: c.name, count: documents.length, file, sha256: hash(bytes) });
      }
      await session.commitTransaction();
    } finally { await session.endSession(); }
    stage = 'backup-storage';
    const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60000) }) } }).storage;
    for (const object of objects) {
      const { data, error } = await storage.from(object.bucket_id).download(object.name); if (error || !data) throw Error('Storage backup failed');
      const bytes = Buffer.from(await data.arrayBuffer()), file = `storage-${manifest.objects.length}.enc`;
      await encrypt(bytes, join(folder, file), secret); manifest.objects.push({ ...object, file, size: bytes.length, sha256: hash(bytes) });
    }
    manifest.completedAt = new Date().toISOString(); await encrypt(Buffer.from(JSON.stringify(manifest)), join(folder, 'manifest.enc'), secret);
    await writeFile(join(root, 'latest.json'), JSON.stringify({ folder }));
    console.log(JSON.stringify({ status: 'backup-complete', folder, tables: manifest.tables.length,
      collections: manifest.collections.length, objects: manifest.objects.length, encrypted: true }));
  } finally { await db.end().catch(() => {}); await mongo.close(); }
}
async function verify() {
  const folder = resolve(process.env.BACKUP_FOLDER ?? JSON.parse(await readFile(join(root, 'latest.json'))).folder);
  const secret = await key(), manifest = JSON.parse(await decrypt(join(folder, 'manifest.enc'), secret));
  if (manifest.format !== 'campuslink-backup-v1' || !manifest.completedAt) throw Error('Incomplete backup');
  const id = randomUUID().slice(0, 8), postgres = 'campuslink-restore-pg-' + id, mongoName = 'campuslink-restore-mongo-' + id;
  let pgStarted = false, mongoStarted = false, localMongo;
  try {
    stage = 'restore-start-postgres';
    await run(['run', '-d', '--name', postgres, '--label', 'campuslink.restore=true', '--network=none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:18.6']); pgStarted = true;
    for (let n = 0; ; n++) { try { await run(['exec', postgres, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); break; } catch { if (n === 60) throw Error('Restore PostgreSQL unavailable'); await new Promise(r => setTimeout(r, 500)); } }
    stage = 'restore-bootstrap';
    const roles = manifest.roles.map(r => `CREATE ROLE ${quote(r)} NOLOGIN;`).join('\n');
    await run(['exec', '-i', postgres, 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'], Buffer.from(roles + '\nDROP SCHEMA public; CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" SCHEMA extensions; CREATE EXTENSION pgcrypto SCHEMA extensions;'));
    stage = 'restore-pg-dump';
    await run(['exec', '-i', postgres, 'pg_restore', '-U', 'postgres', '-d', 'postgres', '--no-owner', '--no-acl', '--exit-on-error'], await decrypt(join(folder, 'postgres.enc'), secret));
    for (const table of manifest.tables) {
      const count = Number(await run(['exec', postgres, 'psql', '-XAt', '-U', 'postgres', '-c', `SELECT count(*) FROM ${quote(table.schema)}.${quote(table.name)}`]));
      if (count !== table.count) throw Error('PostgreSQL restore row-count mismatch');
    }
    stage = 'restore-mongo';
    const mongoPassword = randomBytes(24).toString('hex');
    await run(['run', '-d', '--name', mongoName, '--label', 'campuslink.restore=true', '-p', '127.0.0.1::27017',
      '-e', 'MONGO_INITDB_ROOT_USERNAME=campuslink_restore', '-e', 'MONGO_INITDB_ROOT_PASSWORD', 'mongo:8.0', '--bind_ip_all'],
    undefined, { MONGO_INITDB_ROOT_PASSWORD: mongoPassword }); mongoStarted = true;
    const binding = await run(['port', mongoName, '27017/tcp']), port = binding.split(':').at(-1);
    localMongo = new MongoClient(`mongodb://campuslink_restore:${mongoPassword}@127.0.0.1:${port}/?authSource=admin`, { serverSelectionTimeoutMS: 30000 }); await localMongo.connect();
    const db = localMongo.db('campuslink_restore');
    for (const collection of manifest.collections) {
      const bytes = await decrypt(join(folder, collection.file), secret); if (hash(bytes) !== collection.sha256) throw Error('Mongo archive checksum mismatch');
      const payload = BSON.EJSON.parse(bytes.toString(), { relaxed: false });
      await db.createCollection(payload.name, payload.options); const c = db.collection(payload.name);
      if (payload.documents.length) await c.insertMany(payload.documents);
      for (const index of payload.indexes.filter(i => i.name !== '_id_')) { const { key: keys, v, ns, ...options } = index; await c.createIndex(keys, options); }
      const restored = await c.find({}).toArray();
      const digest = docs => hash(Buffer.from(docs.map(d => BSON.EJSON.stringify(d, { relaxed: false })).sort().join('\n')));
      if (restored.length !== collection.count || digest(restored) !== digest(payload.documents)) throw Error('Mongo restore content mismatch');
    }
    // Recover every binary to an isolated encrypted restore copy and compare its exact bytes.
    // This tests file recovery; it does not claim to boot the complete Supabase platform locally.
    stage = 'restore-storage';
    const recovered = join(folder, 'restore-verified'); await mkdir(recovered, { recursive: true });
    for (const object of manifest.objects) {
      const bytes = await decrypt(join(folder, object.file), secret);
      if (bytes.length !== object.size || hash(bytes) !== object.sha256) throw Error('Storage restore checksum mismatch');
      const target = join(recovered, object.file);
      try { await stat(target); } catch { await encrypt(bytes, target, secret); }
      if (hash(await decrypt(target, secret)) !== object.sha256) throw Error('Recovered file mismatch');
    }
    const result = { status: 'restore-verified', at: new Date().toISOString(), tables: manifest.tables.length,
      rows: manifest.tables.reduce((n, t) => n + t.count, 0), collections: manifest.collections.length,
      documents: manifest.collections.reduce((n, c) => n + c.count, 0), files: manifest.objects.length,
      isolatedDatabases: true, storageBytesRecovered: true, fullSupabasePlatformBoot: false };
    await writeFile(join(folder, 'verification.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally {
    await localMongo?.close();
    if (mongoStarted) await run(['rm', '-f', '-v', mongoName]);
    if (pgStarted) await run(['rm', '-f', '-v', postgres]);
  }
}
try { if (process.argv[2] === 'verify') await verify(); else if (process.argv[2] === 'create') await backup(); else throw Error('Use create or verify'); }
catch (error) { console.error(JSON.stringify({ status: 'failed', stage, reason: /^(Docker|Backup|Incomplete|Invalid|PostgreSQL|Mongo|Storage|Recovered|Restore|Use)/.test(error.message) ? error.message : 'Backup operation unavailable; no provider data modified' })); process.exitCode = 1; }
