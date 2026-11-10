// Compara preparación transaccional con la misma conexión TLS. Sin escrituras.
import dotenv from 'dotenv';
import pg from 'pg';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));dotenv.config({quiet:true});
assert.equal(process.env.QA_AUTHORIZED,'1');
const db=new pg.Client({connectionString:process.env.SUPABASE_DB_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:15000,statement_timeout:5000});
const samples=[];
try{
 await db.connect();
 const settings=async()=>(await db.query("SELECT current_setting('statement_timeout') statement, current_setting('lock_timeout') lock, current_setting('idle_in_transaction_session_timeout') idle")).rows[0];
 const initial=await settings();
 for(let i=0;i<6;i++)for(const mode of (i%2?['combined','separate']:['separate','combined'])){
  const start=performance.now();
  if(mode==='separate'){
   await db.query('BEGIN');await db.query("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$1,true),set_config('idle_in_transaction_session_timeout',$1,true)",['5000']);
  }else await db.query('BEGIN; SET LOCAL statement_timeout = 5000; SET LOCAL lock_timeout = 5000; SET LOCAL idle_in_transaction_session_timeout = 5000');
  samples.push({mode,ms:Math.round(performance.now()-start)});
  assert.deepEqual(await settings(),{statement:'5s',lock:'5s',idle:'5s'});
  await db.query(i%2?'ROLLBACK':'COMMIT');assert.deepEqual(await settings(),initial,'SET LOCAL no debe contaminar la siguiente operación');
 }
 const median=mode=>samples.filter(s=>s.mode===mode).map(s=>s.ms).sort((a,b)=>a-b)[2];
 const report={recordedAt:new Date().toISOString(),kind:'read-only-postgres-transaction-setup',separateMedianMs:median('separate'),combinedMedianMs:median('combined'),settingsRestoredAfterCommitAndRollback:true,samples};
 const output=resolve('qa/local/logs');await mkdir(output,{recursive:true});await writeFile(resolve(output,'postgres-setup.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.end();}
