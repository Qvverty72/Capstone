import type { Rank, RealAnalysis, RealAudience, RealDemand, RealSnapshot } from '../domain/types.ts';
import { validDate } from '../domain/analytics.ts';

const invalid = () => new Error('La API devolvió una respuesta analítica con un formato no válido.');
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown>; }
function text(value: unknown): string { if (typeof value !== 'string' || !value.trim() || value.length > 250) throw invalid(); return value; }
function integer(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw invalid(); return value; }
function timestamp(value: unknown): string { const s = text(value); if (!/^\d{4}-\d\d-\d\dT/.test(s) || !Number.isFinite(Date.parse(s))) throw invalid(); return s; }
function metric(value: unknown, field: string): number | null {
  const row = object(value); if (row.value === null) return null;
  integer(row.value); return integer(row[field]);
}
function rows(value: unknown, limit = 2000): unknown[] { if (!Array.isArray(value) || value.length > limit) throw invalid(); return value; }
function rate(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid();
  return value;
}
function audience(value: unknown): RealAudience {
  const r = object(value);
  return { views: integer(r.views), joins: integer(r.joins), withdrawals: integer(r.withdrawals),
    uniqueViewers: integer(r.uniqueViewers), uniqueParticipants: integer(r.uniqueParticipants), repeatParticipants: integer(r.repeatParticipants),
    viewedPairs: integer(r.viewedPairs), convertedPairs: integer(r.convertedPairs), viewToJoinRate: rate(r.viewToJoinRate),
    repeatParticipantRate: rate(r.repeatParticipantRate), legacyEvents: integer(r.legacyEvents) };
}
function demandRows(value: unknown): RealDemand[] {
  return rows(value).map(value => { const r = object(value);
    return { label: text(r.name), views: integer(r.views), requests: integer(r.requests), resources: integer(r.resourcesWithDemand),
      requesters: integer(r.uniqueRequesters), requestsPer100Views: rate(r.requestsPer100Views) }; });
}
function analysis(value: unknown): RealAnalysis | null {
  if (value == null) return null;
  const r = object(value), activities = object(r.activities), resources = object(r.resources);
  const segment = (value: unknown) => { const r = object(value); return { ...audience(r), type: text(r.type), category: r.category === null ? null : text(r.category) }; };
  return { activities: { summary: audience(activities.summary), segments: rows(activities.segments).map(segment),
    careers: rows(activities.careers).map(value => { const r = object(value); return { ...segment(r), label: text(r.careerName), careerParticipants: integer(r.careerParticipants), participantShare: rate(r.participantShare) }; }) },
    resources: { careers: demandRows(resources.careers), subjects: demandRows(resources.subjects) },
    definitions: rows(r.definitions, 100).map(value => { if (typeof value !== 'string' || value.length > 3000) throw invalid(); return value; }) };
}

/** Proyección del contrato existente por lista permitida. No conserva actores, autores ni perfiles. */
export function parseRealSnapshot(input: unknown): RealSnapshot {
  const envelope = object(input), data = object(envelope.data ?? envelope);
  const period = object(data.period), scope = object(data.scope);
  if (!validDate(period.from) || !validDate(period.to) || period.from > period.to) throw invalid();
  const timeZone = text(period.timeZone); if (timeZone !== 'America/Santiago') throw invalid();
  const resource = object(data.resourceDemand), participation = object(data.activityParticipation), demand = object(data.subjectDemand);
  if (!Array.isArray(demand.subjects) || demand.subjects.length > 1000 || !Array.isArray(data.intervals) || data.intervals.length > 400) throw invalid();
  const subjects: Rank[] = demand.subjects.map(item => { const row = object(item);
    return { label: text(row.subjectName), value: demand.value === null ? null : integer(row.requests), secondary: demand.value === null ? null : integer(row.views) }; });
  const campuses = scope.campuses;
  if (!Array.isArray(campuses) || !campuses.length || campuses.length > 200) throw invalid();
  const intervals = data.intervals.map(item => {
    const interval = object(item), p = object(interval.period);
    if (!validDate(p.from) || !validDate(p.to) || p.from > p.to || p.from < period.from! || p.to > period.to!) throw invalid();
    if (!['recorded', 'no_activity', 'unavailable'].includes(String(interval.status))) throw invalid();
    const metrics = interval.metrics === null ? null : object(interval.metrics);
    return { label: p.from.slice(8) + '/' + p.from.slice(5, 7),
      views: metrics ? metric(metrics.resourceDemand, 'views') : null,
      requests: metrics ? metric(metrics.resourceDemand, 'requests') : null,
      joined: metrics ? metric(metrics.activityParticipation, 'value') : null };
  });
  // activeUsers se omite deliberadamente: el contrato existente cuenta cuentas habilitadas.
  return { from: period.from, to: period.to, generatedAt: timestamp(data.generatedAt), cutoff: timestamp(period.cutoff), timeZone,
    institution: text(scope.institutionName), campus: campuses.map(c => text(object(c).name)).join(', '),
    career: scope.career === null ? null : text(object(scope.career).name),
    views: metric(resource, 'views'), requests: metric(resource, 'requests'), joined: metric(participation, 'value'),
    legacyEvents: integer(participation.legacyEvents), subjects, intervals, analysis: analysis(data.analysis),
    notes: data.notes === undefined ? [] : rows(data.notes, 100).map(value => { if (typeof value !== 'string' || value.length > 3000) throw invalid(); return value; }) };
}
