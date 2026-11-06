import { APP_COLORS } from '@/types/colors';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AuthApiError } from '@/lib/api/authenticated-request';
import { previewActivityEdit, saveActivityEdit } from '../api/activitiesApi';
import type { ActivityDetail } from '../types/activity';
import { isActivityDescriptionAllowed, type ActivityDraft, type ActivityLocationOption } from '../types/creation';
import { activityEditDraft, validateActivityEditDraft } from '../types/editing';
import { ActivityFields } from './ActivityFields';
import { ActivityBackButton } from './ActivityBackButton';
import { activityFormErrorMessage } from '../api/activityFormErrors';

/** Edita una sola ocurrencia mediante previewHash y revisión para detectar escrituras concurrentes. */
export function EditActivityForm({ activity, locations, onCancel, onSaved }: {
  activity: ActivityDetail; locations: ActivityLocationOption[]; onCancel: () => void; onSaved: (count: number) => void;
}) {
  const { identity, refreshIdentity } = useAuth(); const [draft, setDraft] = useState(() => activityEditDraft(activity));
  const allowCustomDescription = identity?.capabilities.officialActivities === true;
  const canViewOccurrences = identity?.capabilities.officialActivities === true;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const change = (field: keyof ActivityDraft, value: string) => {
    setDraft(current => ({ ...current, [field]: value, ...(field === 'buildingKey' ? { floorKey: '', poiKey: '' } : field === 'floorKey' ? { poiKey: '' } : {}) }));
    setError(null);
  };
  const submit = async () => {
    if (request.current || !identity) return;
    if (!isActivityDescriptionAllowed(draft.description, allowCustomDescription, activity.description)) {
      setError(isActivityDescriptionAllowed(activity.description, false)
        ? 'La descripción no corresponde a una opción disponible. Selecciona una descripción de la lista para continuar.'
        : 'La descripción no corresponde a una opción disponible. Elige una descripción de la lista o selecciona «Conservar descripción actual» para mantener el texto original.'); return;
    }
    const parsed = validateActivityEditDraft(draft, activity, locations);
    if (!parsed.input) { setError(parsed.error); return; }
    const abort = new AbortController(); request.current = abort; setBusy(true); setError(null);
    let saving = false;
    try {
      // Obtiene el token de concurrencia del servidor sin requerir otra acción del usuario.
      const preview = await previewActivityEdit(identity.campusId, activity.id, parsed.input, abort.signal);
      if (abort.signal.aborted) return;
      saving = true;
      const result = await saveActivityEdit(identity.campusId, activity.id, { ...parsed.input, previewHash: preview.previewHash }, abort.signal);
      if (!abort.signal.aborted) onSaved(result.updatedCount);
    } catch (reason) {
      if (abort.signal.aborted) return;
      setError(reason instanceof AuthApiError && reason.status === 409
        ? activityFormErrorMessage(reason, 'La actividad cambió mientras la editabas. Vuelve a la ficha y abre la edición nuevamente para revisar su estado actual.')
        : reason instanceof AuthApiError && reason.status === 400 ? activityFormErrorMessage(reason, 'No se pudieron validar los cambios. Revisa que el término sea posterior al inicio y que la ubicación siga disponible en el mapa.')
        : reason instanceof AuthApiError && reason.status === 401 ? 'Tu sesión venció. Vuelve a iniciar sesión antes de guardar los cambios.'
        : reason instanceof AuthApiError && reason.status === 403 ? 'Solo puedes editar actividades creadas por tu cuenta y en tu campus actual. Revisa la cuenta y el campus seleccionados.'
        : reason instanceof AuthApiError && reason.status === 404 ? 'La publicación ya no está disponible para editar. Vuelve al listado y actualízalo para comprobar su estado.'
        : reason instanceof AuthApiError && reason.status === 429 ? 'Has intentado guardar demasiadas veces en poco tiempo. Espera un momento antes de reintentar.'
        : saving ? 'No se pudo confirmar la edición. Actualiza la ficha antes de reintentar para comprobar si se guardaron tus cambios.' : 'No se pudieron revisar los cambios. Comprueba tu conexión e intenta guardar nuevamente.');
      if (reason instanceof AuthApiError && [401, 403].includes(reason.status)) refreshIdentity();
    } finally { if (!abort.signal.aborted) setBusy(false); if (request.current === abort) request.current = null; }
  };
  return <View style={styles.form}>
    <ActivityBackButton label="Volver a la ficha" onBack={onCancel} disabled={busy}/>
    <Text accessibilityRole="header" style={styles.heading}>Editar {canViewOccurrences && activity.series ? 'ocurrencia' : 'actividad'}</Text>
    <Text style={styles.text}>Conserva sus inscripciones y su tipo {activity.type === 'OFFICIAL_EVENT' ? 'oficial' : 'comunitario'}. Los cambios quedan en su historial.</Text>
    <ActivityFields draft={draft} change={change} disabled={busy} locations={locations} organizer={activity.organizer?.name} locationDropdowns
      existingContent={{ description: activity.description, customLabel: activity.location.customLabel ?? '' }}
      allowCustomDescription={allowCustomDescription} />
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <Pressable disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }}
      onPress={() => { void submit(); }} style={[styles.save, busy && styles.disabled]}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Guardar cambios</Text>}
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({ form: { gap: 12, paddingVertical: 12 }, heading: { fontWeight: '700', fontSize: 18, color: '#0F172A' },
  text: { color: '#475569', lineHeight: 21 }, disabled: { opacity: 0.5 },
  save: { backgroundColor: APP_COLORS.PRIMARY, padding: 14, alignItems: 'center', borderRadius: 8 }, saveText: { color: '#FFFFFF', fontWeight: '700' }, error: { color: '#B91C1C' } });
