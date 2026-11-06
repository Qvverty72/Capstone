import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';

function load(path, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/' + path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, AbortController, Date, Intl, Error, ...globals,
    require: name => { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; } });
  return module.exports;
}
const creation = load('features/activities/types/creation.ts');
const editing = load('features/activities/types/editing.ts', { './creation': creation });
const recurrence = load('features/activities/types/recurrence.ts');
const messages = load('features/activities/api/activityFormErrors.ts');
const transport = load('lib/api/authenticated-request.ts', {
  '@/features/auth/api/supabaseClient': { getSupabaseClient: () => ({ auth: {
    getSession: async () => ({ data: { session: { access_token: 'qa-token' } } }),
  } }) },
}, { Headers, process: { env: { EXPO_PUBLIC_API_URL: 'https://qa.invalid' } },
  fetch: async () => Response.json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed.', details: [
    { field: 'title', message: 'El nombre no puede quedar en blanco.' },
    { field: 'endAt', message: 'El término debe ser posterior al inicio.' },
    null, { field: 'description', message: 123 }, { field: 'x'.repeat(121), message: 'Invalid' },
    { field: 'description', message: 'x'.repeat(501) }, { field: 'description', message: ' ' },
  ] } }, { status: 400 }) });

test('transport preserves bounded field details so activity forms show causes instead of the generic header', async () => {
  await assert.rejects(transport.authenticatedRequest('/api/v1/activities'), error => {
    assert.ok(error instanceof transport.AuthApiError);
    assert.equal(error.details.length, 2);
    assert.equal(messages.activityFormErrorMessage(error, 'Fallback'),
      'El nombre no puede quedar en blanco.\nEl término debe ser posterior al inicio.');
    return true;
  });
  assert.equal(messages.activityFormErrorMessage(new transport.AuthApiError(400, 'Request validation failed.'), 'Revisa el horario.'), 'Revisa el horario.');
  assert.equal(messages.activityFormErrorMessage(new transport.AuthApiError(409, 'Solo puedes tener activa una actividad comunitaria'), 'Fallback'),
    'Solo puedes tener activa una actividad comunitaria');
});

