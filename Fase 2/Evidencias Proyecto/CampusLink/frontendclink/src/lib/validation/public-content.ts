/**
 * Validación de formato para dar feedback en borradores antes de enviarlos.
 * Replica el alfabeto permitido y conserva el texto original; la moderación de
 * vocabulario y la autorización siguen siendo responsabilidad del backend.
 */
export const PUBLIC_CONTENT_HINT = 'Solo letras del español, números y espacios. Sin símbolos, emojis, insultos ni groserías.';

/** Valida el borrador original: eliminar símbolos podría disfrazar una expresión bloqueada. */
export function publicTextError(value: string, label = 'El texto', multiline = false): string | null {
  const allowed = multiline ? /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 \r\n]*$/u : /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]*$/u;
  if (allowed.test(value.normalize('NFC'))) return null;
  return `${label} solo admite letras del español, números y espacios${multiline ? ' y saltos de línea' : ''}. Elimina los símbolos, caracteres especiales y emojis para continuar.`;
}

/**
 * Reúne errores de nombre y descripción en un mensaje o null si el formato se admite.
 * Este resultado no certifica que el servidor vaya a aceptar el contenido.
 */
export function publicationTextError(title: string, description: string): string | null {
  return [publicTextError(title, 'El nombre'), publicTextError(description, 'La descripción', true)]
    .filter(Boolean).join('\n') || null;
}
