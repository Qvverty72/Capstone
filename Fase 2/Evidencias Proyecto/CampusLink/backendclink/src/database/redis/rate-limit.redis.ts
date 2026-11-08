/**
 * Implementación distribuida del contrato RateLimitStore mediante Redis.
 * Conserva solo contadores temporales: no guarda usuarios ni recursos del dominio.
 * El script Lua une incremento y expiración para evitar carreras entre instancias.
 */
import { createClient } from 'redis';
import { env } from '../../config/env.js';
import type { RateLimitStore } from '../../shared/rate-limit/rate-limit.js';
import { withDeadline } from '../../shared/async/deadline.js';

// Un solo comando atómico: el reloj/TTL de Redis es común a todas las instancias.
export const consumeScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('PTTL', KEYS[1])}
`;

let client: ReturnType<typeof createClient> | undefined;
let connecting: Promise<unknown> | undefined;
/**
 * Reutiliza el cliente y la promesa de conexión para no abrir intentos simultáneos.
 * Sin URL no conecta; la política superior decide si puede usar memoria.
 * Devuelve: Promesa resuelta al estar listo; rechaza si Redis no queda disponible.
 */
export async function connectRateLimitRedis() {
  if (!env.rateLimitRedisUrl) return;
  if (!client) {
    client = createClient({ url: env.rateLimitRedisUrl, disableOfflineQueue: true, commandsQueueMaxLength: 1000,
      socket: { connectTimeout: env.databaseTimeoutMs,
        reconnectStrategy: retries => Math.min(2000, 100 * 2 ** Math.min(retries, 5)) } });
    // No registrar el error del proveedor: puede contener credenciales/origen.
    client.on('error', () => undefined);
  }
  if (!client.isOpen) {
    connecting ??= client.connect().finally(() => { connecting = undefined; });
  }
  if (connecting) await withDeadline(connecting);
  if (!client.isReady) throw new Error('Shared rate limit unavailable');
}

export async function probeRateLimitRedis(): Promise<void> {
  if (!client?.isReady) throw new Error('Shared rate limit unavailable');
  if (await client.ping() !== 'PONG') throw new Error('Shared rate limit unavailable');
}

export const redisRateLimitStore: RateLimitStore = {
/**
 * Consume una cuota y convierte el TTL de milisegundos a Retry-After en segundos.
 * Una respuesta Redis inesperada se rechaza en lugar de aceptar una cuota incierta.
 */
  async consume(key, windowSeconds) {
    await connectRateLimitRedis();
    if (!client?.isReady) throw new Error('Shared rate limit unavailable');
    const result = await withDeadline(client.eval(consumeScript, { keys: [key], arguments: [String(windowSeconds * 1000)] }));
    if (!Array.isArray(result) || result.length !== 2 || typeof result[0] !== 'number' || typeof result[1] !== 'number'
      || result[0] < 1 || result[1] < 0) throw new Error('Invalid rate counter');
    return { count: result[0], retryAfterSeconds: Math.max(1, Math.ceil(result[1] / 1000)) };
  },
};

/**
 * Destruye la conexión y borra su estado para permitir una inicialización posterior.
 * No borra claves ni modifica datos persistentes de los otros servicios.
 */
export async function closeRateLimitRedis() {
  if (client?.isOpen) client.destroy();
  client = undefined;
  connecting = undefined;
}
