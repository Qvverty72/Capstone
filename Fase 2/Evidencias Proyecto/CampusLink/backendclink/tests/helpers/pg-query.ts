import type { PGlite, Results } from '@electric-sql/pglite';

/** pg usa protocolo simple sin parámetros; PGlite.query siempre prepara una sentencia.
 * exec reproduce ese protocolo para probar también lotes BEGIN/SET LOCAL reales. */
export async function pgQuery<T = Record<string, unknown>>(db: PGlite, sql: string, values: unknown[] = []): Promise<Results<T>> {
  if (values.length) return db.query<T>(sql, values);
  const results = await db.exec(sql);
  const last = results.at(-1);
  if (!last) throw new Error('SQL sin resultado en el adaptador de pruebas');
  return last as Results<T>;
}
