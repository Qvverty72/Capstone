import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newUIManifest,assertUIManifest,assertUIResources,assertUIStorage} from '../ui-data.mjs';
test('manifiesto UI exige identidades QA únicas y nombres del mismo recorrido',()=>{
 const m=newUIManifest(randomUUID(),'http://127.0.0.1:3011');assertUIManifest(m);
 const foreign=structuredClone(m);foreign.users[0].email='personal@example.com';assert.throws(()=>assertUIManifest(foreign));
 const duplicate=structuredClone(m);duplicate.users[1].id=duplicate.users[0].id;assert.throws(()=>assertUIManifest(duplicate));
});
test('limpieza UI se detiene ante otro campus, propietario o título',()=>{
 const m=newUIManifest(randomUUID(),'https://example.onrender.com');const row={campus_id:m.campus,propietario_id:m.users[0].id,titulo:m.prefix+' recurso'};
 assertUIResources(m,[row]);
 for(const changed of [{campus_id:randomUUID()},{propietario_id:randomUUID()},{titulo:'Recurso ajeno'}])assert.throws(()=>assertUIResources(m,[{...row,...changed}]));
});
test('Storage se limpia solo en buckets y namespace exactos del recorrido',()=>{
 const m=newUIManifest(randomUUID(),'http://localhost:3011'),publication=randomUUID();
 const object={bucket_id:'publication-images',storage_path:`${m.campus}/${m.users[0].id}/${publication}/imagen.png`};assertUIStorage(m,[object]);
 const deterministic=publication.slice(0,14)+'5'+publication.slice(15);
 assertUIStorage(m,[{...object,storage_path:`${m.campus}/${m.users[0].id}/${deterministic}/imagen.png`}]);
 assert.throws(()=>assertUIStorage(m,[{...object,bucket_id:'private-personal'}]));
 assert.throws(()=>assertUIStorage(m,[{...object,storage_path:`${randomUUID()}/${m.users[0].id}/${publication}/imagen.png`}]));
 assert.throws(()=>assertUIStorage(m,[{...object,storage_path:`${m.campus}/${randomUUID()}/${publication}/imagen.png`}]));
});
