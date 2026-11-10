import { accountCapabilities } from '../../../auth/domain/auth.authorization.js';
import { lockPhysicalgoodsPublisher,withPhysicalgoodsTransaction } from '../repositories/physicalgoods.repository.js';
import { findPhysicalgoodsReminderCandidates,insertPhysicalgoodsReminder,lockPhysicalgoodsReminder } from '../repositories/physicalgoods.reminders.repository.js';

const reminderDependencies={transaction:withPhysicalgoodsTransaction,candidates:findPhysicalgoodsReminderCandidates,now:()=>new Date(Date.now())};
/** Una entrega por transacción: comparte locks con edición/retirada/cierre y registra generación sin modificar la publicación. */
export async function dispatchPhysicalgoodsReminders(stopped=()=>false,dependencies=reminderDependencies) {
  let delivered=0,failed=0;
  if(stopped())return {delivered,failed};
  const before=new Date(dependencies.now().getTime()-7*24*60*60*1000);
  const message='Tu publicación lleva al menos siete días abierta. Revisa su estado, confirma el intercambio pendiente o retírala si ya no está disponible.';
  const candidates=await dependencies.transaction(client=>dependencies.candidates(client,before));
  for(const candidate of candidates) {
    if(stopped())break;
    try {
      const inserted=await dependencies.transaction(async client=>{
        const {profile,roles}=await lockPhysicalgoodsPublisher(client,candidate.propietario_id);
        if(!profile||profile.estado_cuenta!=='ACTIVA'||profile.deleted_at)return false;
        const owner={userId:profile.id,campusId:profile.campus_id,profile,roles,permissions:[]};
        if(!accountCapabilities(owner).general)return false;
        const publication=await lockPhysicalgoodsReminder(client,before,candidate.id,profile.id);
        if(!publication||stopped())return false;
        return insertPhysicalgoodsReminder(client,before,publication.id,publication.titulo,message);
      });
      if(inserted)delivered++;
    } catch {failed++;}
  }
  return {delivered,failed};
}
