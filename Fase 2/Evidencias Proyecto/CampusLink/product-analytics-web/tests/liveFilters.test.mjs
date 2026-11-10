import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDashboardScope, dashboardQuery, initialLiveFilters, livePresets, parseLiveOptions, todayInSantiago } from '../src/data/liveFilters.ts';

const institution = '00000000-0000-4000-8000-000000000001', a = '00000000-0000-4000-8000-000000000002', b = '00000000-0000-4000-8000-000000000003', career = '00000000-0000-4000-8000-000000000004';
const options = { institutions: [{ id: institution, name: 'Institución QA', campuses: [{ id: a, name: 'Campus A' }, { id: b, name: 'Campus B' }], careers: [{ id: career, name: 'Carrera QA', campusIds: [a] }] }] };
const filters = { from: '2026-10-01', to: '2026-10-31', institutionId: institution, campusId: a, careerId: '', grouping: 'week' };

test('el período inicial usa días civiles de Santiago, sin fijarse al escenario ficticio', () => {
  const now = new Date('2026-11-10T01:30:00Z');
  assert.equal(todayInSantiago(now), '2026-11-09');
  assert.equal(initialLiveFilters(now).to, '2026-11-09');
  assert.equal(initialLiveFilters(now).from, '2026-10-11');
  assert.equal(livePresets(now).find(p => p.id === 'previous').to, '2026-10-31');
});
test('solo se construyen consultas para catálogos autorizados y carreras del campus', () => {
  const parsed = parseLiveOptions(options);
  assert.equal(dashboardQuery(filters, parsed).get('campusIds'), a);
  assert.equal(dashboardQuery({ ...filters, campusId: '' }, parsed).get('campusIds'), [a, b].sort().join(','));
  assert.throws(() => dashboardQuery({ ...filters, institutionId: career }, parsed));
  assert.throws(() => dashboardQuery({ ...filters, campusId: b, careerId: career }, parsed));
  assert.equal(dashboardQuery({ ...filters, careerId: career }, parsed).get('careerId'), career);
});
test('catálogos inválidos o carreras de otro campus no se aceptan', () => {
  assert.throws(() => parseLiveOptions({ institutions: [{ ...options.institutions[0], id: 'incorrecto' }] }));
  assert.throws(() => parseLiveOptions({ institutions: [{ ...options.institutions[0], careers: [{ id: career, name: 'X', campusIds: [institution] }] }] }));
  assert.deepEqual(parseLiveOptions({ institutions: [] }), { institutions: [] });
});
test('una respuesta de otro alcance no se presenta bajo los filtros actuales', () => {
  const response = { scope: { institutionId: institution, campuses: [{ id: a }], career: null } };
  assert.doesNotThrow(() => assertDashboardScope(response, dashboardQuery(filters, options)));
  assert.throws(() => assertDashboardScope({ scope: { ...response.scope, campuses: [{ id: b }] } }, dashboardQuery(filters, options)));
  assert.throws(() => assertDashboardScope({ scope: { ...response.scope, career: { id: career } } }, dashboardQuery(filters, options)));
});
