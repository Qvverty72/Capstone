/** UIAutomator/ADB sobre Android real o emulado. No sustituye pruebas físicas de GPU. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import assert from 'node:assert/strict';

const exec = promisify(execFile);
async function main() {
const sdk = process.env.QA_ANDROID_SDK ?? resolve('../backendclink/qa/local/tools/android/sdk');
const adb = resolve(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const serial = process.env.QA_ANDROID_SERIAL;
assert.ok(serial && /^[\w.:-]+$/.test(serial), 'Indicar QA_ANDROID_SERIAL de un dispositivo QA autorizado');
assert.equal(process.env.QA_AUTHORIZED, '1');
const m = JSON.parse(await readFile(process.env.E2E_QA_WRITE_RUN!, 'utf8'));
assert.equal(m.kind, 'campuslink-ui-qa-v1'); assert.equal(m.cleaned, undefined);
const user = m.users.find((u: { actor: string }) => u.actor === 'receptor');
const output = resolve(process.env.QA_REPORT_DIR ?? 'qa/.artifacts/native');
await mkdir(output, { recursive: true });
type Node = { text: string; desc: string; id: string; className: string; bounds: number[]; clickable: boolean };
const checks: { name: string; status: string; reason?: string }[] = [];
async function command(...args: string[]) {
  // No incluir stdout/stderr ni argumentos en errores: input text contiene credenciales QA.
  try { return (await exec(adb, ['-s', serial!, ...args], { windowsHide: true, timeout: 60_000, maxBuffer: 4_000_000 })).stdout; }
  catch { throw new Error('ADB no completó la operación; revisar el dispositivo QA'); }
}
function decode(s: string) { return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
async function nodes(): Promise<Node[]> {
  const xml = await command('exec-out', 'uiautomator', 'dump', '/dev/tty');
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(match => {
    const a = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(v => [v[1], decode(v[2])]));
    return { text: a.text, desc: a['content-desc'], id: a['resource-id'], className: a.class, bounds: [...(a.bounds ?? '').matchAll(/-?\d+/g)].map(v => Number(v[0])), clickable: a.clickable === 'true' };
  });
}
async function visible(predicate: (n: Node) => boolean, timeout = 45_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const found = (await nodes()).sort((a, b) => Number(b.clickable) - Number(a.clickable)).find(n => predicate(n) && n.bounds.length === 4 && n.bounds[3] > n.bounds[1]);
    if (found) return found;
    await wait(350); // Sondeo de estado nativo, no temporización del recorrido.
  }
  throw new Error('No apareció el control Android esperado');
}
async function tap(name: string | RegExp) {
  const navigation = ['Perfil', 'Mapa', 'Mercado', 'Biblioteca'];
  const navTop = Math.min(...(await nodes()).filter(n => n.clickable && navigation.includes(n.desc)).map(n => n.bounds[1]));
  const isNavigation = typeof name === 'string' && navigation.includes(name);
  // El árbol incluye botones parcialmente cubiertos por la barra flotante.
  // Se pulsa un control visible por encima de ella o su propia acción de navegación.
  const n = await visible(n => (isNavigation || (n.bounds[1] + n.bounds[3]) / 2 < navTop) && (typeof name === 'string' ? n.desc === name || n.text === name : name.test(n.desc || n.text)), 20_000).catch(() => { throw new Error('Control Android no encontrado: ' + String(name)); });
  await command('shell', 'input', 'tap', String(Math.round((n.bounds[0] + n.bounds[2]) / 2)), String(Math.round((n.bounds[1] + n.bounds[3]) / 2)));
}
async function fill(name: string, value: string) {
  assert.match(value, /^[A-Za-z0-9@._+!-]+$/, 'Solo datos sintéticos ASCII sin metacaracteres de shell');
  const n = await visible(n => n.className === 'android.widget.EditText' && n.desc === name);
  await command('shell', 'input', 'tap', String(Math.round((n.bounds[0] + n.bounds[2]) / 2)), String(Math.round((n.bounds[1] + n.bounds[3]) / 2)));
  await command('shell', 'input', 'keyevent', '123');
  await command('shell', 'input', 'keyevent', '--longpress', '67');
  // Seleccionar todo mediante ctrl+a y reemplazar solo el campo de esta app.
  await command('shell', 'input', 'keycombination', '113', '29');
  await command('shell', 'input', 'text', value); await command('shell', 'input', 'keyevent', '111');
}
async function screenshot(name: string) {
  const result = await exec(adb, ['-s', serial!, 'exec-out', 'screencap', '-p'], { encoding: 'buffer', windowsHide: true, timeout: 30_000, maxBuffer: 10_000_000 });
  await writeFile(resolve(output, name + '.png'), result.stdout);
}
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); checks.push({ name, status: 'passed' }); }
  catch (error) { checks.push({ name, status: 'failed', reason: error instanceof Error ? error.message : 'Fallo Android' });
    await screenshot('failure-' + checks.length).catch(() => {});
    const controls = (await nodes().catch(() => [])).filter(n => n.className !== 'android.widget.EditText').map(n => ({ text: n.text, label: n.desc, bounds: n.bounds })).filter(n => n.text || n.label);
    await writeFile(resolve(output, 'failure-' + checks.length + '.json'), JSON.stringify(controls, null, 2));
  }
  console.log(JSON.stringify(checks.at(-1)));
}
let device: Record<string, string> = {};
try {
  assert.equal((await command('get-state')).trim(), 'device');
  const apk = process.env.QA_ANDROID_APK ?? resolve('../backendclink/qa/local/native/CampusLink-0.1.2-android.apk');
  const digest = createHash('sha256'); for await (const chunk of createReadStream(apk)) digest.update(chunk);
  assert.equal(digest.digest('hex'), 'ec96896b60bb70393dbd98d60ae2823e954d144a35282c9dde6df13c413465cc', 'El APK debe coincidir con el binario auditado');
  await command('install', '-r', apk);
  for (const key of ['ro.build.version.sdk', 'ro.product.cpu.abi', 'ro.kernel.qemu']) device[key] = (await command('shell', 'getprop', key)).trim();
  const avd = (await command('shell', 'getprop', 'ro.boot.qemu.avd_name')).trim();
  if (device['ro.kernel.qemu'] === '1' && avd === 'CampusLink_QA') {
    assert.match(await command('shell', 'pm', 'clear', 'cl.campuslink.app'), /Success/);
  }
  const build = await command('shell', 'dumpsys', 'package', 'cl.campuslink.app');
  assert.match(build, /versionName=0\.1\.2/);
  await command('shell', 'am', 'force-stop', 'cl.campuslink.app');
  // Solo se limpia el paquete en nuestro AVD; nunca se limpia un teléfono externo.
  await command('shell', 'monkey', '-p', 'cl.campuslink.app', '-c', 'android.intent.category.LAUNCHER', '1');
  await check('Android: login real en Render y perfil sintético', async () => {
    await fill('Correo', user.email); await fill('Contraseña', user.password); await tap('Iniciar sesión');
    await visible(n => /Perfil/.test(n.desc || n.text));
    await visible(n => n.text === user.name); await screenshot('profile');
  });
  if (checks.at(-1)?.status === 'passed') {
    await check('Android: navegación al catálogo físico', async () => { await tap('Mercado'); await visible(n => /Publicar un recurso/.test(n.desc || n.text)); await screenshot('marketplace'); });
    await check('Android: biblioteca digital', async () => { await tap('Biblioteca'); await visible(n => n.desc === 'Publicar un recurso'); await screenshot('library'); });
    await check('Android: selector nativo de PDF con un archivo QA propio', async () => {
      const filename = 'campuslink-qa-' + m.runId + '.pdf';
      const local = resolve(process.env.E2E_QA_WRITE_RUN!, '..', 'files', 'material.pdf');
      const remote = '/sdcard/Download/' + filename;
      await command('push', local, remote);
      try {
        await tap('Publicar un recurso');
        for (let i = 0; i < 15; i++) {
          const current = await nodes(), navTop = Math.min(...current.filter(n => n.clickable && ['Perfil', 'Mapa', 'Mercado', 'Biblioteca'].includes(n.desc)).map(n => n.bounds[1]));
          if (current.some(n => /Seleccionar archivos PDF/.test(n.desc || n.text) && (n.bounds[1] + n.bounds[3]) / 2 < navTop)) break;
          await command('shell', 'input', 'swipe', '350', '930', '350', '400', '450');
        }
        await tap(/Seleccionar archivos PDF/);
        const rows = await nodes();
        if (!rows.some(n => n.text === filename)) {
          await tap(/Show roots|Mostrar raíces|Open navigation drawer/);
          await tap(/Downloads|Descargas/);
        }
        await tap(filename);
        const current = await nodes();
        if (current.some(n => /^(OPEN|ABRIR|SELECT|SELECCIONAR)$/i.test(n.text))) await tap(/^(OPEN|ABRIR|SELECT|SELECCIONAR)$/i);
        await visible(n => n.desc === 'Navegación principal');
        await visible(n => n.text.includes(filename)); await screenshot('pdf-picker');
      } finally {
        await command('shell', 'rm', remote);
        if (!(await nodes()).some(n => n.desc === 'Navegación principal')) await command('shell', 'input', 'keyevent', '4');
      }
    });
    await check('Android: GL, rotación, edificio, piso y punto de interés', async () => {
      await tap('Mapa');
      await visible(n => /Ver actividades del campus/.test(n.desc));
      await screenshot('map-before');
      const gl = await command('shell', 'dumpsys', 'gfxinfo', 'cl.campuslink.app');
      await writeFile(resolve(output, 'gfxinfo.txt'), gl);
      const pid = (await command('shell', 'pidof', 'cl.campuslink.app')).trim(); assert.match(pid, /^\d+$/);
      const errors = await command('shell', 'logcat', '-d', '--pid=' + pid, '-s', 'AndroidRuntime:E', 'ReactNativeJS:E');
      assert.doesNotMatch(errors, /FATAL EXCEPTION|Unable to resolve|GLContext.*(?:fail|error)|TypeError:/i);
      const candidates = (await nodes()).filter(n => /Edificio|Piso|Ver información de/.test(n.desc || n.text));
      await writeFile(resolve(output, 'map-controls.json'), JSON.stringify(candidates.map(n => ({ text: n.text, label: n.desc, bounds: n.bounds })), null, 2));
      const size = await command('shell', 'wm', 'size'); const dimensions = /Physical size: (\d+)x(\d+)/.exec(size); assert.ok(dimensions);
      const w = Number(dimensions[1]), h = Number(dimensions[2]);
      await command('shell', 'input', 'swipe', String(Math.round(w*.35)), String(Math.round(h*.4)), String(Math.round(w*.6)), String(Math.round(h*.45)), '550');
      await screenshot('map-after-rotation');
      const require = createRequire(resolve('package.json')), ffmpeg = require('ffmpeg-static');
      const hash = async (name: string) => (await exec(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', resolve(output, name + '.png'), '-vf', 'crop=iw*0.7:ih*0.4:iw*0.15:ih*0.25', '-f', 'framemd5', '-'], { windowsHide: true })).stdout;
      assert.notEqual(await hash('map-before'), await hash('map-after-rotation'), 'El gesto debe cambiar los píxeles de la escena GL');
      // Punto de la fachada verificado visualmente en las capturas del APK auditado.
      await command('shell', 'input', 'tap', String(Math.round(w*.30)), String(Math.round(h*.45)));
      await visible(n => n.desc === 'Volver atrás'); await screenshot('building-selected');
      let previous = '', stable = false; const settling = Date.now() + 15_000;
      while (Date.now() < settling) {
        await screenshot('building-selected'); const current = await hash('building-selected');
        if (current === previous) { stable = true; break; } previous = current;
      }
      assert.ok(stable, 'La cámara debe estabilizarse antes del raycasting del piso');
      await command('shell', 'input', 'tap', String(Math.round(w*350/720)), String(Math.round(h*690/1280)));
      await visible(n => n.text === 'Edificio H — Piso 2'); await screenshot('floor-selected');
      await tap('Ver información de Biblioteca');
      await visible(n => n.text === 'Información del lugar');
      await visible(n => n.text === 'Biblioteca. Edificio H, Piso 2.'); await screenshot('poi-library');
      await tap('Cerrar información del punto de interés');
      await visible(n => n.desc === 'Navegación principal');
    });
    checks.push({ name: 'Zoom multitáctil y validación en GPU física', status: 'skipped', reason: 'ADB input no genera dos punteros en este ejecutor. Se requiere instrumentación multitáctil o prueba asistida; SwiftShader tampoco certifica una GPU física.' });
    checks.push({ name: 'iOS y cámara física', status: 'skipped', reason: 'Windows no ofrece simulador iOS; la cámara física requiere un dispositivo.' });
    await check('Android: cierre de sesión', async () => { await tap('Perfil'); await tap('Abrir opciones de cuenta'); await tap('Cerrar sesión'); await visible(n => n.desc === 'Iniciar sesión'); });
  }
} finally {
  const report = { recordedAt: new Date().toISOString(), target: m.apiOrigin, runId: m.runId, device,
    apk: { version: '0.1.2', source: '19d52134fbc054a5aebeee6ec53e46779880b71e', sha256: 'ec96896b60bb70393dbd98d60ae2823e954d144a35282c9dde6df13c413465cc' }, checks };
  await writeFile(resolve(output, 'native.json'), JSON.stringify(report, null, 2));
}
if (checks.some(c => c.status === 'failed')) process.exitCode = 1;
}
main().catch(() => { console.error('No se pudo iniciar el recorrido Android QA'); process.exitCode = 1; });
