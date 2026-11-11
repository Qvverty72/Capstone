import { pathToFileURL } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import dotenv from 'dotenv';

export async function checkReadiness(base, { fetcher = fetch, timeoutMs = 90000 } = {}) {
  try {
    const response = await fetcher(new URL('/api/v1/ready', base), { signal: AbortSignal.timeout(timeoutMs) });
    const body = await response.json();
    return { healthy: response.ok && body.status === 'ok' && ['mongodb', 'postgresql', 'redis', 'supabase'].every(name => body.dependencies?.[name] === 'ok'), status: response.status };
  } catch { return { healthy: false, status: 0 }; }
}
export function monitorState(threshold = 3) {
  let failures = 0, down = false;
  return healthy => {
    failures = healthy ? 0 : failures + 1;
    if (!down && failures >= threshold) { down = true; return 'unavailable'; }
    if (down && healthy) { down = false; return 'recovered'; }
    return null;
  };
}
async function main() {
  dotenv.config({ quiet: true }); dotenv.config({ path: '.env.monitor.local', quiet: true });
  const target = process.env.MONITOR_API_URL ?? 'http://localhost:3000';
  const watch = process.argv.includes('--watch'), update = monitorState();
  const webhook = process.env.MONITOR_ALERT_WEBHOOK_URL;
  if (webhook && new URL(webhook).protocol !== 'https:') throw Error('Alert webhook must use HTTPS');
  do {
    const result = await checkReadiness(target), transition = update(result.healthy);
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), event: 'readiness.check', ...result, transition }));
    if (transition && webhook) {
      try { const response = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: 'CampusLink', event: transition }), signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw Error();
      } catch { console.error(JSON.stringify({ event: 'alert.delivery_failed' })); process.exitCode = 1; }
    }
    if (!watch) { process.exitCode = result.healthy ? 0 : 1; break; }
    await pause(60000);
  } while (watch);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error('Monitor configuration unavailable'); process.exitCode = 1; });
