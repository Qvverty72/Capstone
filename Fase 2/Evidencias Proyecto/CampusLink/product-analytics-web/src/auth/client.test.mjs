import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessPortal, getPortalConfiguration, parsePortalIdentity, portalGet, PortalApiError, PortalConfigurationError } from './client.ts';

function identity() {
  return { userId: 'viewer', campusId: 'campus-a', profile: { id: 'viewer', institucion_id: 'institution', campus_id: 'campus-a', estado_cuenta: 'ACTIVA', deleted_at: null, nombre_completo: 'PRIVATE_PERSON', foto_path: 'PRIVATE_PHOTO' },
    roles: [{ id: 'role', name: 'USUARIO_AUTORIZADO', campusId: 'campus-a' }],
    permissions: [{ id: 'permission', name: 'ACCEDER_REPORTERIA', campusId: 'campus-a' }],
    capabilities: { general: true, officialActivities: false, analytics: false, reports: true } };
}

test('el acceso de reportería vincula rol y permiso al mismo campus', () => {
  const raw = identity();
  assert.equal(canAccessPortal(parsePortalIdentity(raw, 'viewer')), true);
  raw.permissions[0].campusId = 'campus-b';
  assert.equal(canAccessPortal(parsePortalIdentity(raw, 'viewer')), false);
  raw.roles[0].name = 'ESTUDIANTE';
  raw.permissions[0].campusId = 'campus-a';
  assert.equal(canAccessPortal(parsePortalIdentity(raw, 'viewer')), false);
});

test('administración autoriza un campus propio, pero no una cuenta suspendida o eliminada', () => {
  const raw = identity(); raw.roles[0].name = 'ADMINISTRADOR'; raw.permissions = [];
  assert.equal(canAccessPortal(parsePortalIdentity(raw, 'viewer')), true);
  raw.profile.estado_cuenta = 'SUSPENDIDA';
  assert.equal(canAccessPortal(parsePortalIdentity(raw, 'viewer')), false);
  raw.profile.estado_cuenta = 'ACTIVA'; raw.profile.deleted_at = '2026-01-01T00:00:00Z';
  assert.equal(canAccessPortal(parsePortalIdentity(raw, 'viewer')), false);
});

test('la identidad confirmada coincide con la sesión y descarta datos personales innecesarios', () => {
  const parsed = parsePortalIdentity(identity(), 'viewer');
  assert.doesNotMatch(JSON.stringify(parsed), /PRIVATE_PERSON|PRIVATE_PHOTO|nombre_completo|foto_path/);
  assert.throws(() => parsePortalIdentity(identity(), 'someone-else'), error => error instanceof PortalApiError && error.status === 403);
  const malformed = identity(); malformed.roles = [{}];
  assert.throws(() => parsePortalIdentity(malformed, 'viewer'), error => error instanceof PortalApiError && error.status === 502);
});

test('el transporte rechaza destinos externos o ambiguos antes de consultar sesión o red', async () => {
  for (const path of ['https://outside.invalid/api/v1/data', '/api/v1/../auth/me', '/api/v1/data?outside=1', '/api/v1/data#outside', '/api/v1/\\outside']) {
    await assert.rejects(portalGet(path), /ruta de la API no es válida/);
  }
});

test('configuración rechaza claves de servidor y URLs con credenciales sin exponer sus valores', () => {
  const names = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'];
  const saved = new Map(names.map(name => [name, process.env[name]]));
  try {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.invalid';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.example.invalid';
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QA_PUBLIC';
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    assert.equal(getPortalConfiguration().apiUrl, 'https://api.example.invalid');
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_secret_QA_SENTINEL';
    assert.throws(getPortalConfiguration, error => error instanceof PortalConfigurationError && !error.message.includes('QA_SENTINEL'));
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QA_PUBLIC';
    process.env.EXPO_PUBLIC_API_URL = 'https://user:QA_PASSWORD@example.invalid';
    assert.throws(getPortalConfiguration, error => error instanceof PortalConfigurationError && !error.message.includes('QA_PASSWORD'));
  } finally { for (const [name, value] of saved) { if (value === undefined) delete process.env[name]; else process.env[name] = value; } }
});

test('errores HTTP conservan el estado y usan mensajes locales acotados', () => {
  for (const status of [401, 403, 429, 503]) {
    const error = new PortalApiError(status); assert.equal(error.status, status); assert.ok(error.message.length < 160);
    assert.doesNotMatch(error.message, /SQL|Bearer|token|stack/);
  }
});
