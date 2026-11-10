// API QA local con las dependencias reales y sin lanzar workers globales.
import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
dotenv.config({quiet:true});
if(process.env.QA_AUTHORIZED!=='1')throw new Error('Se requiere QA_AUTHORIZED=1');
if(!process.env.RATE_LIMIT_REDIS_URL)throw new Error('Configura RATE_LIMIT_REDIS_URL con el Redis local QA antes de iniciar');
process.env.PORT=process.env.QA_PORT??'3011';
process.env.NODE_ENV='development';
const {startApi,stopApi}=await import('../dist/bootstrap.js');
const server=await startApi();
console.log(JSON.stringify({qaApi:'ready',port:server.address().port,workers:false}));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await stopApi(server);process.exit(0);}
process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
process.on('message',message=>{if(message==='stop')void stop();});
