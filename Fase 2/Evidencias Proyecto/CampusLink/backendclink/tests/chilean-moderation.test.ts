import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPublicContent } from '../src/shared/moderation/content-moderation.js';
import { ApiError } from '../src/shared/errors/api-error.js';

function rejected(text: string): ApiError {
  try { assertPublicContent({ title: text }); } catch (error) {
    assert.ok(error instanceof ApiError, text);
    assert.equal(error.status, 400); assert.equal(error.code, 'VALIDATION_ERROR');
    assert.ok(error.details?.some(detail => detail.field === 'title'));
    return error;
  }
  assert.fail(`Se permitió la expresión: ${text}`);
}

test('Chilean moderation covers compounds, insults and discriminatory variants beyond the initial families', () => {
  for (const text of ['chupapico', 'chupapicos', 'chupapichulas', 'chupatulas', 'chupacornetas', 'chupaculos',
    'carepico', 'carepichulas', 'carecallampa', 'carecornetas', 'carechuchas', 'careculos', 'carepotos',
    'longi', 'longhis', 'longimán', 'pajarón', 'pajarones', 'pajaronas', 'soperutanos', 'soperutanas',
    'sopencos', 'sopencas', 'pelmazos', 'pelmazas', 'papanatas', 'chuchentos', 'chuchentas', 'pelafustán',
    'pelafustanes', 'mequetrefes', 'maricuecas', 'maricuecos', 'maracos', 'marakos', 'fletos', 'colipatos', 'colipatas']) {
    rejected(`Publicación para ${text}`);
  }
});

test('Chilean moderation recognizes chat spellings, genders, plurals and conjugations', () => {
  for (const text of ['güeones', 'gueonas', 'webones', 'webonas', 'wueones', 'wnas', 'ahuevonaos', 'ahuevonadas',
    'agüeonaos', 'agueonados', 'hueveái', 'webeái', 'webeaste', 'webearon', 'webean', 'webeen', 'webiando', 'webiái',
    'weveái', 'wevean', 'weando', 'conchadetumadre', 'conchadesumadre', 'reconchetumare', 'ctmr', 'ctmdre',
    'culiando', 'culeando', 'culiai', 'qliaitos', 'culiaita', 'kliaos', 'sacodeweas', 'sacodehuevadas', 'carewn']) {
    rejected(text);
  }
});

test('Chilean moderation recognizes explicit phrases with voseo, accents and original positions', () => {
  for (const text of ['vales callampa', 'VALÍS CALLAMPA', 'valis una callampa', 'valen una callampa', 'valis hongo',
    'eri penca', 'erís penca', 'soi penca', 'deja de wear', 'para de wear', 'eres un perkin', 'ERIS UN PERKIN', 'son unos perkines',
    'eres un gil', 'soi un gil', 'eres un saco de pelotas', 'saco de huevas', 'saco de weas',
    'cara de raja', 'care raja', 'cara de poto', 'care pico', 'cara de callampa', 'eres una maraca', 'erís una maraca',
    'andate a la cresta', 'ándate a la chucha', 'chupame el pico', 'chúpame la corneta', 'chupa la tula',
    'pico pal que lee', 'pico para el que lee', 'me importa un pico', 'está como el pico', 'funciona como el pico']) {
    const error = rejected(text);
    assert.ok(error.details!.some(detail => detail.message.includes(`«${text}»`)), text);
  }
});

test('Chilean moderation keeps leet, case, separated letters and invisible-character coverage', () => {
  for (const text of ['CHUPAP1C0', 'c.h.u.p.a.p.i.c.o', 'm4ricueca', 'c0lipat0', 'w.e.b.e.a.n.d.o',
    'w\u200beones', 'vales c4ll4mpa', 'VALÍS   CALLAMPA', 'erís un p3rkin']) rejected(text);
});

test('Chilean moderation labels threats and discriminatory phrases explicitly', () => {
  for (const text of ['te saco la cresta', 'sacarte la cresta', 'te reviento a combos', 'te voy a reventar',
    'te voy a pegar', 'te voy a apuñalar', 'te voy a acuchillar', 'te voy a matar']) {
    const error = rejected(text);
    assert.ok(error.details!.some(detail => detail.message.includes(`«${text}»`) && detail.message.includes('amenaza, severidad alta')), text);
  }
  for (const text of ['maricueca', 'colipato', 'eres una maraca']) {
    assert.match(rejected(text).details![0].message, /insulto discriminatorio, severidad alta/);
  }
});

test('Chilean moderation preserves words and phrases together across fields and repeated correction attempts', () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.throws(() => assertPublicContent({ title: 'weones, valís callampa y maricueca', description: 'te voy a pegar' }), error => {
      assert.ok(error instanceof ApiError);
      const message = error.details!.map(detail => detail.message).join('\n');
      for (const expression of ['weones', 'valís callampa', 'maricueca', 'te voy a pegar']) assert.ok(message.includes(`«${expression}»`));
      for (const severity of ['baja', 'media', 'alta']) assert.ok(message.includes(`severidad ${severity}`));
      for (const detail of error.details!) assert.ok(detail.message.length <= 500);
      return true;
    });
    assert.doesNotThrow(() => assertPublicContent({ title: 'Apuntes de redes', description: 'Material académico' }));
  }
});

test('Chilean moderation permits literal ambiguous words, names, identities and innocent near matches', () => {
  for (const text of ['Observación del pico de las aves', 'Pico de demanda eléctrica', 'Cultivo de callampas',
    'Estudio de las poblaciones callampas', 'Construcción de una maraca', 'Taller de maracas y percusión',
    'Estas son unas maracas', 'Práctica de corneta', 'Caminata por la cresta del cerro', 'Una raja en la madera',
    'Síntesis de Perkin', 'Clase con Gil', 'Observación de pájaros', 'Un pájaro en el campus',
    'Arriendo de saco de pelotas para fútbol', 'Saco de pelotas de tenis', 'Cálculo del flete', 'Manuales de fletes',
    'Huevos para el desayuno', 'Curso de programación web', 'Pruebas de software y hardware',
    'Wear appropriate clothing', 'Conversatorio sobre diversidad sexual', 'Derechos de personas trans',
    'Historia de las comunidades lesbianas', 'Estudio de la cultura de Mongolia']) {
    assert.doesNotThrow(() => assertPublicContent({ title: text }), text);
  }
});
