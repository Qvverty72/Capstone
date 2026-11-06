import { createInstance, type Category, type DetectionResult, type Severity } from 'verlux';
import { ApiError } from '../errors/api-error.js';
import type { ApiErrorDetail } from '../http/api.types.js';
import { CHILEAN_PHRASES, CHILEAN_VOCABULARY } from './chilean-vocabulary.js';

const moderator = createInstance({ languages: ['es', 'en'], minSeverity: 'low', fuzzyMatch: true,
  fuzzyThreshold: 0.85, phraseDetection: true });
// Agregar el catálogo completo una sola vez: addWords reconstruye el índice de esta instancia.
// No pasar languages por llamada: Verlux reconstruye otro índice que omite las extensiones.
moderator.addWords(CHILEAN_VOCABULARY);
// addPhrases reemplaza las palabras propias en1.0.19. Mantener un índice de frases
// separado con la API pública para conservar ambos catálogos sin tocar la dependencia.
const phraseModerator = createInstance({ languages: ['es'], minSeverity: 'low', fuzzyMatch: false, phraseDetection: true });
phraseModerator.addPhrases(CHILEAN_PHRASES);
const customPhrases = new Set(CHILEAN_PHRASES.map(entry => entry.phrase));

function detectContent(text: string): DetectionResult[] {
  const phrases = phraseModerator.detect(text).filter(match => match.matchType === 'phrase' && customPhrases.has(match.matched));
  const words = moderator.detect(text).filter(match => !phrases.some(phrase =>
    phrase.position[0] <= match.position[0] && phrase.position[1] >= match.position[1]));
  // La frase completa sustituye sus palabras interiores en el mensaje, sin perder
  // otras expresiones del mismo campo. Toda detección sigue bloqueando.
  return [...words, ...phrases].sort((a, b) => a.position[0] - b.position[0]);
}

const categories: Record<Category, string> = { insult: 'insulto', slur: 'insulto discriminatorio', sexual: 'expresión sexual explícita',
  hate: 'lenguaje de odio', threat: 'amenaza', drug: 'referencia a drogas', other: 'expresión inapropiada' };
const severities: Record<Severity, string> = { low: 'baja', medium: 'media', high: 'alta' };
const labels: Record<string, string> = { title: 'El título', description: 'La descripción', 'location.customLabel': 'La referencia del lugar' };
const displayTerm = (value: string) => {
  const plain = value.replace(/[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ');
  return plain.length > 40 ? plain.slice(0, 39) + '…' : plain;
};

/** Rechaza cualquier coincidencia, independientemente de severidad o puntuación global. */
export function assertPublicContent(fields: Readonly<Record<string, string | undefined>>): void {
  const details: ApiErrorDetail[] = [];
  // El transporte admite20detalles de500caracteres. Repartir el espacio entre campos
  // para mostrar todas las expresiones habituales sin ocultar los demás campos.
  const groupsPerField = Math.max(1, Math.floor(20 / Math.max(1, Object.keys(fields).length)));
  for (const [field, text] of Object.entries(fields)) {
    if (!text) continue;
    const unique = new Map<string, DetectionResult>();
    for (const detection of detectContent(text)) {
      const key = `${detection.original.toLocaleLowerCase('es')}:${detection.category}:${detection.severity}`;
      if (!unique.has(key)) unique.set(key, detection);
    }
    const matches = [...unique.values()];
    if (!matches.length) continue;
    for (let offset = 0; offset < matches.length && offset < groupsPerField * 3 && details.length < 20; offset += 3) {
      const shown = matches.slice(offset, offset + 3).map(match => `«${displayTerm(match.original)}» (${categories[match.category]}, severidad ${severities[match.severity]})`);
      const rest = matches.length - offset - shown.length;
      const remaining = offset + 3 >= groupsPerField * 3 && rest > 0 ? ` y ${rest} expresiones más` : '';
      details.push({ field, message: `${labels[field] ?? 'El texto'} contiene lenguaje bloqueado: ${shown.join('; ')}${remaining}. Elimina o reemplaza todas las expresiones bloqueadas y vuelve a intentarlo.` });
    }
  }
  if (details.length) throw new ApiError(400, 'VALIDATION_ERROR',
    'No se puede guardar el contenido porque contiene lenguaje inapropiado. Revisa las expresiones señaladas en cada campo.', { details });
}
