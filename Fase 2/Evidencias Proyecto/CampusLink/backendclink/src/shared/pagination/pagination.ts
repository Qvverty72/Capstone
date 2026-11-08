/**
 * Paginación común por page/limit para rutas que usan desplazamiento.
 * Acepta cadenas enteras positivas, limita la página a un offset seguro y la cuota
 * a 100 filas; otros módulos usan cursores y no pasan por este contrato.
 */
import type {
  PaginationMeta,
  PaginationParams,
  ValidationResult,
} from '../http/api.types.js';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recibe un valor HTTP desconocido y devuelve entero o detalle de error.
 * Rechaza arrays, signos, decimales y valores fuera del rango seguro sin coerción permisiva.
 */
function parsePositiveInteger(
  value: unknown,
  field: 'page' | 'limit',
  max?: number,
): { value: number } | { issue: { field: string; message: string } } {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return { issue: { field, message: `${field} must be a positive integer.` } };
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return { issue: { field, message: `${field} must be a positive integer.` } };
  }

  if (max !== undefined && parsed > max) {
    return {
      issue: { field, message: `${field} must not exceed ${max}.` },
    };
  }

  return { value: parsed };
}

/** Analiza `page` y `limit`, aplica los valores públicos por defecto y calcula el desplazamiento seguro. */
export function parsePaginationQuery(
  input: unknown,
): ValidationResult<PaginationParams> {
  if (!isRecord(input)) {
    return {
      success: false,
      issues: [{ field: 'query', message: 'Query parameters must be an object.' }],
    };
  }

  const pageResult = input.page === undefined
    ? { value: DEFAULT_PAGE }
    : parsePositiveInteger(input.page, 'page');
  const limitResult = input.limit === undefined
    ? { value: DEFAULT_LIMIT }
    : parsePositiveInteger(input.limit, 'limit', MAX_LIMIT);

  if ('issue' in pageResult || 'issue' in limitResult) {
    const issues = [
      ...('issue' in pageResult ? [pageResult.issue] : []),
      ...('issue' in limitResult ? [limitResult.issue] : []),
    ];
    return { success: false, issues };
  }

  const page = pageResult.value;
  const limit = limitResult.value;
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(offset)) {
    return {
      success: false,
      issues: [{ field: 'page', message: 'page is too large for the selected limit.' }],
    };
  }

  return { success: true, data: { page, limit, offset } };
}

/** Recorta el resultado consultado con un elemento adicional y construye los metadatos de paginación. */
/**
 * El repositorio debe consultar limit + 1; la fila extra solo prueba hasMore.
 * @returns Copia limitada de los datos y metadatos de página, sin inventar un total.
 * Si se necesita total, el caso de uso debe obtenerlo mediante otra consulta.
 */
export function createPaginatedResult<T>(
  fetchedItems: readonly T[],
  pagination: PaginationParams,
): { data: T[]; meta: PaginationMeta } {
  return {
    data: fetchedItems.slice(0, pagination.limit),
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      hasMore: fetchedItems.length > pagination.limit,
    },
  };
}
