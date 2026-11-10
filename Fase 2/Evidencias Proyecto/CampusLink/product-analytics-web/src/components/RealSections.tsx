import type { RealAudienceCareer, RealAudienceSegment, RealDemand, RealSnapshot, Section } from '../domain/types.ts';
import { suppressRanks } from '../domain/analytics.ts';
import { Bars, LineChart, number, percent } from './Charts';
import { Card, Empty, Metric, Notice } from './UI';

const typeLabel = (type: string) => ({ COMMUNITY_ACTIVITY: 'Actividad comunitaria', OFFICIAL_EVENT: 'Evento oficial', UNCLASSIFIED: 'Sin clasificación' }[type] ?? type);
const segmentLabel = (s: RealAudienceSegment) => `${typeLabel(s.type)} · ${s.category ?? 'Sin categoría'}`;
export function protectedDemand(rows: RealDemand[]) {
  return suppressRanks(rows.map(r => ({ label: r.label, value: r.requests, secondary: r.views, people: r.requesters })));
}
function protectedSegments(rows: RealAudienceSegment[]) {
  return suppressRanks(rows.map(s => ({ label: segmentLabel(s), value: s.joins, people: s.uniqueParticipants })));
}
export function protectedCareers(rows: RealAudienceCareer[]) {
  return suppressRanks(rows.map(s => ({ label: `${s.label} · ${segmentLabel(s)}`, value: s.participantShare, people: s.uniqueParticipants })));
}

