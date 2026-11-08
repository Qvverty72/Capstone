/**
 * Ciclo de vida de la API separado de Express para poder probarlo con dobles.
 * La composición predeterminada conecta MongoDB/Redis; PostgreSQL abre su pool
 * cuando las sondas o los repositorios lo necesitan.
 */
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
    // Reintenta hasta tres verificaciones de solo lectura antes de abrir HTTP.
    // Esperar más que el TTL permite que una respuesta fallida en caché expire.
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

/**
 * Deja de aceptar conexiones y drena los workers en paralelo antes de cerrar pools.
 * El bloque finally libera las dependencias incluso si falla el drenaje.
 * @param server Servidor previamente abierto por startApi.
 * @param drainWorkers Callback que espera la finalización de las tareas periódicas.
 * @returns Promesa que termina al liberar los recursos; propaga fallos de cierre.
 */
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
