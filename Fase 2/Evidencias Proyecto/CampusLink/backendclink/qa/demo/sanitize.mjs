// Retiro reversible de listados: IDs confirmados por el propietario, sin borrados.
// No elimina usuarios, relaciones, imágenes, archivos, mapas ni historia.
import dotenv from 'dotenv';
import pg from 'pg';
import {ObjectId,BSON} from 'mongodb';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {students,stableId,requireTarget,unique} from './fixtures.mjs';
import {digest,validateAllowlist,requireApproval} from './cleanup-guards.mjs';

const backend=resolve(dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(backend);dotenv.config({quiet:true});
const args=process.argv.slice(2),command=args[0]??'plan',get=name=>args[args.indexOf(name)+1];
assert.ok(['plan','backup','apply'].includes(command),'Comando: plan | backup | apply');
assert.ok(args.includes('--allowlist'),'Indicar --allowlist qa/local/demo/cleanup.json');
const root=resolve(backend,'qa/local/demo');await mkdir(root,{recursive:true});
const {EJSON}=BSON;
const list=JSON.parse(await readFile(resolve(backend,get('--allowlist')),'utf8'));
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,statement_timeout:20000});
let module,mg;
try {
  await db.connect();if(command!=='apply')await db.query('SET default_transaction_read_only=on');
  else assert.equal((await db.query("SELECT pg_try_advisory_lock(hashtext('CampusLink.institutionalDemo')) AS locked")).rows[0].locked,true);
  module=await import('../../dist/database/mongodb/client.js');mg=await module.connectMongoDB();
  const pgUrl=new URL(process.env.SUPABASE_DB_URL),mongoUrl=new URL(process.env.MONGODB_URI);
  // Misma identidad que seed.mjs; hashes de texto sin serialización JSON adicional.
  const {createHash}=await import('node:crypto');const sha=s=>createHash('sha256').update(s).digest('hex');
  const destination={supabase:new URL(process.env.SUPABASE_URL).hostname,postgres:sha(`${pgUrl.hostname}:${pgUrl.port}/${pgUrl.pathname}/${pgUrl.username}`),mongo:sha(`${mongoUrl.hostname}/${mg.databaseName}`)};
  const target=sha(JSON.stringify(destination));requireTarget(target,list.target,list.environment);
  const campus=unique((await db.query(`SELECT c.id FROM campus c JOIN institucion i ON i.id=c.institucion_id
    WHERE lower(i.nombre)='duoc uc' AND lower(c.nombre) IN ('san andres','san andrés','concepción','concepcion','san andrés de concepción') AND c.activo`)).rows,'sede Duoc');
  const qa=(await db.query("SELECT id FROM auth.users WHERE raw_user_meta_data ? 'qaSeedRun'")).rows.map(u=>u.id);
  const protectedUsers=[...qa,...students.map(s=>stableId('user/'+s.key))];
  validateAllowlist(list,protectedUsers,campus.id);
  const plan={target,campusId:campus.id,operation:'HIDE_CONFIRMED_TEST_CONTENT',publications:[],activities:[]};
  const backupForApply=command==='apply'?JSON.parse(await readFile(resolve(backend,get('--backup')),'utf8')):null;
  const previous=(kind,item)=>{
    const old=unique(backupForApply.plan[kind].filter(p=>p.id===item.id),item.id);
    const data=kind==='activities'?EJSON.deserialize(old.before):old.before;
    assert.equal(kind==='activities'?data.createdByUserId:data.propietario_id,item.ownerId);
    assert.equal(kind==='activities'?data.title:data.titulo,item.expectedTitle);assert.equal(old.reason,item.reason);
    return old;
  };
  for(const item of list.publications) {
    if(backupForApply){plan.publications.push(previous('publications',item));continue;}
    const row=unique((await db.query('SELECT to_jsonb(p) AS data FROM publicacion_recurso p WHERE id=$1 AND propietario_id=$2 AND campus_id=$3 AND titulo=$4',[item.id,item.ownerId,campus.id,item.expectedTitle])).rows,item.id);
    assert.ok(!row.data.deleted_at,'Registro ya retirado; conservar');assert.notEqual(row.data.estado_publicacion,'OCULTO','Registro ya oculto; retirar de allowlist');
    plan.publications.push({id:item.id,reason:item.reason,before:row.data});
  }
  for(const item of list.activities) {
    if(backupForApply){plan.activities.push(previous('activities',item));continue;}
    const row=await mg.collection('activities').findOne({_id:new ObjectId(item.id),campusId:campus.id,createdByUserId:item.ownerId,title:item.expectedTitle});assert.ok(row,'Actividad ajena');assert.notEqual(row.visibility,'HIDDEN','Actividad ya oculta');
    plan.activities.push({id:item.id,reason:item.reason,before:EJSON.serialize(row)});
  }
  const planHash=digest(plan),planPath=resolve(root,'cleanup-preview.json');
  if(command==='plan') {await writeFile(planPath,JSON.stringify({planHash,plan},null,2));console.log(JSON.stringify({dryRun:true,planHash,publications:plan.publications.length,activities:plan.activities.length,planPath}));}
  if(command==='backup') {
    const preview=JSON.parse(await readFile(planPath,'utf8'));assert.equal(preview.planHash,planHash,'Los registros cambiaron: repetir plan');
    // Incluye las filas/documentos completos que se modificarían. No se toca Storage.
    const backup={createdAt:new Date().toISOString(),planHash,plan};
    const path=resolve(root,`cleanup-backup-${planHash}.json`);await writeFile(path,JSON.stringify(backup,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify({backedUp:true,path,planHash}));
  }
  if(command==='apply') {
    assert.ok(plan.publications.length+plan.activities.length>0,'Plan vacío');
    assert.ok(args.includes('--approval')&&args.includes('--backup'),'Requiere autorización y respaldo');
    requireApproval(plan,get('--approval'),backupForApply);
    // SQL transaccional. CAS completo impide sobrescribir cambios desde el respaldo.
    await db.query('BEGIN');try {
      for(const item of plan.publications) {
        const current=unique((await db.query('SELECT to_jsonb(p) AS data FROM publicacion_recurso p WHERE id=$1 FOR UPDATE',[item.id])).rows,item.id).data;
        const omit=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['estado_publicacion','updated_at'].includes(key)));
        if(current.estado_publicacion==='OCULTO'&&digest(omit(current))===digest(omit(item.before)))continue;
        const result=await db.query("UPDATE publicacion_recurso p SET estado_publicacion='OCULTO',updated_at=now() WHERE id=$1 AND to_jsonb(p)=$2::jsonb",[item.id,JSON.stringify(item.before)]);assert.equal(result.rowCount,1,'Cambió una publicación: abortar');
      }
      await db.query('COMMIT');
    }catch(e){await db.query('ROLLBACK');throw e;}
    // Mongo no comparte transacción con SQL. Diario local tras cada cambio.
    const journal={planHash,sql:'complete',mongo:[]};const journalPath=resolve(root,`cleanup-journal-${planHash}.json`);await writeFile(journalPath,JSON.stringify(journal,null,2),{mode:0o600});
    for(const item of plan.activities) {
      const before=EJSON.deserialize(item.before),current=await mg.collection('activities').findOne({_id:before._id});
      assert.ok(current,'Actividad ausente');
      const omit=row=>Object.fromEntries(Object.entries(EJSON.serialize(row)).filter(([key])=>!['visibility','updatedAt'].includes(key)));
      if(!(current.visibility==='HIDDEN'&&digest(omit(current))===digest(omit(before)))) {
        assert.equal(digest(EJSON.serialize(current)),digest(item.before),'Actividad cambió; conservar diario y revisar');
        const result=await mg.collection('activities').updateOne({_id:before._id,campusId:before.campusId,createdByUserId:before.createdByUserId,title:before.title,updatedAt:before.updatedAt,visibility:before.visibility},{$set:{visibility:'HIDDEN',updatedAt:new Date()}});assert.equal(result.matchedCount,1,'Actividad cambió; conservar diario y revisar');
      }
      journal.mongo.push(item.id);await writeFile(journalPath,JSON.stringify(journal,null,2),{mode:0o600});
    }
    console.log(JSON.stringify({applied:true,planHash,publications:plan.publications.length,activities:plan.activities.length,journalPath}));
  }
}catch(e){console.log(JSON.stringify({failed:true,error:e.message,code:e.code}));process.exitCode=1;}
finally{if(module)await module.closeMongoDB();await db.end().catch(()=>{});}
