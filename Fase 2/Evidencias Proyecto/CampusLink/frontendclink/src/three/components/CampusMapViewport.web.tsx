/**
 * Variante web seleccionada por la resolución de plataforma de Metro.
 * Comprueba WebGL2 antes de montar la escena y aísla errores de render con un boundary;
 * el reintento cambia la key para crear una instancia nueva del árbol 3D.
 */
import { Component, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BuildingCloseButton } from './BuildingCloseButton';
import { CampusMap } from './CampusMap';
import type { ActivitiesState } from '@/features/activities/hooks/useLocationActivities';
import { MapActivitiesPanel } from '@/features/activities/components/MapActivitiesPanel';

function MapUnavailable({ retry }: { retry: () => void }) {
  return <View style={styles.notice}>
    <Text accessibilityRole="alert" style={styles.title}>El mapa 3D no está disponible en este navegador.</Text>
    <Text style={styles.description}>Puedes seguir usando las demás secciones de CampusLink. Prueba actualizar el navegador y vuelve a intentarlo.</Text>
    <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.retryLabel}>Reintentar mapa</Text></Pressable>
  </View>;
}

/**
 * Captura errores de render del subárbol del mapa y muestra su alternativa.
 * No captura rechazos async del transporte: los hooks/store presentan esos errores.
 */
class MapBoundary extends Component<{ children: ReactNode; retry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <MapUnavailable retry={this.props.retry} /> : this.props.children; }
}

/** Comprueba WebGL2 y ofrece un reintento del mapa cuando el navegador no puede renderizarlo. */
export function CampusMapViewport({ activities }: { activities: ActivitiesState }) {
  const [revision, setRevision] = useState(0);
  const [support, setSupport] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  useEffect(() => {
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      context?.getExtension('WEBGL_lose_context')?.loseContext();
      setSupport(context ? 'ready' : 'unavailable');
    } catch { setSupport('unavailable'); }
  }, [revision]);
  const retry = () => { setSupport('checking'); setRevision(value => value + 1); };
  return <View style={styles.container}>
    {support === 'checking' ? <View style={styles.notice}><ActivityIndicator accessibilityLabel="Comprobando disponibilidad del mapa" /></View>
      : support === 'unavailable' ? <MapUnavailable retry={retry} />
      : <MapBoundary key={revision} retry={retry}><CampusMap /><BuildingCloseButton /><MapActivitiesPanel state={activities} /></MapBoundary>}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  notice: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16, backgroundColor: '#071A2B' },
  title: { color: '#FFFFFF', fontSize: 18, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  description: { color: '#CBD5E1', maxWidth: 460, lineHeight: 23, textAlign: 'center' },
  retry: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16 },
  retryLabel: { color: '#09243A', fontWeight: '700' },
});
