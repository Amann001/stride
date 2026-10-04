import type { LatLng } from '@repo/shared';
import { useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, type Region } from 'react-native-maps';

import { INK, LIME } from '@/constants/theme';
import { appleMapProps, type MapStyle } from '@/lib/map-prefs';

// The map on the Maps tab: route suggestions you can tap, your activities, heatmap and
// bike-lane layers. This is the iPhone version, on Apple Maps; maps-tab-map.android.tsx is
// the Android one (MapLibre). Both take the same props.

export interface MapsTabMapHandle {
  goTo(p: LatLng, delta: number): void;
  setPitched(on: boolean): Promise<void>;
}

export interface MapsTabMapProps {
  mapStyle: MapStyle;
  pois: boolean;
  bikeLanesUrl: string | null;
  heatmapUrl: string | null;
  routes: { id: string; coords: LatLng[]; selected: boolean }[];
  activities: { id: string; coords: LatLng[]; color: string }[];
  selectedStart: LatLng | null;
  onRoutePress: (id: string) => void;
  onActivityPress: (id: string) => void;
  onMapPress: () => void;
  onCenterChange: (center: LatLng) => void;
  ref?: Ref<MapsTabMapHandle>;
}

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

export function MapsTabMap(props: MapsTabMapProps) {
  const { mapStyle, pois, bikeLanesUrl, heatmapUrl, routes, activities, selectedStart, ref } = props;
  const mapRef = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    goTo: (p, delta) =>
      mapRef.current?.animateToRegion({ latitude: p.lat, longitude: p.lng, latitudeDelta: delta, longitudeDelta: delta }, 500),
    setPitched: async (on) => {
      const cam = await mapRef.current?.getCamera();
      if (!cam) return;
      mapRef.current?.animateCamera(
        { pitch: on ? 60 : 0, altitude: on ? Math.min(cam.altitude ?? 1500, 1500) : cam.altitude },
        { duration: 600 },
      );
    },
  }));

  const routeLines = useMemo(() => routes.map((r) => ({ ...r, coords: r.coords.map(toCoord) })), [routes]);
  const activityLines = useMemo(() => activities.map((a) => ({ ...a, coords: a.coords.map(toCoord) })), [activities]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      {...appleMapProps(mapStyle)}
      showsUserLocation
      showsPointsOfInterests={pois}
      showsBuildings
      showsCompass={false}
      onRegionChangeComplete={(r: Region) => props.onCenterChange({ lat: r.latitude, lng: r.longitude })}
      onPress={props.onMapPress}>
      {bikeLanesUrl && <UrlTile urlTemplate={bikeLanesUrl} maximumZ={19} zIndex={1} tileSize={256} />}
      {heatmapUrl && <UrlTile key={heatmapUrl} urlTemplate={heatmapUrl} maximumZ={18} zIndex={2} tileSize={256} />}
      {routeLines.map((r) => (
        <Polyline key={r.id} coordinates={r.coords} tappable onPress={() => props.onRoutePress(r.id)}
          strokeColor={r.selected ? LIME : 'rgba(200,243,29,0.55)'} strokeWidth={r.selected ? 6 : 4}
          zIndex={r.selected ? 4 : 3} />
      ))}
      {activityLines.map((a) => (
        <Polyline key={a.id} coordinates={a.coords} tappable onPress={() => props.onActivityPress(a.id)}
          strokeColor={a.color} strokeWidth={4} zIndex={3} />
      ))}
      {selectedStart && (
        <Marker coordinate={toCoord(selectedStart)} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[styles.startDot, { borderColor: INK }]} />
        </Marker>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  startDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#22C55E', borderWidth: 3 },
});
