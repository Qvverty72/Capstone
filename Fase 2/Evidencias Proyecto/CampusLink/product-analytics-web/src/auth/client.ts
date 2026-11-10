import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import type { PortalAssignment, PortalIdentity } from './types';

declare const process: { env: Partial<Record<'EXPO_PUBLIC_API_URL' | 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY', string>> };

export class PortalApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(status === 401 ? 'La sesión no es válida. Inicia sesión nuevamente.'
      : status === 403 ? 'Tu cuenta no tiene acceso a esta información.'
      : status === 429 ? 'Hay demasiadas solicitudes. Espera un momento antes de volver a intentar.'
      : 'No se pudo consultar el servicio. Intenta nuevamente.');
    this.name = 'PortalApiError';
    this.status = status;
  }
}

export class PortalConfigurationError extends Error {
  constructor() { super('Configura la URL de la API, la URL de Supabase y una clave pública válida para habilitar el acceso.'); this.name = 'PortalConfigurationError'; }
}

function publicUrl(value: string | undefined): string {
  try {
    const url = new URL(value?.trim() ?? '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.search) throw new Error();
    return url.toString().replace(/\/+$/, '');
  } catch { throw new PortalConfigurationError(); }
}

export function getPortalConfiguration() {
  const apiUrl = publicUrl(process.env.EXPO_PUBLIC_API_URL);
  const supabaseUrl = publicUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key || key.startsWith('sb_secret_')) throw new PortalConfigurationError();
  if (!key.startsWith('sb_publishable_')) {
    try {
      if (JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role !== 'anon') throw new Error();
    } catch { throw new PortalConfigurationError(); }
  }
  return { apiUrl, supabaseUrl, key };
}

let client: SupabaseClient | undefined;
/** Misma persistencia web predeterminada y bloqueo que el frontend de CampusLink. */
export function getPortalClient(): SupabaseClient {
  if (!client) {
    const config = getPortalConfiguration();
    client = createClient(config.supabaseUrl, config.key, { auth: {
      persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: processLock,
    } });
  }
  return client;
}

function allowedPath(path: string) {
  if (!path.startsWith('/api/v1/') || /[\\?#]/.test(path) || path.includes('..')) throw new Error('La ruta de la API no es válida.');
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  allowedPath(path);
  const { apiUrl } = getPortalConfiguration();
  let response: Response;
  try { response = await fetch(apiUrl + path, { ...init, cache: 'no-store', redirect: 'error' }); }
  catch (error) { if (init.signal?.aborted) throw error; throw new PortalApiError(503); }
  if (!response.ok) throw new PortalApiError(response.status);
  try {
    const envelope: unknown = await response.json();
    if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) throw new Error();
    return envelope.data;
  } catch { throw new PortalApiError(502); }
}

/** Solo GET relativo versionado. El bearer nunca se envía a destinos aportados por una respuesta. */
export async function portalGet<T>(path: string, query?: URLSearchParams, signal?: AbortSignal): Promise<T> {
  allowedPath(path);
  const supabase = getPortalClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new PortalApiError(401);
  const suffix = query?.toString();
  // La query se construye aparte; no relaja la frontera de rutas.
  const { apiUrl } = getPortalConfiguration();
  let response: Response;
  try {
    response = await fetch(apiUrl + path + (suffix ? '?' + suffix : ''), { method: 'GET',
      headers: { Authorization: 'Bearer ' + data.session.access_token }, signal, cache: 'no-store', redirect: 'error' });
  } catch (error) { if (signal?.aborted) throw error; throw new PortalApiError(503); }
  if (!response.ok) throw new PortalApiError(response.status);
  try {
    const envelope: unknown = await response.json();
    if (!envelope || typeof envelope !== 'object' || !('data' in envelope)) throw new Error();
    return envelope.data as T;
  } catch { throw new PortalApiError(502); }
}

/** Única operación de autenticación: delega en el endpoint actual, sin crear cuentas nuevas. */
export async function portalLogin(email: string, password: string): Promise<void> {
  const supabase = getPortalClient();
  const result = await request('/api/v1/auth/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) });
  const session = result && typeof result === 'object' && 'session' in result ? result.session : null;
  if (!session || typeof session !== 'object' || !('access_token' in session) || !('refresh_token' in session)
    || typeof session.access_token !== 'string' || typeof session.refresh_token !== 'string') throw new PortalApiError(502);
  const installed = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (installed.error || !installed.data.session) throw new PortalApiError(401);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PortalApiError(502);
  return value as Record<string, unknown>;
}
function string(value: unknown): string { if (typeof value !== 'string' || !value || value.length > 250) throw new PortalApiError(502); return value; }
function assignments(value: unknown): PortalAssignment[] {
  if (!Array.isArray(value) || value.length > 1000) throw new PortalApiError(502);
  return value.map(item => { const row = object(item); return { id: string(row.id), name: string(row.name), campusId: string(row.campusId) }; });
}

/** Valida identidad y omite datos personales que este portal no necesita conservar. */
export function parsePortalIdentity(value: unknown, userId: string): PortalIdentity {
  const raw = object(value), profile = object(raw.profile), capabilities = object(raw.capabilities);
  const state = string(profile.estado_cuenta);
  if (raw.userId !== userId || profile.id !== userId || !['ACTIVA', 'SUSPENDIDA', 'DESACTIVADA'].includes(state)
    || (profile.deleted_at !== null && typeof profile.deleted_at !== 'string')) throw new PortalApiError(403);
  const caps = ['general', 'officialActivities', 'analytics', 'reports'] as const;
  if (caps.some(key => typeof capabilities[key] !== 'boolean')) throw new PortalApiError(502);
  return { userId, campusId: string(raw.campusId), profile: { id: userId, institucion_id: string(profile.institucion_id),
    campus_id: string(profile.campus_id), estado_cuenta: state as PortalIdentity['profile']['estado_cuenta'], deleted_at: profile.deleted_at as string | null },
    roles: assignments(raw.roles), permissions: assignments(raw.permissions), capabilities: capabilities as PortalIdentity['capabilities'] };
}

export function canAccessPortal(identity: PortalIdentity): boolean {
  return identity.profile.estado_cuenta === 'ACTIVA' && !identity.profile.deleted_at && identity.roles.some(role =>
    role.name === 'ADMINISTRADOR' || role.name === 'USUARIO_AUTORIZADO' && identity.permissions.some(permission =>
      permission.campusId === role.campusId && permission.name === 'ACCEDER_REPORTERIA'));
}
