// Carga HTTP acotada, de solo lectura, sobre el campus sintético ya preparado.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as wait} from 'node:timers/promises';
import {qaApiBase} from './fixtures.mjs';

assert.equal(process.env.QA_AUTHORIZED,'1','QA_AUTHORIZED=1 requerido');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'local');
const m=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
assert.ok(m.steps.complete&&!m.cleaned&&m.users.every(u=>u.email.endsWith('@campuslink.invalid')));
const base=qaApiBase(process.env.QA_API_URL??'http://127.0.0.1:3011');
const remote=!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname);
const output=resolve(process.env.QA_REPORT_DIR??resolve(root,'logs'));
const user=m.users.find(u=>u.actor==='receptor');
const auth=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:user.password}),signal:AbortSignal.timeout(60000)});
assert.equal(auth.status,200,'Login QA no disponible');
const token=(await auth.json()).data.session.access_token;
const routes=['/users/me/overview','/marketplace/physicalgoods?limit=20&page=1','/marketplace/elibrary?limit=20&page=1','/users/me/notifications',`/maps/${m.campuses[0]}/active`];
const samples=[],stages=[];
let nextStart=0;
const interval=remote?600:150; // Techo global: 1,67 req/s Render; 6,67 req/s local.
async function request(path,stage){
 const slot=Math.max(Date.now(),nextStart);nextStart=slot+interval;await wait(Math.max(0,slot-Date.now()));
 const started=performance.now();let status=0;
 try {const r=await fetch(base+path,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)});status=r.status;await r.arrayBuffer();}catch{/* error de transporte, sin volcar datos */}
 samples.push({route:path.replace(/[a-f0-9-]{36}/g,':campus'),stage,status,ms:Math.round(performance.now()-started)});
}
function summary(rows){const sorted=rows.map(x=>x.ms).sort((a,b)=>a-b);return {requests:rows.length,errors:rows.filter(x=>x.status!==200).length,p50:sorted[Math.ceil(sorted.length*.5)-1]??null,p95:sorted[Math.ceil(sorted.length*.95)-1]??null,max:sorted.at(-1)??null};}
// Calentamiento se informa aparte y no se mezcla con la medición.
for(const route of routes)await request(route,'warmup');
for(const concurrency of (remote?[1,2]:[1,3,6])){
 const name='concurrency-'+concurrency,started=performance.now();let cursor=0;
 const count=remote?15:30;
 await Promise.all(Array.from({length:concurrency},async()=>{for(;;){const i=cursor++;if(i>=count)return;await request(routes[i%routes.length],name);}}));
 const elapsedMs=Math.round(performance.now()-started);
 const rows=samples.filter(s=>s.stage===name);
 stages.push({name,concurrency,elapsedMs,throughputRps:Number((rows.length/(elapsedMs/1000)).toFixed(2)),...summary(rows),routes:routes.map(route=>({route:route.replace(/[a-f0-9-]{36}/g,':campus'),...summary(rows.filter(s=>s.route===route.replace(/[a-f0-9-]{36}/g,':campus')))}))});
 console.log(JSON.stringify(stages.at(-1)));
 if(rows.some(s=>s.status===429||s.status===503||s.status===0))break; // No insistir sobre una dependencia degradada.
}
const report={recordedAt:new Date().toISOString(),target:new URL(base).origin,runId:m.runId,kind:'bounded-read-load',maximumStartRps:1000/interval,scope:'Dependencias reales; datos sintéticos. No certifica capacidad máxima ni un SLA.',warmup:summary(samples.filter(s=>s.stage==='warmup')),stages,samples};
await mkdir(output,{recursive:true});await writeFile(resolve(output,'load.json'),JSON.stringify(report,null,2));
if(samples.some(s=>s.status!==200))process.exitCode=1;
