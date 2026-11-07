// Read-only preflight: does not start Express, workers, migrations or seed data.
import 'dotenv/config';

let mongo, postgres, redis;
try {
  [mongo, postgres, redis] = await Promise.all([
    import('../dist/database/mongodb/client.js'), import('../dist/database/supabase/postgres.js'),
    import('../dist/database/redis/rate-limit.redis.js'),
  ]);
  await Promise.allSettled([mongo.connectMongoDB(), redis.connectRateLimitRedis()]);
  const { getDependencyReadiness } = await import('../dist/database/readiness.js');
  const result = await getDependencyReadiness();
  console.log(JSON.stringify(result));
  const { getReadiness } = await import('../dist/readiness.js');
  const modules = await getReadiness();
  console.log(JSON.stringify({ schemaReadiness: modules.status,
    modules: modules.modules.map(({ module, status }) => ({ module, status })) }));
  if (result.status !== 'ok' || modules.status !== 'ok') process.exitCode = 1;
} catch {
  console.error('Dependency preflight unavailable; check secure configuration and network access.');
  process.exitCode = 1;
} finally {
  await Promise.allSettled([mongo?.closeMongoDB(), postgres?.closePostgres(), redis?.closeRateLimitRedis()]);
}
