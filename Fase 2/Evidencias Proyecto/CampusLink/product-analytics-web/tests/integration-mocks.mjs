/** Fixtures exclusivamente ficticios para QA del contrato HTTP. Nunca representan producción. */
export const IDS = {
  user: '11111111-1111-4111-8111-111111111111', institution: '22222222-2222-4222-8222-222222222222',
  campus: '33333333-3333-4333-8333-333333333333', secondCampus: '44444444-4444-4444-8444-444444444444',
  career: '55555555-5555-4555-8555-555555555555', secondCareer: '66666666-6666-4666-8666-666666666666',
  subject: '77777777-7777-4777-8777-777777777777',
};
export function qaSession() {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: IDS.user, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })}.cWEtZmljdGl0aW91cy1zaWduYXR1cmU`;
  return { access_token, refresh_token: 'qa-only-fictitious-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: qaUser() };
}
export function qaUser() { return { id: IDS.user, aud: 'authenticated', role: 'authenticated', email: 'admin@campuslink.test', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-01-01T00:00:00Z' }; }
export function qaIdentity() {
  return { userId: IDS.user, campusId: IDS.campus, profile: { id: IDS.user, institucion_id: IDS.institution, campus_id: IDS.campus,
    nombre_completo: 'Administración QA', foto_path: null, verificado_en: '2026-01-01T00:00:00Z', estado_cuenta: 'ACTIVA', deleted_at: null },
    roles: [IDS.campus, IDS.secondCampus].map((campusId, i) => ({ id: `role-${i}`, name: 'ADMINISTRADOR', campusId })), permissions: [],
    capabilities: { general: true, officialActivities: true, analytics: true, reports: true } };
}
export function qaOptions() { return { institutions: [{ id: IDS.institution, name: 'Institución ficticia QA', campuses: [{ id: IDS.campus, name: 'Campus Uno QA' }, { id: IDS.secondCampus, name: 'Campus Dos QA' }],
  careers: [{ id: IDS.career, name: 'Informática QA', campusIds: [IDS.campus, IDS.secondCampus] }, { id: IDS.secondCareer, name: 'Diseño QA', campusIds: [IDS.secondCampus] }] }] }; }
export function qaDashboard(query) {
  const options = qaOptions().institutions[0];
  const from = query.get('from') ?? '2026-10-01', to = query.get('to') ?? '2026-10-31';
  const campusIds = (query.get('campusIds') ?? query.get('campusId') ?? IDS.campus).split(',');
  const campuses = options.campuses.filter(c => campusIds.includes(c.id));
  const career = options.careers.find(c => c.id === query.get('careerId'));
  const scope = { institutionId: IDS.institution, institutionName: options.name, campusId: campuses.length === 1 ? campuses[0].id : null,
    campusName: campuses.map(c => c.name).join(', '), campuses, career: career ? { id: career.id, name: career.name } : null };
  const period = { from, to, timeZone: 'America/Santiago', cutoff: `${to}T23:59:59.000Z` };
  const audience = { views: 80, joins: 15, withdrawals: 3, uniqueViewers: 30, uniqueParticipants: 12, repeatParticipants: 10,
    viewedPairs: 35, convertedPairs: 12, viewToJoinRate: 34.29, repeatParticipantRate: 83.33, legacyEvents: 0 };
  const academic = { id: IDS.subject, name: 'Programación QA', views: 120, requests: 20, resourcesWithDemand: 10, uniqueRequesters: 12, requestsPer100Views: 16.67 };
  const analysis = { resources: { careers: [{ ...academic, id: IDS.career, name: 'Informática QA' }], subjects: [academic] },
    activities: { summary: audience, segments: [{ ...audience, type: 'COMMUNITY_ACTIVITY', category: 'Académicas QA' }],
      careers: [{ ...audience, type: 'COMMUNITY_ACTIVITY', category: 'Académicas QA', careerId: IDS.career, careerName: 'Informática QA', careerParticipants: 12, participantShare: 100 }] },
    definitions: ['Fixture ficticio de QA. Las categorías no son mutuamente excluyentes.'] };
  const metric = value => ({ value, period, scope });
  const metrics = { scope, period, activeUsers: metric(999999), resourceDemand: { ...metric(140), views: 120, requests: 20 },
    subjectDemand: { ...metric(140), views: 120, requests: 20, subjects: [{ subjectId: IDS.subject, subjectName: 'Programación QA', views: 120, requests: 20 }] },
    activityParticipation: { ...metric(15), label: 'Inscripciones registradas', legacyEvents: 0 }, analysis };
  return { ...metrics, generatedAt: new Date().toISOString(), grouping: query.get('grouping') ?? 'month',
    intervals: [{ key: from, label: `Período ${from}`, period, status: 'recorded', coverage: 'partial', metrics }],
    notes: ['Fixture ficticio de QA; no consulta bases de datos.'], generatedBy: { name: 'PII_DISCARD_QA', email: 'pii-discard@example.invalid' } };
}
