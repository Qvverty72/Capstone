import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { baseURL } from './environment';

/** A supplied server belongs to the caller; otherwise own and clean up the Expo tree. */
export async function startDemoServer(logPath: string): Promise<() => Promise<void>> {
  if (process.env.E2E_BASE_URL) return async () => {};
  const responds = async () => {
    try { return (await fetch(baseURL, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; }
  };
  if (await responds()) throw new Error('Port 8088 is occupied. Stop that server or provide E2E_BASE_URL explicitly.');
  const require = createRequire(resolve('package.json'));
  const log = createWriteStream(logPath);
  const child = spawn(process.execPath, [require.resolve('tsx/cli'), 'qa/web.ts'], {
    env: process.env, windowsHide: true, detached: process.platform !== 'win32',
  });
  child.stdout.pipe(log); child.stderr.pipe(log);
  const stop = async () => {
    if (child.exitCode === null && child.pid) {
      if (process.platform === 'win32') await new Promise<void>(resolve => {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
        killer.once('exit', () => resolve()); killer.once('error', () => resolve());
      });
      else process.kill(-child.pid, 'SIGTERM');
    }
    log.end();
  };
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline && child.exitCode === null) {
    if (await responds()) return stop;
    await delay(500); // bounded readiness polling, never used to satisfy UI assertions
  }
  await stop();
  throw new Error(`Expo did not become ready. Inspect ${logPath}`);
}
