/** QA de navegador con API/Supabase ficticios de loopback: nunca consulta producción. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { IDS, qaDashboard, qaIdentity, qaOptions, qaSession, qaUser } from '../tests/integration-mocks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), qa = resolve(root, '.qa'), output = resolve(qa, 'integration-dist');
const origin = 'http://127.0.0.1:4321', portal = `${origin}/analitica-producto/`;
const privateSentinel = 'qa-only-server-secret-must-never-enter-client-bundle';
const env = { ...process.env, EXPO_PUBLIC_API_URL: origin, EXPO_PUBLIC_SUPABASE_URL: origin, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictitious_browser_qa', SUPABASE_SECRET_KEY: privateSentinel };
await mkdir(qa, { recursive: true });
const browserPath = process.env.CAMPUSLINK_BROWSER_PATH ?? ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
if (!browserPath) throw new Error('Indica CAMPUSLINK_BROWSER_PATH con la ruta de Edge/Chrome instalado.');
await new Promise((resolve, reject) => {
  const builder = spawn(process.execPath, ['scripts/build.mjs', '--outdir=.qa/integration-dist'], { cwd: root, env, windowsHide: true, stdio: 'inherit' });
  builder.once('error', reject); builder.once('exit', code => code === 0 ? resolve() : reject(new Error(`Build de QA: código ${code}`)));
});
assert.equal((await readFile(resolve(output, 'analitica-producto/assets/app.js'), 'utf8')).includes(privateSentinel), false, 'Las variables privadas no se incorporan al bundle');
const state = { identityStatus: 200, dashboardStatus: 200, calls: [], delayNextDashboard: false, delayedStarted: false, delayedCompleted: false, allowedCampusIds: [IDS.campus, IDS.secondCampus] };
const server = createServer(async (request, response) => {
  const url = new URL(request.url, origin), path = url.pathname;
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  const json = (status, data) => { response.writeHead(status, headers); response.end(JSON.stringify(data)); };
  if (path.startsWith('/api/') || path.startsWith('/auth/')) {
    state.calls.push({ method: request.method, path, query: Object.fromEntries(url.searchParams), authenticated: !!request.headers.authorization });
    if (request.method === 'OPTIONS') { response.writeHead(204, headers).end(); return; }
    if (path === '/api/v1/auth/login' && request.method === 'POST') { json(200, { data: { session: qaSession() } }); return; }
    if (path === '/auth/v1/user' && request.method === 'GET') { json(200, qaUser()); return; }
    if (path === '/auth/v1/token' && request.method === 'POST') { json(200, qaSession()); return; }
    if (path === '/auth/v1/logout' && request.method === 'POST') { response.writeHead(204, headers).end(); return; }
    if (path.startsWith('/api/v1/') && !request.headers.authorization) { json(401, { error: { code: 'UNAUTHORIZED', message: 'Sesión requerida.' } }); return; }
    if (path === '/api/v1/auth/me' && request.method === 'GET') { json(state.identityStatus, state.identityStatus === 200 ? { data: qaIdentity() } : { error: { code: 'FORBIDDEN', message: 'Acceso no autorizado.' } }); return; }
    if (path === '/api/v1/analytics/options' && request.method === 'GET') {
      const options = qaOptions();
      for (const institution of options.institutions) {
        institution.campuses = institution.campuses.filter(c => state.allowedCampusIds.includes(c.id));
        institution.careers = institution.careers.map(c => ({ ...c, campusIds: c.campusIds.filter(id => state.allowedCampusIds.includes(id)) })).filter(c => c.campusIds.length);
      }
      json(200, { data: options }); return;
    }
    if (path === '/api/v1/analytics/dashboard' && request.method === 'GET') {
      if (state.delayNextDashboard) {
        state.delayNextDashboard = false; state.delayedStarted = true;
        const late = qaDashboard(url.searchParams); late.resourceDemand.views = 9876; late.resourceDemand.value = 9896;
        setTimeout(() => { json(200, { data: late }); state.delayedCompleted = true; }, 1000); return;
      }
      json(state.dashboardStatus, state.dashboardStatus === 200 ? { data: qaDashboard(url.searchParams) } : { error: { code: state.dashboardStatus === 401 ? 'UNAUTHORIZED' : state.dashboardStatus === 403 ? 'FORBIDDEN' : 'DEPENDENCY_UNAVAILABLE', message: 'Fallo simulado de QA.' } }); return;
    }
    json(405, { error: { code: 'QA_UNEXPECTED_ENDPOINT', message: 'La prueba no permite esta operación.' } }); return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
  if (path === '/analitica-producto') { response.writeHead(302, { Location: '/analitica-producto/' }).end(); return; }
  try {
    const target = resolve(output, '.' + decodeURIComponent(path), ...(path.endsWith('/') ? ['index.html'] : []));
    if (!target.startsWith(output + sep)) { response.writeHead(403).end(); return; }
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html', 'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'" });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404).end('Archivo de QA no encontrado.'); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4321, '127.0.0.1', resolve); });
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--remote-debugging-port=9227', `--user-data-dir=${resolve(qa, 'integration-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), failures = [], checks = [], network = [];
let ws, captureFailure;
let browserClosed = false;
let closeBrowser = async () => {};
const analyticsCalls = () => state.calls.filter(c => c.path.startsWith('/api/v1/analytics/'));
const dashboards = () => state.calls.filter(c => c.path === '/api/v1/analytics/dashboard');
async function ready(url) { for (let i = 0; i < 65; i++) { try { const r = await fetch(url, { signal: AbortSignal.timeout(500) }); if (r.ok) return r; } catch {} await sleep(200); } throw new Error(`No respondió ${url}`); }
try {
  await ready(portal); await ready('http://127.0.0.1:9227/json/version');
  const target = await (await fetch('http://127.0.0.1:9227/json/new?about:blank', { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let next = 1; const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (message.error) p?.reject(message.error); else p?.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    if (message.method === 'Network.requestWillBeSent') network.push({ url: message.params.request.url, method: message.params.request.method });
  };
  async function send(method, params = {}) { const id = next++; return new Promise((resolve, reject) => { const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000); pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); ws.send(JSON.stringify({ id, method, params })); }); }
  async function evaluate(expression) { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result?.value; }
  async function waitFor(condition, label) { for (let i = 0; i < 110; i++) { if (await condition()) return; await sleep(100); } throw new Error(`No se cumplió: ${label}`); }
  async function until(expression) { await waitFor(() => evaluate(expression), expression); }
  async function click(text) { assert.equal(await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)}); if(!b)return false;b.click();return true; })()`), true, `botón ${text}`); await sleep(80); }
  async function select(label, value) { await evaluate(`(() => {const s=document.querySelector('select[aria-label=${JSON.stringify(label)}]');if(!s)throw Error('Selector no encontrado: '+${JSON.stringify(label)});s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`); await sleep(120); }
  async function input(selector, value) { await evaluate(`(() => {const f=document.querySelector(${JSON.stringify(selector)});if(!f)throw Error('Campo no encontrado');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,${JSON.stringify(value)});f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}));})()`); await sleep(80); }
  async function changeGrouping() { if(!await evaluate("!!document.querySelector('select[aria-label=\"Agrupación\"]')"))await evaluate("document.querySelector('.filter-toggle').click()"); await until("!!document.querySelector('select[aria-label=\"Agrupación\"]')");const current=await evaluate("document.querySelector('select[aria-label=\"Agrupación\"]').value");await select('Agrupación',current==='week'?'month':'week'); }
  async function navigate(id, label) { await evaluate(`document.querySelector('nav a[href="#${id}"]').click()`); await until(`document.querySelector('h1')?.textContent===${JSON.stringify(label)}`); }
  async function screenshot(name) { const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(resolve(qa,name+'.png'),Buffer.from(r.data,'base64')); }
  closeBrowser = async () => { if (ws.readyState === WebSocket.OPEN) await send('Browser.close'); browserClosed = true; };
  captureFailure = async () => { await screenshot('integration-failure'); await writeFile(resolve(qa,'browser-failure.json'),JSON.stringify({fixtureOnly:true,checks,failures,requests:state.calls,body:await evaluate('document.body.textContent')},null,2)); };
  async function login() {await until("!!document.querySelector('input[name=email]')");await input('input[name=email]','admin@campuslink.test');await input('input[name=password]','qa-password-only-fixture');await click('Iniciar sesión');await waitReady();}
  async function waitReady() {await until("document.querySelector('h1')?.textContent==='Resumen general'&&document.querySelectorAll('.metric-value').length>0");}
  async function download(name) {const path=resolve(qa,name);await rm(path,{force:true});await click('Exportar CSV');await waitFor(()=>existsSync(path),'descarga '+name);return readFile(path,'utf8');}
  function pass(label) {checks.push(label);console.log('✓ '+label);}
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:qa,eventsEnabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Storage.clearDataForOrigin',{origin,storageTypes:'local_storage'});await send('Page.navigate',{url:portal});
  await until("!!document.querySelector('input[name=email]')");assert.equal(analyticsCalls().length,0);assert.equal(await evaluate("document.querySelectorAll('.metric-value').length"),0);
  await screenshot('integration-login');pass('URL propia protegida: sin sesión no se consulta analítica');
  await login();assert.equal(await evaluate("document.querySelector('select[aria-label=\"Fuente de datos\"]').value"),'real');
  assert.equal(await evaluate("document.body.textContent.includes('999.999')||document.body.textContent.includes('PII_DISCARD_QA')"),false);assert.ok(analyticsCalls().every(c=>c.authenticated));
  assert.equal(await evaluate("[...document.querySelectorAll('.line-chart')].length===2&&[...document.querySelectorAll('.line-chart')].every(svg=>[...svg.querySelectorAll('circle')].some(c=>c.getAttribute('cx')==='394'&&c.getBoundingClientRect().width>0&&c.getBoundingClientRect().height>0))"),true);
  pass('Un único intervalo conserva puntos visibles y centrados en cada gráfico');
  await screenshot('integration-real-desktop');pass('Login existente, permisos, datos reales por defecto y descarte de cuentas habilitadas');
  const loginCount=state.calls.filter(c=>c.path==='/api/v1/auth/login').length;await send('Page.reload');await waitReady();assert.equal(state.calls.filter(c=>c.path==='/api/v1/auth/login').length,loginCount);
  pass('Sesión Supabase conservada al recargar el portal en el mismo origen');
  await select('Campus',IDS.secondCampus);await waitFor(()=>dashboards().at(-1)?.query.campusIds===IDS.secondCampus,'parámetro campus autorizado');
  await select('Carrera',IDS.secondCareer);await waitFor(()=>dashboards().at(-1)?.query.careerId===IDS.secondCareer,'parámetro carrera');
  if(!await evaluate("!!document.querySelector('input[aria-label=Desde]')"))await evaluate("document.querySelector('.filter-toggle').click()");
  await until("!!document.querySelector('input[aria-label=Desde]')");
  await input('input[aria-label=Desde]','2026-10-01');await input('input[aria-label=Hasta]','2026-10-31');
  await waitFor(()=>dashboards().at(-1)?.query.from==='2026-10-01'&&dashboards().at(-1)?.query.to==='2026-10-31','parámetros de fechas');assert.equal(dashboards().at(-1).query.institutionId,IDS.institution);
  pass('Filtros reales consultan institución, campus, carrera y período');
  // Simula un transporte que ya no puede cancelar una respuesta: el portal aún debe descartarla.
  await evaluate("globalThis.__qaFetch=globalThis.fetch;globalThis.__qaIgnoreNextAbort=true;globalThis.fetch=(input,init)=>{if(globalThis.__qaIgnoreNextAbort&&String(input).includes('/api/v1/analytics/dashboard')){globalThis.__qaIgnoreNextAbort=false;const transport={...init};delete transport.signal;return globalThis.__qaFetch(input,transport);}return globalThis.__qaFetch(input,init);}");
  state.delayNextDashboard=true;await select('Campus',IDS.campus);await waitFor(()=>state.delayedStarted,'solicitud antigua retenida por QA');
  assert.equal(await evaluate("document.querySelectorAll('.metric-value').length"),0);
  await select('Campus',IDS.secondCampus);await waitReady();await waitFor(()=>state.delayedCompleted,'respuesta anterior completada');await sleep(150);
  assert.equal(await evaluate("document.querySelectorAll('.metric-value')[1].textContent"),'120');assert.equal(await evaluate("document.querySelector('.section-content').textContent.includes('Campus Dos QA')"),true);assert.equal(await evaluate("document.querySelector('.section-content').textContent.includes('9.876')"),false);
  await evaluate("globalThis.fetch=globalThis.__qaFetch;delete globalThis.__qaFetch;delete globalThis.__qaIgnoreNextAbort");
  pass('Una respuesta tardía del campus anterior no reemplaza el alcance ni sus cifras vigentes');
  for(const [id,label]of[['profiles','Perfil de usuarios'],['retention','Uso y retención'],['marketplace','Marketplace'],['demand','Demanda académica'],['community','Actividades y comunidad']]){await navigate(id,label);assert.equal(await evaluate("/NaN|Infinity|undefined/.test(document.querySelector('.section-content').textContent)"),false);assert.equal(await evaluate("document.querySelector('select[aria-label=\"Fuente de datos\"]').value"),'real');}
  await navigate('overview','Resumen general');pass('Las seis vistas mantienen la fuente real y estados de métricas pendientes');
  const realCsv=await download('campuslink-real-overview.csv');assert.match(realCsv,/reales|real/i);assert.match(realCsv,/Institución ficticia QA/);assert.doesNotMatch(realCsv,/DATOS FICTICIOS DE DEMOSTRACIÓN|PII_DISCARD_QA/);pass('CSV real agregado con alcance y fuente');
  state.dashboardStatus=503;await select('Campus',IDS.campus);await until("document.body.textContent.includes('No se pudieron cargar los datos reales')");assert.equal(await evaluate("document.querySelector('select[aria-label=\"Fuente de datos\"]').value"),'real');assert.equal(await evaluate("document.querySelectorAll('.metric-value').length"),0);pass('Fallo real no se reemplaza por demostración ni conserva cifras anteriores');
  const callsBeforeDemo=analyticsCalls().length;await select('Fuente de datos','demo');await waitReady();assert.equal(await evaluate("document.querySelectorAll('.metric-value')[0].textContent"),'840');assert.equal(analyticsCalls().length,callsBeforeDemo);
  const demoCsv=await download('campuslink-demo-overview.csv');assert.match(demoCsv,/DATOS FICTICIOS DE DEMOSTRACIÓN/);assert.doesNotMatch(demoCsv,/Institución ficticia QA/);pass('Cambio manual a demostración y CSV sin mezclar fuentes');
  await select('Fuente de datos','real');await until("document.body.textContent.includes('No se pudieron cargar los datos reales')");state.dashboardStatus=200;await click('Reintentar');await waitReady();pass('Regreso explícito a datos reales y recuperación mediante reintento');
  const removedCampus=await evaluate("document.querySelector('select[aria-label=Campus]').value"), remainingCampus=removedCampus===IDS.campus?IDS.secondCampus:IDS.campus;
  state.allowedCampusIds=[remainingCampus];state.dashboardStatus=403;await changeGrouping();await until("document.body.textContent.includes('No se pudieron cargar los datos reales')");
  assert.equal(await evaluate("document.querySelector('h1')?.textContent"),'Resumen general');assert.equal(await evaluate("document.querySelectorAll('.metric-value').length"),0);
  const catalogsBeforeRetry=state.calls.filter(c=>c.path==='/api/v1/analytics/options').length;state.dashboardStatus=200;await click('Reintentar');await waitReady();
  assert.ok(state.calls.filter(c=>c.path==='/api/v1/analytics/options').length>catalogsBeforeRetry);assert.equal(await evaluate("document.querySelector('select[aria-label=Campus]').value"),remainingCampus);assert.equal(dashboards().at(-1).query.campusIds,remainingCampus);
  state.allowedCampusIds=[IDS.campus,IDS.secondCampus];pass('Un campus deja de estar disponible: reintentar actualiza catálogos y recupera otro alcance con la misma identidad');
  state.dashboardStatus=401;state.identityStatus=401;await changeGrouping();await until("!!document.querySelector('input[name=email]')");assert.equal(await evaluate("document.querySelectorAll('.metric-value').length"),0);state.dashboardStatus=200;state.identityStatus=200;await login();pass('Sesión rechazada retira datos y exige login');
  state.dashboardStatus=403;state.identityStatus=403;await changeGrouping();await until("document.querySelector('h1')?.textContent==='Acceso no autorizado'");assert.equal(await evaluate("document.querySelectorAll('.metric-value').length"),0);await click('Cerrar sesión');state.dashboardStatus=200;state.identityStatus=200;await login();pass('Revocación de permisos retira el panel y sus cifras');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await sleep(150);assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);assert.equal(await evaluate("[...document.querySelectorAll('nav a')].every(a=>!!a.getAttribute('aria-label'))"),true);await screenshot('integration-real-mobile');
  await send('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);pass('Adaptación autenticada a 390 y 1024 px sin desbordamiento');
  await click('Cerrar sesión');await until("!!document.querySelector('input[name=email]')");const callsAfterLogout=analyticsCalls().length;await send('Page.reload');await until("!!document.querySelector('input[name=email]')");assert.equal(analyticsCalls().length,callsAfterLogout);pass('Cerrar sesión y recargar deja de consultar datos reales');
  assert.equal((await fetch(`${origin}/analitica-producto`)).status,200);pass('Acceso directo con y sin barra final');
  assert.deepEqual(network.filter(r=>!r.url.startsWith(origin+'/')&&!r.url.startsWith('data:')),[]);assert.equal(analyticsCalls().some(c=>c.method!=='GET'),false);
  assert.deepEqual(state.calls.filter(c=>c.method!=='GET'&&c.method!=='OPTIONS'&&!['/api/v1/auth/login','/auth/v1/logout','/auth/v1/token'].includes(c.path)),[]);assert.deepEqual(failures,[]);pass('Solo loopback ficticio, analítica GET y autenticación existente; sin excepciones JavaScript');
  await writeFile(resolve(qa,'browser-results.json'),JSON.stringify({fixtureOnly:true,checks,failures,requests:state.calls,screenshots:['integration-login.png','integration-real-desktop.png','integration-real-mobile.png']},null,2));
  console.log(`${checks.length} comprobaciones de integración correctas contra respuestas ficticias de QA.`);await closeBrowser();
}catch(error){await captureFailure?.().catch(()=>{});throw error;
}finally{if(!browserClosed)await closeBrowser().catch(()=>{});ws?.close();server.closeAllConnections();server.close();browser.kill();}
