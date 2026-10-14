import { distanceBetween } from '@repo/shared';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { INK, LIME } from '@/constants/theme';
import { boundsOf, dotElement, lineFeature, maplibregl, roundLine, setLines, useWebMap, type InitialView } from '@/lib/web-map';

// Web app version of RouteMap (route-map.tsx is the iPhone one, route-map.android.tsx the
// Android one). Same props: an activity's route, or the live line while recording.

interface Props {
  coords: { lat: number; lng: number }[];
  follow?: boolean;
  preview?: boolean;
  guide?: { lat: number; lng: number }[];
  style?: StyleProp<ViewStyle>;
}

const LOOP_METERS = 40;
const PADDING = 40;

export function RouteMap({ coords, follow = false, preview = false, guide, style }: Props) {
  const container = useRef<HTMLDivElement>(null);
  // Open straight at the route when it's already known (activity pages, route cards).
  const [initial] = useState<InitialView | null>(() => {
    const framed = coords.length ? coords : follow ? (guide ?? []) : [];
    if (framed.length > 1) return { bounds: boundsOf(framed), padding: PADDING };
    if (framed.length === 1) return { center: [framed[0].lng, framed[0].lat], zoom: 15 };
    return null;
  });
  const map = useWebMap(container, { style: 'standard', interactive: !preview, initial });
  const framedOnce = useRef(initial != null && !follow);
  const markers = useRef<maplibregl.Marker[]>([]);

  // The route and the guide line (a saved route you're following).
  useEffect(() => {
    if (!map) return;
    setLines(map, 'guide', lineFeature(guide && guide.length > 1 ? guide : []), [
      { id: 'guide-line', type: 'line', source: 'guide', layout: roundLine,
        paint: { 'line-color': 'rgba(56,189,248,0.75)', 'line-width': 6, 'line-dasharray': [0.2, 2] } },
    ]);
    setLines(map, 'route', lineFeature(coords.length > 1 ? coords : []), [
      // A dark outline under the lime line keeps the route visible on light maps.
      { id: 'route-casing', type: 'line', source: 'route', layout: roundLine, paint: { 'line-color': INK, 'line-width': 7 } },
      { id: 'route-line', type: 'line', source: 'route', layout: roundLine, paint: { 'line-color': LIME, 'line-width': 4 } },
    ]);
  }, [map, coords, guide]);

  // Start, finish and guide-start dots; while recording, a "you are here" dot at the line's end.
  useEffect(() => {
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    const add = (p: { lat: number; lng: number }, color: string, size?: number) =>
      markers.current.push(new maplibregl.Marker({ element: dotElement(color, size) }).setLngLat([p.lng, p.lat]).addTo(map));
    markers.current = [];
    const first = coords[0];
    const last = coords[coords.length - 1];
    const isLoop = coords.length > 1 && distanceBetween(first, last) < LOOP_METERS;
    if (guide && guide.length > 1) add(guide[0], '#22C55E');
    if (!follow && first) add(first, '#22C55E');
    if (!follow && last && coords.length > 1 && !isLoop) add(last, '#DC2626');
    if (follow && last) add(last, '#2563EB', 18);
  }, [map, coords, guide, follow]);

  // Frame the route once it's known. While recording, keep the newest point in view.
  useEffect(() => {
    if (!map) return;
    const framed = coords.length ? coords : follow ? (guide ?? []) : [];
    if (follow && coords.length) {
      const last = coords[coords.length - 1];
      map.easeTo({ center: [last.lng, last.lat], zoom: framedOnce.current ? map.getZoom() : 16, duration: 500 });
      framedOnce.current = true;
      return;
    }
    if (framedOnce.current || !framed.length) return;
    framedOnce.current = true;
    if (framed.length > 1) map.fitBounds(boundsOf(framed), { padding: PADDING, duration: 0, maxZoom: 17 });
    else map.jumpTo({ center: [framed[0].lng, framed[0].lat], zoom: 15 });
  }, [map, coords, guide, follow]);

  // Recording with nothing drawn yet: jump to where you are.
  const hasStart = coords.length > 0 || (guide?.length ?? 0) > 0;
  useEffect(() => {
    if (!map || !follow || hasStart) return;
    let cancelled = false;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      const here = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
      if (cancelled || !here) return;
      map.jumpTo({ center: [here.coords.longitude, here.coords.latitude], zoom: 15 });
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [map, follow, hasStart]);

  return (
    <View style={[styles.map, style]} pointerEvents={preview ? 'none' : 'auto'}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 260, overflow: 'hidden' },
});
