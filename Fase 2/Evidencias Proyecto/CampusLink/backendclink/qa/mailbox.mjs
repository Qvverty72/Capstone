// Lector IMAP de solo lectura: no marca mensajes, no los borra ni registra OTP.
import {ImapFlow} from 'imapflow';
import {simpleParser} from 'mailparser';
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {setTimeout as wait} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {resolve,relative} from 'node:path';
const [requestFile,codeFile]=process.argv.slice(2);
assert.equal(process.env.QA_AUTHORIZED,'1');
const scope=resolve('qa/local/ui-runs');
for(const file of [requestFile,codeFile]){assert.ok(file&&!relative(scope,resolve(file)).startsWith('..'),'Solo archivos dentro de qa/local/ui-runs');}
const request=JSON.parse(await readFile(requestFile,'utf8'));
assert.match(request.email,/\+clqa[0-9a-f]{32}@/);
const configFile=process.env.QA_MAILBOX_ENV;
assert.ok(configFile,'Indicar QA_MAILBOX_ENV con credenciales IMAP fuera de Git');
const config=parseEnv(await readFile(configFile,'utf8'));
const client=new ImapFlow({host:config.QA_IMAP_HOST??'imap.gmail.com',port:993,secure:true,auth:{user:config.QA_IMAP_USER,pass:config.QA_IMAP_PASSWORD},logger:false,emitLogs:false,connectionTimeout:20000,socketTimeout:30000,disableAutoIdle:true});
let lock;
try{
 await client.connect();lock=await client.getMailboxLock('INBOX',{readOnly:true});
 const end=Date.now()+120000;
 while(Date.now()<end){
  const ids=await client.search({to:request.email,since:new Date(request.since)},{uid:true});
  for(const uid of ids.slice(-8).reverse()){
   const message=await client.fetchOne(uid,{source:true,internalDate:true},{uid:true});
   if(!message||new Date(message.internalDate).getTime()<Date.parse(request.since)-2000)continue;
   const parsed=await simpleParser(message.source,{skipHtmlToText:false,skipTextToHtml:true});
   const recipients=(Array.isArray(parsed.to)?parsed.to:[parsed.to]).flatMap(a=>a?.value??[]).map(a=>a.address?.toLowerCase());
   if(!recipients.includes(request.email.toLowerCase()))continue;
   const text=parsed.text??'',codes=[...new Set([...text.matchAll(/(?<!\d)\d{6,10}(?!\d)/g)].map(m=>m[0]))];
   if(codes.length!==1)continue;
   await writeFile(codeFile,JSON.stringify({email:request.email,purpose:request.purpose,since:request.since,code:codes[0]}),{mode:0o600});
   process.exitCode=0;break;
  }
  try{const code=JSON.parse(await readFile(codeFile,'utf8'));if(code.purpose===request.purpose&&code.since===request.since)break;}catch{}
  await wait(1500);await client.noop();
 }
 const code=JSON.parse(await readFile(codeFile,'utf8'));assert.equal(code.since,request.since,'No llegó un OTP nuevo al buzón QA');
}catch{console.error('No se pudo leer un OTP nuevo del buzón QA. Revisa conexión IMAP, credenciales locales y entrega SMTP.');process.exitCode=1;}
finally{lock?.release();await client.logout().catch(()=>{});}
