/**
 * Combinación paginada de dos historiales ya ordenados, sin conocer sus drivers.
 * Conserva precisión temporal mediante cadenas normalizadas y usa el ID como
 * desempate estable; no convierte instantes SQL a Date con pérdida de microsegundos.
 */
import type { AuditEntry } from '../types/access.types.js';
import type { PaginationParams } from '../../../shared/http/api.types.js';
import { createPaginatedResult } from '../../../shared/pagination/pagination.js';

const timestamp = (value: string) => value.replace(/\.(\d+)Z$/, (_, fraction: string) => '.' + fraction.padEnd(6, '0') + 'Z');
/** Orden total compartido: preserva los microsegundos SQL y los milisegundos Mongo. */
export function compareAuditEntries(a: AuditEntry, b: AuditEntry) {
  const left = timestamp(a.created_at), right = timestamp(b.created_at);
  return left === right ? (a.id === b.id ? 0 : a.id > b.id ? -1 : 1) : left > right ? -1 : 1;
}

type ReadPage = (limit: number, offset: number) => Promise<AuditEntry[]>;
/** Mezcla fuentes ordenadas en lotes acotados; no carga toda la historia de páginas anteriores. */
/**
 * Fusiona por comparación las cabeceras SQL/Mongo y descarta el offset solicitado.
 * Lee lotes de 100 y conserva limit + 1 para calcular si existe página siguiente.
 * La memoria queda acotada, aunque una página lejana aún requiere recorrer registros.
 * Parámetro: readSql Lector paginado ordenado de eventos relacionales.
 * Parámetro: readMongo Lector paginado ordenado de eventos documentales.
 * Devuelve: Página combinada con metadatos; no crea una instantánea común entre motores.
 */
export async function auditTimeline(pagination: PaginationParams, readSql: ReadPage, readMongo: ReadPage) {
  const batch = 100;
  const cursor = (read: ReadPage) => {
    let buffer: AuditEntry[] = [], offset = 0, end = false;
    return async () => {
      if (!buffer.length && !end) {
        buffer = await read(batch, offset); offset += buffer.length; end = buffer.length < batch;
      }
      return buffer.shift();
    };
  };
  const sql = cursor(readSql), mongo = cursor(readMongo);
  let [left, right] = await Promise.all([sql(), mongo()]);
  const rows: AuditEntry[] = [];
  let skipped = 0;
  while (left || right) {
    const takeSql = !!left && (!right || compareAuditEntries(left, right) <= 0);
    const row = takeSql ? left! : right!;
    if (skipped++ >= pagination.offset) rows.push(row);
    if (rows.length > pagination.limit) break;
    if (takeSql) left = await sql(); else right = await mongo();
  }
  return createPaginatedResult(rows, pagination);
}
