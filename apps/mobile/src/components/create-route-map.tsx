import type { LatLng } from '@repo/shared';
import { useImperativeHandle, useRef, type Ref } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type MapPressEvent } from 'react-native-maps';

import { INK, LIME, useColors } from '@/constants/theme';
import type { MapStyle } from '@/lib/map-prefs';

// The map on Create Route: tap to add numbered points, with the planned line drawn
// between them. iPhone version (Apple Maps); create-route-map.android.tsx is the Android one.

export interface CreateRouteMapHandle {
  goTo(p: LatLng, delta: number): void;
}

export interface CreateRouteMapProps {
  mapStyle: MapStyle;
  points: LatLng[];
  line: LatLng[];
  onAddPoint: (p: LatLng) => void;
  ref?: Ref<CreateRouteMapHandle>;
}

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

export function CreateRouteMap({ mapStyle, points, line, onAddPoint, ref }: CreateRouteMapProps) {
  const colors = useColors();
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    goTo: (p, delta) =>
      mapRef.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: delta, longitudeDelta: delta }, 400),
  }));

  const addPoint = (e: MapPressEvent) => {
    const c = e.nativeEvent.coordinate;
    onAddPoint({ lat: c.latitude, lng: c.longitude });
  };

  return (
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} mapType={mapStyle} showsUserLocation onPress={addPoint}>
      {line.length > 1 && <Polyline coordinates={line.map(toCoord)} strokeColor={INK} strokeWidth={8} />}
      {line.length > 1 && <Polyline coordinates={line.map(toCoord)} strokeColor={LIME} strokeWidth={5} />}
      {points.map((p, i) => (
        <Marker key={`${i}-${p.lat}-${p.lng}`} coordinate={toCoord(p)} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.point, { backgroundColor: i === 0 ? '#22C55E' : colors.card, borderColor: INK }]}>
            <Text style={[styles.pointText, { color: i === 0 ? INK : colors.text }]}>{i + 1}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  point: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pointText: { fontSize: 11, fontWeight: '700' },
});
