// Additive repair of the two map invariants from the legacy bootstrap, without running that bootstrap.
// Default is read-only. --apply creates indexes only after bounded duplicate checks succeed.
import 'dotenv/config';
import { connectMongoDB, closeMongoDB } from '../dist/database/mongodb/client.js';

const required = [
  { name: 'campus_version_uq', key: { campusId: 1, version: 1 } },
  { name: 'one_active_map_per_campus', key: { campusId: 1 }, partialFilterExpression: { status: 'ACTIVE' } },
];
try {
  const db = await connectMongoDB();
  if (!(await db.listCollections({ name: 'campus_maps' }, { nameOnly: true }).toArray()).length) throw Error();
  const maps = db.collection('campus_maps');
  const existing = await maps.listIndexes().toArray();
  const missing = required.filter(spec => !existing.some(index => index.unique === true
    && JSON.stringify(index.key) === JSON.stringify(spec.key)
    && JSON.stringify(index.partialFilterExpression) === JSON.stringify(spec.partialFilterExpression)));
  // Check all constraints before making any schema change. Index creation also rejects a concurrent duplicate.
  for (const spec of missing) {
    const pipeline = spec.partialFilterExpression ? [{ $match: spec.partialFilterExpression }] : [];
    pipeline.push({ $group: { _id: Object.fromEntries(Object.keys(spec.key).map(key => [key, '$' + key])), count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }, { $limit: 1 });
    if ((await maps.aggregate(pipeline, { maxTimeMS: 5000 }).toArray()).length) {
      console.error('Map index repair blocked by duplicate keys; no records deleted or changed.');
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) {
    if (process.argv.includes('--apply')) {
      for (const { key, ...options } of missing) await maps.createIndex(key, { ...options, unique: true, maxTimeMS: 60000 });
      console.log(JSON.stringify({ status: 'ok', indexesCreated: missing.length }));
    } else console.log(JSON.stringify({ mode: 'read-only', missingIndexes: missing.map(index => index.name), duplicateChecks: 'ok' }));
  }
} catch {
  console.error('Map index verification or creation unavailable; no data cleanup attempted.');
  process.exitCode = 1;
} finally { await closeMongoDB(); }
