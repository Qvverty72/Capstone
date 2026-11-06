export const ACTIVITY_CONTENT_LIMITS = { title: 120, description: 2000, customLabel: 160 } as const;

/** Opciones del formulario para cuentas sin capacidad de publicación oficial en el campus. */
export const ACTIVITY_DESCRIPTION_OPTIONS: readonly string[] = [
  'Grupo de estudio', 'Actividad de deporte', 'Taller', 'Charla o conferencia',
  'Actividad cultural', 'Encuentro comunitario', 'Jornada informativa',
];

/** Regla del formulario: conserva el texto original si se perdió la capacidad durante la edición. */
export function isActivityDescriptionAllowed(description: string, allowCustom: boolean, originalDescription?: string): boolean {
  return allowCustom || ACTIVITY_DESCRIPTION_OPTIONS.includes(description) || description === originalDescription;
}

export interface CreateActivityInput {
  title: string; description: string; startAt: string; endAt: string;
  location: { buildingKey: string; floorKey: string; poiKey?: string; customLabel?: string };
}

export interface CommunityActivityCreationAvailability {
  campusId: string; canCreate: boolean; message?: string;
}

/** Catálogo de dominio que entrega el adaptador del mapa, sin meshes ni estado de renderizado. */
export interface ActivityLocationOption {
  id: string; name: string;
  floors: { id: string; name: string; pois: { id: string; name: string }[] }[];
}

export interface ActivityDraft {
  title: string; description: string; startDate: string; startTime: string; endDate: string; endTime: string;
  buildingKey: string; floorKey: string; poiKey: string; customLabel: string;
}

/** Interpreta fecha y hora local; rechaza desbordes de calendario y horas inexistentes por DST. */
export function localActivityTimestamp(dateText: string, timeText: string): string | null {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText.trim());
  const time = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!date || !time) return null;
  const [, day, month, year] = date.map(Number); const [, hour, minute] = time.map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const result = new Date(year, month - 1, day, hour, minute);
  if (result.getFullYear() !== year || result.getMonth() !== month - 1 || result.getDate() !== day
    || result.getHours() !== hour || result.getMinutes() !== minute) return null;
  return result.toISOString();
}

/** Explica qué parte del horario local debe corregirse sin normalizar fechas inexistentes. */
function dateTimeError(dateText: string, timeText: string, endpoint: 'inicio' | 'término'): string | null {
  if (!dateText.trim()) return `Falta la fecha de ${endpoint}. Selecciónala en el calendario.`;
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText.trim());
  if (!parts) return `La fecha de ${endpoint} debe tener el formato DD/MM/AAAA, por ejemplo, 15/11/2026. Vuelve a seleccionarla en el calendario.`;
  const [, day, month, year] = parts.map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (year < 1000 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    return `La fecha de ${endpoint} no existe en el calendario. Revisa el día, el mes y el año y selecciona una fecha válida.`;
  }
  if (!timeText.trim()) return `Falta la hora de ${endpoint}. Selecciónala en el selector de hora.`;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeText.trim())) {
    return `La hora de ${endpoint} no es válida. Usa el formato de 24 horas, entre 00:00 y 23:59; por ejemplo, 14:30.`;
  }
  if (!localActivityTimestamp(dateText, timeText)) {
    return `La hora de ${endpoint} no existe en esa fecha por un cambio de horario de tu zona. Selecciona otra hora.`;
  }
  return null;
}

