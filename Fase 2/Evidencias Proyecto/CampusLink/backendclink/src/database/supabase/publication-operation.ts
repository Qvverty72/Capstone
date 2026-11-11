import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ApiError } from '../../shared/errors/api-error.js';

export interface PublicationOperation { id: string; hash: string; userId: string; campusId: string; kind: 'FISICO' | 'DIGITAL' }
export function publicationOperation(kind: PublicationOperation['kind'], userId: string, campusId: string,
  key: unknown, input: unknown, bytes: Uint8Array): PublicationOperation | undefined {
  if (key === undefined) return undefined; // Older clients keep their existing contract.
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'La clave de operación debe ser un UUID.');
  }
  const digest = createHash('sha256').update(`CampusLink:publish:${kind}:${userId}:${key.toLowerCase()}`).digest('hex');
  const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  const hash = createHash('sha256').update(JSON.stringify(input)).update(bytes).digest('hex');
  return { id, hash, userId, campusId, kind };
}
export async function previousPublication(client: PoolClient, operation?: PublicationOperation, lock = false): Promise<boolean> {
  if (!operation) return false;
  if (lock) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [operation.id]);
  const row = (await client.query<{ creation_payload_hash: string; propietario_id: string; campus_id: string; tipo_recurso: string }>(
    'SELECT creation_payload_hash,propietario_id,campus_id,tipo_recurso FROM public.publicacion_recurso WHERE id=$1', [operation.id])).rows[0];
  if (!row) return false;
  if (row.creation_payload_hash !== operation.hash || row.propietario_id !== operation.userId || row.campus_id !== operation.campusId || row.tipo_recurso !== operation.kind) {
    throw new ApiError(409, 'CONFLICT', 'La clave de operación ya corresponde a otra publicación.');
  }
  return true;
}
export async function recordPublicationOperation(client: PoolClient, operation?: PublicationOperation) {
  if (operation) await client.query('UPDATE public.publicacion_recurso SET creation_payload_hash=$2 WHERE id=$1', [operation.id, operation.hash]);
}
