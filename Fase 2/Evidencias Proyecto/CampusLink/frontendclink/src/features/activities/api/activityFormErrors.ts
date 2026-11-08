import type { AuthApiError } from '@/lib/api/authenticated-request';

/** Prioriza causas por campo y evita mostrar la cabecera genérica del middleware. */
export function activityFormErrorMessage(error: AuthApiError, fallback: string): string {
  const messages = [...new Set((error.details ?? []).map(detail => detail.message))];
  if (messages.length) return messages.join('\n');
  return error.serverMessage && error.serverMessage !== 'Request validation failed.' ? error.serverMessage : fallback;
}
