import { getSupabaseClient } from '@/features/auth/api/supabaseClient';

export interface AuthApiErrorDetail { field: string; message: string }

/** Error de cliente que conserva el estado HTTP y un mensaje acotado del servidor. */
export class AuthApiError extends Error {
  constructor(public readonly status: number, public readonly serverMessage?: string, public readonly code?: string,
    public readonly details: readonly AuthApiErrorDetail[] = []) {
    super(status === 401 ? 'La sesión no es válida.' : status === 403
      ? 'La cuenta no tiene acceso.' : 'No se pudo consultar la cuenta.');
  }
}

/** Presenta todos los campos rechazados, incluidos los términos que deben corregirse. */
export function apiFormErrorMessage(error: AuthApiError, fallback: string): string {
  const messages = [...new Set((error.details ?? []).map(detail => detail.message))];
  if (messages.length) return messages.join('\n');
  return error.serverMessage && error.serverMessage !== 'Request validation failed.' ? error.serverMessage : fallback;
}

/** Devuelve solo `data` del sobre estándar de una petición autenticada. */
export async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await authenticatedEnvelopeRequest<T>(path, init)).data;
}

/**
 * Adjunta el token vigente de Supabase y consulta una ruta relativa versionada.
 * La restricción de ruta evita enviar el bearer a hosts externos o a destinos
 * ambiguos; la autorización real del token corresponde al backend.
 */
export async function authenticatedEnvelopeRequest<T, Meta = never>(path: string, init: RequestInit = {}, query?: URLSearchParams): Promise<{ data: T; meta: Meta }> {
  const response = await authenticatedResponseRequest(path, init, query);
  return await response.json() as { data: T; meta: Meta };
}

/** Comparte sesión, frontera de URL y errores con respuestas binarias autenticadas. */
export async function authenticatedResponseRequest(path: string, init: RequestInit = {}, query?: URLSearchParams): Promise<Response> {
  // Solo rutas relativas de la API pueden recibir el token bearer.
  if (!path.startsWith('/api/v1/') || /[\\?#]/.test(path) || path.includes('..')) {
    throw new Error('A relative versioned API path is required');
  }
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_URL is required');
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase Auth is not configured');
  // El SDK restaura/renueva la sesión; solo el backend autoriza este token.
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new AuthApiError(401);
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + data.session.access_token);
  const search = query?.toString();
  const response = await fetch(baseUrl + path + (search ? '?' + search : ''), { ...init, headers, cache: 'no-store', redirect: 'error' });
  if (!response.ok) {
    let message: string | undefined;
    let code: string | undefined;
    let details: AuthApiErrorDetail[] = [];
    try {
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object'
        && body.error !== null && 'code' in body.error && typeof body.error.code === 'string'
        && /^[A-Z_]{1,64}$/.test(body.error.code)) code = body.error.code;
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object'
        && body.error !== null && 'message' in body.error && typeof body.error.message === 'string' && body.error.message.length <= 500) message = body.error.message;
      if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object'
        && body.error !== null && 'details' in body.error && Array.isArray(body.error.details)) {
        details = body.error.details.slice(0, 20).filter((detail): detail is AuthApiErrorDetail =>
          typeof detail === 'object' && detail !== null && typeof detail.field === 'string' && detail.field.length <= 120
          && typeof detail.message === 'string' && detail.message.trim().length > 0 && detail.message.length <= 500)
          .map(detail => ({ field: detail.field, message: detail.message }));
      }
    } catch { /* Si la respuesta no es JSON, se conserva de todos modos el estado HTTP. */ }
    throw new AuthApiError(response.status, message, code, details);
  }
  return response;
}