function runtime() {
  const slots = []; let index = 0; let effects = [];
  return {
    react: {
      useState(initial) { const i = index++; if (!(i in slots)) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }]; },
      useRef(initial) { return slots[index++] ??= { current: initial }; },
      useEffect(fn, deps) { const i = index++; const old = slots[i];
        if (!old || deps.some((value, j) => !Object.is(value, old.deps[j]))) effects.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
      useCallback(fn) { return fn; },
    },
    render(fn) { index = 0; effects = []; const result = fn(); effects.forEach(effect => effect()); return result; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
const nodes = node => Array.isArray(node) ? node.flatMap(nodes)
  : !node || typeof node !== 'object' ? [] : [node, ...nodes(node.props?.children)];
const content = node => Array.isArray(node) ? node.map(content).join(' ')
  : typeof node === 'string' ? node : node && typeof node === 'object' ? content(node.props?.children) : '';
const locations = [{ id: 'building', name: 'Edificio', floors: [{ id: 'floor', name: 'Piso 1', pois: [] }] }];
const valid = { title: 'Taller', description: 'Descripción libre', startDate: '11/10/2099', startTime: '12:00',
  endDate: '11/10/2099', endTime: '13:00', buildingKey: 'building', floorKey: 'floor', poiKey: '', customLabel: '' };

function form(kind, { error, officialCapability = true } = {}) {
  const h = runtime(); let calls = 0; let saved = 0;
  const activity = { id: 'activity', campusId: 'campus', type: 'COMMUNITY_ACTIVITY', title: valid.title,
    description: valid.description, startAt: creation.localActivityTimestamp(valid.startDate, valid.startTime),
    endAt: creation.localActivityTimestamp(valid.endDate, valid.endTime), location: { buildingKey: 'building', floorKey: 'floor' }, editing: { revision: 1 } };
  const failOrCreate = async () => { calls++; if (error) throw error; return activity; };
  const auth = { identity: { profile: { id: 'user' }, campusId: 'campus', capabilities: { officialActivities: officialCapability } }, refreshIdentity() {} };
  const dependencies = {
    react: h.react, 'react/jsx-runtime': jsx,
    'react-native': { ActivityIndicator: 'Spinner', Pressable: 'Button', Text: 'Text', View: 'View', StyleSheet: { create: value => value } },
    '@/types/colors': { APP_COLORS: { PRIMARY: '#008080' } },
    '@/features/auth/hooks/useAuth': { useAuth: () => auth },
    '@/lib/api/authenticated-request': transport, '../api/activityFormErrors': messages,
    '../types/creation': creation, '../types/editing': editing, '../types/recurrence': recurrence,
    './ActivityFields': { ActivityFields: 'ActivityFields' }, './ActivityRecurrencePicker': { ActivityRecurrencePicker: 'Recurrence' },
    './ActivityBackButton': { ActivityBackButton: 'Back' },
    '../api/activitiesApi': { createCommunityActivity: failOrCreate, createOfficialEvent: failOrCreate,
      fetchCommunityActivityCreationAvailability: async () => ({ canCreate: true }),
      previewActivityEdit: async () => { calls++; if (error) throw error; return { previewHash: 'hash' }; },
      saveActivityEdit: async () => ({ updatedCount: 1 }) },
  };
  const name = kind === 'create' ? 'CreateActivityForm' : 'EditActivityForm';
  const Component = load(`features/activities/components/${name}.tsx`, dependencies)[name];
  const render = () => h.render(() => Component(kind === 'create'
    ? { locations, initialLocation: { buildingKey: 'building', floorKey: 'floor' }, onCreated: () => saved++ }
    : { activity, locations, onCancel() {}, onSaved: () => saved++ }));
  const update = patch => { const fields = nodes(render()).find(node => node.type === 'ActivityFields');
    Object.entries(patch).forEach(([key, value]) => fields.props.change(key, value)); };
  const submit = async () => { const button = nodes(render()).find(node => node.type === 'Button'
    && /^(Publicar actividad|Guardar cambios)$/.test(content(node))); button.props.onPress(); await setImmediate(); };
  const alert = () => nodes(render()).filter(node => node.props?.accessibilityRole === 'alert').map(content).join('\n');
  return { render, update, submit, alert, unmount: h.unmount, calls: () => calls, saved: () => saved };
}

test('create and edit show a specific local error, retain the draft and submit only after correction', async () => {
  for (const kind of ['create', 'edit']) {
    const q = form(kind); q.render(); q.update({ ...valid, endTime: '11:00' });
    await q.submit(); assert.match(q.alert(), /término.*anteriores.*día siguiente/); assert.equal(q.calls(), 0);
    assert.equal(nodes(q.render()).find(node => node.type === 'ActivityFields').props.draft.title, valid.title);
    q.update({ endTime: '13:00' }); assert.equal(q.alert(), ''); await q.submit();
    assert.equal(q.calls(), 1); assert.equal(q.saved(), 1); q.unmount();
  }
});

test('description choices explain the missing selection and server rejections keep the actual field cause in both forms', async () => {
  const choice = form('create', { officialCapability: false }); choice.render(); await setImmediate();
  choice.update({ title: 'Taller' }); await choice.submit(); assert.match(choice.alert(), /Falta elegir una descripción.*Selecciona/);
  assert.equal(choice.calls(), 0); choice.unmount();
  for (const kind of ['create', 'edit']) {
    const q = form(kind, { error: new transport.AuthApiError(400, 'Request validation failed.', 'VALIDATION_ERROR',
      [{ field: 'location.floorKey', message: 'El piso ya no está disponible. Selecciona otro piso.' }]) });
    q.render(); q.update(valid); await q.submit(); assert.match(q.alert(), /piso.*Selecciona otro piso/);
    assert.doesNotMatch(q.alert(), /Request validation failed/); assert.equal(q.saved(), 0); q.unmount();
  }
});

test('editing preserves the community limit conflict instead of falsely reporting a concurrent change', async () => {
  const q = form('edit', { error: new transport.AuthApiError(409, 'Solo puedes tener activa una actividad comunitaria') });
  q.render(); await q.submit(); assert.match(q.alert(), /Solo puedes tener activa una actividad comunitaria/);
  assert.doesNotMatch(q.alert(), /cambió mientras/); assert.equal(q.saved(), 0); q.unmount();
});

test('recurrence identifies missing/invalid end date, no weekdays and the invalid omission entry', () => {
  const check = (until, exclusions = '', weekdays = [1]) => recurrence.recurrenceDraftRule('WEEKLY', '1', until, exclusions, 'UTC', weekdays);
  assert.match(check('').error, /Falta indicar.*¿Hasta cuándo/);
  assert.match(check('30/02/2099').error, /fecha.*no es válida.*calendario/);
  assert.match(check('12/10/2099', '', []).error, /al menos un día.*Selecciona/);
  assert.match(check('12/10/2099', '11/10/2099,30/02/2099').error, /número 2.*no es válida.*DD\/MM\/AAAA/);
  assert.match(check('12/10/2099', '11/10/2099,11/10/2099').error, /repetidas.*una sola vez/);
  assert.ok(check('12/10/2099').rule);
});
