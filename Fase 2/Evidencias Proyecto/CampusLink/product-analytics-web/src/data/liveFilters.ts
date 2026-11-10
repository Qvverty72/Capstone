import type { LiveFilters, LiveOptions } from '../domain/types.ts';
import { dayAdd } from './demo.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function todayInSantiago(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (part: string) => parts.find(p => p.type === part)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function initialLiveFilters(now = new Date()): LiveFilters {
  const to = todayInSantiago(now);
  return { from: dayAdd(to, -29), to, institutionId: '', campusId: '', careerId: '', grouping: 'week' };
}
export function livePresets(now = new Date()): { id: string; label: string; from: string; to: string }[] {
  const today = todayInSantiago(now), month = today.slice(0, 7) + '-01', previousEnd = dayAdd(month, -1);
  return [
    { id: 'last30', label: 'Últimos 30 días', from: dayAdd(today, -29), to: today },
    { id: 'month', label: 'Este mes', from: month, to: today },
    { id: 'previous', label: 'Mes anterior', from: previousEnd.slice(0, 7) + '-01', to: previousEnd },
  ];
}
/** Los catálogos proceden del backend autorizado; no se inventan instituciones o campus. */
export function parseLiveOptions(input: unknown): LiveOptions {
  const fail = () => new Error('La API devolvió un catálogo analítico no válido.');
  const record = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(); return value as Record<string, unknown>; };
  const list = (value: unknown): unknown[] => { if (!Array.isArray(value) || value.length > 2000) throw fail(); return value; };
  const id = (value: unknown): string => { if (typeof value !== 'string' || !uuid.test(value)) throw fail(); return value; };
  const name = (value: unknown): string => { if (typeof value !== 'string' || !value.trim() || value.length > 250) throw fail(); return value; };
  return { institutions: list(record(input).institutions).map(item => { const institution = record(item);
    const campuses = list(institution.campuses).map(item => { const r = record(item); return { id: id(r.id), name: name(r.name) }; });
    const campusIds = new Set(campuses.map(c => c.id));
    const careers = list(institution.careers).map(item => { const r = record(item), scope = list(r.campusIds).map(id);
      if (scope.some(campus => !campusIds.has(campus))) throw fail();
      return { id: id(r.id), name: name(r.name), campusIds: scope }; });
    return { id: id(institution.id), name: name(institution.name), campuses, careers };
  }) };
}
export function dashboardQuery(filters: LiveFilters, options: LiveOptions): URLSearchParams {
  const institution = options.institutions.find(i => i.id === filters.institutionId);
  if (!institution) throw new Error('Selecciona una institución autorizada.');
  const campuses = institution.campuses.filter(c => !filters.campusId || c.id === filters.campusId);
  if (!campuses.length) throw new Error('No hay campus autorizados para esta selección.');
  if (filters.careerId && !institution.careers.some(c => c.id === filters.careerId && c.campusIds.some(id => campuses.some(campus => campus.id === id)))) throw new Error('La carrera no está disponible en los campus seleccionados.');
  return new URLSearchParams({ from: filters.from, to: filters.to, grouping: filters.grouping, institutionId: institution.id,
    campusIds: campuses.map(c => c.id).sort().join(','), ...(filters.careerId ? { careerId: filters.careerId } : {}) });
}
/** Una respuesta atrasada o con otro alcance nunca se muestra bajo los filtros actuales. */
export function assertDashboardScope(input: unknown, query: URLSearchParams): void {
  const fail = () => new Error('El alcance devuelto por la API no coincide con la consulta.');
  if (!input || typeof input !== 'object' || !('scope' in input) || !input.scope || typeof input.scope !== 'object') throw fail();
  const scope = input.scope as Record<string, unknown>;
  if (scope.institutionId !== query.get('institutionId') || !Array.isArray(scope.campuses)) throw fail();
  const actual = scope.campuses.map(c => { if (!c || typeof c !== 'object' || !('id' in c) || typeof c.id !== 'string') throw fail(); return c.id; }).sort().join(',');
  if (actual !== query.get('campusIds')) throw fail();
  const career = scope.career;
  if (query.has('careerId') ? !career || typeof career !== 'object' || !('id' in career) || career.id !== query.get('careerId') : career !== null) throw fail();
}
