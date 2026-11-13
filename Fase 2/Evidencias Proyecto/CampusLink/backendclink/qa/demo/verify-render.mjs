// Verificación HTTP del QA ya desplegado. No despliega ni cambia configuración.
import dotenv from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const backend=resolve(dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(backend);dotenv.config({quiet:true});
const api='https://campuslink-api-qa-mxwt.onrender.com/api/v1';
const m=JSON.parse(await readFile('qa/local/demo/manifest.json','utf8'));
const actor=m.users.find(u=>u.key==='tomas');
const auth=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await auth.auth.signInWithPassword({email:actor.email,password:actor.password});assert.ok(!login.error&&login.data.session,'No se pudo autenticar el perfil demo');
async function get(path) {const response=await fetch(api+path,{headers:{Authorization:'Bearer '+login.data.session.access_token},signal:AbortSignal.timeout(55000)});assert.equal(response.status,200,`${path}: HTTP ${response.status}`);return (await response.json()).data;}
const me=await get('/auth/me');assert.equal(me.userId,actor.id);assert.equal(me.campusId,m.catalog.campus.id);assert.ok(me.capabilities.analytics&&me.capabilities.reports);
const checks=['identidad demo y sede correcta en Render'];
const legacyVisible=[],listCounts={};
for(const [kind,path] of [['physical','/marketplace/physicalgoods'],['digital','/marketplace/elibrary']]) {
  const rows=await get(path+'?page=1&limit=100');
  const expected=m.publications.filter(p=>p.kind===kind&&!['physical/monitor','physical/cuaderno'].includes(p.key));assert.ok(expected.every(p=>rows.some(r=>r.id===p.id)),'Faltan publicaciones del piloto en '+kind);checks.push(`${expected.length} publicaciones ${kind} disponibles en el listado`);
  listCounts[kind]=rows.length;legacyVisible.push(...rows.filter(r=>!m.publications.some(p=>p.id===r.id)).map(r=>({kind,id:r.id,title:r.title})));
}
for(const key of ['physical/monitor','physical/cuaderno']){const p=m.publications.find(p=>p.key===key);await get('/marketplace/physicalgoods/'+p.id+'/images');}
checks.push('reservado y finalizado consultables en detalle conforme al filtro vigente');
const activities=await get('/activities');assert.ok(m.activities.every(a=>activities.some(r=>r.id===a.id)));checks.push('6 actividades visibles con IDs MongoDB del piloto');
listCounts.activities=activities.length;legacyVisible.push(...activities.filter(r=>!m.activities.some(a=>a.id===r.id)).map(r=>({kind:'activity',id:r.id,title:r.title})));
const dashboard=await get(`/analytics/dashboard?from=2026-11-13&to=2026-11-16&grouping=week&institutionId=${m.catalog.institution.id}&campusId=${m.catalog.campus.id}`);
assert.ok(dashboard.resourceDemand.value>0&&dashboard.subjectDemand.value>0&&dashboard.activityParticipation.value>0);checks.push('analítica existente con demanda y participación');
const report=await get('/analytics/reports/'+m.steps['analytical-report'].id);assert.equal(report.generatedBy.userId,actor.id);checks.push('instantánea analítica consultable');
const p=m.publications.find(p=>p.key==='physical/calculadora'),gallery=await get('/marketplace/physicalgoods/'+p.id+'/images');
for(const img of gallery.images){const response=await fetch(img.url,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);}
checks.push('imagen privada accesible con URL firmada generada por Render');
const result={api,checkedAt:new Date().toISOString(),checks,listCounts,legacyVisible,metrics:{resourceDemand:dashboard.resourceDemand.value,subjectDemand:dashboard.subjectDemand.value,activityParticipation:dashboard.activityParticipation.value}};
await writeFile('qa/local/demo/render-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