/** Valida contenido, horario y claves espaciales antes de construir el contrato de creación. */
export function validateActivityDraft(draft: ActivityDraft, locations: ActivityLocationOption[], now = Date.now(),
  options: { allowEnded?: boolean; timestamps?: { startAt: string | null; endAt: string | null } } = {}):
  { input: CreateActivityInput; error?: never } | { error: string; input?: never } {
  for (const field of ['title', 'description'] as const) {
    const label = field === 'title' ? 'El nombre' : 'La descripción';
    const controls = field === 'description' ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/ : /[\u0000-\u001F\u007F]/;
    if (!draft[field].trim()) {
      return { error: `${label} de la actividad está ${field === 'title' ? 'vacío' : 'vacía'}. Escribe ${field === 'title' ? 'un nombre' : 'una descripción'}; no basta con ingresar espacios.` };
    }
    if (draft[field].length > ACTIVITY_CONTENT_LIMITS[field]) {
      return { error: `${label} tiene ${draft[field].length} caracteres y el máximo es ${ACTIVITY_CONTENT_LIMITS[field]}. Acorta el texto para continuar.` };
    }
    if (controls.test(draft[field])) {
      return { error: field === 'title' && /[\r\n\t]/.test(draft[field])
        ? 'El nombre debe estar en una sola línea. Elimina los saltos de línea y las tabulaciones.'
        : `${label} contiene caracteres invisibles no admitidos. Elimínalos o vuelve a escribir el texto.` };
    }
  }
  if (draft.customLabel.length > ACTIVITY_CONTENT_LIMITS.customLabel) {
    return { error: `La referencia del lugar tiene ${draft.customLabel.length} caracteres y el máximo es ${ACTIVITY_CONTENT_LIMITS.customLabel}. Acorta el texto o deja este campo opcional vacío.` };
  }
  if (/[\u0000-\u001F\u007F]/.test(draft.customLabel)) {
    return { error: 'La referencia del lugar debe estar en una sola línea y sin caracteres invisibles. Elimina los saltos de línea, las tabulaciones y los caracteres no admitidos.' };
  }
  for (const [date, time, endpoint] of [[draft.startDate, draft.startTime, 'inicio'], [draft.endDate, draft.endTime, 'término']] as const) {
    const error = dateTimeError(date, time, endpoint);
    if (error) return { error };
  }
  const startAt = options.timestamps ? options.timestamps.startAt : localActivityTimestamp(draft.startDate, draft.startTime);
  const endAt = options.timestamps ? options.timestamps.endAt : localActivityTimestamp(draft.endDate, draft.endTime);
  if (!startAt || !endAt) return { error: 'No se pudo interpretar el horario. Vuelve a seleccionar las fechas y horas de inicio y término.' };
  if (Date.parse(endAt) === Date.parse(startAt)) return { error: 'El inicio y el término tienen la misma fecha y hora. Elige un término posterior al inicio.' };
  if (Date.parse(endAt) < Date.parse(startAt)) return { error: 'La fecha y hora de término son anteriores al inicio. Si la actividad termina al día siguiente, cambia también la fecha de término.' };
  if (!options.allowEnded && Date.parse(endAt) <= now) return { error: 'La actividad ya terminó. Elige una fecha y hora de término posteriores al momento actual; el inicio puede estar en el pasado si la actividad sigue en curso.' };
  if (!draft.buildingKey) return { error: 'Falta el edificio de la actividad. Selecciona un edificio de la lista.' };
  const building = locations.find(value => value.id === draft.buildingKey);
  if (!building) return { error: 'El edificio seleccionado ya no está disponible en este campus. Vuelve al mapa, selecciona un edificio disponible y abre nuevamente el formulario.' };
  if (!draft.floorKey) return { error: 'Falta el piso de la actividad. Selecciona un piso del edificio elegido.' };
  const floor = building?.floors.find(value => value.id === draft.floorKey);
  if (!floor) return { error: 'El piso seleccionado no está disponible en ese edificio. Vuelve al mapa y elige un piso disponible antes de abrir nuevamente el formulario.' };
  if (draft.poiKey && !floor.pois.some(value => value.id === draft.poiKey)) {
    return { error: 'El punto de interés seleccionado no está disponible en ese piso. Elige otro o selecciona «En el piso, sin punto de interés», ya que es opcional.' };
  }
  return { input: { title: draft.title.trim(), description: draft.description.trim(), startAt, endAt,
    location: { buildingKey: draft.buildingKey, floorKey: draft.floorKey,
      ...(draft.poiKey ? { poiKey: draft.poiKey } : {}), ...(draft.customLabel.trim() ? { customLabel: draft.customLabel.trim() } : {}) } } };
}
