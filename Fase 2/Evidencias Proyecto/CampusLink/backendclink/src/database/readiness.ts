import { env } from '../config/env.js';
import { getMongoDB } from './mongodb/client.js';
import { probePostgres } from './supabase/postgres.js';
import { probeRateLimitRedis } from './redis/rate-limit.redis.js';
import { probeSupabaseTables } from './supabase/health.js';
import { createReadinessCheck } from '../shared/health/readiness.js';

export const getDependencyReadiness = createReadinessCheck({
  mongodb: () => getMongoDB().command({ ping: 1 }, { timeoutMS: env.databaseTimeoutMs }),
  postgresql: probePostgres,
  redis: probeRateLimitRedis,
  supabase: () => probeSupabaseTables([{ table: 'campus' }]),
});
