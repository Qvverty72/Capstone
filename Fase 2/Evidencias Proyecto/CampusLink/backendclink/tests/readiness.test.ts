import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { before, test } from 'node:test';
import type { Express } from 'express';
import type { DependencyName, ReadinessProbes } from '../src/shared/health/readiness.js';

let check: typeof import('../src/shared/health/readiness.js').createReadinessCheck;
let createApp: typeof import('../src/app.js').createApp;
before(async () => {
  Object.assign(process.env, { NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1',
    SUPABASE_URL: 'https://readiness-test.invalid', SUPABASE_PUBLISHABLE_KEY: 'test',
    RATE_LIMIT_REDIS_URL: 'redis://127.0.0.1:1', TRUST_PROXY_HOPS: '1',
    CORS_ALLOWED_ORIGINS: 'https://web-test.invalid', RATE_LIMIT_ORIGIN_MAX: '2' });
  ({ createReadinessCheck: check } = await import('../src/shared/health/readiness.js'));
  ({ createApp } = await import('../src/app.js'));
});
const names: DependencyName[] = ['mongodb', 'postgresql', 'redis', 'supabase'];
const probes = (): ReadinessProbes => Object.fromEntries(names.map(name => [name, async () => {}])) as ReadinessProbes;
async function withServer(app: Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try { await run('http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/v1'); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

test('production readiness: all dependencies healthy; liveness does not call probes or Redis', async () => {
  let calls = 0;
  const healthy = check(probes());
  const app = createApp({ readiness: () => { calls++; return healthy(); }, rateLimitStore: {
    consume: async () => { throw Error('redis://secret@private'); },
  } });
  await withServer(app, async base => {
    for (const path of ['/health', '/health/', '/HeAlTh']) {
      const response = await fetch(base + path); assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'ok' });
    }
    assert.equal(calls, 0);
    const response = await fetch(base + '/ready'); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { status: 'ok', dependencies: Object.fromEntries(names.map(n => [n, 'ok'])) });
    assert.equal((await fetch(base + '/auth/me')).status, 503);
    assert.equal((await fetch(base + '/auth/health')).status, 503);
  });
});

for (const name of names) test(`production readiness returns 503 when ${name} fails, without secrets`, async () => {
  const failing = probes(); failing[name] = async () => { throw Error('password postgres://private/db /internal SQL SELECT personal'); };
  await withServer(createApp({ readiness: check(failing) }), async base => {
    const response = await fetch(base + '/ready'); assert.equal(response.status, 503);
    const body = await response.json(); assert.equal(body.status, 'unavailable');
    assert.deepEqual(body.dependencies, Object.fromEntries(names.map(n => [n, n === name ? 'unavailable' : 'ok'])));
    assert.doesNotMatch(JSON.stringify(body), /password|private|internal|SELECT|personal/);
  });
});

test('timeouts remain bounded and never create overlapping underlying operations after cache expiry', async () => {
  let calls = 0, time = 0, release!: () => void;
  const stalled = probes(); stalled.mongodb = () => { calls++; return new Promise<void>(resolve => { release = resolve; }); };
  const read = check(stalled, { timeoutMs: 20, ttlMs: 10, now: () => time });
  assert.equal((await read()).dependencies.mongodb, 'unavailable');
  time = 20;
  assert.equal((await read()).status, 'unavailable'); assert.equal(calls, 1);
  release(); await new Promise(resolve => setImmediate(resolve)); time = 40;
  stalled.mongodb = async () => { calls++; };
  assert.equal((await read()).status, 'ok'); assert.equal(calls, 2);
});

test('concurrent queries share one batch; cache includes failures and expires', async () => {
  let calls = 0, time = 0;
  const simulated = probes(); simulated.redis = async () => { calls++; throw Error('secret'); };
  const read = check(simulated, { ttlMs: 50, now: () => time });
  const results = await Promise.all(Array.from({ length: 40 }, () => read()));
  assert.ok(results.every(result => result.status === 'unavailable')); assert.equal(calls, 1);
  await read(); assert.equal(calls, 1); time = 51; await read(); assert.equal(calls, 2);
});

test('synchronous probe errors and unexpected readiness exceptions are sanitized; Express survives', async () => {
  const sync = probes(); sync.postgresql = () => { throw Error('private'); };
  assert.equal((await check(sync)()).dependencies.postgresql, 'unavailable');
  await withServer(createApp({ readiness: async () => { throw Error('private credential'); } }), async base => {
    assert.equal((await fetch(base + '/ready')).status, 503);
    assert.doesNotMatch(await (await fetch(base + '/ready')).text(), /private|credential|stack/);
    assert.equal((await fetch(base + '/health')).status, 200);
  });
});

test('public readiness allowlists fields and statuses even when a probe returns diagnostics', async () => {
  const read = async () => ({ status: 'ok' as const, dependencies: { mongodb: 'ok', postgresql: 'ok', redis: 'ok', supabase: 'ok' },
    secret: 'private', modules: ['internal'] });
  await withServer(createApp({ readiness: read as never }), async base => {
    const body = await (await fetch(base + '/ready')).text(); assert.doesNotMatch(body, /private|secret|internal|modules/);
  });
});

test('one trusted ingress hop ignores forged leftmost IPs, separates clients, and preserves quotas', async () => {
  const { MemoryRateLimitStore } = await import('../src/shared/rate-limit/rate-limit.js');
  await withServer(createApp({ rateLimitStore: new MemoryRateLimitStore() }), async base => {
    const request = (forwarded: string) => fetch(base + '/unknown', { headers: { 'X-Forwarded-For': forwarded } });
    assert.equal((await request('192.0.2.66, 203.0.113.10')).status, 404);
    assert.equal((await request('192.0.2.77, 203.0.113.10')).status, 404);
    assert.equal((await request('192.0.2.88, 203.0.113.10')).status, 429);
    assert.equal((await request('192.0.2.88, 203.0.113.11')).status, 404);
  });
});

test('production CORS permits the configured web origin and native clients; other origins get no CORS grant', async () => {
  await withServer(createApp(), async base => {
    const allowed = await fetch(base + '/health', { headers: { Origin: 'https://web-test.invalid' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://web-test.invalid');
    const rejected = await fetch(base + '/health', { headers: { Origin: 'https://evil.invalid' } });
    assert.equal(rejected.headers.get('access-control-allow-origin'), null);
    assert.equal((await fetch(base + '/health')).status, 200);
  });
});
