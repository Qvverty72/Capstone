import { Pool, type PoolClient } from 'pg';
import { env } from '../../config/env.js';

let pool: Pool | undefined;
function getPool(): Pool {
  if (!env.supabaseDatabaseUrl) throw new Error('SUPABASE_DB_URL is required for profile updates');
  if (!pool) {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.supabaseDatabaseUrl).hostname);
    pool = new Pool({ connectionString: env.supabaseDatabaseUrl, max: 5,
      connectionTimeoutMillis: env.databaseTimeoutMs, query_timeout: env.databaseTimeoutMs + 1000,
      statement_timeout: env.databaseTimeoutMs, idleTimeoutMillis: 10000,
      ssl: local ? undefined : { rejectUnauthorized: true },
    });
    // Los errores del driver pueden contener datos de conexión; nunca se registran sin filtrar.
    pool.on('error', () => console.error('PostgreSQL connection unavailable'));
  }
  return pool;
}

/** Uses the same verified TLS pool as business transactions; never changes data. */
export async function probePostgres(): Promise<void> {
  const client = await getPool().connect();
  let destroy = false;
  try { await client.query('SELECT 1'); }
  catch (error) { destroy = true; throw error; }
  finally { client.release(destroy); }
}

/** Ejecuta la operación con timeouts locales y revierte cualquier error antes de liberar el cliente. */
export async function withPostgresTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  let destroy = false;
  try {
    // Un solo viaje de red para abrir y limitar la transacción. El valor procede
    // de loadEnv (entero 100..60000), nunca de una petición ni de texto libre.
    const timeout = env.databaseTimeoutMs;
    await client.query(`BEGIN; SET LOCAL statement_timeout = ${timeout}; SET LOCAL lock_timeout = ${timeout}; SET LOCAL idle_in_transaction_session_timeout = ${timeout}`);
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
