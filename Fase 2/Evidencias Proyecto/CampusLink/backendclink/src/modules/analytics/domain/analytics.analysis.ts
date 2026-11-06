import type { ActivityAudienceFact, ActivityAudienceMetrics, AudienceCareer, DashboardAnalysis } from '../types/analytics.analysis.types.js';

export const ANALYSIS_DEFINITIONS = [
  'Interés observado: vistas e inscripciones registradas; no mide preferencias declaradas ni asistencia presencial. El creador también se inscribe al publicar.',
  'Conversión observada = pares persona-actividad con una inscripción no importada posterior a su primera vista dentro del período / pares persona-actividad con vistas en el mismo período × 100. Sin vistas, la tasa no está disponible. No atribuye causalidad ni cuenta inscripciones sin vista previa.',
  'Recurrencia = personas inscritas en al menos dos actividades distintas / personas inscritas × 100 dentro del período. Reinscribirse en la misma actividad no es recurrencia.',
  'Afinidad por carrera = participantes únicos de la carrera en un tipo/categoría / participantes únicos de esa carrera en cualquier actividad del período × 100. Las categorías pueden compartir personas y no suman necesariamente 100%.',
  'Carreras del participante y tipo/categoría de actividad son los disponibles al generar. Personas con varias carreras cuentan una vez dentro de cada carrera; no sumar carreras, categorías o períodos para obtener personas únicas. Sin carrera incluye perfiles sin asociación vigente o sin perfil conservado.',
  'Demanda académica clasifica el recurso por sus carreras/asignaturas, no al solicitante. Recursos con varias asociaciones aparecen en cada una. Recursos con demanda = publicaciones distintas con alguna vista o solicitud en el período.',
  'Solicitudes por 100 vistas = solicitudes / vistas × 100. Es una razón de eventos, puede superar 100 y no es conversión de personas. Sin vistas no hay razón disponible. Solicitantes únicos no se suman entre filas o períodos.',
  'Retiros cuenta eventos LEFT ocurridos en el período; no representa una tasa de abandono ni resta inscripciones. Eventos importados y captura histórica parcial se conservan sin inventar hechos.',
];

export const percentage = (numerator: number, denominator: number) => denominator > 0 ? Math.round(numerator / denominator * 10000) / 100 : null;

function metrics(facts: ActivityAudienceFact[]): ActivityAudienceMetrics {
  const viewers = new Set<string>(), participants = new Map<string, Set<string>>();
  const pairs = new Map<string, { viewed: number | null; joined: number | null }>();
  let views = 0, joins = 0, withdrawals = 0, legacyEvents = 0;
  for (const fact of facts) {
    views += fact.views; joins += fact.joins; withdrawals += fact.withdrawals; legacyEvents += fact.legacyEvents;
    if (fact.views) viewers.add(fact.userId);
    if (fact.joins) {
      const activities = participants.get(fact.userId) ?? new Set<string>();
      activities.add(fact.activityId); participants.set(fact.userId, activities);
    }
    const key = `${fact.userId}:${fact.activityId}`, pair = pairs.get(key) ?? { viewed: null, joined: null };
    if (fact.firstViewedAt) pair.viewed = Math.min(pair.viewed ?? Infinity, new Date(fact.firstViewedAt).getTime());
    if (fact.lastLiveJoinedAt) pair.joined = Math.max(pair.joined ?? -Infinity, new Date(fact.lastLiveJoinedAt).getTime());
    pairs.set(key, pair);
  }
  const viewedPairs = [...pairs.values()].filter(pair => pair.viewed !== null).length;
  const convertedPairs = [...pairs.values()].filter(pair => pair.viewed !== null && pair.joined !== null && pair.joined > pair.viewed).length;
  const repeatParticipants = [...participants.values()].filter(activities => activities.size >= 2).length;
  return { views, joins, withdrawals, uniqueViewers: viewers.size, uniqueParticipants: participants.size, repeatParticipants,
    viewedPairs, convertedPairs, viewToJoinRate: percentage(convertedPairs, viewedPairs),
    repeatParticipantRate: percentage(repeatParticipants, participants.size), legacyEvents };
}

/** Deduplica personas en todo el rango; nunca suma únicos de semanas/meses. */
export function analyzeActivityAudience(facts: ActivityAudienceFact[], careers: AudienceCareer[], careerId: string | null): DashboardAnalysis['activities'] {
  const affiliations = new Map<string, Map<string, AudienceCareer>>();
  for (const career of careers) {
    const rows = affiliations.get(career.userId) ?? new Map<string, AudienceCareer>();
    if (!careerId || career.careerId === careerId) rows.set(career.careerId, career);
    affiliations.set(career.userId, rows);
  }
  const segments = new Map<string, ActivityAudienceFact[]>(), groups = new Map<string, { careerId: string | null; careerName: string; facts: ActivityAudienceFact[] }>();
  const careerParticipants = new Map<string | null, Set<string>>();
  for (const fact of facts) {
    const key = JSON.stringify([fact.type, fact.category]);
    const rows = segments.get(key) ?? []; rows.push(fact); segments.set(key, rows);
    const associated = [...(affiliations.get(fact.userId)?.values() ?? [])];
    const memberships = associated.length ? associated : careerId ? [] : [{ careerId: null, careerName: 'Sin carrera' }];
    for (const career of memberships) {
      const groupKey = JSON.stringify([career.careerId, key]);
      const group = groups.get(groupKey) ?? { ...career, facts: [] };
      group.facts.push(fact); groups.set(groupKey, group);
      if (fact.joins) {
        const users = careerParticipants.get(career.careerId) ?? new Set<string>();
        users.add(fact.userId); careerParticipants.set(career.careerId, users);
      }
    }
  }
  const segment = (rows: ActivityAudienceFact[]) => ({ type: rows[0].type, category: rows[0].category, ...metrics(rows) });
  const ranked = <T extends ActivityAudienceMetrics>(a: T, b: T) => b.uniqueParticipants - a.uniqueParticipants || b.uniqueViewers - a.uniqueViewers;
  return { summary: metrics(facts), segments: [...segments.values()].map(segment).sort((a, b) => ranked(a, b) || a.type.localeCompare(b.type) || (a.category ?? '').localeCompare(b.category ?? '')),
    careers: [...groups.values()].map(group => {
      const row = segment(group.facts), total = careerParticipants.get(group.careerId)?.size ?? 0;
      return { ...row, careerId: group.careerId, careerName: group.careerName, careerParticipants: total,
        participantShare: percentage(row.uniqueParticipants, total) };
    }).sort((a, b) => ranked(a, b) || a.careerName.localeCompare(b.careerName) || a.type.localeCompare(b.type) || (a.category ?? '').localeCompare(b.category ?? '')) };
}
