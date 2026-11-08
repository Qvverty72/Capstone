/**
 * Reglas de autorización reutilizables sin consultas ni dependencias de Express.
 * El llamante aporta un contexto vigente y el campus obtenido de datos confiables.
 * Ser propietario y administrar un campus son comprobaciones distintas.
 */
import { ApiError } from '../../../shared/errors/api-error.js';
import type { AuthProfile, VerifiedAuthConnection } from '../types/auth.types.js';

/** Exige que el perfil pertenezca al usuario y esté ACTIVA, sin marca de eliminación. */
export function requireActiveAccount(profile: Pick<AuthProfile, 'id'> & { estado_cuenta: string; deleted_at: unknown }, userId: string) {
  if (profile.id !== userId || profile.deleted_at) {
    throw new ApiError(403, 'FORBIDDEN', 'An active account profile is required');
  }
  if (profile.estado_cuenta === 'SUSPENDIDA') {
    throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida. Contacta a la administración de tu campus.');
  }
  if (profile.estado_cuenta === 'DESACTIVADA') {
    throw new ApiError(403, 'ACCOUNT_DEACTIVATED', 'Tu cuenta está desactivada. Contacta a la administración de tu campus.');
  }
  if (profile.estado_cuenta !== 'ACTIVA') {
    throw new ApiError(403, 'FORBIDDEN', 'An active account profile is required');
  }
}

/** Calcula las capacidades que `/me` y los módulos comparten para el campus consultado. */
export function accountCapabilities(context: VerifiedAuthConnection, campusId = context.campusId) {
  const localRoles = context.roles.filter(role => role.campusId === campusId);
  const admin = localRoles.some(role => role.name === 'ADMINISTRADOR');
  const authorized = localRoles.some(role => role.name === 'USUARIO_AUTORIZADO');
  /**
   * Un administrador obtiene la capacidad en su campus. El usuario autorizado
   * necesita además el permiso correspondiente; los permisos aislados no bastan.
   */
  const has = (name: string) => admin || (authorized && context.permissions.some(permission =>
    permission.campusId === campusId && permission.name === name));
  return {
    general: admin || authorized || (campusId === context.campusId && Boolean(context.profile.verificado_en)),
    officialActivities: has('PUBLICAR_EVENTO'),
    analytics: has('ACCEDER_ANALITICA'),
    reports: has('ACCEDER_REPORTERIA'),
  };
}

export type CampusCapability = keyof ReturnType<typeof accountCapabilities> | 'administration';

/**
 * Exige una capacidad para un campus concreto después de verificar la identidad.
 * El campus debe venir del recurso persistido o de contexto validado por el servidor.
 */
export function requireCampusCapability(context: VerifiedAuthConnection, campusId: string, capability: CampusCapability) {
  requireActiveAccount(context.profile, context.userId);
  const allowed = capability === 'administration'
    ? context.roles.some(role => role.campusId === campusId && role.name === 'ADMINISTRADOR')
    : accountCapabilities(context, campusId)[capability] === true;
  if (!allowed) throw new ApiError(403, 'FORBIDDEN', 'No tienes autorización para esta operación en este campus.');
}

/**
 * Verifica cuenta activa y coincidencia exacta con el propietario persistido.
 * Parámetro: context Contexto de identidad y perfil validado por el servidor.
 * Parámetro: ownerId Dueño obtenido del recurso, no del usuario que solicita la operación.
 * Devuelve: Sin valor si se permite; lanza 403 ante una cuenta o propietario inválidos.
 */
export function requireResourceOwner(context: VerifiedAuthConnection, ownerId: string) {
  requireActiveAccount(context.profile, context.userId);
  // La propiedad se comprueba aparte; cada operación debe declarar expresamente
  // cualquier excepción administrativa, pues aquí no se concede una implícita.
  if (ownerId !== context.userId) throw new ApiError(403, 'FORBIDDEN', 'Solo el propietario puede realizar esta operación.');
}
