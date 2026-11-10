import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgeBand, Filters, Section, Source } from './domain/types.ts';
import { DEFAULT_BANDS, DEFAULT_FILTERS, DEMO_DATA, GENDER_LABELS } from './data/demo.ts';
import { calculateDemo, makeAgeBands, validateFilters } from './domain/analytics.ts';
import { useLiveAnalytics } from './data/useLiveAnalytics';
import { usePortalAuth } from './auth/AuthGate';
import { Badge, Dialog, Empty, Notice } from './components/UI';
import { Icon } from './components/Icon';
import { DemoSections } from './components/Sections';
import { protectedDemand, RealSections } from './components/RealSections';
import { PortalFilters } from './components/PortalFilters';

const SECTIONS: { id: Section; label: string; icon: string; description: string }[] = [
  { id: 'overview', label: 'Resumen general', icon: 'grid', description: 'Una mirada al crecimiento, la participación y los hábitos de tu comunidad.' },
  { id: 'profiles', label: 'Perfil de usuarios', icon: 'users', description: 'Conoce quiénes participan y compara su comportamiento con contexto.' },
  { id: 'retention', label: 'Uso y retención', icon: 'pulse', description: 'Entiende cómo se utiliza CampusLink y cuántas personas regresan.' },
  { id: 'marketplace', label: 'Marketplace', icon: 'bag', description: 'Sigue el recorrido de los recursos, desde la solicitud hasta el intercambio.' },
  { id: 'demand', label: 'Demanda académica', icon: 'book', description: 'Explora las necesidades que se reflejan en las solicitudes de material.' },
  { id: 'community', label: 'Actividades y comunidad', icon: 'calendar', description: 'Descubre qué iniciativas conectan a la comunidad estudiantil.' },
];
const currentSection = (): Section => SECTIONS.find(s => s.id === window.location.hash.slice(1))?.id ?? 'overview';
function csvValue(value: unknown) { let text = String(value ?? 'No disponible'); if (/^\s*[=+@\-\t\r]/.test(text)) text = "'" + text; return `"${text.replaceAll('"', '""')}"`; }

