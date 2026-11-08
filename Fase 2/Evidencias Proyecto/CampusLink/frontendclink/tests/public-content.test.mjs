import assert from 'node:assert/strict';
import test from 'node:test';
import { publicContent } from './helpers/public-content.mjs';

test('publication drafts retain invalid text and report both fields before sending', () => {
  const draft = { title: 'Hi h!tler', description: 'Tul_a} 😀' };
  const error = publicContent.publicationTextError(draft.title, draft.description);
  assert.match(error, /El nombre/);
  assert.match(error, /La descripción/);
  assert.match(error, /emojis/);
  assert.equal(draft.title, 'Hi h!tler');
  assert.equal(draft.description, 'Tul_a} 😀');
  assert.equal(publicContent.publicationTextError('Taller de cálculo 2', 'Material académico\nPara estudiantes'), null);
});

test('emoji sequences and Unicode lookalikes cannot pass as letters or numbers', () => {
  for (const text of ['😀', '👨‍👩‍👧', '🇨🇱', '1️⃣', '™', '＠', '\u200b', '\u202e', 'ＰＤＦ', '𝓐', 'і', 'A\tB', 'Texto.']) {
    assert.ok(publicContent.publicTextError(text), text);
  }
  for (const text of ['Árbol 123', 'Niñez', 'Pingüino', 'Disen\u0303o']) assert.equal(publicContent.publicTextError(text), null);
});
