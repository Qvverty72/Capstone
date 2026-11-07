import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertPublicContent } from '../src/shared/moderation/content-moderation.js';
import { ApiError } from '../src/shared/errors/api-error.js';
import { publicTextError } from '../../frontendclink/src/lib/validation/public-content.js';

const fields = ['title', 'description', 'location.customLabel'] as const;
test('all published text rejects symbols, emoji, invisible text and non Spanish lookalike letters', () => {
  for (const text of ['Hi h!tler', 'Tul_a}', 'Material 😀', 'Clase ❤', 'Prueba 1️⃣', 'Precio $100', 'Texto con punto.',
    'Texto, nuevo', 'A/B', 'A-B', '@usuario', '<script>', 'Texto\u200boculto', 'Texto\u202eoculto',
    'Texto\u00a0oculto', 'Tеxto', 'Ｔｅｘｔｏ', '𝓣𝓮𝔁𝓽𝓸', '漢字', 'Texto\t2', '\uFEFFMaterial']) {
    for (const field of fields) {
      assert.throws(() => assertPublicContent({ [field]: text }), error => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 400);
        assert.ok(error.details?.some(detail => detail.field === field && /caracteres especiales y emojis/.test(detail.message)));
        return true;
      }, `${field}: ${text}`);
      assert.ok(publicTextError(text, 'Campo', field === 'description'), `${field}: ${text}`);
    }
  }
});

test('Spanish letters, digits, spaces and canonical accent input remain valid in client and server', () => {
  for (const text of ['Taller de programación 2026', 'ÁÉÍÓÚÜÑ áéíóúüñ 0123456789', 'Sala A105', 'Disen\u0303o 3D', 'Pingu\u0308ino 2']) {
    for (const field of fields) {
      assert.doesNotThrow(() => assertPublicContent({ [field]: text }));
      assert.equal(publicTextError(text, 'Campo', field === 'description'), null);
    }
  }
  assert.doesNotThrow(() => assertPublicContent({ description: 'Primera línea\r\nSegunda línea 2' }));
  assert.equal(publicTextError('Primera línea\nSegunda línea', 'Campo', true), null);
  for (const field of ['title', 'location.customLabel']) {
    assert.throws(() => assertPublicContent({ [field]: 'Sala\nA105' }), { code: 'VALIDATION_ERROR' });
    assert.ok(publicTextError('Sala\nA105'));
  }
});

test('letter spacing, leet spelling and extremist greetings cannot bypass moderation', () => {
  for (const value of ['i d i o t a', 'i d i\u0301 o t a', 'c u l i a o', 'w e o n', 'w n', 'idi0tas', 'p3nd3j0',
    'Hi hitler', 'Hi hitl3r', 'Hi h i t l e r', 'h i h i t l e r', 'HiHitler', 'heil hitler']) {
    assert.throws(() => assertPublicContent({ title: value }), { code: 'VALIDATION_ERROR' }, value);
  }
  assert.doesNotThrow(() => assertPublicContent({ title: 'Taller de redes 2', description: 'Material académico\nPara estudiantes' }));
  assert.doesNotThrow(() => assertPublicContent({ title: 'Historia de Hitler', description: 'Estudio histórico' }));
});
