import type { RequestParser, ValidationResult, ApiErrorDetail } from '../../../shared/http/api.types.js';
import type { CreateActivityInput } from '../types/activities.types.js';

export const ACTIVITY_CONTENT_LIMITS = { title: 120, description: 2000, customLabel: 160 } as const;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Solo acepta fechas ISO UTC; rechaza la normalización automática de fechas de calendario inexistentes. */
function timestamp(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value.replace(/Z$/, value.includes('.') ? 'Z' : '.000Z') ? date : null;
}

export const parseCreateActivity: RequestParser = (input: unknown): ValidationResult<CreateActivityInput> => {
  const issues: ApiErrorDetail[] = [];
  if (!record(input)) return { success: false, issues: [{ field: 'body', message: 'No se recibieron los datos de la actividad. Completa el formulario e intenta enviarlo nuevamente.' }] };
  const allowed = ['title', 'description', 'startAt', 'endAt', 'location'];
  for (const key of Object.keys(input)) if (!allowed.includes(key)) issues.push({ field: key, message: 'La solicitud contiene un campo de actividad no permitido. Publica desde el formulario sin agregar campos adicionales.' });
  const text = (value: unknown, field: keyof typeof ACTIVITY_CONTENT_LIMITS, optional = false): string => {
    if (optional && value === undefined) return '';
    const result = typeof value === 'string' ? value.trim() : '';
    const label = field === 'title' ? 'El nombre' : field === 'description' ? 'La descripción' : 'La referencia del lugar';
    const path = field === 'customLabel' ? 'location.customLabel' : field;
    const controls = field === 'description' ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/ : /[\u0000-\u001F\u007F]/;
    if (typeof value !== 'string') issues.push({ field: path, message: `${label} debe ser un texto. Completa ese campo del formulario.` });
    else if (!result) issues.push({ field: path, message: `${label} no puede quedar en blanco ni contener solo espacios.${optional ? ' Escribe una referencia o deja de enviar este campo opcional.' : ' Completa ese campo antes de continuar.'}` });
    else if (value.length > ACTIVITY_CONTENT_LIMITS[field]) issues.push({ field: path, message: `${label} tiene ${value.length} caracteres y el máximo es ${ACTIVITY_CONTENT_LIMITS[field]}. Acorta el texto para continuar.` });
    else if (controls.test(value)) issues.push({ field: path, message: field !== 'description' && /[\r\n\t]/.test(value)
      ? `${label} debe estar en una sola línea. Elimina los saltos de línea y las tabulaciones.`
      : `${label} contiene caracteres invisibles no admitidos. Elimínalos o vuelve a escribir el texto.` });
    return result;
  };
  const title = text(input.title, 'title'); const description = text(input.description, 'description');
  const startAt = timestamp(input.startAt); const endAt = timestamp(input.endAt);
  if (!startAt) issues.push({ field: 'startAt', message: 'La fecha u hora de inicio falta o no es válida. Vuelve a seleccionar ambas en el formulario.' });
  if (!endAt) issues.push({ field: 'endAt', message: 'La fecha u hora de término falta o no es válida. Vuelve a seleccionar ambas en el formulario.' });
  if (startAt && endAt && endAt <= startAt) issues.push({ field: 'endAt', message: 'La fecha y hora de término deben ser posteriores al inicio. Si termina al día siguiente, cambia también la fecha de término.' });
  const location = record(input.location) ? input.location : {};
  if (!record(input.location)) issues.push({ field: 'location', message: 'Falta una ubicación válida. Selecciona un edificio y un piso de tu campus en el mapa.' });
  for (const key of Object.keys(location)) if (!['buildingKey', 'floorKey', 'poiKey', 'customLabel'].includes(key)) {
    issues.push({ field: `location.${key}`, message: 'La ubicación contiene un campo no permitido. Vuelve a seleccionarla desde el mapa.' });
  }
  for (const key of ['buildingKey', 'floorKey', 'poiKey'] as const) {
    if (key === 'poiKey' && location[key] === undefined) continue;
    if (typeof location[key] !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(location[key] as string)) {
      issues.push({ field: `location.${key}`, message: key === 'buildingKey'
        ? 'Falta un edificio válido. Selecciona un edificio disponible de tu campus en el mapa.'
        : key === 'floorKey' ? 'Falta un piso válido. Selecciona un piso del edificio elegido.'
          : 'El punto de interés no es válido. Selecciona uno del piso elegido o deja este dato opcional sin seleccionar.' });
    }
  }
  const customLabel = text(location.customLabel, 'customLabel', true);
  return issues.length ? { success: false, issues } : { success: true, data: {
    title, description, startAt: startAt!, endAt: endAt!, location: {
      buildingKey: location.buildingKey as string, floorKey: location.floorKey as string,
      ...(location.poiKey !== undefined ? { poiKey: location.poiKey as string } : {}),
      ...(customLabel ? { customLabel } : {}),
    },
  } };
};
