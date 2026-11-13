// Carga institucional acotada. Predeterminado: dry-run. Nunca inicia workers.
import dotenv from 'dotenv';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
import {ObjectId} from 'mongodb';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {DATASET,students,physical,digital,activities,careerNames,description,stableId,operationId,newManifest,runStep,requireTarget,unique} from './fixtures.mjs';

const backend=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
process.chdir(backend);dotenv.config({path:resolve(backend,'.env'),quiet:true});
const args=process.argv.slice(2),command=args[0]??'plan';
const option=name=>args[args.indexOf(name)+1];
const allowed=new Set(['plan','seed','verify']);
assert.ok(allowed.has(command),'Comando permitido: plan | seed | verify');
for(let i=1;i<args.length;i++) {
  if(['--target','--environment'].includes(args[i])){assert.ok(args[++i]&&!args[i].startsWith('--'));continue;}
  assert.ok(['--dry-run','--apply'].includes(args[i]),'Opción desconocida');
}
const apply=command==='seed'&&args.includes('--apply')&&!args.includes('--dry-run');
const root=resolve(backend,'qa/local/demo'),manifestPath=resolve(root,'manifest.json');
const assets=resolve(backend,'qa/demo/assets'),hash=value=>createHash('sha256').update(value).digest('hex');
const log=value=>console.log(JSON.stringify(value));
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,statement_timeout:20000});
let mongoModule,mg,admin,server,base,m,catalog,target,stage='preflight';
const tokens=new Map();
async function save(){await mkdir(root,{recursive:true});await writeFile(manifestPath+'.tmp',JSON.stringify(m,null,2),{mode:0o600});await rename(manifestPath+'.tmp',manifestPath);}
const step=(key,fn)=>runStep(m,key,async()=>{stage=key;const value=await fn();log({completed:key});return value;},save);
const user=key=>unique(m.users.filter(u=>u.key===key),key);
const pub=key=>unique(m.publications.filter(p=>p.key===key),key);
const activity=key=>unique(m.activities.filter(a=>a.key===key),key);
const lib=kind=>kind==='physical'?'/marketplace/physicalgoods':'/marketplace/elibrary';

