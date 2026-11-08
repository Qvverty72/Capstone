import { publicContent } from './helpers/public-content.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function load(path, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, Error, AbortController, ...globals,
    require: name => { if (name.endsWith('/lib/validation/public-content')) return publicContent;  assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; } });
  return module.exports;
}
const details = [{ field: 'title', message: 'El título contiene «idi0tas» (insulto, severidad media). Elimina o reemplaza la expresión.' },
  { field: 'description', message: 'La descripción contiene «weá» (insulto, severidad baja). Elimina o reemplaza la expresión.' }];
const transport = load('lib/api/authenticated-request.ts', {
  '@/features/auth/api/supabaseClient': { getSupabaseClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 'qa' } } }) } }) },
}, { Headers, process: { env: { EXPO_PUBLIC_API_URL: 'https://qa.invalid' } },
  fetch: async () => Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Contenido rechazado', details } }, { status: 400 }) });

function runtime() {
  const slots = []; let index = 0;
  return {
    react: { useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { value: initial };
      return [slots[slot].value, value => { slots[slot].value = typeof value === 'function' ? value(slots[slot].value) : value; }]; },
    useRef(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = { current: initial }; return slots[slot]; },
    useEffect() {} },
    render(fn) { index = 0; return fn(); },
  };
}

test('real error transport and publication creation preserve explicit terms in every rejected field', async () => {
  await assert.rejects(transport.authenticatedRequest('/api/v1/marketplace/elibrary'), error => {
    assert.equal(transport.apiFormErrorMessage(error, 'Fallback'), details.map(detail => detail.message).join('\n'));
    return true;
  });
  const api = load('features/marketplace/physicalgoods/api/physicalgoodsApi.ts', { '@/lib/api/authenticated-request': transport });
  await assert.rejects(api.publishPhysicalgoods({}, new AbortController().signal), error => {
    assert.match(error.message, /idi0tas/); assert.match(error.message, /weá/); return true;
  });
});

test('digital edit keeps the rejected draft and version, displays every term, and saves a corrected retry without reloading', async () => {
  const h = runtime(), saved = [], calls = []; let reject = true;
  const initial = { id: 'resource', title: 'Original', description: 'Material académico', modality: 'DONACION', price: null, updatedAt: 'original-version' };
  const hook = load('features/marketplace/elibrary/hooks/useEditDigitalPublication.ts', { react: h.react,
    '@/lib/api/authenticated-request': transport,
    '../api/elibraryApi': { editDigitalContent: async (id, body) => { calls.push(body);
      if (reject) throw new transport.AuthApiError(400, 'Contenido rechazado', 'VALIDATION_ERROR', details);
      return { ...initial, ...body }; }, loadOwnedDigitalResource: () => assert.fail('No reload on validation failure') } });
  const render = () => h.render(() => hook.useEditDigitalPublication(initial, value => saved.push(value)));
  let state = render(); state.setTitle('idi0tas'); state.setDescription('weá'); state = render(); await state.save(); state = render();
  assert.equal(state.title, 'idi0tas'); assert.equal(state.description, 'weá'); assert.equal(state.resource.updatedAt, 'original-version');
  assert.equal(state.mustReload, false); assert.equal(state.busy, false); assert.equal(saved.length, 0);
  assert.match(state.error, /idi0tas/); assert.match(state.error, /weá/);
  reject = false; state.setTitle('Apuntes de redes'); state.setDescription('Material académico'); state = render(); await state.save();
  assert.equal(saved.length, 1); assert.equal(saved[0].title, 'Apuntes de redes'); assert.equal(calls[1].updatedAt, 'original-version');
});

test('physical edit keeps the rejected draft and allows a corrected retry', async () => {
  const h = runtime(), calls = []; let reject = true;
  const gallery = { id: 'resource', title: 'Original', description: 'Material académico', condition: 'USADO', modality: 'DONACION', price: null,
    updatedAt: 'original-version', owner: { id: 'owner' } };
  const resources = { selectedId: gallery.id, gallery, change: async operation => {
    try { await operation(new AbortController().signal); } catch (error) {
      assert.ok(error instanceof transport.AuthApiError); resources.error = transport.apiFormErrorMessage(error, 'Fallback');
    }
  } };
  const hook = load('features/marketplace/physicalgoods/hooks/useEditPhysicalgoods.ts', { react: h.react,
    '@/features/auth/hooks/useAuth': { useAuth: () => ({ identity: { userId: 'owner' } }) },
    '../api/physicalgoodsApi': { updatePhysicalgoods: async (id, body) => { calls.push(body);
      if (reject) throw new transport.AuthApiError(400, 'Contenido rechazado', 'VALIDATION_ERROR', details); } } });
  const render = () => h.render(() => hook.useEditPhysicalgoods(resources));
  let state = render(); state.start(); state = render(); state.setDraft({ ...state.draft, title: 'idi0tas', description: 'weá' });
  state = render(); assert.equal(await state.save(), false); state = render();
  assert.equal(state.draft.title, 'idi0tas'); assert.equal(state.draft.description, 'weá'); assert.equal(state.draft.updatedAt, 'original-version');
  assert.match(resources.error, /idi0tas/); assert.match(resources.error, /weá/);
  reject = false; state.setDraft({ ...state.draft, title: 'Apuntes de cálculo', description: 'Material académico' });
  state = render(); assert.equal(await state.save(), true); state = render(); assert.equal(state.draft, null); assert.equal(calls.length, 2);
});

test('both publication editors reject symbols locally, preserve version and save a corrected draft', async () => {
  for (const kind of ['physical', 'digital']) {
    const h = runtime(), calls = [];
    const resource = { id: 'resource', title: 'Original', description: 'Material académico', modality: 'DONACION',
      condition: 'USADO', price: null, updatedAt: 'original-version', owner: { id: 'owner' } };
    let render;
    if (kind === 'physical') {
      const resources = { selectedId: resource.id, gallery: resource,
        change: operation => operation(new AbortController().signal) };
      const hook = load('features/marketplace/physicalgoods/hooks/useEditPhysicalgoods.ts', { react: h.react,
        '@/features/auth/hooks/useAuth': { useAuth: () => ({ identity: { userId: 'owner' } }) },
        '../api/physicalgoodsApi': { updatePhysicalgoods: async (id, body) => { calls.push(body); } } });
      render = () => h.render(() => hook.useEditPhysicalgoods(resources));
      render().start();
    } else {
      const hook = load('features/marketplace/elibrary/hooks/useEditDigitalPublication.ts', { react: h.react,
        '@/lib/api/authenticated-request': transport,
        '../api/elibraryApi': { editDigitalContent: async (id, body) => { calls.push(body); return { ...resource, ...body }; } } });
      render = () => h.render(() => hook.useEditDigitalPublication(resource, () => {}));
    }
    const setContent = (title, description) => { const state = render();
      if (kind === 'physical') state.setDraft({ ...state.draft, title, description });
      else { state.setTitle(title); state.setDescription(description); }
    };
    setContent('Hi h!tler', 'Tul_a} 😀'); await render().save();
    const failed = render(); assert.equal(calls.length, 0); assert.match(failed.error, /El nombre/);
    assert.equal(kind === 'physical' ? failed.draft.updatedAt : failed.resource.updatedAt, 'original-version');
    assert.equal(kind === 'physical' ? failed.draft.title : failed.title, 'Hi h!tler');
    setContent('Material académico 2', 'Guía para estudiantes'); await render().save();
    assert.equal(calls.length, 1); assert.equal(calls[0].updatedAt, 'original-version');
  }
});
