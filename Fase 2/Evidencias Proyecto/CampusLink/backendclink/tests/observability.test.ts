import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { requestLog } from '../src/shared/http/request-log.js';

test('structured request logs correlate a response without URLs, query values, cookies or credentials', async () => {
  const logs: string[] = [], logger = mock.method(console, 'log', line => logs.push(String(line)));
  const app = express(); app.use(requestLog);
  app.get('/private/:id', (_request, response) => response.json({ ok: true }));
  const nested = express.Router(); nested.get('/unread-count', (_request, response) => response.json({ count: 0 }));
  app.use('/api/v1/users/:userId/notifications', nested);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/private/personal@example.invalid?token=secret-query`,
      { headers: { Authorization: 'Bearer private-token', Cookie: 'private-cookie' } });
    await response.json();
    const record = JSON.parse(logs[0]); assert.equal(record.route, '/private/:id'); assert.equal(record.status, 200);
    assert.equal(record.requestId, response.headers.get('x-request-id')); assert.equal(typeof record.durationMs, 'number');
    await (await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/users/personal@example.invalid/notifications/unread-count`)).json();
    assert.equal(JSON.parse(logs[1]).route, '/api/v1/users/:id/notifications/unread-count');
    for (const secret of ['personal@','secret-query','private-token','private-cookie']) assert.ok(!logs.join('').includes(secret));
  } finally { await new Promise<void>(r => server.close(() => r())); logger.mock.restore(); }
});
