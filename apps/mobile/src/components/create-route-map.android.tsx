import { Camera, GeoJSONSource, Layer, Map, Marker, NativeUserLocation, type CameraRef } from '@maplibre/maplibre-react-native';
import { useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CreateRouteMapProps } from '@/components/create-route-map';
import { INK, LIME, useColors } from '@/constants/theme';
import { mapStyleFor } from '@/lib/android-map-style';

// Android version of the Create Route map (create-route-map.tsx is the iPhone one).

const zoomFor = (delta: number) => Math.max(1, Math.min(18, Math.log2(360 / delta)));

export function CreateRouteMap({ mapStyle, points, line, onAddPoint, ref }: CreateRouteMapProps) {
  const colors = useColors();
  const cameraRef = useRef<CameraRef>(null);

  useImperativeHandle(ref, () => ({
    goTo: (p, delta) => cameraRef.current?.flyTo({ center: [p.lng, p.lat], zoom: zoomFor(delta), duration: 400 }),
  }));

  const lineData = useMemo<GeoJSON.Feature<GeoJSON.LineString>>(
    () => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.map((c) => [c.lng, c.lat]) } }),
    [line],
  );

  return (
    <Map
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyleFor(mapStyle)}
      compass={false}
      logo={false}
      onPress={(e) => {
        const [lng, lat] = e.nativeEvent.lngLat;
        onAddPoint({ lat, lng });
      }}>
      <Camera ref={cameraRef} />
      <NativeUserLocation />
      {line.length > 1 && (
        <GeoJSONSource id="planned" data={lineData}>
          <Layer type="line" id="planned-casing" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': INK, 'line-width': 8 }} />
          <Layer type="line" id="planned-line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
            paint={{ 'line-color': LIME, 'line-width': 5 }} />
        </GeoJSONSource>
      )}
      {points.map((p, i) => (
        <Marker key={`${i}-${p.lat}-${p.lng}`} id={`point-${i}`} lngLat={[p.lng, p.lat]}>
          <View style={[styles.point, { backgroundColor: i === 0 ? '#22C55E' : colors.card, borderColor: INK }]}>
            <Text style={[styles.pointText, { color: i === 0 ? INK : colors.text }]}>{i + 1}</Text>
          </View>
        </Marker>
      ))}
    </Map>
  );
}

const styles = StyleSheet.create({
  point: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pointText: { fontSize: 11, fontWeight: '700' },
});