export async function snapshotQA(client) {
  // Todas las generaciones QA, no solo el último manifiesto. Sin contraseñas/tokens.
  return (await client.query(`SELECT u.id,u.email,u.raw_user_meta_data,p.nombre_completo,p.campus_id,p.institucion_id,p.estado_cuenta,
    p.verificado_en,p.deleted_at,
    (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) FROM usuario_rol r WHERE r.perfil_usuario_id=u.id) AS roles,
    (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id),'[]'::jsonb) FROM usuario_permiso r WHERE r.perfil_usuario_id=u.id) AS permisos,
    (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.carrera_id),'[]'::jsonb) FROM usuario_carrera r WHERE r.perfil_usuario_id=u.id) AS carreras
    FROM auth.users u LEFT JOIN perfil_usuario p ON p.id=u.id
    WHERE u.raw_user_meta_data ? 'qaSeedRun' ORDER BY u.id`)).rows;
}
async function preflight() {
  const {assertPublicContent}=await import('../../dist/shared/moderation/content-moderation.js');
  for(const item of [...physical,...digital,...activities])assertPublicContent({title:item.title,description:description(item)});
  await db.connect();
  if(!apply)await db.query('SET default_transaction_read_only=on');
  else assert.equal((await db.query("SELECT pg_try_advisory_lock(hashtext('CampusLink.institutionalDemo')) AS locked")).rows[0].locked,true,'Otra carga demo está en curso');
  mongoModule=await import('../../dist/database/mongodb/client.js');mg=await mongoModule.connectMongoDB();
  const pgUrl=new URL(process.env.SUPABASE_DB_URL),mongoUrl=new URL(process.env.MONGODB_URI);
  const destination={supabase:new URL(process.env.SUPABASE_URL).hostname,postgres:hash(`${pgUrl.hostname}:${pgUrl.port}/${pgUrl.pathname}/${pgUrl.username}`),mongo:hash(`${mongoUrl.hostname}/${mg.databaseName}`)};
  target=hash(JSON.stringify(destination));
  const institutions=(await db.query('SELECT id,nombre FROM institucion')).rows;
  const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const institution=unique(institutions.filter(i=>norm(i.nombre)==='duocuc'),'Duoc UC');
  const campuses=(await db.query('SELECT id,nombre,ciudad,region FROM campus WHERE institucion_id=$1 AND activo',[institution.id])).rows;
  const campus=unique(campuses.filter(c=>['sanandres','sanandresdeconcepcion','concepcion'].includes(norm(c.nombre))),'Concepción / San Andrés');
  const careers=(await db.query(`SELECT c.id,c.nombre FROM carrera c JOIN campus_carrera cc ON cc.carrera_id=c.id
    WHERE cc.campus_id=$1 AND c.institucion_id=$2 AND c.activo`,[campus.id,institution.id])).rows;
  const selected=Object.fromEntries(Object.entries(careerNames).map(([key,name])=>[key,unique(careers.filter(c=>c.nombre===name),name)]));
  const subjects=(await db.query(`SELECT a.id,a.nombre,ca.carrera_id FROM asignatura a JOIN carrera_asignatura ca ON ca.asignatura_id=a.id
    WHERE ca.carrera_id=ANY($1::uuid[]) AND a.activo`,[Object.values(selected).map(c=>c.id)])).rows;
  const associations=Object.fromEntries(digital.map(d=>[d.key,unique(subjects.filter(a=>a.nombre===d.subject&&a.carrera_id===selected[d.career].id),d.subject)]));
  const categoryRows=(await db.query('SELECT id,nombre FROM categoria_recurso_fisico WHERE activo')).rows;
  const categories=Object.fromEntries(physical.map(p=>[p.key,unique(categoryRows.filter(c=>c.nombre===p.category),p.category).id]));
  const map=unique(await mg.collection('campus_maps').find({campusId:campus.id,status:'ACTIVE'}).toArray(),'mapa activo de la sede');
  const pois=map.buildings.filter(b=>b.isVisible!==false&&!b.deletedAt).flatMap(b=>(b.floors??[]).filter(f=>f.isVisible!==false&&!f.deletedAt)
    .flatMap(f=>(f.pois??[]).filter(p=>p.isVisible===true&&!p.deletedAt).map(p=>({buildingKey:b.id,floorKey:f.id,poiKey:p.poiKey??p.id,name:p.name}))));
  const locations=Object.fromEntries(activities.map(a=>{const {name,...location}=unique(pois.filter(p=>p.poiKey===a.poi),a.poi);return[a.key,location];}));
  catalog={institution,campus,careers:selected,subjects:associations,categories,locations,mapId:String(map._id)};
  admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  for(const bucket of ['publication-images','digital-resources']){const result=await admin.storage.getBucket(bucket);assert.ok(!result.error&&!result.data.public,'Se requiere bucket privado: '+bucket);}
  for(const name of ['USUARIO_AUTORIZADO'])unique((await db.query('SELECT id FROM rol WHERE nombre=$1',[name])).rows,name);
  for(const name of ['ACCEDER_ANALITICA','ACCEDER_REPORTERIA'])unique((await db.query('SELECT id FROM permiso WHERE nombre=$1',[name])).rows,name);
  for(const p of physical)assert.ok((await readFile(resolve(assets,p.asset))).subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')));
  for(const d of digital)assert.equal((await readFile(resolve(assets,d.key+'.pdf'))).subarray(0,5).toString(),'%PDF-');
  return {target,destination,catalog,qaHash:hash(JSON.stringify(await snapshotQA(db)))};
}
async function inventory() {
  const ids=students.map(s=>stableId('user/'+s.key));
  // No inferir descartabilidad desde título, propietario ni antigüedad.
  const publications=(await db.query(`SELECT id,propietario_id,tipo_recurso,titulo,estado_publicacion,deleted_at
    FROM publicacion_recurso WHERE campus_id=$1 AND NOT(propietario_id=ANY($2::uuid[])) ORDER BY id`,[catalog.campus.id,ids])).rows;
  const legacyActivities=await mg.collection('activities').find({campusId:catalog.campus.id,createdByUserId:{$nin:ids}})
    .project({_id:1,title:1,status:1,visibility:1,endAt:1,createdByUserId:1}).toArray();
  return {preservedPublications:publications,preservedActivities:legacyActivities.map(a=>({...a,_id:String(a._id)})),
    policy:'Conservar registros sin procedencia verificable; ninguna operación automática sobre ellos.'};
}
async function plan(pre) {
  const old=await inventory();
  const plan={dataset:DATASET,mode:'dry-run',target,catalog,counts:{students:8,physical:6,digital:5,activities:6},
    creates:{users:students.map(s=>({key:s.key,name:s.name,career:catalog.careers[s.career].nombre})),physical:physical.map(p=>p.title),digital:digital.map(d=>d.title),activities:activities.map(a=>({title:a.title,date:a.day,from:a.start,to:a.end,location:catalog.locations[a.key]}))},
    relationships:{requests:6,transactions:5,activityJoins:8,activityLeaves:1,resourceViews:14,activityViews:3,analyticalReports:1,moderationReports:0},
    qaHash:pre.qaHash,...old,notes:['No se crean instituciones, sedes, carreras, asignaturas ni mapas.','Analista Programador no se inventa cuando no existe en el catálogo.','Las publicaciones y actividades nuevas incluyen un aviso de contenido ficticio.','Cero borrados; el contenido antiguo requiere revisión explícita.']};
  await mkdir(root,{recursive:true});await writeFile(resolve(root,'plan.json'),JSON.stringify(plan,null,2));
  log({mode:'dry-run',target,counts:plan.counts,preservedPublications:old.preservedPublications.length,preservedActivities:old.preservedActivities.length,plan:resolve(root,'plan.json')});
}
async function token(key) {
  const u=user(key);if(tokens.has(key))return tokens.get(key);
  const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const r=await client.auth.signInWithPassword({email:u.email,password:u.password});
  assert.ok(!r.error&&r.data.session,`Login demo falló: ${key}`);tokens.set(key,r.data.session.access_token);return tokens.get(key);
}
async function request(path,key,method='GET',body,status=200) {
  const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+await token(key),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},
    ...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(45000)});
  if(response.status!==status){const error=await response.json().catch(()=>({}));throw new Error(`${method} ${path}: HTTP ${response.status}; ${JSON.stringify(error.error??{}).slice(0,600)}`);}
  if(status===204)return null;
  return response.headers.get('content-type')?.includes('json')?(await response.json()).data:Buffer.from(await response.arrayBuffer());
}
async function openApi(){const {createApp}=await import('../../dist/app.js');server=createApp().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}/api/v1`;}
async function bootstrap() {
  for(const u of m.users)await step('user/'+u.key,async()=>{
    const found=await admin.auth.admin.getUserById(u.id);
    assert.ok(!found.error||found.error.status===404,'Auth no disponible');
    if(found.data.user){assert.equal(found.data.user.app_metadata?.campuslinkDemo,DATASET,'Colisión con cuenta ajena');assert.equal(found.data.user.email,u.email);}
    else {const result=await admin.auth.admin.createUser({id:u.id,email:u.email,password:u.password,email_confirm:true,app_metadata:{campuslinkDemo:DATASET}});assert.ok(!result.error,`No se pudo crear cuenta ${u.key}`);assert.equal(result.data.user.id,u.id);}
    await db.query('BEGIN');try {
      const old=(await db.query('SELECT institucion_id,campus_id,nombre_completo FROM perfil_usuario WHERE id=$1',[u.id])).rows[0];
      if(old)assert.deepEqual(old,{institucion_id:catalog.institution.id,campus_id:catalog.campus.id,nombre_completo:u.name},'Perfil ajeno o editado: revisar antes de continuar');
      await db.query(`INSERT INTO perfil_usuario(id,institucion_id,campus_id,nombre_completo,verificado_en,region_origen,comuna_origen)
        VALUES($1,$2,$3,$4,now(),'Biobío','Concepción') ON CONFLICT(id) DO NOTHING`,[u.id,catalog.institution.id,catalog.campus.id,u.name]);
      await db.query('INSERT INTO usuario_carrera(perfil_usuario_id,carrera_id,anio_ingreso) VALUES($1,$2,2026) ON CONFLICT DO NOTHING',[u.id,catalog.careers[u.career].id]);
      const subject=digital.find(d=>d.career===u.career);
      await db.query('INSERT INTO usuario_asignatura(perfil_usuario_id,asignatura_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[u.id,catalog.subjects[subject.key].id]);
      if(u.consult) {
        await db.query(`INSERT INTO usuario_rol(id,perfil_usuario_id,rol_id,campus_id) SELECT $1,$2,id,$3 FROM rol WHERE nombre='USUARIO_AUTORIZADO' ON CONFLICT(id) DO NOTHING`,[stableId('role/'+u.key),u.id,catalog.campus.id]);
        for(const permission of ['ACCEDER_ANALITICA','ACCEDER_REPORTERIA'])await db.query(`INSERT INTO usuario_permiso(id,perfil_usuario_id,permiso_id,campus_id) SELECT $1,$2,id,$3 FROM permiso WHERE nombre=$4 ON CONFLICT(id) DO NOTHING`,[stableId('permission/'+u.key+'/'+permission),u.id,catalog.campus.id,permission]);
      }
      await db.query('COMMIT');
    }catch(e){await db.query('ROLLBACK');throw e;}
    return u.id;
  });
}
async function resources() {
  for(const [kind,items] of [['physical',physical],['digital',digital]])for(const item of items)await step(kind+'/'+item.key,async()=>{
    const key=kind+'/'+item.key,owner=user(item.owner).id;
    const rows=(await db.query(`SELECT id,descripcion FROM publicacion_recurso WHERE propietario_id=$1 AND campus_id=$2 AND titulo=$3`,[owner,catalog.campus.id,item.title])).rows;
    assert.ok(rows.length<=1,'Publicación duplicada: '+key);if(rows.length)assert.equal(rows[0].descripcion,description(item),'Publicación editada: revisar');
    let result=rows[0];
    if(!result) {
      const common={title:item.title,description:description(item),modality:item.modality,price:item.price};
      if(kind==='physical')result=await request(lib(kind),item.owner,'POST',{...common,categoryId:catalog.categories[item.key],condition:item.condition,careerId:null,subjectId:null,photo:{name:item.asset,mimeType:'image/png',base64:(await readFile(resolve(assets,item.asset))).toString('base64')}},201);
      else {const form=new FormData();form.append('metadata',JSON.stringify({...common,careerIds:[catalog.careers[item.career].id],subjectIds:[catalog.subjects[item.key].id]}));form.append('file',new Blob([await readFile(resolve(assets,item.key+'.pdf'))],{type:'application/pdf'}),item.key+'.pdf');result=await request(lib(kind),item.owner,'POST',form,201);}
    }
    if(!m.publications.some(p=>p.key===key)){m.publications.push({key,id:result.id,kind,owner:item.owner});await save();}
    return result.id;
  });
}
async function agreement(key,receiver,mode) {
  const p=pub(key),path=lib(p.kind)+'/'+p.id;
  const asked=await step(key+'/request',async()=>{
    const rows=(await db.query('SELECT id FROM solicitud_recurso WHERE publicacion_id=$1 AND solicitante_id=$2',[p.id,user(receiver).id])).rows;
    assert.ok(rows.length<=1);return rows[0]??request(path+'/requests',receiver,'POST',{messageCode:'ME_INTERESA'},201);
  });
  if(mode==='pending')return;
  const accepted=await step(key+'/accept',async()=>{
    const row=(await db.query('SELECT id FROM transaccion_recurso WHERE solicitud_id=$1',[asked.id])).rows[0];
    return row?{transactionId:row.id}:request(path+'/requests/'+asked.id,p.owner,'PATCH',{decision:'ACEPTAR'});
  });
  const tx=accepted.transactionId??accepted.transaction?.id;assert.ok(tx);
  if(!m.transactions.some(t=>t.id===tx)){m.transactions.push({id:tx,key,receiver});await save();}
  const txPath=path+'/transactions/'+tx;
  // Las confirmaciones y cancelaciones se recuperan también tras una respuesta perdida.
  await step(key+'/owner-confirm',async()=>{
    const row=(await db.query('SELECT id FROM confirmacion_transaccion WHERE transaccion_id=$1 AND usuario_id=$2',[tx,user(p.owner).id])).rows[0];
    if(!row)await request(txPath+'/confirm',p.owner,'POST',{});return true;
  });
  if(mode==='single')return;
  if(mode==='cancel')await step(key+'/cancel',async()=>{const row=(await db.query('SELECT estado_transaccion FROM transaccion_recurso WHERE id=$1',[tx])).rows[0];if(row.estado_transaccion!=='CANCELADA')await request(txPath+'/cancel',receiver,'POST',{});});
  else {
    await step(key+'/receiver-confirm',async()=>{const row=(await db.query('SELECT id FROM confirmacion_transaccion WHERE transaccion_id=$1 AND usuario_id=$2',[tx,user(receiver).id])).rows[0];if(!row)await request(txPath+'/confirm',receiver,'POST',{});});
    await step(key+'/rating',async()=>{const row=(await db.query('SELECT id FROM valoracion WHERE transaccion_id=$1',[tx])).rows[0];if(!row)await request(txPath+'/rating',receiver,'POST',{score:4},201);});
  }
}
async function activityFixtures() {
  for(const item of activities)await step('activity/'+item.key,async()=>{
    const found=await mg.collection('activities').find({campusId:catalog.campus.id,createdByUserId:user(item.owner).id,title:item.title}).toArray();assert.ok(found.length<=1);
    if(found[0])assert.equal(found[0].description,description(item));
    const body={title:item.title,description:description(item),startAt:new Date(`${item.day}T${item.start}:00-03:00`).toISOString(),endAt:new Date(`${item.day}T${item.end}:00-03:00`).toISOString(),location:catalog.locations[item.key]};
    const result=found[0]?{id:String(found[0]._id)}:await request('/activities',item.owner,'POST',body,201);
    if(!m.activities.some(a=>a.key===item.key)){m.activities.push({key:item.key,id:result.id,owner:item.owner});await save();}
    return result.id;
  });
  for(const [key,participant] of [['moviles','antonia'],['moviles','tomas'],['comunidades','camila'],['orientacion','catalina'],['redes','diego'],['bd','matias'],['seguridad','sebastian'],['bd','antonia']])
    await step(`join/${key}/${participant}`,async()=>{const row=await mg.collection('activity_participation').findOne({activityId:new ObjectId(activity(key).id),userId:user(participant).id});if(row?.status!=='JOINED')await request('/activities/'+activity(key).id+'/participation',participant,'PUT',{});});
  await step('leave/bd/antonia',async()=>{const row=await mg.collection('activity_participation').findOne({activityId:new ObjectId(activity('bd').id),userId:user('antonia').id});if(row?.status!=='LEFT')await request('/activities/'+activity('bd').id+'/participation','antonia','DELETE',{});});
}
async function interactions() {
  for(const p of m.publications)for(const actor of [p.owner==='antonia'?'tomas':'antonia',...(['physical/calculadora','digital/bd','digital/redes'].includes(p.key)?['tomas']:[])])await step(`view/${p.key}/${actor}`,()=>request('/analytics/resources/'+p.id+'/views',actor,'POST',{operationId:operationId(`view/${p.key}/${actor}`)}));
  for(const key of ['moviles','bd','redes'])await step('activity-view/'+key,()=>request('/activities/'+activity(key).id+'/interactions','tomas','POST',{type:'VIEWED',operationId:operationId('activity-view/'+key)}));
}
const analyticsQuery=()=>`from=2026-11-13&to=2026-11-16&grouping=week&institutionId=${catalog.institution.id}&campusId=${catalog.campus.id}`;
async function report() {
  await step('analytical-report',async()=>{
    // La API no admite operationId: recuperar por autor exclusivo y filtros exactos.
    const rows=(await db.query(`SELECT id FROM reporte WHERE generado_por_id=$1 AND institucion_id=$2
      AND tipo_reporte='KPI_ESENCIALES' AND filtros_json->>'from'='2026-11-13'
      AND filtros_json->>'to'='2026-11-16' AND filtros_json->>'grouping'='week'`,[user('tomas').id,catalog.institution.id])).rows;
    assert.ok(rows.length<=1,'Más de una instantánea demo: revisar sin borrar');
    const result=rows[0]??await request('/analytics/reports','tomas','POST',{institutionId:catalog.institution.id,campusId:catalog.campus.id,from:'2026-11-13',to:'2026-11-16',grouping:'week'});
    return {id:result.id};
  });
}
async function verify(pre) {
  stage='verify';const ids=m.publications.map(p=>p.id),users=m.users.map(u=>u.id);
  assert.equal(m.dataset,DATASET);assert.equal(m.users.length,8);assert.equal(ids.length,11);assert.equal(new Set(ids).size,11);assert.equal(m.activities.length,6);
  const rows=(await db.query('SELECT id,campus_id,propietario_id,tipo_recurso,estado_publicacion FROM publicacion_recurso WHERE id=ANY($1::uuid[])',[ids])).rows;
  assert.equal(rows.length,11);assert.equal(rows.filter(p=>p.tipo_recurso==='FISICO').length,6);assert.equal(rows.filter(p=>p.tipo_recurso==='DIGITAL').length,5);
  assert.ok(rows.every(p=>p.campus_id===catalog.campus.id&&users.includes(p.propietario_id)));
  const profiles=(await db.query('SELECT id,campus_id,institucion_id FROM perfil_usuario WHERE id=ANY($1::uuid[])',[users])).rows;
  assert.equal(profiles.length,8);assert.ok(profiles.every(p=>p.campus_id===catalog.campus.id&&p.institucion_id===catalog.institution.id));
  assert.equal(rows.find(r=>r.id===pub('physical/monitor').id).estado_publicacion,'RESERVADO');
  assert.equal(rows.find(r=>r.id===pub('physical/cuaderno').id).estado_publicacion,'FINALIZADO');
  assert.equal(rows.find(r=>r.id===pub('physical/kit').id).estado_publicacion,'DISPONIBLE');
  for(const a of m.activities){const doc=await mg.collection('activities').findOne({_id:new ObjectId(a.id),campusId:catalog.campus.id});assert.ok(doc);const count=await mg.collection('activity_participation').countDocuments({activityId:doc._id,status:'JOINED'});assert.equal(doc.participantCount,count);assert.ok(doc.startAt instanceof Date&&doc.endAt instanceof Date);}
  const files=(await db.query('SELECT publicacion_id,bucket_id,storage_path,tamano_bytes,tipo_archivo FROM archivo_publicacion WHERE publicacion_id=ANY($1::uuid[]) AND deleted_at IS NULL',[ids])).rows;
  for(const p of m.publications){const own=files.filter(f=>f.publicacion_id===p.id);assert.ok(own.length);for(const f of own){assert.ok(f.storage_path.startsWith(`${catalog.campus.id}/${user(p.owner).id}/${p.id}/`));const result=await admin.storage.from(f.bucket_id).download(f.storage_path);assert.ok(!result.error&&result.data);const bytes=Buffer.from(await result.data.arrayBuffer());assert.equal(bytes.length,Number(f.tamano_bytes));if(f.tipo_archivo==='IMAGEN')assert.deepEqual(bytes,await readFile(resolve(assets,physical.find(i=>i.key===p.key.split('/')[1]).asset)));if(f.tipo_archivo==='RECURSO')assert.deepEqual(bytes,await readFile(resolve(assets,p.key.split('/')[1]+'.pdf')));}}
  const gallery=await request('/marketplace/physicalgoods/'+pub('physical/calculadora').id+'/images','tomas');for(const img of gallery.images){const response=await fetch(img.url,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);}
  const acquired=await request('/marketplace/elibrary/acquired/'+pub('digital/bd').id,'catalina');assert.ok(acquired.acquisition);
  const downloaded=await request(`/marketplace/elibrary/${pub('digital/bd').id}/files/${acquired.files[0].id}/download`,'catalina');
  assert.deepEqual(downloaded,await readFile(resolve(assets,'bd.pdf')));
  const pendingFile=unique(files.filter(f=>f.publicacion_id===pub('digital/poo').id&&f.tipo_archivo==='RECURSO'),'original pendiente');
  const pendingId=(await db.query("SELECT id FROM archivo_publicacion WHERE publicacion_id=$1 AND storage_path=$2",[pendingFile.publicacion_id,pendingFile.storage_path])).rows[0].id;
  await request(`/marketplace/elibrary/${pub('digital/poo').id}/files/${pendingId}/download`,'antonia','GET',undefined,403);
  const dashboard=await request('/analytics/dashboard?'+analyticsQuery(),'tomas');assert.ok(dashboard.resourceDemand.value>0);assert.ok(dashboard.subjectDemand.value>0);assert.ok(dashboard.activityParticipation.value>0);
  assert.equal(hash(JSON.stringify(await snapshotQA(db))),m.qaHash,'Cambió una cuenta QA desde el preflight');
  const result={dataset:DATASET,target,verifiedAt:new Date().toISOString(),counts:{students:profiles.length,physical:6,digital:5,activities:6,files:files.length},
    checks:['relaciones SQL/MongoDB','catálogo real sin duplicados','estados físicos y adquisición digital','descarga autorizada idéntica al original y descarga pendiente HTTP 403','participación y contadores','todos los archivos descargados y comparados','URL firmada de imagen HTTP 200','analítica existente no vacía','cuentas QA preservadas'],
    metrics:{resourceDemand:dashboard.resourceDemand.value,subjectDemand:dashboard.subjectDemand.value,activityParticipation:dashboard.activityParticipation.value},
    remaining:await inventory()};
  await writeFile(resolve(root,'verification.json'),JSON.stringify(result,null,2));log({verified:true,counts:result.counts,metrics:result.metrics,preservedLegacyPublications:result.remaining.preservedPublications.length});
}
try {
  const pre=await preflight();
  if(!apply&&command!=='verify'){await plan(pre);}
  else {
    requireTarget(target,option('--target'),option('--environment'));
    try{m=JSON.parse(await readFile(manifestPath,'utf8'));}catch(e){if(e.code!=='ENOENT'||!apply)throw e;
      // Si se perdió el manifiesto, nunca cambiar contraseñas ni recuperar cuentas a ciegas.
      const collisions=(await db.query('SELECT id FROM auth.users WHERE id=ANY($1::uuid[]) OR email=ANY($2::text[])',[students.map(s=>stableId('user/'+s.key)),students.map(s=>`demo.${s.key}.20261116@campuslink.invalid`)])).rows;
      assert.equal(collisions.length,0,'Existen cuentas demo: recuperar el manifiesto privado antes de continuar');m=newManifest(target,catalog);m.qaHash=pre.qaHash;await save();}
    assert.equal(m.dataset,DATASET);assert.equal(m.target,target);assert.deepEqual(m.catalog,catalog,'Cambió el catálogo: revisar el plan');
    if(apply){assert.equal(pre.qaHash,m.qaHash,'Cuentas QA cambiaron: revisar antes de reanudar');await openApi();await bootstrap();await resources();await agreement('physical/calculadora','valentina','pending');await agreement('physical/monitor','catalina','single');await agreement('physical/cuaderno','antonia','complete');await agreement('physical/kit','diego','cancel');await agreement('digital/bd','catalina','complete');await agreement('digital/poo','antonia','single');await activityFixtures();await interactions();await report();}
    else await openApi();
    await verify(pre);
    if(apply)await writeFile(resolve(root,'credentials.md'),'# Cuentas ficticias de demostración\n\nNo versionar ni compartir públicamente.\n\n| Perfil | Correo | Contraseña |\n|---|---|---|\n'+m.users.map(u=>`| ${u.name}${u.consult?' (consulta de analítica y reportería)':''} | ${u.email} | ${u.password} |`).join('\n')+'\n',{mode:0o600});
  }
}catch(e){log({failed:stage,error:e.message?.replace(/postgres(?:ql)?:\/\/\S+|mongodb(?:\+srv)?:\/\/\S+/g,'[conexión omitida]'),code:e.code});process.exitCode=1;}
finally{if(server)await new Promise(r=>server.close(r));if(mongoModule)await mongoModule.closeMongoDB();try{const {closePostgres}=await import('../../dist/database/supabase/postgres.js');await closePostgres();}catch{}await db.end().catch(()=>{});}
