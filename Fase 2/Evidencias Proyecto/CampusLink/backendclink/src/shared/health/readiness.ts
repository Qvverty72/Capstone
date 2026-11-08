import { env } from '../../config/env.js';
import { withDeadline } from '../async/deadline.js';

export type ReadinessStatus = 'ok' | 'unavailable';
export type DependencyName = 'mongodb' | 'postgresql' | 'redis' | 'supabase';
export interface DependencyReadiness {
  status: ReadinessStatus;
  dependencies: Record<DependencyName, ReadinessStatus>;
}
export type ReadinessProbes = Record<DependencyName, () => Promise<unknown>>;

/**
 * Construye una consulta de disponibilidad con TTL y deduplicación de solicitudes.
 * Recibe sondas de solo lectura y devuelve una función que agrega sus estados.
 * El timeout deja de esperar, pero una operación aún pendiente conserva su lugar:
 * así una dependencia bloqueada no acumula nuevas sondas en cada petición.
 */
export function createReadinessCheck(probes: ReadinessProbes, {
  timeoutMs = env.databaseTimeoutMs, ttlMs = env.healthCacheTtlMs, now = Date.now,
} = {}): () => Promise<DependencyReadiness> {
  let cached: DependencyReadiness | undefined;
  let expiresAt = 0;
  let pending: Promise<DependencyReadiness> | undefined;
  const operations = new Map<DependencyName, Promise<unknown>>();
  return () => {
/**
 * Los consumidores concurrentes comparten el mismo resultado en vuelo.
 * Al terminar se cachea el estado completo, incluidos fallos, durante el TTL.
 */
    if (pending) return pending;
    if (cached && now() < expiresAt) return Promise.resolve(cached);
    pending = Promise.all((Object.keys(probes) as DependencyName[]).map(async name => {
      let operation = operations.get(name);
      if (!operation) {
        operation = Promise.resolve().then(probes[name]).finally(() => { operations.delete(name); });
        operations.set(name, operation);
      }
      try { await withDeadline(operation, timeoutMs); return [name, 'ok'] as const; }
      catch { return [name, 'unavailable'] as const; }
    })).then(entries => {
      const dependencies = Object.fromEntries(entries) as DependencyReadiness['dependencies'];
      cached = { status: entries.every(([, status]) => status === 'ok') ? 'ok' : 'unavailable', dependencies };
      expiresAt = now() + ttlMs;
      return cached;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}
