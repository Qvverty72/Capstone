/** Uso: npm run test:e2e:real -- local|render. Credenciales solo desde el manifiesto ignorado. */
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, mkdir, open, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { setTimeout as wait } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

async function main() {
  const args = process.argv.slice(2);
  const suite = args.find(arg => arg.startsWith('--suite='))?.slice(8) ?? 'default';
  if (!['default', 'resilience', 'load', 'native', 'auth', 'workers'].includes(suite)) throw new Error('Suite QA desconocida');
  const writeMode = args.includes('--write');
  const cli = args.filter(arg => arg !== '--write' && !arg.startsWith('--suite='));
  const target = cli.shift() ?? 'local';
  if (!['local', 'render'].includes(target) || process.env.QA_AUTHORIZED !== '1') {
    throw new Error('Uso: QA_AUTHORIZED=1 npm run test:e2e:real -- local|render');
  }
  const backend = resolve('../backendclink');
  let backendNode = process.env.QA_NODE_BINARY;
  if (!backendNode && process.versions.node.startsWith('22.')) backendNode = process.execPath;
  if (!backendNode) {
    const localNode = resolve(backend, 'qa/local/tools/node22', process.platform === 'win32' ? 'node.exe' : 'bin/node');
    try { await access(localNode); backendNode = localNode; }
    catch { throw new Error('backendclink requiere Node 22.13+. Ejecuta con Node 22 o indica QA_NODE_BINARY.'); }
  }
  const publicEnv = parseEnv(await readFile('.env', 'utf8'));
  let manifest = writeMode ? undefined : JSON.parse(await readFile(resolve(backend, 'qa/local/manifest.json'), 'utf8'));
  if (!writeMode && (!manifest.steps.complete || manifest.cleaned || !manifest.users.every((u: { email: string }) => u.email.endsWith('@campuslink.invalid')))) {
    throw new Error('Se requiere el manifiesto sintético de qa:seed');
  }
  const actor = (name: string) => manifest.users.find((u: { actor: string }) => u.actor === name);
  const api = target === 'local' ? 'http://127.0.0.1:3011' : process.env.QA_API_URL;
  const web = target === 'local' ? 'http://localhost:8090' : process.env.QA_WEB_URL;
  if (!api || !web) throw new Error('Render requiere QA_API_URL y QA_WEB_URL explícitas');
  for (const url of [api, web]) {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.search || parsed.hash || (target === 'render' && parsed.protocol !== 'https:')) throw new Error('URL QA inválida');
  }
  if (suite === 'native' && target !== 'render') throw new Error('El APK disponible apunta a Render; no certifica un backend local');
  const browserSuite = !['load', 'native', 'workers'].includes(suite);
  const artifacts = resolve('qa/.artifacts/real-' + target + (suite === 'default' ? (writeMode ? '-write' : '') : '-' + suite));
  await mkdir(artifacts, { recursive: true });
  const localRequire = createRequire(resolve('package.json'));
  const children: ChildProcess[] = [];
  const logs: Awaited<ReturnType<typeof open>>[] = [];
  let interrupted = false;
  let activeTest: ChildProcess | undefined;
  const runId = writeMode ? randomUUID() : undefined;
  const fixtureFile = runId ? resolve(backend, 'qa/local/ui-runs', runId, 'manifest.json') : undefined;
  const lifecycle = { runId, target, prepared: false, cleaned: false, testsExit: null as number | null };
  const saveLifecycle = () => writeFile(resolve(artifacts, 'lifecycle.json'), JSON.stringify(lifecycle, null, 2));
  async function fixture(command: 'prepare' | 'clean') {
    const log = await open(resolve(artifacts, 'fixture-' + command + '.log'), 'w');
    try {
      const child = spawn(backendNode!, ['qa/ui-fixture.mjs', command, runId!], {
        cwd: backend, env: { ...process.env, QA_API_URL: api }, stdio: ['ignore', log.fd, log.fd], windowsHide: true,
      });
      const code = await new Promise<number>(done => { child.once('exit', n => done(n ?? 1)); child.once('error', () => done(1)); });
      if (code !== 0) throw new Error(`Falló ${command} de la institución QA temporal; revisar ${artifacts}. Ejecución ${runId}`);
    } finally { await log.close(); }
  }
  const cancel = () => { interrupted = true; activeTest?.kill('SIGTERM'); };
  async function launch(args: string[], cwd: string, env: NodeJS.ProcessEnv, name: string, node = process.execPath) {
    const log = await open(resolve(artifacts, name + '.log'), 'w'); logs.push(log);
    const child = spawn(node, args, { cwd, env, stdio: ['ignore', log.fd, log.fd, 'ipc'], windowsHide: true });
    children.push(child);
    child.on('error', () => { console.error(`No se pudo iniciar ${name}`); });
    return child;
  }
  async function ready(url: string, child?: ChildProcess) {
    const end = Date.now() + 180_000;
    while (Date.now() < end) {
      if (interrupted) throw new Error('Pruebas interrumpidas');
      if (child && child.exitCode !== null) throw new Error('Servidor QA terminó; revisar logs locales');
      try { if ((await fetch(url, { signal: AbortSignal.timeout(Math.min(30_000, Math.max(1, end - Date.now()))) })).ok) return; } catch { /* disponibilidad */ }
      await wait(500);
    }
    throw new Error('El servidor QA no estuvo disponible dentro del plazo');
  }
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  try {
    if (writeMode) {
      console.log(`QA UI temporal: ${runId}`);
      await fixture('prepare');
      manifest = JSON.parse(await readFile(fixtureFile!, 'utf8'));
      lifecycle.prepared = true; await saveLifecycle();
    }
    if (target === 'local') {
      const authURL = publicEnv.EXPO_PUBLIC_SUPABASE_URL;
      if (!authURL || new URL(authURL).hostname !== manifest.target.supabase) throw new Error('Supabase web no coincide con el manifiesto QA');
      const apiChild = await launch(['qa/serve.mjs'], backend,
        { ...process.env, QA_PORT: '3011', QA_SQL_DIAGNOSTICS: writeMode ? '1' : '', RATE_LIMIT_REDIS_URL: process.env.QA_REDIS_URL ?? 'redis://127.0.0.1:16379' }, 'api', backendNode);
      await ready(api + '/api/v1/ready', apiChild);
      if (browserSuite) {
      const webChild = await launch([localRequire.resolve('expo/bin/cli'), 'start', '--web', '--localhost', '--port', '8090'], process.cwd(), {
        ...process.env, CI: '1', EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: api,
        EXPO_PUBLIC_SUPABASE_URL: authURL,
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
      }, 'expo');
      await ready(web, webChild);
      }
    } else {
      // Render gratuito puede arrancar en frío; esperar readiness antes de medir los recorridos UI.
      await ready(api + '/api/v1/ready');
      if (browserSuite) await ready(web);
    }
    const entry = suite === 'load' ? [resolve(backend, 'qa/load.mjs')] : suite === 'workers' ? [resolve(backend, 'qa/worker-resilience.mjs')] : suite === 'native'
      ? [localRequire.resolve('tsx/cli'), 'qa/native/android.ts']
      : [localRequire.resolve('@playwright/test/cli'), 'test', '--workers=1', ...cli];
    const child = spawn(['load', 'workers'].includes(suite) ? backendNode : process.execPath, entry, {
      stdio: 'inherit', windowsHide: true, env: { ...process.env,
        E2E_QA_SUITE: suite, QA_API_URL: api, QA_REPORT_DIR: artifacts,
        QA_NODE_BINARY: backendNode,
        E2E_QA_AUTH_URL: publicEnv.EXPO_PUBLIC_SUPABASE_URL,
        E2E_QA_AUTH_KEY: publicEnv.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? publicEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        E2E_MODE: 'real', E2E_QA_AUTHORIZED: '1', E2E_BASE_URL: web,
        E2E_REPORT_DIR: artifacts, E2E_QA_EMAIL: actor('receptor').email, E2E_QA_PASSWORD: actor('receptor').password,
        E2E_QA_WRITE_RUN: fixtureFile ?? '',
        E2E_QA_DATA: writeMode ? '' : JSON.stringify({ publications: manifest.publications.map(({ key, title }: { key: string; title: string }) => ({ key, title })),
          activityTitle: manifest.activities.find((a: { key: string }) => a.key === 'oficial-futura')?.body?.title }),
      },
    });
    activeTest = child;
    children.push(child);
    const code = await new Promise<number>(resolveExit => { child.once('exit', n => resolveExit(n ?? 1)); child.once('error', () => resolveExit(1)); });
    process.exitCode = interrupted ? 130 : code;
    if (writeMode) { lifecycle.testsExit = Number(process.exitCode); await saveLifecycle(); }
  } finally {
    process.off('SIGINT', cancel); process.off('SIGTERM', cancel);
    for (const child of children.reverse()) {
      if (child.exitCode !== null || !child.pid) continue;
      if (child.connected) {
        child.send('stop');
        await new Promise<void>(done => { const timer = setTimeout(done, 6000); child.once('exit', () => { clearTimeout(timer); done(); }); });
        if (child.exitCode !== null) continue;
      }
      if (process.platform === 'win32') {
        // Solo procesos creados por este recorrido; nunca se cierran servidores ajenos.
        await new Promise<void>(done => { const kill = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); kill.once('exit', () => done()); kill.once('error', () => done()); });
      } else child.kill('SIGTERM');
    }
    for (const log of logs) await log.close();
    if (writeMode) { await fixture('clean'); lifecycle.cleaned = true; await saveLifecycle(); }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
