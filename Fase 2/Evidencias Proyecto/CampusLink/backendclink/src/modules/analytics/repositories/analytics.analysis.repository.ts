import type { PoolClient } from 'pg';
import type { AcademicDemand, AudienceCareer } from '../types/analytics.analysis.types.js';
import type { AnalyticsWindow } from '../domain/analytics.periods.js';
import type { DashboardGrouping } from '../types/analytics.types.js';
import { percentage } from '../domain/analytics.analysis.js';
import { ANALYTICS_TIME_ZONE } from '../domain/analytics.periods.js';

/** Se ejecuta después del match autorizado y temporal de activity_interactions. */
export function audiencePipeline(grouping: DashboardGrouping) {
  const is = (type: string) => ({ $eq: ['$type', type] });
  const liveJoin = { $and: [is('JOINED'), { $ne: ['$provenance', 'LEGACY_STATE'] }] };
  return [
    { $group: {
      _id: { userId: '$userId', activityId: '$activityId', campusId: '$campusId', period: { $dateToString: {
        format: '%Y-%m-%d', timezone: ANALYTICS_TIME_ZONE,
        date: { $dateTrunc: { date: '$occurredAt', unit: grouping, timezone: ANALYTICS_TIME_ZONE, ...(grouping === 'week' ? { startOfWeek: 'monday' } : {}) } },
      } } },
      views: { $sum: { $cond: [is('VIEWED'), 1, 0] } }, joins: { $sum: { $cond: [is('JOINED'), 1, 0] } },
      withdrawals: { $sum: { $cond: [is('LEFT'), 1, 0] } },
      legacyEvents: { $sum: { $cond: [{ $eq: ['$provenance', 'LEGACY_STATE'] }, 1, 0] } },
      firstViewedAt: { $min: { $cond: [is('VIEWED'), '$occurredAt', new Date('9999-12-31T00:00:00Z')] } },
      lastLiveJoinedAt: { $max: { $cond: [liveJoin, '$occurredAt', null] } },
    } },
    { $lookup: { from: 'activities', let: { activityId: '$_id.activityId', campusId: '$_id.campusId' }, pipeline: [
      { $match: { $expr: { $and: [{ $eq: ['$_id', '$$activityId'] }, { $eq: ['$campusId', '$$campusId'] }] } } },
      { $project: { _id: 0, type: 1, category: 1 } },
    ], as: 'activity' } },
    { $project: { _id: 0, userId: '$_id.userId', activityId: { $toString: '$_id.activityId' }, period: '$_id.period',
      type: { $ifNull: [{ $arrayElemAt: ['$activity.type', 0] }, 'UNCLASSIFIED'] },
      category: { $ifNull: [{ $arrayElemAt: ['$activity.category', 0] }, null] },
      views: 1, joins: 1, withdrawals: 1, legacyEvents: 1, lastLiveJoinedAt: 1,
      firstViewedAt: { $cond: [{ $gt: ['$views', 0] }, '$firstViewedAt', null] },
    } },
  ];
}

/** Conserva participantes de cuentas desactivadas o trasladadas: campus pertenece al evento. */
export async function readAudienceCareers(client: PoolClient, userIds: string[], institutionId: string): Promise<AudienceCareer[]> {
  if (!userIds.length) return [];
  return (await client.query<AudienceCareer>(
    `SELECT DISTINCT uc.perfil_usuario_id AS "userId",c.id AS "careerId",c.nombre AS "careerName"
     FROM public.usuario_carrera uc JOIN public.perfil_usuario p ON p.id=uc.perfil_usuario_id
     JOIN public.carrera c ON c.id=uc.carrera_id
     WHERE p.id=ANY($1::uuid[]) AND p.institucion_id=$2 AND c.institucion_id=$2`, [userIds, institutionId])).rows;
}

/** Una consulta parametrizada para carreras/asignaturas, totales y todos los intervalos. */
export async function readAcademicDemand(client: PoolClient, campusIds: string[], from: Date, until: Date, careerId: string | null, windows: AnalyticsWindow[]) {
  const ranges = JSON.stringify([{ key: 'total', from, until }, ...windows].map(row => ({ key: row.key, start: row.from, cutoff: row.until })));
  const rows = (await client.query<{ key: string; dimension: 'careers' | 'subjects'; id: string | null; name: string;
    views: string; requests: string; resourcesWithDemand: string; uniqueRequesters: string }>(
    `WITH ranges AS (SELECT * FROM jsonb_to_recordset($5::jsonb) AS r(key text,start timestamptz,cutoff timestamptz)),
     eligible AS (
       SELECT p.id FROM public.publicacion_recurso p WHERE p.campus_id=ANY($1::uuid[])
       AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM public.publicacion_carrera pc WHERE pc.publicacion_id=p.id AND pc.carrera_id=$4))
     ), facts AS (
       SELECT v.publicacion_id AS id,v.created_at AS at,1 AS views,0 AS requests,NULL::uuid AS requester
       FROM public.interaccion_recurso v JOIN eligible p ON p.id=v.publicacion_id
       WHERE v.tipo_interaccion='VISTA' AND v.created_at>=$2 AND v.created_at<$3
       UNION ALL
       SELECT s.publicacion_id,s.solicitada_en,0,1,s.solicitante_id
       FROM public.solicitud_recurso s JOIN eligible p ON p.id=s.publicacion_id WHERE s.solicitada_en>=$2 AND s.solicitada_en<$3
     ), relations AS (
       SELECT p.id,'careers' AS dimension,c.id AS relation_id,coalesce(c.nombre,'Sin carrera') AS name
       FROM eligible p LEFT JOIN public.publicacion_carrera pc ON pc.publicacion_id=p.id
       LEFT JOIN public.carrera c ON c.id=pc.carrera_id WHERE $4::uuid IS NULL OR c.id=$4
       UNION ALL
       SELECT p.id,'subjects',a.id,coalesce(a.nombre,'Sin asignatura')
       FROM eligible p LEFT JOIN public.publicacion_asignatura pa ON pa.publicacion_id=p.id
       LEFT JOIN public.asignatura a ON a.id=pa.asignatura_id
     ) SELECT r.key,d.dimension,d.relation_id AS id,d.name,
       sum(f.views)::text AS views,sum(f.requests)::text AS requests,
       count(DISTINCT f.id)::text AS "resourcesWithDemand",count(DISTINCT f.requester)::text AS "uniqueRequesters"
     FROM facts f JOIN ranges r ON f.at>=r.start AND f.at<r.cutoff JOIN relations d ON d.id=f.id
     GROUP BY r.key,d.dimension,d.relation_id,d.name ORDER BY sum(f.requests) DESC,sum(f.views) DESC,d.name,d.relation_id`,
    [campusIds, from, until, careerId, ranges])).rows;
  const result = new Map<string, { careers: AcademicDemand[]; subjects: AcademicDemand[] }>();
  for (const row of rows) {
    const group = result.get(row.key) ?? { careers: [], subjects: [] };
    const views = Number(row.views), requests = Number(row.requests);
    group[row.dimension].push({ id: row.id, name: row.name, views, requests,
      resourcesWithDemand: Number(row.resourcesWithDemand), uniqueRequesters: Number(row.uniqueRequesters), requestsPer100Views: percentage(requests, views) });
    result.set(row.key, group);
  }
  return result;
}
