// Workers locales con PostgreSQL/MongoDB/Storage reales y una cola QA propia.
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as wait} from 'node:timers/promises';
import {ObjectId} from 'mongodb';
import {createClient} from '@supabase/supabase-js';
import {qaApiBase,pngFixture} from './fixtures.mjs';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));dotenv.config({quiet:true});
assert.equal(process.env.QA_AUTHORIZED,'1');
const m=JSON.parse(await readFile(process.env.E2E_QA_WRITE_RUN,'utf8'));
assert.equal(m.kind,'campuslink-ui-qa-v1');assert.ok(m.ready&&!m.cleaned);
const api=qaApiBase(process.env.QA_API_URL),output=resolve(process.env.QA_REPORT_DIR);
const {withPostgresTransaction:transaction,closePostgres}=await import('../dist/database/supabase/postgres.js');
const mongo=await import('../dist/database/mongodb/client.js');
const {dispatchActivityNotifications}=await import('../dist/modules/activities/workers/activities.notifications.worker.js');
const {deliverActivityNotification}=await import('../dist/modules/users/repositories/notifications.repository.js');
const {dispatchPhysicalgoodsReminders}=await import('../dist/modules/marketplace/physicalgoods/services/physicalgoods.reminders.service.js');
const {findPhysicalgoodsReminderCandidates}=await import('../dist/modules/marketplace/physicalgoods/repositories/physicalgoods.reminders.repository.js');
const checks=[],publications=[];let queue;
const owner=m.users.find(u=>u.actor==='propietario'),recipient=m.users.find(u=>u.actor==='receptor');
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
let token;
async function call(path,body,status=200){const r=await fetch(api+path,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,status,'HTTP inesperado en '+path);return (await r.json()).data;}
async function check(name,fn){try{await fn();checks.push({name,status:'passed'});}catch{checks.push({name,status:'failed',reason:'Dependencia o aserción de resiliencia no satisfecha; no se registran datos de sesión.'});}console.log(JSON.stringify(checks.at(-1)));}
async function physical(suffix){const options=await call('/marketplace/physicalgoods/options');const p=await call('/marketplace/physicalgoods',{title:m.prefix+' '+suffix,description:'Recurso sintético para recuperación de workers',condition:'BUEN_ESTADO',categoryId:options.categories[0].id,modality:'DONACION',price:null,careerId:null,subjectId:null,photo:{name:'imagen.png',mimeType:'image/png',base64:pngFixture.toString('base64')}},201);publications.push(p.id);await transaction(c=>c.query("UPDATE publicacion_recurso SET publicado_en=now()-interval '8 days' WHERE id=$1 AND propietario_id=$2 AND campus_id=$3",[p.id,owner.id,m.campus]));return p;}
const notices=(id)=>transaction(async c=>(await c.query('SELECT id,deleted_at FROM notificacion WHERE publicacion_id=$1 AND destinatario_id=$2',[id,owner.id])).rows);
const dependencies=id=>({transaction,candidates:(client,before)=>findPhysicalgoodsReminderCandidates(client,before,[id]),now:()=>new Date()});
try{
 token=(await call('/auth/login',{email:owner.email,password:owner.password})).session.access_token;
 const db=await mongo.connectMongoDB();queue=db.collection('qa_activity_queue');
 await check('Notificación: fallo antes de entrega, respuesta de ack perdida y reinicio sin duplicados',async()=>{
  const id=new ObjectId(),key='qa:'+m.runId+':changed';
  const event={key,type:'ACTIVITY_CHANGED',title:m.prefix+' Cambio QA',reasons:['CONTENT_CHANGED'],occurredAt:new Date(),status:'PENDING',recipientIds:[recipient.id]};
  await queue.insertOne({_id:id,qaUiRun:m.runId,campusId:m.campus,event});
  const pending=async()=>{const row=await queue.findOne({_id:id,qaUiRun:m.runId,campusId:m.campus,'event.status':'PENDING'});return row?[{activityId:id.toHexString(),campusId:m.campus,creatorId:owner.id,createdAt:event.occurredAt,event:row.event}]:[];};
  const ack=async()=>{await queue.updateOne({_id:id,qaUiRun:m.runId,'event.key':key,'event.status':'PENDING'},{$set:{'event.status':'DELIVERED'}});};
  const deps={pending,participants:async()=>[recipient.id],deliver:deliverActivityNotification,acknowledge:ack};
  assert.deepEqual(await dispatchActivityNotifications({...deps,deliver:async()=>{throw new Error('Fallo inyectado');}}),{delivered:0,failed:1});
  assert.deepEqual(await dispatchActivityNotifications({...deps,acknowledge:async()=>{throw new Error('Ack perdido antes de persistir');}}),{delivered:0,failed:1});
  const count=()=>transaction(async c=>Number((await c.query('SELECT count(*) n FROM notificacion WHERE destinatario_id=$1 AND campus_id=$2 AND actividad_evento_clave=$3',[recipient.id,m.campus,key])).rows[0].n));
  assert.equal(await count(),1);
  await mongo.closeMongoDB();await mongo.connectMongoDB();queue=mongo.getMongoDB().collection('qa_activity_queue');
  assert.deepEqual(await dispatchActivityNotifications(deps),{delivered:1,failed:0});assert.equal(await count(),1);
  assert.deepEqual(await dispatchActivityNotifications(deps),{delivered:0,failed:0});
 });
 await check('Recordatorio: rollback por fallo SQL, reintento y una entrega',async()=>{
  const p=await physical('Recordatorio rollback'),deps=dependencies(p.id);
  const failing=operation=>transaction(async client=>{const result=await operation(client);if(typeof result==='boolean')throw new Error('Fallo antes de commit');return result;});
  assert.deepEqual(await dispatchPhysicalgoodsReminders(()=>false,{...deps,transaction:failing}),{delivered:0,failed:1});assert.equal((await notices(p.id)).length,0);
  assert.deepEqual(await dispatchPhysicalgoodsReminders(()=>false,deps),{delivered:1,failed:0});assert.equal((await notices(p.id)).length,1);
 });
 await check('Recordatorio: commit confirmado con respuesta perdida y borrado lógico no duplican',async()=>{
  const p=await physical('Recordatorio ack'),deps=dependencies(p.id);
  const lost=async operation=>{const result=await transaction(operation);if(typeof result==='boolean')throw new Error('Respuesta perdida después de commit');return result;};
  assert.deepEqual(await dispatchPhysicalgoodsReminders(()=>false,{...deps,transaction:lost}),{delivered:0,failed:1});assert.equal((await notices(p.id)).length,1);
  assert.deepEqual(await dispatchPhysicalgoodsReminders(()=>false,deps),{delivered:0,failed:0});
  await transaction(c=>c.query('UPDATE notificacion SET deleted_at=now() WHERE publicacion_id=$1 AND destinatario_id=$2',[p.id,owner.id]));
  assert.deepEqual(await dispatchPhysicalgoodsReminders(()=>false,deps),{delivered:0,failed:0});assert.equal((await notices(p.id)).length,1);
 });
 await check('Storage: vencimiento real de URL de 1 segundo y renovación con PNG válido',async()=>{
  assert.ok(publications.length);const gallery=await call('/marketplace/physicalgoods/'+publications[0]+'/images');
  const path=await transaction(async c=>(await c.query('SELECT storage_path FROM archivo_publicacion WHERE publicacion_id=$1',[publications[0]])).rows[0].storage_path);
  assert.ok(path.startsWith(m.campus+'/'+owner.id+'/'));
  const signed=await admin.storage.from('publication-images').createSignedUrl(path,1);assert.ok(!signed.error);
  const jwt=new URL(signed.data.signedUrl).searchParams.get('token'),exp=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url').toString()).exp;
  while(Date.now()<exp*1000+2000)await wait(100);
  const expired=await fetch(signed.data.signedUrl,{cache:'no-store',signal:AbortSignal.timeout(30000)});assert.ok([400,401,403].includes(expired.status));
  const renewed=await call('/marketplace/physicalgoods/'+publications[0]+'/images');const image=await fetch(renewed.images[0].url,{signal:AbortSignal.timeout(30000)});assert.equal(image.status,200);assert.equal(Buffer.from(await image.arrayBuffer()).readUInt32BE(0),0x89504e47);assert.ok(gallery.images.length);
 });
}finally{
 if(queue)await queue.deleteMany({qaUiRun:m.runId,campusId:m.campus});
 await Promise.allSettled([mongo.closeMongoDB(),closePostgres()]);
 await mkdir(output,{recursive:true});await writeFile(resolve(output,'workers.json'),JSON.stringify({recordedAt:new Date().toISOString(),runId:m.runId,target:new URL(api).origin,scope:'Worker ejecutado localmente, cola Mongo QA aislada, PostgreSQL y Storage reales. Fallos y tiempos inyectados explícitos; no se ejecuta el barrido global de producción.',checks},null,2));
}
if(checks.some(c=>c.status==='failed'))process.exitCode=1;
