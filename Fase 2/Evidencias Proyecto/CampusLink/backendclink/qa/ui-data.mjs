import {randomUUID,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
export const uiActors=['propietario','receptor','admin','sujeto'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicationUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function newUIManifest(runId,apiOrigin,now=new Date()) {
 assert.match(runId,uuid);
 const prefix='QAUI '+now.toISOString().replace(/\D/g,'').slice(0,14)+' '+parseInt(runId.slice(0,8),16);
 return {kind:'campuslink-ui-qa-v1',runId,apiOrigin,prefix,createdAt:now.toISOString(),institution:randomUUID(),campus:randomUUID(),career:randomUUID(),subject:randomUUID(),
  users:uiActors.map(actor=>({actor,id:randomUUID(),name:prefix+' '+actor,email:`${actor}.${runId}@campuslink.invalid`,password:randomBytes(24).toString('base64url')+'Az1!'})),steps:{},cleanup:{},objects:[]};
}
export function assertUIManifest(m) {
 assert.equal(m.kind,'campuslink-ui-qa-v1');assert.match(m.runId,uuid);assert.match(m.prefix,/^QAUI \d{14} \d+$/);
 for(const id of [m.institution,m.campus,m.career,m.subject])assert.match(id,uuid);
 assert.equal(m.users.length,4);assert.deepEqual(m.users.map(u=>u.actor),uiActors);
 assert.equal(new Set(m.users.map(u=>u.id)).size,4);
 for(const u of m.users){assert.match(u.id,uuid);assert.equal(u.email,`${u.actor}.${m.runId}@campuslink.invalid`);assert.equal(u.name,m.prefix+' '+u.actor);}
}
export function assertUIResources(m,rows) {
 assertUIManifest(m);
 for(const row of rows){assert.equal(row.campus_id,m.campus,'Publicación de otro campus: detener limpieza');assert.ok(m.users.some(u=>u.id===row.propietario_id),'Propietario ajeno: detener limpieza');assert.ok(row.titulo.startsWith(m.prefix+' '),'Título ajeno: detener limpieza');}
}
export function assertUIStorage(m,objects) {
 assertUIManifest(m);
 for(const object of objects){const [campus,owner,publication]=object.storage_path.split('/');assert.equal(campus,m.campus);assert.ok(m.users.some(u=>u.id===owner));assert.match(publication,publicationUuid);assert.ok(['publication-images','digital-resources'].includes(object.bucket_id));}
}
