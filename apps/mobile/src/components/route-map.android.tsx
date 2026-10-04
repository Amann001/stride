import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  NativeUserLocation,
  type CameraRef,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import { distanceBetween } from '@repo/shared';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { INK, LIME } from '@/constants/theme';
import { mapStyleFor } from '@/lib/android-map-style';

// Android version of RouteMap (route-map.tsx is the iPhone one, on Apple Maps). Same props,
// drawn with MapLibre on free OpenFreeMap maps, so no Google account or key is needed.

interface Props {
  coords: { lat: number; lng: number }[];
  follow?: boolean;
  preview?: boolean;
  guide?: { lat: number; lng: number }[];
  style?: StyleProp<ViewStyle>;
}

const LOOP_METERS = 40;
const PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

const lineFeature = (points: { lat: number; lng: number }[]): GeoJSON.Feature<GeoJSON.LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
});

// [west, south, east, north] around the points.
function boundsOf(points: { lat: number; lng: number }[]): LngLatBounds {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [w, s, e, n];
}

function Dot({ color }: { color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

export function RouteMap({ coords, follow = false, preview = false, guide, style }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const mapStyle = mapStyleFor('standard');
  const first = coords[0];
  const last = coords[coords.length - 1];
  const isLoop = coords.length > 1 && distanceBetween(coords[0], coords[coords.length - 1]) < LOOP_METERS;
  const framed = coords.length ? coords : follow ? (guide ?? []) : [];
  const route = useMemo(() => (coords.length > 1 ? lineFeature(coords) : null), [coords]);
  const guideLine = useMemo(() => (guide && guide.length > 1 ? lineFeature(guide) : null), [guide]);

  // Recording with nothing drawn yet: jump to where you are.
  const hasStart = framed.length > 0;
  useEffect(() => {
    if (!follow || hasStart) return;
    let cancelled = false;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      const { granted } = perm.granted || !perm.canAskAgain ? perm : await Location.requestForegroundPermissionsAsync();
      if (!granted || cancelled) return;
      const here = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
      if (cancelled || !here) return;
      cameraRef.current?.flyTo({ center: [here.coords.longitude, here.coords.latitude], zoom: 15, duration: 400 });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [follow, hasStart]);

  const initialViewState =
    framed.length > 1
      ? { bounds: boundsOf(framed), padding: PADDING }
      : framed.length === 1
        ? { center: [framed[0].lng, framed[0].lat] as [number, number], zoom: 15 }
        : undefined;

  return (
    <View style={[styles.map, style]} pointerEvents={preview ? 'none' : 'auto'}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        dragPan={!preview}
        touchZoom={!preview}
        doubleTapZoom={!preview}
        touchRotate={!preview}
        touchPitch={!preview}
        compass={false}
        logo={false}>
        <Camera ref={cameraRef} initialViewState={initialViewState} trackUserLocation={follow ? 'default' : undefined} />
        {follow && <NativeUserLocation />}
        {guideLine && (
          <GeoJSONSource id="guide" data={guideLine}>
            <Layer type="line" id="guide-line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': 'rgba(56,189,248,0.75)', 'line-width': 6, 'line-dasharray': [0.2, 2] }} />
          </GeoJSONSource>
        )}
        {route && (
          <GeoJSONSource id="route" data={route}>
            {/* A dark outline under the lime line keeps the route visible on light maps. */}
            <Layer type="line" id="route-casing" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': INK, 'line-width': 7 }} />
            <Layer type="line" id="route-line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': LIME, 'line-width': 4 }} />
          </GeoJSONSource>
        )}
        {guide && guide.length > 1 && (
          <Marker id="guide-start" lngLat={[guide[0].lng, guide[0].lat]}>
            <Dot color="#22C55E" />
          </Marker>
        )}
        {!follow && first && (
          <Marker id="start" lngLat={[first.lng, first.lat]}>
            <Dot color="#22C55E" />
          </Marker>
        )}
        {!follow && last && coords.length > 1 && !isLoop && (
          <Marker id="finish" lngLat={[last.lng, last.lat]}>
            <Dot color="#DC2626" />
          </Marker>
        )}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 260, overflow: 'hidden' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: '#fff' },
});
