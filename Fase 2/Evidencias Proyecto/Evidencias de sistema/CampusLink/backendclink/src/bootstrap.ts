/**
 * Ciclo de vida de la API separado de Express para poder probarlo con dobles.
 * La composición predeterminada conecta MongoDB/Redis y comprueba los módulos;
 * PostgreSQL crea su pool cuando un repositorio solicita una transacción.
 */
import type { Server } from 'node:http';
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
    const readiness = await dependencies.verify();
    if (readiness.status !== 'ok') throw new Error('Required dependencies are unavailable');
    return await dependencies.listen();
  } catch {
    await dependencies.close().catch(() => { console.error('Unable to close database connections after startup failure'); });
    throw new Error('API startup failed; check configuration and required dependencies');
  }
}

/**
 * Deja de aceptar conexiones y espera el cierre HTTP antes de liberar los pools.
 * El servidor llamante detiene sus workers antes de invocar esta función.
 * El bloque finally cierra dependencias incluso si falla el cierre del servidor.
 * Parámetro: server Servidor previamente abierto por startApi.
 * Devuelve: Promesa que finaliza al liberar recursos; propaga los errores de cierre.
 */
export async function stopApi(server: Server): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      // Limita el cierre aunque algún cliente mantenga abierta una conexión HTTP.
      const timer = setTimeout(() => server.closeAllConnections(), env.databaseTimeoutMs);
      timer.unref();
      server.once('close', () => clearTimeout(timer));
    });
  } finally { await defaults.close(); }
}