export default function App() {
  const { signOut } = usePortalAuth();
  const [section, setSection] = useState<Section>(currentSection), [source, setSource] = useState<Source>('real');
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS }), [bands, setBands] = useState<AgeBand[]>(DEFAULT_BANDS);
  const [more, setMore] = useState(false), [modal, setModal] = useState<'method' | 'bands' | null>(null), [toast, setToast] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const active = SECTIONS.find(s => s.id === section)!;
  const live = useLiveAnalytics(source === 'real');
  const error = validateFilters(filters), outsideCoverage = filters.from < DEMO_DATA.from || filters.to > DEMO_DATA.to;
  const result = useMemo(() => source === 'demo' && !error && !outsideCoverage ? calculateDemo(DEMO_DATA, filters, bands) : null, [source, filters, bands, error, outsideCoverage]);
  const snapshot = source === 'real' ? live.snapshot : null;
  const canExport = source === 'demo' ? result?.status === 'ready' : !!snapshot && ['overview', 'demand', 'community'].includes(section);

  useEffect(() => { const onHash = () => setSection(currentSection()); window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, []);
  useEffect(() => { document.title = `${active.label} · Analítica CampusLink`; }, [active.label]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 4000); return () => window.clearTimeout(timeout); }, [toast]);
  function navigate(id: Section) { setSection(id); window.location.hash = id; window.scrollTo({ top: 0, behavior: 'instant' }); window.setTimeout(() => headingRef.current?.focus(), 0); }
  function exportCsv() {
    const rows: unknown[][] = [['CampusLink · Analítica de producto'], ['Fuente', source === 'demo' ? 'DATOS FICTICIOS DE DEMOSTRACIÓN' : 'DATOS REALES · API CampusLink'], ['Sección', active.label]];
    if (source === 'demo' && result?.status === 'ready') {
      rows.push(['Período', filters.from, filters.to], ['Institución', filters.institution || 'Todas'], ['Campus', filters.campus || 'Todos'], ['Carrera', filters.career || 'Todas'], ['Edad', bands.find(b => b.id === filters.age)?.label || (filters.age === 'unknown' ? 'Sin información' : 'Todas')], ['Género declarado', GENDER_LABELS[filters.gender] || 'Todos']);
      if (section === 'overview') rows.push(['Indicador', 'Valor'], ['Registrados', result.population], ['Con actividad', result.active], ['Nuevos', result.newUsers], ['Interacciones', result.interactions]);
      if (section === 'profiles') { rows.push(['Segmento', 'Personas', 'Con actividad (%)', 'Marketplace (%)', 'Actividades (%)']); result.groups.career.forEach(g => rows.push([g.label, g.total, g.rate, g.marketplace, g.community])); }
      if (section === 'retention') rows.push(['Indicador', 'Valor'], ['DAU', result.dau], ['WAU', result.wau], ['MAU', result.mau], ['Retención D7 (%)', result.d7], ['Retención D30 (%)', result.d30]);
      if (section === 'marketplace') { rows.push(['Etapa de cohorte', 'Solicitudes']); result.market.funnel.forEach(r => rows.push([r.label, r.value])); }
      if (section === 'demand') { rows.push(['Asignatura', 'Solicitudes']); result.demand.subjects.forEach(r => rows.push([r.label, r.value])); }
      if (section === 'community') { rows.push(['Actividad', 'Inscripciones']); result.community.activities.forEach(r => rows.push([r.label, r.value])); }
    } else if (source === 'real' && snapshot && canExport) {
      rows.push(['Período', snapshot.from, snapshot.to], ['Institución', snapshot.institution], ['Campus', snapshot.campus], ['Carrera', snapshot.career ?? 'Todas en el alcance'], ['Agrupación', live.filters.grouping], ['Generado', snapshot.generatedAt], ['Cobertura', 'Registros disponibles; histórica parcial']);
      if (section === 'overview') rows.push(['Indicador', 'Valor'], ['Vistas de recursos', snapshot.views], ['Solicitudes de recursos', snapshot.requests], ['Inscripciones', snapshot.joined]);
      if (section === 'demand') { rows.push(['Asignatura', 'Solicitudes', 'Vistas']); if (snapshot.analysis) protectedDemand(snapshot.analysis.resources.subjects).forEach(r => rows.push([r.label, r.value, r.secondary])); }
      if (section === 'community') rows.push(['Indicador', 'Valor'], ['Inscripciones', snapshot.joined], ['Participantes únicos', snapshot.analysis?.activities.summary.uniqueParticipants], ['Retiros', snapshot.analysis?.activities.summary.withdrawals], ['Eventos heredados', snapshot.legacyEvents]);
    } else return;
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csvValue).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `campuslink-${source}-${section}.csv`; link.click(); URL.revokeObjectURL(url); setToast('CSV agregado exportado con su fuente y alcance.');
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }}>Saltar al contenido</a>
    <aside className="sidebar" aria-label="Analítica de producto">
      <div className="brand"><span className="brand-symbol"><Icon name="cap" size={27} /></span><span>Campus<span className="brand-link">Link</span><small>CONEXIONES QUE TRANSFORMAN</small></span></div>
      <div className="workspace-label"><span className="workspace-mark"><Icon name="chart" size={17} /></span><div>Analítica de producto<small>PORTAL WEB INDEPENDIENTE</small></div></div>
      <div className="nav-caption">EXPLORAR ANALÍTICA</div>
      <nav>{SECTIONS.map(item => <a key={item.id} href={`#${item.id}`} aria-label={item.label} title={item.label} onClick={e => { e.preventDefault(); navigate(item.id); }} className={section === item.id ? 'nav-item active' : 'nav-item'} aria-current={section === item.id ? 'page' : undefined}><Icon name={item.icon} size={19} /><span>{item.label}</span>{section === item.id && <span className="nav-active-dot" />}</a>)}</nav>
      <div className="sidebar-bottom"><div className="privacy-note"><Icon name="shield" size={21} /><strong>Datos con responsabilidad</strong><p>Información agregada para entender a la comunidad y cuidar su privacidad.</p><button onClick={() => setModal('method')}>Conocer la metodología <Icon name="right" size={14} /></button></div><div className="sidebar-version"><span className="status-dot" />Prueba de integración<span>v0.2</span></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">CampusLink <Icon name="right" size={12} /><span>Analítica de producto</span></div><div className="topbar-right"><span className="evaluation-label"><span className="status-dot" />Acceso autorizado</span><button className="text-button" onClick={() => { void signOut(); }}>Cerrar sesión</button></div></header>
      <main id="main-content" tabIndex={-1}>
        <div className="page-heading"><div><span className="eyebrow">{section === 'overview' ? 'ENTIENDE TU COMUNIDAD' : 'ANALÍTICA DE PRODUCTO'}</span><h1 ref={headingRef} tabIndex={-1}>{active.label}</h1><p>{active.description}</p></div><div className="heading-actions"><button className="icon-button" title="Metodología y definiciones" aria-label="Metodología y definiciones" onClick={() => setModal('method')}><Icon name="help" /></button><button className="button secondary" onClick={exportCsv} disabled={!canExport}><Icon name="download" size={16} />Exportar CSV</button></div></div>
        <div className={`source-banner ${source === 'real' ? 'imported' : ''}`}><div className="source-banner-copy"><span className="source-icon"><Icon name={source === 'demo' ? 'info' : 'shield'} size={19} /></span><div><strong>{source === 'demo' ? 'Estás explorando datos de demostración' : 'Datos reales de CampusLink'}</strong><p>{source === 'demo' ? 'Las cifras son ficticias y permiten evaluar la experiencia. No representan resultados reales de CampusLink.' : 'Consulta del backend con tu sesión y permisos. Los indicadores sin evidencia permanecen como no disponibles.'}</p></div></div><label className="source-select"><span className="sr-only">Fuente de datos</span><select aria-label="Fuente de datos" value={source} onChange={e => { setSource(e.target.value as Source); setToast(''); }}><option value="real">Datos reales</option><option value="demo">Demostración</option></select></label></div>
        <PortalFilters source={source} filters={filters} setFilters={setFilters} bands={bands} more={more} setMore={setMore} live={live} />
        <div className="section-meta"><span>{source === 'demo' ? 'Escenario de evaluación · julio–octubre 2026' : snapshot ? `Actualizado: ${new Date(snapshot.generatedAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}` : 'Alcance confirmado por los permisos de tu cuenta'}</span><Badge real={source === 'real'}>{source === 'demo' ? 'Datos ficticios' : 'Datos reales'}</Badge></div>
        <div className="section-content" key={section + source}>
          {source === 'demo' ? error ? <Empty title="Revisa el período seleccionado">{error}</Empty> : outsideCoverage ? <Empty title="Información insuficiente para este período">El escenario cubre del 1 de julio al 31 de octubre de 2026. Un período fuera de esa cobertura no se representa con ceros.<button className="button secondary" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Volver al escenario</button></Empty>
            : result?.status === 'suppressed' ? <Empty title="Segmento protegido por privacidad" icon="shield">La selección contiene menos de 10 personas. Amplía los filtros para consultar resultados agregados.</Empty>
            : result?.status === 'empty' ? <Empty title="Sin actividad registrada para esta selección">No hay interacciones en este período y alcance. Amplía el rango o limpia los filtros para explorar el escenario.<button className="button secondary" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>Limpiar filtros</button></Empty>
            : result && <DemoSections section={section} data={result} filters={filters} onNavigate={navigate} onConfigure={() => setModal('bands')} />
            : live.validation ? <Empty title="Revisa el período seleccionado">{live.validation}</Empty>
            : live.error ? <Empty title="No se pudieron cargar los datos reales">{live.error}<button className="button secondary" onClick={live.retry}>Reintentar</button></Empty>
            : snapshot ? <RealSections section={section} snapshot={snapshot} />
            : live.options && !live.options.institutions.length ? <Empty title="Sin campus autorizados">La cuenta no tiene un alcance analítico disponible. Solicita la revisión de tus permisos de reportería.</Empty>
            : <div className="loading-state" role="status"><div className="skeleton" /><div className="skeleton" /><p>Consultando los datos reales del alcance autorizado…</p></div>}
        </div>
        <footer className="page-footer"><span><Icon name="shield" size={13} />Datos agregados. Sin información personal identificable en los indicadores.</span><button className="text-button" onClick={() => setModal('method')}>Definiciones y cobertura <Icon name="right" size={12} /></button></footer>
      </main>
    </div>
    {modal === 'method' && <Dialog title="Metodología y cobertura" onClose={() => setModal(null)}><Methodology /><button className="button primary" onClick={() => setModal(null)}>Entendido</button></Dialog>}
    {modal === 'bands' && <Dialog title="Configurar rangos de edad" onClose={() => setModal(null)}><BandEditor bands={bands} onApply={next => { setBands(next); setModal(null); }} /></Dialog>}
    {toast && <div className="toast" role="status"><Icon name="check" size={17} />{toast}</div>}
  </div>;
}

