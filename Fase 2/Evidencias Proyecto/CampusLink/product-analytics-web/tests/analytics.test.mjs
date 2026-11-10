import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDemo, makeAgeBands, ratio, suppressRanks, validateFilters, validDate } from '../src/domain/analytics.ts';
import { DEMO_DATA, DEFAULT_BANDS, DEFAULT_FILTERS, dates, dayAdd } from '../src/data/demo.ts';

const result = calculateDemo(DEMO_DATA, DEFAULT_FILTERS, DEFAULT_BANDS);
test('cada indicador proviene de hechos del período y la población al corte', () => {
  const expected = DEMO_DATA.events.filter(e => e.day >= DEFAULT_FILTERS.from && e.day <= DEFAULT_FILTERS.to);
  assert.equal(result.active, new Set(expected.map(e => e.user)).size);
  assert.equal(result.interactions, expected.length);
  assert.equal(result.newActive + result.recurrent, result.active);
  assert.equal(result.modules.reduce((sum, row) => sum + row.value, 0), result.interactions);
  assert.equal(result.series.reduce((sum, row) => sum + row.interactions, 0), result.interactions);
  assert.ok(result.active < result.population, 'una cuenta registrada no implica actividad');
});
test('DAU, WAU y MAU deduplican actores y tienen ventanas móviles al corte', () => {
  for (const [days, name] of [[1, 'dau'], [7, 'wau'], [30, 'mau']]) {
    const users = new Set(DEMO_DATA.events.filter(e => e.day >= dayAdd(DEFAULT_FILTERS.to, 1 - days) && e.day <= DEFAULT_FILTERS.to).map(e => e.user));
    assert.equal(result[name], users.size);
  }
  assert.ok(result.dau <= result.wau && result.wau <= result.mau);
  assert.equal(result.series.at(-1).wau, result.wau);
  assert.equal(result.series.at(-1).mau, result.mau);
});
test('los seis filtros segmentan usuarios antes de deduplicar interacciones', () => {
  for (const extra of [{ institution: 'Duoc UC' }, { campus: 'San Joaquín' }, { career: 'Diseño Gráfico' }, { age: 'young' }, { gender: 'FEMENINO' }, { from: '2026-09-01', to: '2026-09-30' }]) {
    const filtered = calculateDemo(DEMO_DATA, { ...DEFAULT_FILTERS, ...extra }, DEFAULT_BANDS);
    assert.notEqual(filtered.interactions, result.interactions);
    assert.ok(filtered.active <= filtered.population);
    assert.ok(filtered.interactions >= 0);
  }
});
test('fechas civiles válidas y rangos acotados; no depende del horario de verano', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2026-02-28'), true);
  assert.equal(validDate(''), false);
  assert.ok(validateFilters({ ...DEFAULT_FILTERS, from: '2026-11-01' }));
  assert.ok(validateFilters({ ...DEFAULT_FILTERS, from: '2020-01-01' }));
  assert.deepEqual(dates('2026-09-05', '2026-09-07'), ['2026-09-05', '2026-09-06', '2026-09-07']);
});
test('sin población ni eventos muestra estado vacío; un segmento pequeño se protege', () => {
  assert.equal(calculateDemo(DEMO_DATA, { ...DEFAULT_FILTERS, campus: 'Campus inexistente' }, DEFAULT_BANDS).status, 'empty');
  assert.equal(calculateDemo({ ...DEMO_DATA, users: DEMO_DATA.users.slice(0, 5) }, DEFAULT_FILTERS, DEFAULT_BANDS).status, 'suppressed');
});
test('supresión complementaria oculta una segunda celda para impedir resta del total', () => {
  const masked = suppressRanks([{ label: 'A', value: 3, people: 3 }, { label: 'B', value: 24, people: 20 }, { label: 'C', value: 40, people: 30 }]);
  assert.equal(masked[0].value, null); assert.equal(masked[1].value, null); assert.equal(masked[2].value, 40);
});
test('los rangos de edad no se superponen y no dejan huecos; filtros usan nuevos límites', () => {
  const bands = makeAgeBands([24, 34, 44]);
  assert.equal(bands[1].min, 25); assert.equal(bands[3].min, 45);
  assert.throws(() => makeAgeBands([30, 22, 40]));
  assert.notEqual(calculateDemo(DEMO_DATA, { ...DEFAULT_FILTERS, age: 'young' }, bands).population,
    calculateDemo(DEMO_DATA, { ...DEFAULT_FILTERS, age: 'young' }, DEFAULT_BANDS).population);
});
test('porcentajes de cada segmento usan su propia población', () => {
  for (const group of result.groups.career) {
    if (group.total !== null) assert.equal(group.rate, group.active / group.total * 100);
    for (const field of ['rate', 'marketplace', 'community']) assert.ok(group[field] === null || group[field] >= 0 && group[field] <= 100);
  }
  assert.equal(ratio(1, 0), null);
});
test('retención excluye cohortes sin seguimiento y usa el día exacto', () => {
  const users = Array.from({ length: 20 }, (_, i) => ({ id: `u${i}`, registered: '2026-10-01', institution: 'X', campus: 'Y', career: 'Z', age: 20, gender: 'SIN_DATO' }));
  const data = { users, resources: [], activities: [], from: '2026-07-01', to: '2026-10-31',
    events: users.map((u, i) => ({ id: `e${i}`, user: u.id, day: '2026-10-08', module: 'community', type: 'view', target: 'a' })) };
  const d7 = calculateDemo(data, { ...DEFAULT_FILTERS, to: '2026-10-08' }, DEFAULT_BANDS);
  assert.equal(d7.d7, 100); assert.equal(d7.d30, null);
  assert.equal(calculateDemo(data, { ...DEFAULT_FILTERS, to: '2026-10-07' }, DEFAULT_BANDS).d7, null);
});
test('embudo sigue una única cohorte de solicitudes y mantiene orden lógico', () => {
  const [requests, accepted, completed] = result.market.funnel.map(r => r.value);
  assert.equal(requests, result.market.requests);
  assert.ok(completed <= accepted && accepted <= requests);
  const created = DEMO_DATA.events.filter(e => e.module === 'marketplace' && e.type === 'request' && e.day >= DEFAULT_FILTERS.from && e.day <= DEFAULT_FILTERS.to);
  const requestIds = new Set(created.map(e => e.request));
  const finished = new Set(DEMO_DATA.events.filter(e => requestIds.has(e.request) && e.type === 'completed' && e.day <= DEFAULT_FILTERS.to).map(e => e.request));
  assert.equal(completed, finished.size);
});
test('retención, ranking y frecuencia nunca generan NaN ni Infinity', () => {
  assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
  assert.ok(result.frequency >= 1 && result.frequency <= 31);
  assert.ok(result.d7 === null || result.d7 >= 0 && result.d7 <= 100);
});
test('ventanas semanales y mensuales incompletas no se presentan como cifras observadas', () => {
  const early = calculateDemo(DEMO_DATA, { ...DEFAULT_FILTERS, from: '2026-07-01', to: '2026-07-03' }, DEFAULT_BANDS);
  assert.equal(early.wau, null); assert.equal(early.mau, null);
  assert.equal(early.series[0].wau, null); assert.equal(early.series[0].mau, null);
  assert.notEqual(early.dau, null);
});
