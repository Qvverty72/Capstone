/**
 * Variante nativa del viewport: compone escena 3D y controles 2D React Native.
 * Comparte props de actividades con la variante web; la comprobación de WebGL2 del
 * DOM solo existe en el archivo .web.tsx.
 */
import { StyleSheet, View } from 'react-native';
import { BuildingCloseButton } from '@/three/components/BuildingCloseButton';
import { CampusMap } from '@/three/components/CampusMap';
import type { ActivitiesState } from '@/features/activities/hooks/useLocationActivities';
import { MapActivitiesPanel } from '@/features/activities/components/MapActivitiesPanel';

/**
 * Superpone controles React Native sobre el Canvas sin introducirlos en la escena.
 * El botón puede responder como UI 2D mientras `CampusMap` conserva todo el espacio 3D.
 */
export function CampusMapViewport({ activities }: { activities: ActivitiesState }) {
  return (
    <View style={styles.container}>
      <CampusMap />
      <BuildingCloseButton />
      <MapActivitiesPanel state={activities} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
});
