import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPublicContent } from '../src/shared/moderation/content-moderation.js';
import { ApiError } from '../src/shared/errors/api-error.js';

function rejection(text: string) {
  try { assertPublicContent({ title: text }); } catch (error) {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 400); assert.equal(error.code, 'VALIDATION_ERROR');
    return error;
  }
  assert.fail(`No se rechazó: ${text}`);
}

test('moderation blocks all five teacher cases including accents, leet, separators and uppercase', () => {
  for (const word of ['idiotas', 'IDIOTAS', 'idíotas', 'idi0tas', 'i.d.i.o.t.a.s']) {
    const error = rejection(`actividad para ${word}`);
    assert.equal(error.details?.[0].field, 'title');
    assert.ok(error.details?.[0].message.toLowerCase().includes(word.toLowerCase()));
    assert.match(error.details![0].message, /Elimina o reemplaza/);
  }
});

test('low, medium and high severities all block even when diluted by clean text', () => {
  for (const [term, severity] of [['weá', 'baja'], ['idiota', 'media'], ['conchetumadre', 'alta']]) {
    assert.match(rejection('Material académico '.repeat(80) + term).details![0].message, new RegExp(`severidad ${severity}`));
  }
});

test('Chilean vocabulary covers inflections, abbreviations and obfuscated forms', () => {
  for (const term of ['weón', 'weones', 'weonas', 'huevones', 'hueones', 'WN', 'aweonaos', 'aweonadas', 'ahuevonado',
    'weá', 'weas', 'huevadas', 'webeando', 'wevear', 'ctm', 'csm', 'conchesumare', 'chucha', 'rechucha', 'chuchatumare',
    'culiao', 'culiadas', 'qlo', 'qliaos', 'sacoweas', 'carewea', 'careraja', 'pichula', 'tulazo',
    'w.e.o.n.e.s', 'w30nes', 'a.w.e.o.n.a.o.s', 'c.t.m', 'cul1a0', 'we\u200bones']) rejection(`Texto ${term}`);
});

test('clean academic titles, health topics and substring collisions remain allowed', () => {
  for (const title of ['actividad de programación', 'taller de fundamentos de redes', 'Taller de cálculo',
    'Clase de análisis de algoritmos', 'Taller de análisis de datos', 'Educación sexual y prevención del VIH',
    'Charla sobre discriminación y violencia de género', 'Apuntes de anatomía humana', 'Semana de la inclusión',
    'Clase de difusión científica', 'Libro de álgebra', 'Apuntes de computación', 'Taller de modelado 3D',
    'Partido de fútbol', 'Torneo de ajedrez', 'Herramientas para investigación', 'Taller de física', 'Taller de matemáticas',
    'Cuidado del vehículo', 'Taller de salud mental', 'Curso de programación web y SQL', 'Tablas y gráficos',
    'Aulas virtuales', 'Huevos para el desayuno', 'Cálculo del área y del volumen', 'Introduction to classic algorithms']) {
    assert.doesNotThrow(() => assertPublicContent({ title, description: 'Material académico para estudiantes' }), title);
  }
});

test('errors identify original expressions and all affected fields within transport limits', () => {
  assert.throws(() => assertPublicContent({ title: 'idi0tas y weones', description: 'conchetumadre', 'location.customLabel': 'chucha' }), error => {
    assert.ok(error instanceof ApiError);
    assert.deepEqual(error.details?.map(detail => detail.field), ['title', 'description', 'location.customLabel']);
    assert.match(error.details![0].message, /idi0tas.*weones/);
    assert.match(error.details![2].message, /referencia del lugar.*chucha/);
    for (const detail of error.details!) assert.ok(detail.message.length <= 500);
    assert.ok(error.message.length <= 500);
    return true;
  });
  const many = rejection('weá idiotas conchetumadre chucha culiao pichula');
  assert.equal(many.details!.length, 2);
  for (const term of ['weá', 'idiotas', 'conchetumadre', 'chucha', 'culiao', 'pichula']) {
    assert.ok(many.details!.some(detail => detail.message.includes(`«${term}»`)), term);
  }
  for (const detail of many.details!) assert.ok(detail.message.length <= 500);
  assert.match(many.details![1].message, /expresión sexual explícita/);
  assert.throws(() => assertPublicContent({ title: 'idiotas', 'location.customLabel': 'ctm',
    description: 'weones weonas huevones hueones wn aweonaos aweonadas ahuevonado weá weas huevadas webeando wevear ctm csm conchesumare chucha rechucha chuchatumare culiao culiadas qlo qliaos sacoweas carewea careraja pichula tulazo weón idiotas' }), error => {
    assert.ok(error instanceof ApiError);
    assert.ok(error.details!.length <= 20);
    assert.ok(error.details!.some(detail => detail.field === 'description' && detail.message.includes('expresiones más')));
    assert.ok(error.details!.some(detail => detail.field === 'location.customLabel'));
    for (const detail of error.details!) assert.ok(detail.message.length <= 500);
    return true;
  });
  // Un rechazo anterior no contamina la instancia ni permite el siguiente intento ofensivo.
  assert.doesNotThrow(() => assertPublicContent({ title: 'Actividad respetuosa', description: 'Taller de redes' }));
  rejection('weones');
});
