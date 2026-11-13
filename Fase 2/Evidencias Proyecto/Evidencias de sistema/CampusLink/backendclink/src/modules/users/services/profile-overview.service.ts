/**
 * Resumen personal a partir de contadores del dominio relacional.
 * Reutiliza la frontera pública del historial físico para revalidar el contexto;
 * este acoplamiento evita duplicar autorización, pero une users al marketplace.
 */
import type { VerifiedAuthConnection } from '../../auth/types/auth.types.js';
import { withPhysicalgoodsHistory } from '../../marketplace/physicalgoods/public.js';
import { queryProfileOverview } from '../repositories/profile-overview.repository.js';


/**
 * Recibe la cuenta autenticada y devuelve la consulta agregada de su institución.
 * Comparte el PoolClient de la lectura autorizada, sin abrir otra transacción.
 */
export function getProfileOverview(auth: VerifiedAuthConnection) {
  // Comparte la revalidación de cuenta, institución, campus y capacidades del historial.
  return withPhysicalgoodsHistory(auth, (client, current) => queryProfileOverview(client, current.userId, current.profile.institucion_id));
}
