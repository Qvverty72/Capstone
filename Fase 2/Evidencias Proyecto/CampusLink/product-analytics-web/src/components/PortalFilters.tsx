import type { Dispatch, SetStateAction } from 'react';
import type { AgeBand, Filters, Source } from '../domain/types.ts';
import type { useLiveAnalytics } from '../data/useLiveAnalytics';
import { CAMPUSES, CAREERS, DEFAULT_FILTERS, GENDERS, GENDER_LABELS } from '../data/demo.ts';
import { livePresets } from '../data/liveFilters.ts';
import { Icon } from './Icon';

type LiveState = ReturnType<typeof useLiveAnalytics>;
export function PortalFilters({ source, filters, setFilters, bands, more, setMore, live }: {
  source: Source; filters: Filters; setFilters: Dispatch<SetStateAction<Filters>>; bands: AgeBand[]; more: boolean; setMore: Dispatch<SetStateAction<boolean>>; live: LiveState;
}) {
  const real = source === 'real', active = real ? live.filters : filters;
  const count = real ? Number(!!live.filters.campusId) + Number(!!live.filters.careerId) : [filters.institution, filters.campus, filters.career, filters.age, filters.gender].filter(Boolean).length;
  const updateDemo = (key: keyof Filters, value: string) => setFilters(f => ({ ...f, [key]: value, ...(key === 'institution' ? { campus: '' } : {}) }));
  const institution = live.options?.institutions.find(i => i.id === live.filters.institutionId);
  const presets = livePresets();
  const selectedPreset = presets.find(p => p.from === live.filters.from && p.to === live.filters.to)?.id ?? 'custom';
  const dateFields = <>
    <label><span>Desde (inclusive)</span><input aria-label="Desde" type="date" value={active.from} onChange={e => real ? live.setFilters(f => ({ ...f, from: e.target.value })) : updateDemo('from', e.target.value)} /></label>
    <label><span>Hasta (inclusive)</span><input aria-label="Hasta" type="date" value={active.to} onChange={e => real ? live.setFilters(f => ({ ...f, to: e.target.value })) : updateDemo('to', e.target.value)} /></label>
  </>;
  return <section className="filter-panel" aria-label="Filtros globales">
    <div className="filter-row">
      <label><span>Período</span>{real ? <select aria-label="Período" value={selectedPreset} onChange={e => { const preset = presets.find(p => p.id === e.target.value); if (preset) live.setFilters(f => ({ ...f, from: preset.from, to: preset.to })); else setMore(true); }}>{presets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}<option value="custom">Personalizado…</option></select>
        : <select aria-label="Período" value={filters.from === '2026-10-01' && filters.to === '2026-10-31' ? 'oct' : filters.from === '2026-09-01' && filters.to === '2026-09-30' ? 'sep' : filters.from === '2026-07-01' && filters.to === '2026-10-31' ? 'all' : 'custom'} onChange={e => { const ranges: Record<string, [string, string]> = { oct: ['2026-10-01', '2026-10-31'], sep: ['2026-09-01', '2026-09-30'], all: ['2026-07-01', '2026-10-31'] }; const range = ranges[e.target.value]; if (range) setFilters(f => ({ ...f, from: range[0], to: range[1] })); else setMore(true); }}><option value="oct">Octubre de 2026</option><option value="sep">Septiembre de 2026</option><option value="all">Julio – octubre de 2026</option><option value="custom">Personalizado…</option></select>}</label>
      <label><span>Institución</span>{real ? <select aria-label="Institución" disabled={!live.options} value={live.filters.institutionId} onChange={e => live.setFilters(f => ({ ...f, institutionId: e.target.value, campusId: '', careerId: '' }))}>{!live.options?.institutions.length && <option value="">Sin catálogo disponible</option>}{live.options?.institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
        : <select aria-label="Institución" value={filters.institution} onChange={e => updateDemo('institution', e.target.value)}><option value="">Todas las instituciones</option><option>Duoc UC</option><option>INACAP</option></select>}</label>
      <label><span>Campus</span>{real ? <select aria-label="Campus" disabled={!institution} value={live.filters.campusId} onChange={e => live.setFilters(f => ({ ...f, campusId: e.target.value, careerId: '' }))}><option value="">Todos los campus autorizados</option>{institution?.campuses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        : <select aria-label="Campus" value={filters.campus} onChange={e => updateDemo('campus', e.target.value)}><option value="">Todos los campus</option>{CAMPUSES.filter(c => !filters.institution || c.institution === filters.institution).map(c => <option key={c.name}>{c.name}</option>)}</select>}</label>
      <label className="career-filter"><span>Carrera</span>{real ? <select aria-label="Carrera" disabled={!institution} value={live.filters.careerId} onChange={e => live.setFilters(f => ({ ...f, careerId: e.target.value }))}><option value="">Todas las carreras del alcance</option>{institution?.careers.filter(c => !live.filters.campusId || c.campusIds.includes(live.filters.campusId)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        : <select aria-label="Carrera" value={filters.career} onChange={e => updateDemo('career', e.target.value)}><option value="">Todas las carreras</option>{CAREERS.map(c => <option key={c}>{c}</option>)}</select>}</label>
      <button className={`button filter-toggle ${more ? 'selected' : ''}`} onClick={() => setMore(!more)} aria-expanded={more} aria-controls="extra-filters"><Icon name="filter" size={16} />Más filtros{count > 0 && <span className="filter-count">{count}</span>}</button>
    </div>
    {more && <div id="extra-filters" className="extra-filters">{dateFields}{real ? <>
      <label><span>Agrupación</span><select aria-label="Agrupación" value={live.filters.grouping} onChange={e => live.setFilters(f => ({ ...f, grouping: e.target.value as 'week' | 'month' }))}><option value="week">Semanal</option><option value="month">Mensual</option></select></label>
      <label><span>Edad y género declarado</span><select disabled aria-label="Segmentación demográfica no disponible"><option>Sin agregados demográficos disponibles</option></select></label>
      <p className="filter-availability">El backend actual permite segmentar por institución, campus y carrera. Edad y género quedan disponibles únicamente en demostración hasta contar con agregados autorizados.</p>
    </> : <>
      <label><span>Rango de edad</span><select aria-label="Rango de edad" value={filters.age} onChange={e => updateDemo('age', e.target.value)}><option value="">Todas las edades</option>{bands.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}<option value="unknown">Sin información</option></select></label>
      <label><span>Género declarado</span><select aria-label="Género declarado" value={filters.gender} onChange={e => updateDemo('gender', e.target.value)}><option value="">Todos los géneros</option>{GENDERS.map(g => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}</select></label>
    </>}</div>}
    <div className="filter-summary"><span><Icon name="calendar" size={13} />{active.from} — {active.to}<span className="summary-divider">·</span>America/Santiago{count > 0 && <span className="scope-chip">{count} filtros aplicados</span>}</span><button className="text-button" onClick={() => real ? live.reset() : setFilters({ ...DEFAULT_FILTERS })}><Icon name="reset" size={13} />Limpiar filtros</button></div>
  </section>;
}
