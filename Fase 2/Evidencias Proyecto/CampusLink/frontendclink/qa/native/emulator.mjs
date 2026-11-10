// AVD dedicado, sin ventanas, sin cambiar características de Windows ni tocar otros dispositivos.
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
const exec=promisify(execFile),root=resolve('../backendclink/qa/local/tools/android');
const sdk=process.env.QA_ANDROID_SDK??resolve(root,'sdk'),adb=resolve(sdk,'platform-tools',process.platform==='win32'?'adb.exe':'adb');
const serial='emulator-5580',mode=process.argv[2]??'start',pidFile=resolve(root,'emulator.json');
const call=(...args)=>exec(adb,['-s',serial,...args],{windowsHide:true,timeout:15000,maxBuffer:1000000});
const owned=async()=>{const result=await call('shell','getprop','ro.boot.qemu.avd_name');if(result.stdout.trim()!=='CampusLink_QA')throw new Error('El puerto pertenece a otro AVD; no se modifica');};
if(mode==='stop'){
 const state=JSON.parse(await readFile(pidFile,'utf8'));if(state.serial!==serial||state.avd!=='CampusLink_QA')throw new Error('No existe registro del emulador QA propio');
 await owned();await call('emu','kill');
 const deadline=Date.now()+30000;let stopped=false;
 while(Date.now()<deadline){
  const devices=(await exec(adb,['devices'],{windowsHide:true,timeout:5000})).stdout;
  let alive=false;if(state.pid){try{process.kill(state.pid,0);alive=true;}catch{}}
  if(!devices.includes(serial)&&!alive){stopped=true;break;}await wait(250);
 }
 if(!stopped)throw new Error('El AVD QA aún se está cerrando; no se inicia otra instancia');
 console.log('Emulador CampusLink_QA detenido');
}else if(mode==='start'){
 let running=false;try{await call('get-state');running=true;}catch{}
 if(running){
  await owned();let previous={};try{previous=JSON.parse(await readFile(pidFile,'utf8'));}catch{}
  await writeFile(pidFile,JSON.stringify({...(previous.serial===serial&&previous.avd==='CampusLink_QA'?previous:{}),serial,avd:'CampusLink_QA',reused:true}));
  console.log('QA_ANDROID_SERIAL='+serial);
 }
 else{
  const logs=resolve(root,'logs');await mkdir(logs,{recursive:true});const out=await open(resolve(logs,'stdout.log'),'a'),err=await open(resolve(logs,'stderr.log'),'a');
  const env={...process.env,ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,ANDROID_AVD_HOME:resolve(root,'avd'),ANDROID_USER_HOME:resolve(root,'user')};
  const child=spawn(resolve(sdk,'emulator',process.platform==='win32'?'emulator.exe':'emulator'),['-avd','CampusLink_QA','-no-window','-no-audio','-no-boot-anim','-gpu','swiftshader_indirect','-no-snapshot','-port','5580','-memory','3072','-cores','4'],{env,windowsHide:true,detached:true,stdio:['ignore',out.fd,err.fd]});
  await new Promise((done,fail)=>{child.once('spawn',done);child.once('error',fail);});child.unref();
  await writeFile(pidFile,JSON.stringify({pid:child.pid,serial,avd:'CampusLink_QA'}));await out.close();await err.close();
  const deadline=Date.now()+240000;let ready=false;
  while(Date.now()<deadline){try{const boot=await call('shell','getprop','sys.boot_completed');if(boot.stdout.trim()==='1'){await owned();ready=true;break;}}catch{}await wait(1000);}
  if(!ready)throw new Error('Android no terminó de arrancar. Revisar los logs QA y WHPX/KVM');
  console.log('QA_ANDROID_SERIAL='+serial);
 }
}else throw new Error('Uso: emulator.mjs start|stop');
