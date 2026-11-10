import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LiveFilters, LiveOptions, RealSnapshot } from '../domain/types.ts';
import { DEFAULT_FILTERS } from './demo.ts';
import { validateFilters } from '../domain/analytics.ts';
import { parseRealSnapshot } from './realSnapshot.ts';
import { assertDashboardScope, dashboardQuery, initialLiveFilters, parseLiveOptions } from './liveFilters.ts';
import { portalGet, PortalApiError } from '../auth/client';
import { usePortalAuth } from '../auth/AuthGate';

/** Solo GET existentes. Cada respuesta queda vinculada a identidad, fuente y filtros. */
export function useLiveAnalytics(enabled: boolean) {
  const { identity, revalidate } = usePortalAuth();
  const [filters, setFilters] = useState<LiveFilters>(initialLiveFilters);
  const [options, setOptions] = useState<LiveOptions | null>(null);
  const [snapshot, setSnapshot] = useState<{ key: string; data: RealSnapshot } | null>(null);
  const [error, setError] = useState(''), [optionsLoading, setOptionsLoading] = useState(false), [loading, setLoading] = useState(false);
  const [optionsRevision, setOptionsRevision] = useState(0);
  const identityKey = JSON.stringify([identity.userId, identity.profile.institucion_id, identity.profile.campus_id, identity.roles, identity.permissions]);
  const [optionsKey, setOptionsKey] = useState('');
  const currentOptions = optionsKey === identityKey ? options : null;
  const validation = validateFilters({ ...DEFAULT_FILTERS, from: filters.from, to: filters.to });
  const query = useMemo(() => { if (!currentOptions || validation) return null; try { return dashboardQuery(filters, currentOptions).toString(); } catch { return null; } }, [filters, currentOptions, validation]);
  const queryKey = identityKey + '|' + query;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController(); let disposed = false;
    setOptionsLoading(true); setOptions(null); setOptionsKey(''); setSnapshot(null); setError('');
    const timeout = window.setTimeout(() => { controller.abort(); if (!disposed) { setOptionsLoading(false); setError('La consulta de catálogos tardó demasiado. Vuelve a intentarlo.'); } }, 20000);
    void portalGet<unknown>('/api/v1/analytics/options', undefined, controller.signal).then(raw => {
      if (disposed || controller.signal.aborted) return;
      const next = parseLiveOptions(raw);
      setOptions(next); setOptionsKey(identityKey);
      setFilters(previous => {
        const institution = next.institutions.find(i => i.id === previous.institutionId) ?? next.institutions.find(i => i.id === identity.profile.institucion_id) ?? next.institutions[0];
        if (!institution) return previous;
        const campus = institution.campuses.find(c => c.id === previous.campusId) ?? institution.campuses.find(c => c.id === identity.profile.campus_id) ?? institution.campuses[0];
        return { ...previous, institutionId: institution.id, campusId: campus?.id ?? '', careerId: '' };
      });
    }).catch(reason => {
      if (disposed || controller.signal.aborted) return;
      setError(reason instanceof PortalApiError && reason.status === 403 ? 'La cuenta no tiene campus habilitados para consultar analítica.' : 'No se pudieron consultar los catálogos autorizados.');
      if (reason instanceof PortalApiError && [401, 403].includes(reason.status)) revalidate();
    }).finally(() => { window.clearTimeout(timeout); if (!disposed) setOptionsLoading(false); });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [enabled, identityKey, optionsRevision]);

  useEffect(() => {
    setSnapshot(null);
    if (!enabled || !query || !currentOptions) { setLoading(false); return; }
    const controller = new AbortController(); let disposed = false;
    setLoading(true); setError('');
    const timeout = window.setTimeout(() => { controller.abort(); if (!disposed) { setLoading(false); setError('La consulta analítica tardó demasiado. Vuelve a intentarlo.'); } }, 20000);
    void portalGet<unknown>('/api/v1/analytics/dashboard', new URLSearchParams(query), controller.signal).then(raw => {
      if (disposed || controller.signal.aborted) return;
      assertDashboardScope(raw, new URLSearchParams(query));
      const data = parseRealSnapshot(raw);
      // No presentar un agregado que corresponda a otras fechas o a otro alcance.
      if (data.from !== filters.from || data.to !== filters.to) throw new Error('El período devuelto no coincide con la consulta.');
      setSnapshot({ key: queryKey, data });
    }).catch(reason => {
      if (disposed || controller.signal.aborted) return;
      setError(reason instanceof PortalApiError && reason.status === 403 ? 'El servidor denegó el acceso a este alcance. Actualiza los campus autorizados.'
        : reason instanceof PortalApiError && reason.status === 401 ? 'La sesión dejó de ser válida. Vuelve a iniciar sesión.' : reason instanceof Error && !(reason instanceof PortalApiError) ? reason.message : 'No se pudo consultar el servicio analítico.');
      if (reason instanceof PortalApiError && [401, 403].includes(reason.status)) revalidate();
    }).finally(() => { window.clearTimeout(timeout); if (!disposed) setLoading(false); });
    return () => { disposed = true; controller.abort(); window.clearTimeout(timeout); };
  }, [enabled, queryKey, currentOptions]);

  // El alcance puede quedar obsoleto sin que cambie la identidad (por ejemplo, un campus inactivo).
  // Reintentar siempre revalida catálogos antes de volver a consultar métricas.
  const retry = useCallback(() => { setError(''); setSnapshot(null); setOptionsRevision(r => r + 1); }, []);
  const reset = useCallback(() => { const institution = currentOptions?.institutions.find(i => i.id === identity.profile.institucion_id) ?? currentOptions?.institutions[0];
    setFilters({ ...initialLiveFilters(), institutionId: institution?.id ?? '', campusId: institution?.campuses.find(c => c.id === identity.profile.campus_id)?.id ?? institution?.campuses[0]?.id ?? '' });
  }, [currentOptions, identity.profile.institucion_id, identity.profile.campus_id]);
  return { filters, setFilters, options: currentOptions, snapshot: enabled && snapshot?.key === queryKey ? snapshot.data : null,
    error, validation, loading: enabled && (optionsLoading || loading), retry, reset };
}
