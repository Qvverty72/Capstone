import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { encrypt, decrypt } from '../../scripts/backup-crypto.mjs';
import { checkReadiness, monitorState } from '../../scripts/monitor.mjs';

test('backup encryption recovers exact binary bytes; corruption/wrong key never yields accepted plaintext', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'campuslink-backup-test-'));
  try {
    const file = join(dir, 'snapshot.enc'), secret = randomBytes(32), input = randomBytes(65536);
    await encrypt(input, file, secret); assert.deepEqual(await decrypt(file, secret), input);
    await assert.rejects(decrypt(file, randomBytes(32)));
    const bytes = await readFile(file); bytes[100] ^= 1; await writeFile(file, bytes);
    await assert.rejects(decrypt(file, secret));
  } finally { await rm(dir, { recursive: true }); }
});
test('readiness rejects HTTP 200 loading pages, missing dependencies and provider failure', async () => {
  const good = { status: 'ok', dependencies: Object.fromEntries(['mongodb','postgresql','redis','supabase'].map(k => [k,'ok'])) };
  const check = (body, status = 200) => checkReadiness('http://localhost', { fetcher: async () => new Response(body, { status }) });
  assert.equal((await check(JSON.stringify(good))).healthy, true);
  assert.equal((await check('<html>loading</html>')).healthy, false);
  assert.equal((await check('{"status":"ok"}')).healthy, false);
  assert.equal((await check(JSON.stringify(good), 503)).healthy, false);
  assert.equal((await checkReadiness('http://localhost', { fetcher: async () => { throw Error('private endpoint'); } })).healthy, false);
});
test('monitor alerts only after three consecutive failures and once per recovery', () => {
  const update = monitorState();
  assert.deepEqual([false,false,true,false,false,false,false,true,true].map(update), [null,null,null,null,null,'unavailable',null,'recovered',null]);
});
