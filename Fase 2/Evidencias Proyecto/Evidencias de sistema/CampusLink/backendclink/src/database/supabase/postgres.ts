/**
 * Acceso SQL con pg para operaciones que necesitan una misma transacción.
 * El pool se crea bajo demanda y limita concurrencia a cinco conexiones;
 * las conexiones remotas verifican TLS y las locales no fuerzan SSL.
 */
import { Pool, type PoolClient } from 'pg';
import { env } from '../../config/env.js';

let pool: Pool | undefined;
function getPool(): Pool {
  if (!env.supabaseDatabaseUrl) throw new Error('SUPABASE_DB_URL is required for profile updates');
  if (!pool) {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.supabaseDatabaseUrl).hostname);
    pool = new Pool({ connectionString: env.supabaseDatabaseUrl, max: 5,
      connectionTimeoutMillis: env.databaseTimeoutMs, query_timeout: env.databaseTimeoutMs + 1000, idleTimeoutMillis: 10000,
      ssl: local ? undefined : { rejectUnauthorized: true },
    });
    // Los errores del driver pueden contener datos de conexión; nunca se registran sin filtrar.
    pool.on('error', () => console.error('PostgreSQL connection unavailable'));
  }
  return pool;
}

/** Ejecuta la operación con timeouts locales y revierte cualquier error antes de liberar el cliente. */
/**
 * El callback recibe el mismo PoolClient durante toda la operación: los repositorios
 * que colaboren deben conservarlo para compartir locks y atomicidad SQL.
 * Parámetro: operation Caso de uso ejecutado entre BEGIN y COMMIT.
 * Devuelve: Resultado del callback; cualquier excepción provoca ROLLBACK y se propaga.
 * No incluye MongoDB ni Storage en la transacción.
 */
export async function withPostgresTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  let destroy = false;
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $1, true), set_config('idle_in_transaction_session_timeout', $1, true)", [String(env.databaseTimeoutMs)]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { destroy = true; }
    throw error;
  } finally { client.release(destroy); }
}

/** Cierra el pool actual y permite que una inicialización posterior cree uno nuevo. */
export async function closePostgres(): Promise<void> {
  const current = pool; pool = undefined;
  if (current) await current.end();
}