function BandEditor({ bands, onApply }: { bands: AgeBand[]; onApply: (b: AgeBand[]) => void }) {
  const [cuts, setCuts] = useState(bands.slice(0, 3).map(b => b.max)), [error, setError] = useState('');
  return <form onSubmit={e => { e.preventDefault(); try { onApply(makeAgeBands(cuts)); } catch (err) { setError((err as Error).message); } }}><p>Define el límite superior de los tres primeros rangos. El último agrupa las edades restantes hasta 120 años. Las edades sin información se mantienen separadas.</p><div className="band-fields">{cuts.map((n, i) => <label key={i}><span>Límite del rango {i + 1}</span><input type="number" min="18" max="100" value={n} onChange={e => setCuts(cuts.map((v, j) => j === i ? Number(e.target.value) : v))} required /></label>)}</div>{error && <p className="error-message" role="alert">{error}</p>}<Notice>Los rangos cambian únicamente el escenario de demostración. No modifican los datos reales ni las bases de datos.</Notice><button className="button primary" type="submit">Aplicar rangos</button></form>;
}
function Methodology() { return <div className="methodology"><Notice title="Datos reales por defecto">Este portal usa la autenticación y los endpoints existentes de CampusLink. La demostración se activa únicamente mediante el selector; los errores de red o permisos no activan datos ficticios.</Notice><dl>
  <dt>Fuentes y permisos</dt><dd>GET /api/v1/analytics/options y GET /api/v1/analytics/dashboard. El backend valida institución, campus y permisos de reportería. La identidad se confirma con /auth/me antes de consultar analítica. La sesión del navegador se comparte con CampusLink cuando ambos se sirven en el mismo origen y usan la misma configuración pública de Supabase.</dd>
  <dt>Cobertura real</dt><dd>Se presentan vistas y solicitudes de recursos, inscripciones y, cuando existe análisis ampliado, participantes, retiros, recurrencia y desgloses por carrera/categoría. Las asociaciones de carrera son las actuales y pueden ser múltiples. El estado ACTIVA de cuenta se descarta como medida de uso.</dd>
  <dt>Indicadores aún no disponibles</dt><dd>Perfiles demográficos, DAU/WAU/MAU globales, cohortes y retención D7/D30, y embudo físico no están expuestos por los endpoints actuales. Se muestran como no disponibles. Sus propuestas de backend no se han implementado.</dd>
  <dt>Privacidad</dt><dd>Los gráficos de segmentos protegen grupos con menos de 10 personas y aplican supresión complementaria. Esta protección de presentación no reemplaza una política de privacidad aplicada en el servidor. No se descargan perfiles individuales para construir demografía.</dd>
  <dt>Escenario de demostración</dt><dd>Cubre julio–octubre de 2026 con perfiles y eventos completamente ficticios. Usuarios activos son personas con al menos un evento; DAU/WAU/MAU usan ventanas de 1/7/30 días. Retención D7/D30 usa actividad exactamente en ese día sobre registros con seguimiento suficiente.</dd>
  <dt>Embudo de demostración</dt><dd>Sigue una misma cohorte de solicitudes: solicitud → reserva → intercambio completado. Los porcentajes usan la base de solicitudes y la etapa anterior. Las vistas se muestran aparte porque no existe atribución verificable.</dd>
  <dt>Interpretación de actividades</dt><dd>Inscripciones y retiros son eventos; reingresos pueden generar nuevas inscripciones. Participantes únicos no equivalen a asistencia. Recurrencia entre actividades no equivale a retención de usuarios de la plataforma. Se conserva la advertencia sobre registros LEGACY_STATE.</dd>
  </dl></div>; }
