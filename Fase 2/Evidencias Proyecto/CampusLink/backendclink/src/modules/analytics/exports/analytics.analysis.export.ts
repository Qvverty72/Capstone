import type { AnalyticalReport } from '../types/analytics.types.js';
import type { ActivityAudienceMetrics } from '../types/analytics.analysis.types.js';

type Cell = string | number | null;
export interface AnalysisTable { name: string; title: string; headers: string[]; rows: Cell[][]; identityColumns: number }
const countsHeaders = ['Vistas', 'Inscripciones', 'Retiros', 'Personas que vieron', 'Participantes únicos', 'Participantes recurrentes',
  'Pares con vista', 'Pares convertidos', 'Conversión observada (%)', 'Recurrencia (%)', 'Eventos importados'];
const counts = (row: ActivityAudienceMetrics): Cell[] => [row.views, row.joins, row.withdrawals, row.uniqueViewers, row.uniqueParticipants,
  row.repeatParticipants, row.viewedPairs, row.convertedPairs, row.viewToJoinRate, row.repeatParticipantRate, row.legacyEvents];
export const activityTypeName = (type: string) => ({ COMMUNITY_ACTIVITY: 'Actividad comunitaria', OFFICIAL_EVENT: 'Evento oficial', UNCLASSIFIED: 'Sin tipo conservado' })[type] ?? type;

/** Proyecta exclusivamente el snapshot, incluidas tasas/denominadores ya calculados. */
export function savedAnalysisTables(report: AnalyticalReport): AnalysisTable[] {
  const sections = [{ key: 'total', label: 'Todo el rango', period: report.period, analysis: report.analysis },
    ...report.intervals.map(row => ({ ...row, analysis: row.metrics?.analysis }))].filter(row => row.analysis);
  if (!sections.length) return [];
  const base = ['Intervalo ID', 'Período', 'Desde', 'Hasta', 'Corte exclusivo'];
  const context = (row: typeof sections[number]): Cell[] => [row.key, row.label, row.period.from, row.period.to, row.period.cutoff];
  return [
    { name: 'Participacion', title: 'Participación observada', headers: [...base, ...countsHeaders], identityColumns: 0,
      rows: sections.map(row => [...context(row), ...counts(row.analysis!.activities.summary)]) },
    { name: 'Tipos actividad', title: 'Interés por tipo y categoría', headers: [...base, 'Tipo', 'Categoría', ...countsHeaders], identityColumns: 2,
      rows: sections.flatMap(row => row.analysis!.activities.segments.map(item => [...context(row), activityTypeName(item.type), item.category, ...counts(item)])) },
    { name: 'Carrera actividad', title: 'Carrera del participante por tipo y categoría',
      headers: [...base, 'Carrera ID', 'Carrera', 'Tipo', 'Categoría', ...countsHeaders, 'Participantes de la carrera (base)', 'Afinidad (%)'], identityColumns: 4,
      rows: sections.flatMap(row => row.analysis!.activities.careers.map(item => [...context(row), item.careerId, item.careerName,
        activityTypeName(item.type), item.category, ...counts(item), item.careerParticipants, item.participantShare])) },
    ...(['careers', 'subjects'] as const).map(dimension => ({ name: dimension === 'careers' ? 'Demanda carreras' : 'Demanda asignaturas',
      title: dimension === 'careers' ? 'Demanda de recursos por carrera' : 'Demanda de recursos por asignatura',
      headers: [...base, 'Clasificación ID', 'Clasificación', 'Vistas', 'Solicitudes', 'Recursos con demanda', 'Solicitantes únicos', 'Solicitudes por 100 vistas'], identityColumns: 2,
      rows: sections.flatMap(row => row.analysis!.resources[dimension].map(item => [...context(row), item.id, item.name, item.views,
        item.requests, item.resourcesWithDemand, item.uniqueRequesters, item.requestsPer100Views])) })),
  ];
}
