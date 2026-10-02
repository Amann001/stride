import { distanceBetween } from '@repo/shared';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import { INK, LIME } from '@/constants/theme';

interface Props {
  coords: { lat: number; lng: number }[];
  // When true, the map follows the last point (used while recording).
  follow?: boolean;
  // When true, the map is a still picture (used in the feed) so it doesn't catch scrolls and taps.
  preview?: boolean;
  // A route to follow, drawn faintly underneath (used while recording).
  guide?: { lat: number; lng: number }[];
  style?: StyleProp<ViewStyle>;
}

// A route that ends within this distance of its start is a loop: one start/finish pin.
const LOOP_METERS = 40;
// Smallest area to show (about 300 m), so a short route isn't zoomed in absurdly far.
const MIN_DELTA = 0.003;

// The map area that shows every point with a margin around it. Used as the starting view,
// so the whole route is framed even before (or without) fitToCoordinates running.
function regionAround(points: { lat: number; lng: number }[]): Region | undefined {
  if (!points.length) return undefined;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, MIN_DELTA),
  };
}

// Draws a route as a lime line on Apple Maps, with start and end markers.
export function RouteMap({ coords, follow = false, preview = false, guide, style }: Props) {
  const mapRef = useRef<MapView>(null);
  const line = coords.map((c) => ({ latitude: c.lat, longitude: c.lng }));
  const guideLine = guide?.map((c) => ({ latitude: c.lat, longitude: c.lng })) ?? [];
  const first = line[0];
  const last = line[line.length - 1];
  const isLoop = line.length > 1 && distanceBetween(coords[0], coords[coords.length - 1]) < LOOP_METERS;
  // Start on the route; while recording with nothing drawn yet, on the guide route if there is one.
  const initialRegion = regionAround(coords.length ? coords : follow ? (guide ?? []) : []);

  // Recording with nothing drawn yet: jump to where you are instead of a whole-country view.
  const hasStart = coords.length > 0 || (follow && !!guide?.length);
  useEffect(() => {
    if (!follow || hasStart) return;
    let cancelled = false;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      const { granted } = perm.granted || !perm.canAskAgain ? perm : await Location.requestForegroundPermissionsAsync();
      if (!granted || cancelled) return;
      const here = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync());
      if (cancelled || !here) return;
      mapRef.current?.animateToRegion(
        { latitude: here.coords.latitude, longitude: here.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        400,
      );
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [follow, hasStart]);

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
      pointerEvents={preview ? 'none' : 'auto'}
      scrollEnabled={!preview}
      zoomEnabled={!preview}
      rotateEnabled={!preview}
      pitchEnabled={!preview}
      initialRegion={initialRegion}>
      {guideLine.length > 1 && (
        <Polyline coordinates={guideLine} strokeColor="rgba(56,189,248,0.75)" strokeWidth={6} lineDashPattern={[1, 8]} lineCap="round" />
      )}
      {guideLine.length > 1 && <Marker coordinate={guideLine[0]} pinColor="green" title="Route start" />}
      {/* A dark outline under the lime line keeps the route visible on light maps. */}
      {line.length > 1 && <Polyline coordinates={line} strokeColor={INK} strokeWidth={7} />}
      {line.length > 1 && <Polyline coordinates={line} strokeColor={LIME} strokeWidth={4} />}
      {!follow && first && <Marker coordinate={first} pinColor="green" title={isLoop ? 'Start & finish' : 'Start'} />}
      {!follow && last && line.length > 1 && !isLoop && <Marker coordinate={last} pinColor="red" title="Finish" />}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { width: '100%', height: 260 },
});
