import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { mock, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { Db } from 'mongodb';
import type { VerifiedAuthConnection } from '../src/modules/auth/types/auth.types.js';

/**
 * A new consumer must not turn existing GET services into persisted reports or view events.
 * Fixtures live exclusively in an in-memory PostgreSQL engine; no provider is contacted.
 */
test('product analytics consumes options and dashboard through SQL/Mongo read operations only', async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1:27017',
    SUPABASE_URL: 'https://product-analytics-test.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    SUPABASE_DB_URL: 'postgresql://postgres:simulated@product-analytics-test.invalid/postgres',
  });
  const db = new PGlite(), statements: string[] = [], pipelines: unknown[][] = [];
  const institution = randomUUID(), campus = randomUUID(), userId = randomUUID();
  const required = new Set(['institucion', 'campus', 'carrera', 'campus_carrera', 'perfil_usuario', 'usuario_carrera',
    'publicacion_recurso', 'publicacion_carrera', 'asignatura', 'publicacion_asignatura', 'mensaje_solicitud',
    'solicitud_recurso', 'interaccion_recurso', 'reporte_contenido', 'auditoria']);
  try {
    await db.exec('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);');
    const schema = await readFile('src/database/supabase/migrations/CampusLink_Schema.sql', 'utf8');
    for (const match of schema.matchAll(/CREATE TABLE public\.(\w+) \([\s\S]*?\n\);/g)) {
      if (required.has(match[1])) await db.exec(match[0]);
    }
    await db.query('INSERT INTO institucion(id,nombre) VALUES($1,$2)', [institution, 'Institución de prueba']);
    await db.query('INSERT INTO campus(id,institucion_id,nombre) VALUES($1,$2,$3)', [campus, institution, 'Campus de prueba']);
    await db.query('INSERT INTO auth.users(id) VALUES($1)', [userId]);
    await db.query(`INSERT INTO perfil_usuario(id,institucion_id,campus_id,nombre_completo,created_at)
      VALUES($1,$2,$3,'Cuenta de prueba','2026-01-01T00:00:00Z')`, [userId, institution, campus]);

    mock.method(Pool.prototype, 'connect', async () => ({
      query: (sql: string, values?: unknown[]) => {
        statements.push(sql);
        assert.doesNotMatch(sql, /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY)\b/i,
          'a dashboard/options read cannot execute mutation statements');
        return db.query(sql, values);
      },
      release() {},
    }));
    mock.method(Db.prototype, 'collection', (name: string) => ({
      aggregate: (pipeline: unknown[]) => {
        assert.equal(name, 'activity_interactions');
        assert.doesNotMatch(JSON.stringify(pipeline), /"\$(?:out|merge)"/,
          'analytical Mongo pipelines cannot write aggregation results');
        pipelines.push(pipeline);
        return { toArray: async () => [{ total: [], periods: [], audience: [] }] };
      },
    }));
    const auth: VerifiedAuthConnection = { userId, campusId: campus,
      profile: { id: userId, campus_id: campus, institucion_id: institution, nombre_completo: 'Cuenta de prueba',
        foto_path: null, verificado_en: null, estado_cuenta: 'ACTIVA', deleted_at: null },
      roles: [{ id: randomUUID(), name: 'ADMINISTRADOR', campusId: campus }], permissions: [] };
    const { getDashboard, getDashboardOptions } = await import('../src/modules/analytics/services/analytics.service.js');
    const options = await getDashboardOptions(auth);
    assert.equal(options.institutions[0].campuses[0].id, campus);
    const dashboard = await getDashboard(auth, { from: '2026-10-01', to: '2026-10-31', institutionId: institution, campusIds: campus });
    assert.equal(dashboard.resourceDemand.value, 0);
    assert.equal(dashboard.analysis?.activities.summary.uniqueParticipants, 0);
    assert.ok(statements.some(sql => sql.includes('jsonb_to_recordset')), 'executes the existing SQL metrics instead of skipping data access');
    assert.equal(pipelines.length, 1, 'executes the existing Mongo aggregation once');
    assert.ok(statements.every(sql => !/public\.reporte\b/.test(sql)), 'does not persist or fetch report snapshots');
  } finally {
    const { closePostgres } = await import('../src/database/supabase/postgres.js');
    await closePostgres();
    const { closeMongoDB } = await import('../src/database/mongodb/client.js');
    await closeMongoDB();
    mock.restoreAll();
    await db.close();
  }
});
