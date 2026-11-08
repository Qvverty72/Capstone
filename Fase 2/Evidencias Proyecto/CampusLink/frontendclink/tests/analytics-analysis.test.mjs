import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { analyticsRenderer } from './helpers/analytics-render.mjs';

const file = 'src/features/analytics/components/AnalyticsDeepDive.tsx';
const counts = { views: 20, joins: 6, withdrawals: 1, uniqueViewers: 10, uniqueParticipants: 5, repeatParticipants: 2,
  viewedPairs: 12, convertedPairs: 3, viewToJoinRate: 25, repeatParticipantRate: 40, legacyEvents: 0 };
const segment = { ...counts, type: 'COMMUNITY_ACTIVITY', category: 'Deporte' };
const rows = [
  { ...segment, careerId: 'it', careerName: 'Informática', careerParticipants: 10, participantShare: 50 },
  { ...segment, careerId: 'design', careerName: 'Diseño', uniqueParticipants: 1, careerParticipants: 1, participantShare: 100 },
  { ...segment, careerId: 'it', careerName: 'Informática', category: 'Cultura', careerParticipants: 10, participantShare: 50 },
];
const analysis = { activities: { summary: counts, segments: [segment], careers: rows }, resources: { careers: [], subjects: [] }, definitions: ['Definición conservada de prueba.'] };
const period = { from: '2026-10-01', to: '2026-10-31', timeZone: 'America/Santiago' };

function stateful(name, props) {
  const slots = [], actions = [], fields = []; let cursor = 0;
  const renderer = analyticsRenderer({ react: { ...React, useState(initial) {
    const index = cursor++; if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  } } }, actions, fields);
  const result = { actions, fields, render() { cursor = 0; actions.length = fields.length = 0; return renderer.render(file, name, props); },
    click(label) { const action = actions.find(action => action.children?.props?.children === label); assert.ok(action, label); action.onPress(); return result.render(); } };
  return result;
}

test('advanced view shows denominators, unique audience, activity breakdown and saved definitions', () => {
  const view = stateful('AnalyticsDeepDive', { dashboard: { analysis, intervals: [] } });
  const html = view.render();
  for (const text of ['Participantes únicos', 'Conversión observada', 'Recurrencia', '12', '25', 'Informática', 'Diseño', 'Deporte', 'no acreditan asistencia']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Definición conservada de prueba.'));
  assert.ok(view.click('Cómo se calculan estas métricas').includes('Definición conservada de prueba.'));
});

test('career ranking supports affinity, minimum sample, category and literal name search', () => {
  const view = stateful('CareerAudience', { rows });
  let html = view.render(); assert.ok(html.indexOf('Informática') < html.indexOf('Diseño'));
  html = view.click('Mayor afinidad'); assert.ok(html.indexOf('Diseño') < html.indexOf('Informática'));
  html = view.click('5 participantes'); assert.ok(!html.includes('Diseño'));
  html = view.click('Actividad comunitaria · Deporte'); assert.equal((html.match(/Actividad comunitaria · Cultura/g) ?? []).length, 1, 'only the category filter remains, not a culture result');
  view.fields[0].onChangeText('inforMÁTICA'); html = view.render(); assert.ok(html.includes('Informática'));
  view.fields[0].onChangeText('inexistente'); html = view.render(); assert.ok(html.includes('No hay carreras que coincidan'));
});

test('academic view distinguishes event ratios, unique requesters and missing denominators and changes dimension', () => {
  const view = stateful('AcademicAudience', { careers: [
    { id: 'it', name: 'Informática', views: 1, requests: 2, uniqueRequesters: 1, resourcesWithDemand: 1, requestsPer100Views: 200 },
  ], subjects: [{ id: 'algebra', name: 'Álgebra', views: 0, requests: 1, uniqueRequesters: 1, resourcesWithDemand: 1, requestsPer100Views: null }] });
  let html = view.render(); assert.ok(html.includes('Informática')); assert.ok(html.includes('200')); assert.ok(html.includes('no es conversión de personas'));
  html = view.click('Por asignatura'); assert.ok(html.includes('Álgebra')); assert.ok(html.includes('Sin base')); assert.ok(!html.includes('Informática'));
  view.fields[0].onChangeText('sin coincidencia'); assert.ok(view.render().includes('No hay demanda registrada'));
});

test('historical version absence and future periods never become zero observations', () => {
  const old = analyticsRenderer().render(file, 'AnalyticsDeepDive', { dashboard: { intervals: [] } });
  assert.ok(old.includes('versión anterior')); assert.ok(!old.includes('Participantes únicos'));
  const future = analyticsRenderer().render(file, 'AnalyticsDeepDive', { dashboard: { analysis: null, intervals: [] } });
  assert.ok(future.includes('Sin datos disponibles')); assert.ok(!future.includes('Participantes únicos'));
  const view = stateful('AnalyticsDeepDive', { dashboard: { analysis, intervals: [{ key: 'future', label: 'Noviembre futuro', period, metrics: null }] } });
  view.render(); const html = view.click('Noviembre futuro'); assert.ok(html.includes('Sin datos disponibles')); assert.ok(!html.includes('Participantes únicos'));
});

test('career ranking paginates all rows without a silent top-N limit', () => {
  const many = Array.from({ length: 19 }, (_, index) => ({ ...rows[0], careerId: `career-${index}`, careerName: `Carrera ${String(index).padStart(2, '0')}` }));
  const view = stateful('CareerAudience', { rows: many });
  assert.ok(view.render().includes('1–8 de 19'));
  assert.ok(view.click('Siguiente').includes('9–16 de 19'));
  const html = view.click('Siguiente'); assert.ok(html.includes('17–19 de 19')); assert.ok(html.includes('Carrera 18'));
});
