import type { Server } from 'node:http';
import { setTimeout as wait } from 'node:timers/promises';
import { app } from './app.js';
import { env } from './config/env.js';
import { closeMongoDB, connectMongoDB } from './database/mongodb/client.js';
import { closePostgres } from './database/supabase/postgres.js';
import { connectRateLimitRedis, closeRateLimitRedis } from './database/redis/rate-limit.redis.js';
import { getReadiness } from './readiness.js';
import type { ApiReadiness } from './shared/health/health.types.js';

interface BootstrapDependencies {
  connect: () => Promise<unknown>;
  verify: () => Promise<ApiReadiness>;
  close: () => Promise<void>;
  listen: () => Promise<Server>;
  wait?: (milliseconds: number) => Promise<void>;
}
const defaults: BootstrapDependencies = {
  connect: async () => { await Promise.all([connectMongoDB(), connectRateLimitRedis()]); },
  verify: getReadiness,
  close: async () => { await Promise.all([closeMongoDB(), closePostgres(), closeRateLimitRedis()]); },
  listen: () => new Promise((resolve, reject) => {
    const server = app.listen(env.port);
    server.once('error', reject);
    server.once('listening', () => resolve(server));
  }),
};

/**
 * Conecta las bases, comprueba las dependencias obligatorias y recién entonces abre el puerto.
 * Si una etapa falla, cierra las conexiones y sustituye el error para no exponer detalles.
 */
export async function startApi(dependencies: BootstrapDependencies = defaults): Promise<Server> {
  try {
    await dependencies.connect();
    // Fresh provider connections can fail transiently (observed on Supabase in Render).
    // Retry read-only probes, never opening HTTP until every dependency is ready.
    // Wait beyond the readiness cache TTL so a cached failure can expire.
    for (let attempt = 1; ; attempt++) {
      const readiness = await dependencies.verify();
      if (readiness.status === 'ok') break;
      if (attempt === 3) throw new Error('Required dependencies are unavailable');
      console.warn('Startup readiness unavailable; retrying verification');
      await (dependencies.wait ?? wait)(Math.max(1000, env.healthCacheTtlMs + 100));
    }
    return await dependencies.listen();
  } catch {
    await dependencies.close().catch(() => { console.error('Unable to close database connections after startup failure'); });
    throw new Error('API startup failed; check configuration and required dependencies');
  }
}

export async function stopApi(server: Server, drainWorkers: () => Promise<unknown> = async () => {}): Promise<void> {
  try {
    await Promise.all([new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      // Limita el cierre aunque algún cliente mantenga abierta una conexión HTTP.
      const timer = setTimeout(() => server.closeAllConnections(), env.databaseTimeoutMs);
      timer.unref();
      server.once('close', () => clearTimeout(timer));
    }), drainWorkers()]);
  } finally { await defaults.close(); }
}
