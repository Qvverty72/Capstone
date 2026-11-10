// Preparación/limpieza de una institución temporal; las operaciones de negocio se hacen desde Playwright.
import dotenv from 'dotenv';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {ObjectId} from 'mongodb';
import {newUIManifest,assertUIManifest,assertUIResources,assertUIStorage} from './ui-data.mjs';
import {pdfFixture,pngFixture,qaApiBase} from './fixtures.mjs';

process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
dotenv.config({quiet:true});
if(process.env.QA_AUTHORIZED!=='1')throw new Error('Se requiere QA_AUTHORIZED=1');
const [command,runId]=process.argv.slice(2);
assert.ok(['prepare','clean'].includes(command),'Uso: ui-fixture.mjs prepare|clean UUID');
assert.match(runId??'',/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
const root=resolve('qa/local/ui-runs',runId),file=resolve(root,'manifest.json');
const apiOrigin=new URL(qaApiBase(process.env.QA_API_URL??'http://127.0.0.1:3011')).origin;
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,statement_timeout:15000,query_timeout:20000});
let m,mg,mongoModule,stage='connect';
const save=async()=>{await mkdir(root,{recursive:true});await writeFile(file+'.tmp',JSON.stringify(m,null,2),{mode:0o600});await rename(file+'.tmp',file);};
async function transaction(fn){await db.query('BEGIN');try{await fn();await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}}
async function step(key,fn){if(m.steps[key])return;stage=key;await fn();m.steps[key]=true;await save();}
async function authUser(id){const r=await admin.auth.admin.getUserById(id);if(r.error&&r.error.status!==404)throw new Error('No se pudo consultar la identidad QA');return r.data.user;}
async function prepare(){
 assert.ok(!m.cleaned,'Esta ejecución ya fue limpiada; utiliza otro UUID');
 await step('catalog',()=>transaction(async()=>{
  await db.query('INSERT INTO institucion(id,nombre) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[m.institution,m.prefix]);
  await db.query('INSERT INTO campus(id,institucion_id,nombre) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[m.campus,m.institution,m.prefix+' Campus']);
  await db.query('INSERT INTO carrera(id,institucion_id,nombre,codigo) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING',[m.career,m.institution,'Informática QA',m.runId]);
  await db.query('INSERT INTO asignatura(id,nombre,codigo) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[m.subject,'Programación QA',m.runId]);
  await db.query('INSERT INTO campus_carrera(campus_id,carrera_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[m.campus,m.career]);
  await db.query('INSERT INTO carrera_asignatura(carrera_id,asignatura_id,semestre_nivel) VALUES($1,$2,1) ON CONFLICT DO NOTHING',[m.career,m.subject]);
 }));
 await step('map',async()=>{
  const source=await mg.collection('campus_maps').findOne({status:'ACTIVE'});assert.ok(source,'Se requiere un mapa activo como plantilla');
  m.mapId??=new ObjectId().toHexString();await save();
  const copy=structuredClone(source);copy._id=new ObjectId(m.mapId);copy.campusId=m.campus;copy.createdAt=new Date(m.createdAt);copy.updatedAt=new Date(m.createdAt);
  await mg.collection('campus_maps').updateOne({_id:copy._id},{$setOnInsert:copy},{upsert:true});
 });
 for(const u of m.users)await step('user-'+u.actor,async()=>{
  const found=await authUser(u.id);
  if(found)assert.equal(found.user_metadata.qaUiRun,m.runId,'Identidad ajena');
  else {const r=await admin.auth.admin.createUser({id:u.id,email:u.email,password:u.password,email_confirm:true,user_metadata:{qaUiRun:m.runId}});assert.ok(!r.error,'No se pudo crear la identidad QA');}
  await transaction(async()=>{
   await db.query('INSERT INTO perfil_usuario(id,institucion_id,campus_id,nombre_completo,verificado_en) VALUES($1,$2,$3,$4,now()) ON CONFLICT(id) DO NOTHING',[u.id,m.institution,m.campus,u.name]);
   await db.query('INSERT INTO usuario_carrera(perfil_usuario_id,carrera_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[u.id,m.career]);
   if(u.actor==='admin')await db.query("INSERT INTO usuario_rol(perfil_usuario_id,rol_id,campus_id,asignado_por_id) SELECT $1,id,$2,$1 FROM rol WHERE nombre='ADMINISTRADOR' AND NOT EXISTS(SELECT 1 FROM usuario_rol WHERE perfil_usuario_id=$1 AND revocado_en IS NULL)",[u.id,m.campus]);
  });
 });
 await step('files',async()=>{await mkdir(resolve(root,'files'),{recursive:true});for(const [name,bytes] of [['imagen.png',pngFixture],['material.pdf',await pdfFixture('CampusLink Material QA')],['unidad2.pdf',await pdfFixture('CampusLink Unidad Dos QA',true)]])await writeFile(resolve(root,'files',name),bytes);});
 if(process.env.QA_MAILBOX_EMAIL)await step('registration-plan',async()=>{
  const address=process.env.QA_MAILBOX_EMAIL.trim().toLowerCase();assert.match(address,/^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]+$/);
  const [local,domain]=address.split('@');
  const option=(await db.query('SELECT d.institucion_id,c.id,c.nombre FROM dominio_institucional d JOIN campus c ON c.institucion_id=d.institucion_id WHERE d.dominio=$1 AND d.activo AND c.activo ORDER BY c.id LIMIT 1',[domain])).rows[0];
  assert.ok(option,'El buzón QA debe pertenecer a un dominio admitido; no se modifica el catálogo');
  const email=local+'+clqa'+m.runId.replaceAll('-','')+'@'+domain;
  assert.equal((await db.query('SELECT id FROM auth.users WHERE email=$1',[email])).rows.length,0,'No reutilizar una cuenta existente');
  m.registration={mailbox:address,email,campus:option.id,campusName:option.nombre,institution:option.institucion_id,name:m.prefix+' Registro',password:randomBytes(24).toString('base64url')+'Az1!',absentBeforeRun:true};
 });
 m.ready=true;await save();console.log(JSON.stringify({fixture:'ready',runId:m.runId}));
}
async function clean(){
 if(m.cleaned){console.log(JSON.stringify({cleanup:'already-clean',runId:m.runId}));return;}
 const users=m.users.map(u=>u.id);
 if(m.registration){
  const r=m.registration;assert.equal(r.absentBeforeRun,true);assert.equal(r.name,m.prefix+' Registro');
  const [local,domain]=r.mailbox.split('@');assert.equal(r.email,local+'+clqa'+m.runId.replaceAll('-','')+'@'+domain);
  const row=(await db.query('SELECT id FROM auth.users WHERE email=$1',[r.email])).rows[0];
  if(row){const found=await authUser(row.id);assert.equal(found.email,r.email);assert.equal(found.user_metadata.campus_id,r.campus);assert.equal(found.user_metadata.nombre_completo,r.name);assert.ok(Date.parse(found.created_at)>=Date.parse(m.createdAt));r.id=row.id;users.push(row.id);await save();}
 }
 if(!m.cleanup.sql){
  stage='ownership-guards';
  const institution=(await db.query('SELECT nombre FROM institucion WHERE id=$1',[m.institution])).rows[0];assert.equal(institution?.nombre,m.prefix,'Institución ajena o inexistente');
  const queue=mg.collection('qa_activity_queue');
  const tasks=await queue.find({$or:[{campusId:m.campus},{qaUiRun:m.runId}]}).toArray();
  for(const task of tasks){assert.equal(task.campusId,m.campus);assert.equal(task.qaUiRun,m.runId);assert.ok(task.event.key.startsWith('qa:'+m.runId+':'));assert.ok(task.event.recipientIds.every(id=>users.includes(id)));}
  await queue.deleteMany({campusId:m.campus,qaUiRun:m.runId});
  assert.equal(await mg.collection('activities').countDocuments({campusId:m.campus}),0,'Actividad fuera del alcance de este recorrido');
  const profiles=(await db.query('SELECT id,campus_id,institucion_id FROM perfil_usuario WHERE campus_id=$1 OR institucion_id=$2 OR id=$3',[m.campus,m.institution,m.registration?.id??null])).rows;
  for(const row of profiles){assert.ok(users.includes(row.id));const reg=row.id===m.registration?.id;assert.equal(row.campus_id,reg?m.registration.campus:m.campus);assert.equal(row.institucion_id,reg?m.registration.institution:m.institution);}
  for(const u of m.users){const found=await authUser(u.id);if(found)assert.equal(found.user_metadata.qaUiRun,m.runId,'Identidad ajena');}
  const rows=(await db.query('SELECT id,campus_id,propietario_id,titulo FROM publicacion_recurso WHERE campus_id=$1 OR propietario_id=ANY($2::uuid[])',[m.campus,users])).rows;
  assertUIResources(m,rows);const ids=rows.map(r=>r.id);
  const requests=(await db.query('SELECT publicacion_id,solicitante_id FROM solicitud_recurso WHERE publicacion_id=ANY($1::uuid[]) OR solicitante_id=ANY($2::uuid[])',[ids,users])).rows;
  for(const row of requests){assert.ok(ids.includes(row.publicacion_id));assert.ok(users.includes(row.solicitante_id));}
  const transactions=(await db.query('SELECT id,publicacion_id,receptor_id FROM transaccion_recurso WHERE publicacion_id=ANY($1::uuid[]) OR receptor_id=ANY($2::uuid[])',[ids,users])).rows;
  for(const row of transactions){assert.ok(ids.includes(row.publicacion_id));assert.ok(users.includes(row.receptor_id));}
  const reports=(await db.query('SELECT campus_id,reportante_id,resuelto_por_id,entidad_id,entidad_tipo FROM reporte_contenido WHERE campus_id=$1 OR reportante_id=ANY($2::uuid[])',[m.campus,users])).rows;
  for(const row of reports){assert.equal(row.campus_id,m.campus);assert.ok(users.includes(row.reportante_id));assert.ok(!row.resuelto_por_id||users.includes(row.resuelto_por_id));assert.ok(ids.includes(row.entidad_id));assert.ok(['PUBLICACION_FISICA','PUBLICACION_DIGITAL'].includes(row.entidad_tipo));}
  const notices=(await db.query('SELECT destinatario_id FROM notificacion WHERE campus_id=$1 OR publicacion_id=ANY($2::uuid[])',[m.campus,ids])).rows;
  assert.ok(notices.every(row=>users.includes(row.destinatario_id)),'Notificación ajena');
  const objects=(await db.query("SELECT bucket_id,name AS storage_path FROM storage.objects WHERE bucket_id IN ('publication-images','digital-resources') AND name LIKE $1",[m.campus+'/%'])).rows;
  assertUIStorage(m,objects);m.objects=objects;m.resources=ids;m.transactions=transactions.map(t=>t.id);await save();
  stage='cleanup-sql';
  await transaction(async()=>{
   await db.query('SELECT id FROM perfil_usuario WHERE id=ANY($1::uuid[]) FOR UPDATE',[users]);
   await db.query('DELETE FROM notificacion WHERE destinatario_id=ANY($1::uuid[]) AND (campus_id=$2 OR publicacion_id=ANY($3::uuid[]) OR destinatario_id=$4)',[users,m.campus,ids,m.registration?.id??null]);
   await db.query('DELETE FROM auditoria WHERE institucion_id=$1 AND actor_usuario_id=ANY($2::uuid[])',[m.institution,users]);
   await db.query('DELETE FROM reporte WHERE institucion_id=$1 AND generado_por_id=ANY($2::uuid[])',[m.institution,users]);
   await db.query('DELETE FROM reporte_contenido WHERE campus_id=$1 AND reportante_id=ANY($2::uuid[])',[m.campus,users]);
   for(const table of ['valoracion','acceso_recurso_digital','confirmacion_transaccion'])await db.query(`DELETE FROM ${table} WHERE transaccion_id=ANY($1::uuid[])`,[m.transactions]);
   await db.query('DELETE FROM transaccion_recurso WHERE id=ANY($1::uuid[])',[m.transactions]);
   await db.query('DELETE FROM solicitud_recurso WHERE publicacion_id=ANY($1::uuid[])',[ids]);
   await db.query('DELETE FROM interaccion_recurso WHERE publicacion_id=ANY($1::uuid[])',[ids]);
   for(const table of ['publicacion_carrera','publicacion_asignatura','archivo_publicacion','recurso_fisico','recurso_digital'])await db.query(`DELETE FROM ${table} WHERE publicacion_id=ANY($1::uuid[])`,[ids]);
   await db.query('DELETE FROM publicacion_recurso WHERE id=ANY($1::uuid[]) AND campus_id=$2',[ids,m.campus]);
   for(const table of ['usuario_rol','usuario_permiso','usuario_carrera','usuario_asignatura'])await db.query(`DELETE FROM ${table} WHERE perfil_usuario_id=ANY($1::uuid[])`,[users]);
   await db.query('DELETE FROM perfil_usuario WHERE id=ANY($1::uuid[]) AND (campus_id=$2 OR (id=$3 AND campus_id=$4))',[users,m.campus,m.registration?.id??null,m.registration?.campus??null]);
   await db.query('DELETE FROM campus_carrera WHERE campus_id=$1 AND carrera_id=$2',[m.campus,m.career]);
   await db.query('DELETE FROM carrera_asignatura WHERE carrera_id=$1 AND asignatura_id=$2',[m.career,m.subject]);
   await db.query('DELETE FROM asignatura WHERE id=$1',[m.subject]);await db.query('DELETE FROM carrera WHERE id=$1 AND institucion_id=$2',[m.career,m.institution]);
   await db.query('DELETE FROM campus WHERE id=$1 AND institucion_id=$2',[m.campus,m.institution]);await db.query('DELETE FROM institucion WHERE id=$1',[m.institution]);
  });m.cleanup.sql=true;await save();
 }
 stage='cleanup-storage';assertUIStorage(m,m.objects);
 for(const bucket of ['publication-images','digital-resources']){const paths=m.objects.filter(o=>o.bucket_id===bucket).map(o=>o.storage_path);if(paths.length){const r=await admin.storage.from(bucket).remove(paths);assert.ok(!r.error,'Storage QA no se pudo limpiar');}}
 stage='cleanup-map';
 const maps=await mg.collection('campus_maps').find({campusId:m.campus}).toArray();assert.ok(maps.every(map=>map._id.toHexString()===m.mapId),'Mapa ajeno');
 if(m.mapId)await mg.collection('campus_maps').deleteOne({_id:new ObjectId(m.mapId),campusId:m.campus});
 stage='cleanup-auth';
 for(const u of m.users){const found=await authUser(u.id);if(found){assert.equal(found.user_metadata.qaUiRun,m.runId);const r=await admin.auth.admin.deleteUser(u.id);assert.ok(!r.error,'Identidad QA no se pudo limpiar');}}
 if(m.registration?.id){const r=m.registration,found=await authUser(r.id);if(found){assert.equal(found.email,r.email);assert.equal(found.user_metadata.campus_id,r.campus);assert.equal(found.user_metadata.nombre_completo,r.name);const result=await admin.auth.admin.deleteUser(r.id);assert.ok(!result.error,'No se pudo limpiar el registro QA');}}
 const remaining=(await db.query("SELECT (SELECT count(*) FROM auth.users WHERE id=ANY($1::uuid[]))+(SELECT count(*) FROM institucion WHERE id=$2)+(SELECT count(*) FROM storage.objects WHERE name LIKE $3) AS n",[users,m.institution,m.campus+'/%'])).rows[0].n;
 assert.equal(Number(remaining),0,'Residuos QA');m.cleaned=true;await save();console.log(JSON.stringify({cleanup:'verified',runId:m.runId,resources:m.resources?.length??0}));
}
try{
 await db.connect();assert.equal((await db.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked',['CampusLink.UI.'+runId])).rows[0].locked,true,'Otra operación utiliza este recorrido QA');await mkdir(root,{recursive:true});
 try{m=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT'||command!=='prepare')throw error;m=newUIManifest(runId,apiOrigin);await save();}
 assertUIManifest(m);assert.equal(m.runId,runId);assert.equal(m.apiOrigin,apiOrigin);
 const target={supabase:new URL(process.env.SUPABASE_URL).hostname,postgres:(await db.query('SELECT current_database() AS name')).rows[0].name};
 if(m.target)assert.deepEqual(m.target,target,'Destino QA distinto');else{m.target=target;await save();}
 mongoModule=await import('../dist/database/mongodb/client.js');mg=await mongoModule.connectMongoDB();
 await (command==='prepare'?prepare():clean());
}catch(error){console.error(JSON.stringify({fixture:'failed',stage,error:error.name,code:error.code}));process.exitCode=1;}finally{if(mongoModule)await mongoModule.closeMongoDB();await db.end().catch(()=>{});}
