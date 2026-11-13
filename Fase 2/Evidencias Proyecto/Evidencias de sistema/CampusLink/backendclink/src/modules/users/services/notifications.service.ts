/**
 * Caso de uso de la bandeja propia: listado, contador, lectura, retiro y detalle
 * de cambios de actividad. El repositorio siempre recibe usuario y campus;
 * conocer un ID de notificación ajena no habilita acceso.
 */
import type { PoolClient } from 'pg';
import type { VerifiedAuthConnection } from '../../auth/types/auth.types.js';
import { requireCampusCapability } from '../../auth/domain/auth.authorization.js';
import { withPostgresTransaction } from '../../../database/supabase/postgres.js';
import { ApiError } from '../../../shared/errors/api-error.js';
import { countOwnUnreadNotifications, findOwnActivityChange, listOwnNotifications, updateOwnNotification, lockOwnNotificationAccount } from '../repositories/notifications.repository.js';
import { getNotificationActivityChange } from './notifications.activity-change.js';
import type { ActivityDependencies } from '../../activities/public.js';

/**
 * Revalida la cuenta dentro de SQL antes de seleccionar una operación.
 * Los flags del input determinan si cuenta, lista, consulta referencia o actualiza.
 * Parámetro: auth Contexto autenticado del propietario de la bandeja.
 * Parámetro: transaction Frontera sustituible por pruebas; por defecto usa pg.
 * Devuelve: DTO de la operación; 404 oculta notificaciones fuera del alcance propio.
 */
export async function ownNotificationOperation(auth: VerifiedAuthConnection,
  input: { cursor?: string; id?: string; remove?: boolean; countOnly?: boolean; activityChange?: boolean },
  transaction = withPostgresTransaction, activityDependencies: ActivityDependencies = {}) {
  // Revalida cuenta y campus dentro de la transacción para cubrir revocaciones posteriores al middleware.
  requireCampusCapability(auth, auth.campusId, 'general');
  return transaction(async (client: PoolClient) => {
    if (!await lockOwnNotificationAccount(client, auth.userId, auth.campusId)) throw new ApiError(403, 'FORBIDDEN', 'Tu cuenta o campus cambió. Actualiza la sesión.');
    if (input.countOnly) return { unreadCount: await countOwnUnreadNotifications(client, auth.userId, auth.campusId) };
    if (!input.id) return listOwnNotifications(client, auth.userId, auth.campusId, input.cursor);
    if (input.activityChange) {
      const reference = await findOwnActivityChange(client, auth.userId, auth.campusId, input.id);
      if (!reference) throw new ApiError(404, 'NOT_FOUND', 'Notificación no disponible.');
      return getNotificationActivityChange(auth, input.id, reference, activityDependencies);
    }
    if (!await updateOwnNotification(client, auth.userId, auth.campusId, input.id, !!input.remove)) {
      throw new ApiError(404, 'NOT_FOUND', 'Notificación no disponible.');
    }
    return { id: input.id };
  });
}
