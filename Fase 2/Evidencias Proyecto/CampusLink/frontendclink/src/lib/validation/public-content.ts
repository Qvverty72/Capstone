export const PUBLIC_CONTENT_HINT = 'Solo letras del español, números y espacios. Sin símbolos, emojis, insultos ni groserías.';

/** Validate the original draft; removing symbols could disguise a blocked expression. */
export function publicTextError(value: string, label = 'El texto', multiline = false): string | null {
  const allowed = multiline ? /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 \r\n]*$/u : /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ]*$/u;
  if (allowed.test(value.normalize('NFC'))) return null;
  return `${label} solo admite letras del español, números y espacios${multiline ? ' y saltos de línea' : ''}. Elimina los símbolos, caracteres especiales y emojis para continuar.`;
}

export function publicationTextError(title: string, description: string): string | null {
  return [publicTextError(title, 'El nombre'), publicTextError(description, 'La descripción', true)]
    .filter(Boolean).join('\n') || null;
}
