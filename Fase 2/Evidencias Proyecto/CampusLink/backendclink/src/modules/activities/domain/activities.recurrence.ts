/**
 * Expansión pura de series con Temporal y zona horaria IANA explícita.
 * Calcula días de calendario en vez de sumar milisegundos fijos: las transiciones
 * de horario de verano pueden cambiar la duración real entre dos fechas.
 */
import { Temporal } from '@js-temporal/polyfill';
import { createHash } from 'node:crypto';
import { ApiError } from '../../../shared/errors/api-error.js';
import type { ActivityRecurrencePreview, CreateActivitySeriesInput, ActivityType } from '../types/activities.types.js';

export const RECURRENCE_LIMITS = { occurrences: 200, interval: 52, years: 2 } as const;

/** Calcula fechas de calendario conservando hora de inicio y duración en la zona IANA guardada. */
export function expandActivityRecurrence(input: CreateActivitySeriesInput, campusId: string, type: ActivityType,
  now: Date): ActivityRecurrencePreview {
  const rule = input.recurrence;
  const start = Temporal.Instant.from(input.startAt.toISOString()).toZonedDateTimeISO(rule.timeZone);
  const end = Temporal.Instant.from(input.endAt.toISOString()).toZonedDateTimeISO(rule.timeZone);
  const firstDate = start.toPlainDate(); const until = Temporal.PlainDate.from(rule.until);
  if (Temporal.PlainDate.compare(until, firstDate) < 0) throw new ApiError(400, 'VALIDATION_ERROR', 'La fecha de «¿Hasta cuándo?» es anterior al inicio de la serie. Elige el mismo día de inicio o una fecha posterior.');
  if (Temporal.PlainDate.compare(until, firstDate.add({ years: RECURRENCE_LIMITS.years })) > 0) throw new ApiError(400, 'VALIDATION_ERROR', 'La repetición supera el máximo de dos años desde el inicio de la serie. Acerca la fecha de «¿Hasta cuándo?» al inicio.');
  const daySpan = firstDate.until(end.toPlainDate()).days;
  const occurrences: ActivityRecurrencePreview['occurrences'] = []; const skipped: ActivityRecurrencePreview['skipped'] = [];
  const exclusions = new Set(rule.excludedDates); const candidateDates = new Set<string>();
/**
 * La política reject evita elegir silenciosamente una hora duplicada o inexistente.
 * El usuario debe corregir el horario o excluir la fecha que entra en conflicto.
 */
  const inZone = (date: Temporal.PlainDate, clock: Temporal.PlainTime) => date.toPlainDateTime(clock)
    .toZonedDateTime(rule.timeZone, { disambiguation: 'reject' });
  for (let period = 0; period <= 732; period++) {
    let date: Temporal.PlainDate;
    if (rule.frequency === 'WEEKLY' && rule.weekdays) {
      // Recorre desde la fecha inicial; el intervalo cuenta semanas ISO ancladas en su lunes.
      date = firstDate.add({ days: period });
      if (Temporal.PlainDate.compare(date, until) > 0) break;
      const week = Math.floor((period + firstDate.dayOfWeek - 1) / 7);
      if (week % rule.interval !== 0 || !rule.weekdays.includes(date.dayOfWeek)) continue;
    } else if (rule.frequency === 'MONTHLY') {
      const month = firstDate.toPlainYearMonth().add({ months: period * rule.interval });
      const requested = `${month.toString()}-${String(firstDate.day).padStart(2, '0')}`;
      const comparison = Temporal.PlainYearMonth.compare(month, until.toPlainYearMonth());
      if (comparison > 0 || (comparison === 0 && firstDate.day > until.day)) break;
      if (firstDate.day > month.daysInMonth) { skipped.push({ date: requested, reason: 'INVALID_MONTH_DAY' }); continue; }
      date = month.toPlainDate({ day: firstDate.day });
    } else {
      date = firstDate.add(rule.frequency === 'DAILY' ? { days: period * rule.interval } : { weeks: period * rule.interval });
      if (Temporal.PlainDate.compare(date, until) > 0) break;
    }
    candidateDates.add(date.toString());
    if (exclusions.has(date.toString())) { skipped.push({ date: date.toString(), reason: 'EXCLUDED' }); continue; }
    let occurrenceStart: Temporal.ZonedDateTime; let occurrenceEnd: Temporal.ZonedDateTime;
    try {
      occurrenceStart = inZone(date, start.toPlainTime()); occurrenceEnd = inZone(date.add({ days: daySpan }), end.toPlainTime());
    } catch {
      throw new ApiError(400, 'VALIDATION_ERROR', `La hora del ${date.toString()} no existe o es ambigua en ${rule.timeZone}. Cambia la hora o excluye esa fecha.`);
    }
    if (occurrenceEnd.epochMilliseconds <= occurrenceStart.epochMilliseconds) throw new ApiError(400, 'VALIDATION_ERROR', `La actividad del ${date.toString()} termina antes de su inicio o a la misma hora. Cambia la fecha u hora de término de la actividad base.`);
    if (occurrenceEnd.epochMilliseconds <= now.getTime()) throw new ApiError(400, 'VALIDATION_ERROR', `La actividad del ${date.toString()} ya terminó. Cambia el inicio de la serie para que sus actividades aún estén vigentes al publicarlas.`);
    occurrences.push({ index: occurrences.length + 1, startAt: new Date(occurrenceStart.epochMilliseconds).toISOString(),
      endAt: new Date(occurrenceEnd.epochMilliseconds).toISOString() });
    if (occurrences.length > RECURRENCE_LIMITS.occurrences) throw new ApiError(400, 'VALIDATION_ERROR', 'La serie admite hasta 200 ocurrencias. Reduce la vigencia o aumenta el intervalo.');
  }
  if (!occurrences.length) throw new ApiError(400, 'VALIDATION_ERROR', 'La repetición no genera ninguna actividad. Amplía la fecha de «¿Hasta cuándo?», revisa los días seleccionados o quita alguna fecha a omitir.');
  if (rule.excludedDates.some(date => !candidateDates.has(date))) throw new ApiError(400, 'VALIDATION_ERROR', 'Una fecha a omitir no coincide con los días de la repetición. Elimina esa fecha o ajusta la repetición para que la incluya.');
/**
 * El hash cubre entrada y expansión completa, incluidas exclusiones y omisiones.
 * Permite confirmar que se publica la misma serie que se presentó en la vista previa.
 */
  const fingerprint = { campusId, type, title: input.title, description: input.description, startAt: input.startAt.toISOString(),
    endAt: input.endAt.toISOString(), location: input.location, recurrence: rule, occurrences, skipped };
  return { campusId, type, recurrence: rule, occurrences, skipped,
    previewHash: createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex') };
}
