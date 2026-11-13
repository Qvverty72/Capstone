import {createHash} from 'node:crypto';

export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function validateAllowlist(list,protectedUsers,campusId) {
  const seen=new Set();
  for(const kind of ['publications','activities']) {
    if(!Array.isArray(list[kind])||list[kind].length>30)throw new Error('Allowlist inválida o demasiado amplia');
    for(const item of list[kind]) {
      const validId=kind==='publications'?/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i:/^[a-f0-9]{24}$/i;
      if(!validId.test(item.id)||seen.has(item.id)||!item.ownerId||item.campusId!==campusId||!item.expectedTitle?.trim()
        ||item.confirmedTestData!==true||!item.reason?.trim()||protectedUsers.includes(item.ownerId))
        throw new Error('Registro sin confirmación, duplicado, ajeno al campus o protegido por QA');
      seen.add(item.id);
    }
  }
}
export function requireApproval(plan,approval,backup) {
  if(approval!==digest(plan)||backup?.planHash!==approval||digest(backup.plan)!==approval)
    throw new Error('Se requiere el SHA-256 del plan revisado y su respaldo exacto');
}
