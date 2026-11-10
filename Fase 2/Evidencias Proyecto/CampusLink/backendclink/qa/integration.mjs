// Smoke real y línea base de latencia: lecturas acotadas, sin bombardear el servicio compartido.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {qaApiBase} from './fixtures.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'local');
if(process.env.QA_AUTHORIZED!=='1')throw new Error('Se requiere QA_AUTHORIZED=1 y datos propios del manifiesto');
const base=qaApiBase(process.env.QA_API_URL??'http://127.0.0.1:3011');
const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
assert.ok(manifest.steps.complete&&!manifest.cleaned,'Ejecutar qa:seed primero');
assert.ok(manifest.users.every(u=>u.email.endsWith('@campuslink.invalid')));
const tokens=new Map(),checks=[],samples=[];
const remote=!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname);
async function call(path,actor='receptor',status=200,body){
 const started=performance.now();
 const res=await fetch(base+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(60000),headers:{...(tokens.has(actor)?{Authorization:`Bearer ${tokens.get(actor)}`}:{ }),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await res.json();
 samples.push({route:path.split('?')[0].replace(/[a-f0-9-]{24,36}/g,':id'),method:body?'POST':'GET',status:res.status,ms:Math.round(performance.now()-started)});
 // Nunca mostrar la respuesta de login ni los datos personales en errores.
 assert.equal(res.status,status,`HTTP inesperado en ${path.split('?')[0]}`);
 return result.data;
}
async function check(name,fn){try{await fn();checks.push({name,status:'passed'});}catch(error){checks.push({name,status:'failed',error:error.name==='AssertionError'?error.message:'Dependencia inaccesible o respuesta inválida'});}console.log(JSON.stringify(checks.at(-1)));}
async function login(actor){
 const user=manifest.users.find(u=>u.actor===actor);assert.ok(user);
 const result=await call('/auth/login',undefined,200,{email:user.email,password:user.password});
 assert.equal(typeof result.session.access_token,'string','Login sin sesión');tokens.set(actor,result.session.access_token);
}
const publication=key=>manifest.publications.find(p=>p.key===key);
await check('login real del receptor QA',()=>login('receptor'));
await check('login real del administrador QA',()=>login('admin'));
await check('contraseña inválida rechazada',()=>call('/auth/login',undefined,401,{email:manifest.users.find(u=>u.actor==='receptor').email,password:'IncorrectaSoloQA123456'}));
await check('perfil y contexto institucional',async()=>{const profile=await call('/auth/me');assert.equal(profile.userId,manifest.users.find(u=>u.actor==='receptor').id);assert.equal(profile.campusId,manifest.campuses[0]);});
await check('ruta protegida rechaza usuario anónimo',()=>call('/users/me/overview','anonymous',401));
await check('perfil y notificaciones reales',async()=>{assert.ok(await call('/users/me/overview'));assert.ok(await call('/users/me/notifications'));});
for(const [kind,path] of [['physical','physicalgoods'],['digital','elibrary']]){
 await check(`catálogo ${kind}: paginación y búsqueda`,async()=>{
  const first=await call(`/marketplace/${path}?limit=20&page=1`),second=await call(`/marketplace/${path}?limit=20&page=2`);
  assert.equal(first.length,20);assert.ok(second.length);assert.ok(!second.some(b=>first.some(a=>a.id===b.id)));
  const rows=await call(`/marketplace/${path}?q=${encodeURIComponent(publication(kind+'-01').title)}`);assert.ok(rows.some(p=>p.id===publication(kind+'-01').id));
 });
 await check(`aislamiento institucional ${kind}`,async()=>{
  const suffix=kind==='physical'?'/images':'';
  assert.ok(await call(`/marketplace/${path}/${publication(kind+'-05').id}${suffix}`));
  await call(`/marketplace/${path}/${publication(kind+'-'+(kind==='physical'?'28':'26')).id}${suffix}`,'receptor',404);
 });
}
await check('Storage privado: imagen firmada real',async()=>{
 const gallery=await call(`/marketplace/physicalgoods/${publication('physical-05').id}/images`);assert.equal(gallery.images.length,3);
 const image=await fetch(gallery.images[0].url,{signal:AbortSignal.timeout(30000)});assert.equal(image.status,200);assert.equal(Buffer.from(await image.arrayBuffer()).readUInt32BE(0),0x89504e47);
});
await check('biblioteca adquirida y descarga PDF real',async()=>{
 const p=publication('digital-06');const detail=await call(`/marketplace/elibrary/acquired/${p.id}`);assert.ok(detail.acquisition);
 const res=await fetch(`${base}/marketplace/elibrary/${p.id}/files/${detail.files[0].id}/download`,{headers:{Authorization:`Bearer ${tokens.get('receptor')}`},signal:AbortSignal.timeout(30000)});
 assert.equal(res.status,200);assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0,5).toString(),'%PDF-');
});
await check('MongoDB: mapa y actividades reales',async()=>{
 assert.ok(await call(`/maps/${manifest.campuses[0]}/active`));
 const activity=manifest.activities.find(a=>a.key==='oficial-futura');assert.equal((await call('/activities/'+activity.id)).id,activity.id);
 assert.ok(await call('/activities/mine'));
});
await check('moderación real rechaza lenguaje ofensivo sin publicar',async()=>{
 const body=manifest.activities.find(a=>a.key==='oficial-futura').body;
 await call('/activities/series/official/preview','admin',400,{...body,title:'QA weon',description:'Actividad sintética QA',recurrence:{frequency:'WEEKLY',interval:1,timeZone:'America/Santiago',until:body.startAt.slice(0,10),excludedDates:[]}});
});
await check('reportería y control de permisos',async()=>{
 const path=`/reports/campuses/${manifest.campuses[0]}`;assert.ok(await call(path,'admin'));await call(path,'receptor',403);
});
await check('analítica real y opciones del campus',async()=>{
 assert.ok(await call('/analytics/options','admin'));
 const from=manifest.t0.slice(0,10),to=new Date(Date.parse(manifest.t0)+86400000).toISOString().slice(0,10);
 assert.ok(await call(`/analytics/dashboard?from=${from}&to=${to}`,'admin'));
 await call(`/analytics/dashboard?from=${from}&to=${to}`,'receptor',403);
});
await check('cuenta suspendida bloqueada',async()=>{await login('suspendido');await call('/auth/me','suspendido',403);});
// 12 consultas reales, máximo 1 remota o 3 locales simultáneas. No representa capacidad máxima.
await check('línea base acotada de latencia',async()=>{
 const paths=['/users/me/overview','/marketplace/physicalgoods?limit=5','/marketplace/elibrary?limit=5'];
 for(let i=0;i<4;i++){if(remote){for(const path of paths)await call(path);}else await Promise.all(paths.map(path=>call(path)));}
});
const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b),percentile=p=>sorted[Math.max(0,Math.ceil(sorted.length*p)-1)];
const report={target:new URL(base).origin,runId:manifest.runId,recordedAt:new Date().toISOString(),passed:checks.filter(c=>c.status==='passed').length,failed:checks.filter(c=>c.status==='failed').length,checks,latency:{requests:samples.length,p50:percentile(.5),p95:percentile(.95),max:sorted.at(-1),unit:'ms',scope:'Línea base HTTP con dependencias reales; no es certificación de capacidad'},samples};
await mkdir(resolve(root,'logs'),{recursive:true});await writeFile(resolve(root,'logs',`integration-${remote?'render':'local'}.json`),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,failed:report.failed,latency:report.latency}));
if(report.failed)process.exitCode=1;
