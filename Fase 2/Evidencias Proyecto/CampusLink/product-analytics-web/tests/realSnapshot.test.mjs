import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRealSnapshot } from '../src/data/realSnapshot.ts';

export function fixture() {
  const period = { from: '2026-10-01', to: '2026-10-31', timeZone: 'America/Santiago', cutoff: '2026-11-01T03:00:00Z' };
  return { generatedAt: '2026-11-02T12:00:00Z', period, scope: { institutionName: 'Institución de prueba', campuses: [{ id: 'private-id', name: 'Campus de prueba' }], career: null },
    activeUsers: { value: 999999 }, generatedBy: { name: 'PRIVATE_PERSON', email: 'private@example.invalid' },
    resourceDemand: { value: 120, views: 100, requests: 20 }, subjectDemand: { value: 120, subjects: [{ subjectName: 'Asignatura de prueba', views: 100, requests: 20 }] },
    activityParticipation: { value: 15, legacyEvents: 2 }, intervals: [{ status: 'recorded', period, metrics: { resourceDemand: { value: 120, views: 100, requests: 20 }, activityParticipation: { value: 15 } } }] };
}
test('importa únicamente agregados permitidos y omite cuentas habilitadas y PII', () => {
  const s = parseRealSnapshot({ data: fixture() });
  assert.equal(s.views, 100); assert.equal(s.requests, 20); assert.equal(s.joined, 15);
  assert.doesNotMatch(JSON.stringify(s), /999999|PRIVATE_PERSON|private@|private-id|activeUsers|generatedBy/);
});
test('acepta respuesta directa y sobre HTTP data', () => assert.deepEqual(parseRealSnapshot(fixture()), parseRealSnapshot({ data: fixture() })));
test('no mezcla mocks ni transforma métricas no disponibles en ceros', () => {
  const raw = fixture(); raw.resourceDemand.value = null; raw.subjectDemand.value = null;
  raw.intervals[0].metrics = null; raw.intervals[0].status = 'unavailable';
  const result = parseRealSnapshot(raw); assert.equal(result.views, null); assert.equal(result.subjects[0].value, null); assert.equal(result.intervals[0].requests, null);
  assert.equal('population' in result, false);
});
test('rechaza JSON ajeno, valores negativos, rangos inválidos y zona incompatible', () => {
  assert.throws(() => parseRealSnapshot({ users: [] }));
  for (const alter of [r => { r.resourceDemand.requests = -1; }, r => { r.period.from = '2026-02-30'; }, r => { r.period.timeZone = 'UTC'; }, r => { r.intervals[0].period = { ...r.period, to: '2027-01-01' }; }]) {
    const raw = fixture(); alter(raw); assert.throws(() => parseRealSnapshot(raw));
  }
});
test('rechaza etiquetas excesivas y payloads con cantidades desmesuradas de filas', () => {
  const raw = fixture(); raw.scope.institutionName = 'a'.repeat(251); assert.throws(() => parseRealSnapshot(raw));
  const many = fixture(); many.intervals = Array(401).fill(many.intervals[0]); assert.throws(() => parseRealSnapshot(many));
});
test('proyecta el análisis v2 disponible en prerelease sin conservar actores ni IDs', () => {
  const raw = fixture();
  const audience = { views: 100, joins: 15, withdrawals: 2, uniqueViewers: 50, uniqueParticipants: 12, repeatParticipants: 3,
    viewedPairs: 60, convertedPairs: 12, viewToJoinRate: 20, repeatParticipantRate: 25, legacyEvents: 2 };
  const demand = { id: 'catalog-id', name: 'Asignatura v2', views: 100, requests: 20, resourcesWithDemand: 8, uniqueRequesters: 12, requestsPer100Views: 20 };
  raw.analysis = { activities: { summary: { ...audience, userIds: ['PRIVATE_ACTOR'] },
    segments: [{ ...audience, type: 'COMMUNITY_ACTIVITY', category: null }],
    careers: [{ ...audience, type: 'COMMUNITY_ACTIVITY', category: null, careerId: 'private-career-id', careerName: 'Carrera v2', careerParticipants: 12, participantShare: 100 }] },
    resources: { subjects: [demand], careers: [demand] }, definitions: ['Definición de QA'] };
  raw.notes = ['Cobertura parcial'];
  const s = parseRealSnapshot(raw);
  assert.equal(s.analysis.activities.summary.uniqueParticipants, 12);
  assert.equal(s.analysis.resources.subjects[0].requesters, 12);
  assert.equal(s.analysis.activities.careers[0].participantShare, 100);
  assert.deepEqual(s.notes, ['Cobertura parcial']);
  assert.doesNotMatch(JSON.stringify(s), /PRIVATE_ACTOR|catalog-id|private-career-id/);
});
test('un agregado antiguo no inventa análisis v2 ausente', () => {
  const s = parseRealSnapshot(fixture());
  assert.equal(s.analysis, null); assert.deepEqual(s.notes, []);
});
