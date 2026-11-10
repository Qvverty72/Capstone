import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { canAccessPortal, getPortalClient, parsePortalIdentity, portalGet, portalLogin, PortalApiError, PortalConfigurationError } from './client';
import type { PortalAuthContext, PortalIdentity } from './types';
import './auth.css';

const AuthContext = createContext<PortalAuthContext | null>(null);
export function usePortalAuth(): PortalAuthContext {
  const context = useContext(AuthContext);
  if (!context) throw new Error('El portal requiere una identidad autorizada.');
  return context;
}
type Status = 'loading' | 'signedOut' | 'ready' | 'forbidden' | 'error' | 'unconfigured';

/** Ninguna vista ni consulta analítica se monta antes de confirmar identidad y permisos. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null), [identity, setIdentity] = useState<PortalIdentity | null>(null);
  const [status, setStatus] = useState<Status>('loading'), [restored, setRestored] = useState(false);
  const [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const validatedUser = useRef<string | null>(null);
  const currentUser = useRef<string | null>(null), pendingIdentity = useRef<AbortController | null>(null);
  const revalidate = useCallback(() => setRevision(value => value + 1), []);
  const signOut = useCallback(async () => {
    try {
      const result = await getPortalClient().auth.signOut({ scope: 'local' });
      if (result.error) throw new Error();
      validatedUser.current = null; setIdentity(null); setSession(null); setStatus('signedOut'); setError('');
    } catch { setError('No se pudo cerrar la sesión. Revisa la conexión e intenta nuevamente.'); }
  }, []);

  useEffect(() => {
    let supabase;
    try { supabase = getPortalClient(); }
    catch (cause) { setStatus('unconfigured'); setError(cause instanceof PortalConfigurationError ? cause.message : 'La configuración del acceso no es válida.'); return; }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      pendingIdentity.current?.abort();
      currentUser.current = next?.user.id ?? null;
      if (next?.user.id !== validatedUser.current) { validatedUser.current = null; setIdentity(null); setStatus(next ? 'loading' : 'signedOut'); }
      setSession(next); setRestored(true); setRevision(value => value + 1);
    });
    const visible = () => { if (document.visibilityState === 'visible') revalidate(); };
    document.addEventListener('visibilitychange', visible);
    return () => { subscription.unsubscribe(); document.removeEventListener('visibilitychange', visible); };
  }, [revalidate]);

  useEffect(() => {
    if (!restored) return;
    if (!session) { setIdentity(null); setStatus('signedOut'); return; }
    const abort = new AbortController();
    pendingIdentity.current = abort;
    const timeout = window.setTimeout(() => {
      if (abort.signal.aborted || currentUser.current !== session.user.id) return;
      abort.abort(); validatedUser.current = null; setIdentity(null); setStatus('error');
      setError('La comprobación de acceso tardó demasiado. Intenta nuevamente.');
    }, 15000);
    if (validatedUser.current !== session.user.id) setStatus('loading');
    void portalGet<unknown>('/api/v1/auth/me', undefined, abort.signal).then(raw => {
      if (abort.signal.aborted || currentUser.current !== session.user.id) return;
      const next = parsePortalIdentity(raw, session.user.id);
      if (!canAccessPortal(next)) throw new PortalApiError(403);
      validatedUser.current = next.userId; setIdentity(next); setStatus('ready'); setError('');
    }).catch(cause => {
      if (abort.signal.aborted || currentUser.current !== session.user.id) return;
      validatedUser.current = null; setIdentity(null);
      setStatus(cause instanceof PortalApiError && cause.status === 401 ? 'signedOut' : cause instanceof PortalApiError && cause.status === 403 ? 'forbidden' : 'error');
      setError(cause instanceof PortalApiError ? cause.message : 'No se pudo verificar tu acceso. Intenta nuevamente.');
    }).finally(() => window.clearTimeout(timeout));
    return () => { abort.abort(); window.clearTimeout(timeout); if (pendingIdentity.current === abort) pendingIdentity.current = null; };
  }, [session, restored, revision]);

  if (status === 'ready' && identity) return <AuthContext.Provider value={{ identity, signOut, revalidate }}>{error && <div className="portal-session-warning" role="alert">{error}</div>}{children}</AuthContext.Provider>;
  return <div className="portal-auth-shell"><div className="portal-auth-brand">Campus<span>Link</span><small>ANALÍTICA DE PRODUCTO</small></div><section className="portal-auth-card" aria-busy={status === 'loading'}>
    {status === 'signedOut' ? <LoginForm initialError={error} />
      : status === 'loading' ? <><div className="portal-auth-loader" aria-hidden="true" /><h1>Verificando acceso</h1><p role="status">Restaurando tu sesión y comprobando los permisos de CampusLink.</p></>
      : status === 'unconfigured' ? <><span className="portal-auth-label">ACCESO PENDIENTE</span><h1>Configuración pendiente</h1><p role="alert">{error}</p><p>El portal necesita las variables públicas del mismo entorno de CampusLink. No se muestran datos hasta configurar y validar el acceso.</p></>
      : status === 'forbidden' ? <><span className="portal-auth-label">ACCESO RESTRINGIDO</span><h1>Acceso no autorizado</h1><p>Tu cuenta no tiene permisos vigentes para consultar reportería en ningún campus autorizado.</p><p>Si necesitas acceso, contacta a la administración de CampusLink.</p><div className="portal-auth-actions"><button className="button primary" onClick={revalidate}>Comprobar nuevamente</button><button className="button secondary" onClick={() => { void signOut(); }}>Cerrar sesión</button></div>{error && <p className="portal-auth-error" role="alert">{error}</p>}</>
      : <><span className="portal-auth-label">SERVICIO NO DISPONIBLE</span><h1>No pudimos verificar tu acceso</h1><p role="alert">{error}</p><div className="portal-auth-actions"><button className="button primary" onClick={revalidate}>Reintentar</button><button className="button secondary" onClick={() => { void signOut(); }}>Cerrar sesión</button></div></>}
  </section><p className="portal-auth-footnote">Acceso con tu cuenta de CampusLink. Los permisos se comprueban en el servidor.</p></div>;
}

function LoginForm({ initialError }: { initialError: string }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(initialError);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { await portalLogin(email, password); }
    catch (cause) { setError(cause instanceof PortalApiError ? cause.status === 401 || cause.status === 400 ? 'No se pudo iniciar sesión. Revisa tus credenciales y la verificación del correo.' : cause.message : 'No se pudo iniciar sesión. Intenta nuevamente.'); }
    finally { setPassword(''); setBusy(false); }
  }
  return <><span className="portal-auth-label">TU COMUNIDAD, CON CONTEXTO</span><h1>Iniciar sesión</h1><p>Accede a la analítica de producto con tu cuenta de CampusLink y sus permisos vigentes.</p><form onSubmit={event => { void submit(event); }} aria-busy={busy}>
    <label><span>Email institucional</span><input name="email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
    <label><span>Contraseña</span><input name="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
    {error && <p className="portal-auth-error" role="alert">{error}</p>}<button className="button primary" disabled={busy} type="submit">{busy ? 'Validando acceso…' : 'Iniciar sesión'}</button>
  </form><p className="portal-auth-help">Usa las credenciales de la aplicación. La administración de CampusLink gestiona los permisos de acceso a reportería.</p></>;
}
