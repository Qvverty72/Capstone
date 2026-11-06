/** Actualizar la versión en Express y conservar el texto anterior al cambiar estas normas. */
export const CONTENT_POLICY_VERSION = '2026-11-06';

export const CONTENT_POLICY_ACCEPTANCE = 'He leído y acepto estas normas y mi responsabilidad por el contenido que publique.';

export const CONTENT_POLICY_SECTIONS = [
  { title: 'Tu contenido es tu responsabilidad', text: 'El contenido que publiques, compartas, vendas o dones es de tu exclusiva responsabilidad. Respondes por su legalidad y por contar con los derechos o permisos necesarios.' },
  { title: 'Respeta los derechos de autor', text: 'Publica solo material propio, con licencia, autorización del titular o permitido por la ley. Está prohibido compartir o vender copias no autorizadas de libros, apuntes, imágenes, software u otras obras protegidas.' },
  { title: 'Responsabilidad de CampusLink', text: 'CampusLink no asume responsabilidad por el contenido publicado por sus usuarios ni por el uso indebido de la plataforma.' },
  { title: 'Incumplimiento y sanciones', text: 'Debes respetar la ley, la privacidad y las normas de convivencia: no publiques contenido ofensivo, discriminatorio o que vulnere derechos de terceros. Las infracciones pueden dar lugar al retiro de publicaciones y la suspensión de la cuenta, previa revisión por la administración.' },
] as const;
