// API QA local con las dependencias reales y sin lanzar workers globales.
import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import pg from 'pg';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
dotenv.config({quiet:true});
dotenv.config({path:'.env.runtime.local',override:true,quiet:true});
if(process.env.QA_AUTHORIZED!=='1')throw new Error('Se requiere QA_AUTHORIZED=1');
if(!process.env.RATE_LIMIT_REDIS_URL)throw new Error('Configura RATE_LIMIT_REDIS_URL con el Redis local QA antes de iniciar');
if(process.env.QA_SQL_DIAGNOSTICS==='1'){
 const query=pg.Client.prototype.query;
 pg.Client.prototype.query=function(...args){const started=performance.now();const result=query.apply(this,args);return result?.catch?result.catch(error=>{
  const sql=typeof args[0]==='string'?args[0]:args[0]?.text??'';
  console.error(JSON.stringify({qaSqlError:true,code:error.code,routine:error.routine,
   tables:[...new Set([...sql.matchAll(/public\.([a-z_]+)/g)].map(match=>match[1]))],rowLock:/FOR (?:NO KEY )?(?:UPDATE|SHARE)/i.test(sql),durationMs:Math.round(performance.now()-started)}));throw error;
 }):result;};
}
process.env.PORT=process.env.QA_PORT??'3011';
process.env.NODE_ENV='development';
const {startApi,stopApi}=await import('../dist/bootstrap.js');
const server=await startApi();
console.log(JSON.stringify({qaApi:'ready',port:server.address().port,workers:false}));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await stopApi(server);process.exit(0);}
process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
process.on('message',message=>{if(message==='stop')void stop();});