export function RealSections({ section, snapshot: s }: { section: Section; snapshot: RealSnapshot }) {
  const a = s.analysis?.activities;
  if (section === 'profiles') return <>
    <Empty title="Perfiles demográficos no disponibles">El backend actual no entrega edades, género declarado ni población por segmento. Estas métricas requieren una consulta agregada adicional y permanecen pendientes de autorización; no se descargan perfiles individuales.</Empty>
    {a && <Card real title="Participación observada por carrera" subtitle="Afinidad entre participantes de actividades; no describe la población total de CampusLink"><Bars rates rows={protectedCareers(a.careers).slice(0, 12)} /><p className="card-footnote">Cada tasa usa como denominador las personas de esa carrera inscritas en cualquier actividad del período. Una persona puede participar en varias categorías y pertenecer a más de una carrera. No representa el porcentaje activo de todos los estudiantes.</p></Card>}
  </>;
  if (section === 'marketplace') return <Empty title="Embudo del marketplace no disponible">El endpoint actual combina recursos físicos y digitales. No expone las solicitudes enlazadas a reservas y transacciones, por lo que no permite construir el embudo físico ni sus tiempos de espera. Los agregados de recursos disponibles se muestran en resumen y demanda académica.</Empty>;
  if (section === 'retention') return <>
    <Notice title="Sin evidencia suficiente de uso global">La respuesta actual no permite deduplicar personas entre módulos, construir DAU/WAU/MAU ni observar cohortes de registro. El estado ACTIVA de una cuenta no demuestra uso y no se interpreta como sesión.</Notice>
    <div className="metrics-grid"><Metric label="DAU" value={null} icon="pulse" detail="No disponible: faltan actores por día" /><Metric label="WAU / MAU" value={null} icon="users" detail="No disponible: faltan ventanas deduplicadas" /><Metric label="Retención D7" value={null} icon="reset" detail="No disponible: faltan cohortes observables" /><Metric label="Retención D30" value={null} icon="calendar" detail="No disponible: faltan cohortes observables" /></div>
    {a && <Card real title="Recurrencia entre actividades" subtitle="Indicador disponible del módulo de comunidad; no equivale a retención de la plataforma"><div className="retention-pair"><div><strong>{percent(a.summary.repeatParticipantRate)}</strong><span>participantes en dos o más actividades</span></div><div><strong>{number(a.summary.repeatParticipants)}</strong><span>personas recurrentes en actividades</span></div></div><p className="card-footnote">Numerador: personas inscritas en al menos dos actividades distintas. Denominador: personas inscritas en actividades durante el mismo período. Reingresar a una actividad no cuenta como recurrencia entre actividades.</p></Card>}
  </>;
  return <>
    <Notice title="Datos reales · registros disponibles">{s.institution} · {s.campus}{s.career && ` · ${s.career}`} · {s.from} al {s.to}. Consulta autorizada al backend de CampusLink; los registros pueden tener cobertura histórica parcial.</Notice>
    {section === 'overview' && <>
      <div className="metrics-grid"><Metric label="Usuarios con actividad" value={null} icon="users" detail="Falta deduplicación entre módulos" /><Metric label="Vistas de recursos" value={s.views} icon="book" detail="Recursos físicos y digitales del alcance" /><Metric label="Solicitudes de recursos" value={s.requests} icon="bag" detail="Recursos físicos y digitales del alcance" /><Metric label="Inscripciones registradas" value={s.joined} icon="calendar" detail="Eventos de inscripción disponibles" /></div>
      <div className="chart-grid equal"><Card real title="Interacciones con recursos" subtitle="Vistas y solicitudes por intervalo; no son personas únicas"><LineChart title="Vistas y solicitudes reales" labels={s.intervals.map(r => r.label)} series={[{ label: 'Vistas', values: s.intervals.map(r => r.views), color: '#002E56' }, { label: 'Solicitudes', values: s.intervals.map(r => r.requests), color: '#B47A09', dashed: true }]} /></Card><Card real title="Participación en actividades" subtitle="Inscripciones registradas en cada intervalo"><LineChart title="Inscripciones reales" labels={s.intervals.map(r => r.label)} series={[{ label: 'Inscripciones', values: s.intervals.map(r => r.joined), color: '#002E56' }]} /></Card></div>
      {a && <div className="metrics-grid"><Metric label="Participantes en actividades" value={a.summary.uniqueParticipants} icon="users" detail="Personas únicas en todo el período" /><Metric label="Personas que consultaron actividades" value={a.summary.uniqueViewers} icon="pulse" detail="Personas con vistas registradas" /><Metric label="Retiros de actividades" value={a.summary.withdrawals} icon="reset" detail="Eventos LEFT; no cancela inscripciones pasadas" /><Metric label="Recurrencia entre actividades" value={a.summary.repeatParticipantRate} unit="%" icon="calendar" detail="Personas inscritas en al menos dos actividades" /></div>}
      <Notice kind="warning">Los registros no permiten calcular todos los indicadores del prototipo. Los valores ausentes permanecen como no disponibles. Fecha de consulta: {new Date(s.generatedAt).toLocaleString('es-CL', { timeZone: s.timeZone })}.</Notice>
    </>}
    {section === 'demand' && <>
      {s.analysis ? <div className="chart-grid equal"><Card real title="Demanda por asignatura" subtitle="Solicitudes y vistas de recursos asociados"><Bars rows={protectedDemand(s.analysis.resources.subjects).slice(0, 12)} secondary /><DemandFootnote /></Card><Card real title="Demanda por carrera del recurso" subtitle="Clasificación del recurso, no carrera del solicitante"><Bars rows={protectedDemand(s.analysis.resources.careers).slice(0, 12)} secondary /><DemandFootnote /></Card></div>
        : <Card real title="Demanda por asignatura" subtitle="El análisis ampliado no está disponible en esta respuesta"><p className="muted">El agregado de asignaturas no incluye personas distintas, por lo que no se habilita el desglose de grupos sin ese denominador.</p></Card>}
      <Card real title="Solicitudes de recursos en el tiempo" subtitle="Recursos físicos y digitales; períodos originales del backend"><LineChart title="Demanda real de recursos" labels={s.intervals.map(r => r.label)} series={[{ label: 'Solicitudes', values: s.intervals.map(r => r.requests), color: '#002E56' }]} /></Card>
      <Notice>La demanda observada no demuestra falta de oferta ni necesidad insatisfecha. No se calculan conclusiones de escasez a partir de estos conteos.</Notice>
    </>}
    {section === 'community' && <>
      <div className="metrics-grid"><Metric label="Inscripciones registradas" value={a?.summary.joins ?? s.joined} icon="calendar" detail="Eventos JOINED; incluye reingresos" /><Metric label="Participantes únicos" value={a?.summary.uniqueParticipants ?? null} icon="users" detail="Personas deduplicadas en todo el período" /><Metric label="Retiros registrados" value={a?.summary.withdrawals ?? null} icon="reset" detail="Eventos LEFT del período" /><Metric label="Vistas de actividades" value={a?.summary.views ?? null} icon="book" detail="Eventos de consulta registrados" /></div>
      <Card real title="Inscripciones a través del tiempo" subtitle="Los valores nulos indican información no disponible"><LineChart title="Inscripciones reales" labels={s.intervals.map(r => r.label)} series={[{ label: 'Inscripciones', values: s.intervals.map(r => r.joined), color: '#002E56' }]} /></Card>
      {a && <><div className="chart-grid equal"><Card real title="Tipos y categorías de actividades" subtitle="Inscripciones por clasificación disponible"><Bars rows={protectedSegments(a.segments).slice(0, 12)} /><p className="card-footnote">Se protegen grupos con menos de 10 participantes y una celda adicional cuando corresponde. Categorías actuales; «Sin categoría» conserva información faltante.</p></Card><Card real title="Afinidad por carrera" subtitle="Participación relativa dentro de los participantes de cada carrera"><Bars rates rows={protectedCareers(a.careers).slice(0, 12)} /><p className="card-footnote">Denominador: participantes de la carrera en cualquier actividad del rango. Personas y carreras pueden superponerse.</p></Card></div><Notice>Conversión observada de vista a inscripción: {percent(a.summary.viewToJoinRate)}. Se calcula sobre pares persona–actividad con vistas; el numerador exige una inscripción no importada posterior a una vista dentro del período. No representa asistencia ni atribución causal.</Notice></>}
      <Notice>La respuesta informa {number(s.legacyEvents)} eventos con procedencia heredada. Pueden reflejar estados importados y no prueban el momento histórico real de una inscripción. Las actividades publicadas y la asistencia confirmada no están disponibles en este contrato.</Notice>
    </>}
    {s.notes.length > 0 && <details className="coverage-details"><summary>Definiciones y cobertura informadas por el backend</summary><ul>{[...s.notes, ...(s.analysis?.definitions ?? [])].map((note, i) => <li key={i}>{note}</li>)}</ul></details>}
  </>;
}
function DemandFootnote() { return <p className="card-footnote">Se protegen grupos con menos de 10 solicitantes únicos y se aplica supresión complementaria. Un recurso puede tener varias asociaciones; no sumar filas como si fueran exclusivas.</p>; }
