import { useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { INK, LIME } from '@/constants/theme';

interface Props {
  coords: { lat: number; lng: number }[];
  // When true, the map follows the last point (used while recording).
  follow?: boolean;
  style?: StyleProp<ViewStyle>;
}

// Draws a route as a lime line on Apple Maps, with start and end markers.
export function RouteMap({ coords, follow = false, style }: Props) {
  const mapRef = useRef<MapView>(null);
  const line = coords.map((c) => ({ latitude: c.lat, longitude: c.lng }));
  const first = line[0];
  const last = line[line.length - 1];

  const fit = () => {
    if (follow || line.length < 2) return;
    mapRef.current?.fitToCoordinates(line, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: false,
    });
  };

  return (
    <MapView
      ref={mapRef}
      style={[styles.map, style]}
      showsUserLocation={follow}
      followsUserLocation={follow}
      onMapReady={fit}
      initialRegion={
        first ? { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 } : undefined
      }>
      {/* A dark outline under the lime line keeps the route visible on light maps. */}
      {line.length > 1 && <Polyline coordinates={line} strokeColor={INK} strokeWidth={7} />}
      {line.length > 1 && <Polyline coordinates={line} strokeColor={LIME} strokeWidth={4} />}
      {!follow && first && <Marker coordinate={first} pinColor="green" title="Start" />}
      {!follow && last && line.length > 1 && <Marker coordinate={last} pinColor="red" title="Finish" />}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 260 },
});
