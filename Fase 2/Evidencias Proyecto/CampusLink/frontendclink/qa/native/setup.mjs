// Paquetes oficiales fijados por URL, tamaño y checksum del repositorio de Google.
import {mkdir,readFile,writeFile,stat,access} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../../../backendclink/qa/local/tools/android'),sdk=resolve(root,'sdk'),cache=resolve(root,'downloads');
if(process.platform!=='win32')throw new Error('Este instalador fija paquetes Windows; QA_ANDROID_SDK permite utilizar un SDK existente en Linux');
const packages=JSON.parse(await readFile(resolve(here,'sdk-packages.json'),'utf8'));
await mkdir(cache,{recursive:true});await mkdir(sdk,{recursive:true});
async function digest(file){const hash=createHash('sha1');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
for(const item of packages){
 const url=new URL(item.url);if(url.origin!=='https://dl.google.com')throw new Error('Proveedor SDK no admitido');
 const archive=resolve(cache,url.pathname.split('/').at(-1));
 let valid=false;try{valid=(await stat(archive)).size===item.bytes&&await digest(archive)===item.sha1;}catch{}
 if(!valid){console.log(JSON.stringify({download:item.name,bytes:item.bytes}));const response=await fetch(url,{signal:AbortSignal.timeout(900000)});if(!response.ok)throw new Error('Descarga SDK falló: '+response.status);await pipeline(Readable.fromWeb(response.body),createWriteStream(archive));}
 if((await stat(archive)).size!==item.bytes||await digest(archive)!==item.sha1)throw new Error('Checksum SDK incorrecto: '+item.name);
 const target=resolve(sdk,item.destination),inside=relative(sdk,target);if(inside.startsWith('..')||inside.startsWith(sep))throw new Error('Ruta de extracción fuera del SDK');
 const marker=resolve(target,item.name==='platform-tools'?'platform-tools/adb.exe':item.name==='emulator'?'emulator/emulator.exe':'x86_64/system.img');
 try{await access(marker);console.log(JSON.stringify({installed:item.name}));continue;}catch{}
 await mkdir(target,{recursive:true});
 await exec('tar.exe',['-xf',archive,'-C',target],{windowsHide:true,timeout:300000,maxBuffer:1024*1024});
 await access(marker);console.log(JSON.stringify({verified:item.name}));
}
const avdRoot=resolve(root,'avd'),avd=resolve(avdRoot,'CampusLink_QA.avd');await mkdir(avd,{recursive:true});
await writeFile(resolve(avdRoot,'CampusLink_QA.ini'),`avd.ini.encoding=UTF-8\npath=${avd}\ntarget=android-35\n`);
await writeFile(resolve(avd,'config.ini'),[
 'AvdId=CampusLink_QA','avd.ini.encoding=UTF-8','abi.type=x86_64','hw.cpu.arch=x86_64','hw.cpu.ncore=4','hw.ramSize=3072',
 'hw.keyboard=yes','hw.lcd.width=720','hw.lcd.height=1280','hw.lcd.density=320','hw.gpu.enabled=yes','hw.gpu.mode=swiftshader_indirect',
 'image.sysdir.1=system-images/android-35/default/x86_64/','tag.id=default','tag.display=Default','disk.dataPartition.size=2G','showDeviceFrame=no',
].join('\n')+'\n');
const env={...process.env,ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,ANDROID_AVD_HOME:avdRoot,ANDROID_USER_HOME:resolve(root,'user')};
// El wrapper -accel-check de Windows no cita correctamente rutas con espacios.
const result=await exec(resolve(sdk,'emulator/emulator-check.exe'),['accel'],{env,windowsHide:true,maxBuffer:1024*1024}).catch(error=>({stdout:error.stdout??'',stderr:error.stderr??'',code:error.code}));
await writeFile(resolve(root,'setup-result.json'),JSON.stringify({sdk,avdRoot,packages:packages.map(p=>({name:p.name,sha1:p.sha1})),acceleration:result.stdout+result.stderr},null,2));
console.log(JSON.stringify({sdk,acceleration:(result.stdout+result.stderr).trim()}));
