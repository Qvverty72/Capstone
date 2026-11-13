import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {DATASET,DEMO_DATE,NOTICE,students,physical,digital,activities,description,stableId,operationId,newManifest,runStep,requireTarget,unique} from '../fixtures.mjs';
import {digest,validateAllowlist,requireApproval} from '../cleanup-guards.mjs';

test('piloto reducido, autores reutilizados y seis organizadores diferentes',()=>{
  assert.equal(students.length,8);assert.equal(physical.length,6);assert.equal(digital.length,5);assert.equal(activities.length,6);
  const authors=new Set(students.map(s=>s.key));
  for(const rows of [physical,digital,activities]){assert.equal(new Set(rows.map(x=>x.key)).size,rows.length);for(const row of rows){assert.ok(authors.has(row.owner));assert.ok(description(row).includes(NOTICE));}}
  assert.equal(new Set(activities.map(a=>a.owner)).size,6);
});
test('fechas vigentes durante la presentación y sin salas inventadas',()=>{
  const demo=new Date(DEMO_DATE+'T12:00:00-03:00');
  for(const a of activities){const start=new Date(`${a.day}T${a.start}:00-03:00`),end=new Date(`${a.day}T${a.end}:00-03:00`);assert.ok(end>start);assert.ok(end>demo);assert.ok(a.poi);}
  const a=activities.find(a=>a.key==='orientacion');assert.ok(new Date(`${a.day}T${a.start}:00-03:00`)<demo);
});
test('IDs reproducibles sin credenciales versionadas ni correos de personas reales',()=>{
  const a=newManifest('target',{}),b=newManifest('target',{});
  assert.equal(a.dataset,DATASET);assert.deepEqual(a.users.map(u=>u.id),b.users.map(u=>u.id));assert.notEqual(a.users[0].password,b.users[0].password);
  assert.ok(a.users.every(u=>u.email.endsWith('@campuslink.invalid')));
  assert.notEqual(stableId('user/camila'),stableId('view/camila'));
  assert.match(operationId('view/camila'),/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/);
});
test('ejecutar dos veces conserva los pasos completados',async()=>{
  let changes=0,saves=0;const m={steps:{}};
  const operation=()=>{changes++;return {id:'existing'};},save=async()=>{saves++;};
  await runStep(m,'resource',operation,save);await runStep(m,'resource',operation,save);
  assert.equal(changes,1);assert.equal(saves,1);
});
test('paso fallido no queda marcado como completado',async()=>{
  const m={steps:{}};await assert.rejects(runStep(m,'request',async()=>{throw new Error('network');},async()=>{}));
  assert.equal(Object.hasOwn(m.steps,'request'),false);
});
test('rechaza producción, destinos distintos y catálogos ambiguos',()=>{
  const id='a'.repeat(64);assert.doesNotThrow(()=>requireTarget(id,id,'qa'));
  assert.throws(()=>requireTarget(id,id,'production'));assert.throws(()=>requireTarget(id,'b'.repeat(64),'qa'));assert.throws(()=>requireTarget(id,undefined,'qa'));
  assert.throws(()=>unique([],'sede'));assert.throws(()=>unique([{},{}],'sede'));
});
test('precios y categorías coherentes con la modalidad',()=>{
  for(const p of [...physical,...digital]){if(p.modality==='DONACION')assert.equal(p.price,null);else assert.ok(p.price>0&&Number.isInteger(p.price));}
  assert.ok(physical.every(p=>p.category&&p.condition&&p.asset));assert.ok(digital.every(p=>p.career&&p.subject));
});
test('todos los PNG y PDF existen; documentos originales completos de dos páginas',async()=>{
  for(const p of physical){const bytes=await readFile(new URL('../assets/'+p.asset,import.meta.url));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),960);assert.equal(bytes.readUInt32BE(20),640);}
  for(const d of digital){const bytes=await readFile(new URL('../assets/'+d.key+'.pdf',import.meta.url));const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),2);assert.equal(pdf.getTitle(),d.title);}
});
const campus='campus',entry={id:'11111111-1111-4111-a111-111111111111',ownerId:'owner',campusId:campus,expectedTitle:'Prueba identificada',confirmedTestData:true,reason:'Confirmado por el propietario'};
test('saneamiento exige IDs explícitos y protege cuentas QA',()=>{
  const list={publications:[entry],activities:[]};assert.doesNotThrow(()=>validateAllowlist(list,[],campus));
  assert.throws(()=>validateAllowlist(list,['owner'],campus));assert.throws(()=>validateAllowlist(list,[],'other'));
  assert.throws(()=>validateAllowlist({...list,publications:[entry,entry]},[],campus));
  assert.throws(()=>validateAllowlist({...list,publications:[{...entry,confirmedTestData:false}]},[],campus));
  assert.throws(()=>validateAllowlist({...list,publications:[{...entry,id:'*'}]},[],campus));
});
test('respaldo y autorización deben coincidir con el plan exacto',()=>{
  const plan={target:'qa',ids:[entry.id]},approval=digest(plan),backup={planHash:approval,plan};
  assert.doesNotThrow(()=>requireApproval(plan,approval,backup));
  assert.throws(()=>requireApproval(plan,'wrong',backup));assert.throws(()=>requireApproval(plan,approval,null));
  assert.throws(()=>requireApproval({...plan,ids:[]},approval,backup));
});
