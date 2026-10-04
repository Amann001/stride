import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  NativeUserLocation,
  RasterSource,
  type CameraRef,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import type { LatLng } from '@repo/shared';
import { useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MapsTabMapProps } from '@/components/maps-tab-map';
import { INK, LIME } from '@/constants/theme';
import { mapStyleFor } from '@/lib/android-map-style';

// Android version of the Maps tab map (maps-tab-map.tsx is the iPhone one). Same props,
// drawn with MapLibre on free OpenFreeMap maps.

// Only the few fields the map styles and taps need go into the map data.
const collection = (
  items: { id: string; coords: LatLng[]; selected?: boolean; color?: string }[],
): GeoJSON.FeatureCollection<GeoJSON.LineString> => ({
  type: 'FeatureCollection',
  features: items
    .filter((i) => i.coords.length > 1)
    .map((i) => ({
      type: 'Feature',
      properties: { id: i.id, selected: !!i.selected, color: i.color ?? LIME },
      geometry: { type: 'LineString', coordinates: i.coords.map((c) => [c.lng, c.lat]) },
    })),
});

// Apple-style "area across" (degrees) to a MapLibre zoom level.
const zoomFor = (delta: number) => Math.max(1, Math.min(18, Math.log2(360 / delta)));

const featureId = (features: GeoJSON.Feature[]) => {
  const id = features[0]?.properties?.id;
  return typeof id === 'string' ? id : null;
};

export function MapsTabMap(props: MapsTabMapProps) {
  const { mapStyle, bikeLanesUrl, heatmapUrl, routes, activities, selectedStart, ref } = props;
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);

  useImperativeHandle(ref, () => ({
    goTo: (p, delta) => cameraRef.current?.flyTo({ center: [p.lng, p.lat], zoom: zoomFor(delta), duration: 500 }),
    setPitched: async (on) => {
      const center = await mapRef.current?.getCenter();
      if (center) cameraRef.current?.easeTo({ center, pitch: on ? 60 : 0, duration: 600 });
    },
  }));

  const routeData = useMemo(() => collection(routes), [routes]);
  const activityData = useMemo(() => collection(activities), [activities]);

  return (
    <Map
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      mapStyle={mapStyleFor(mapStyle)}
      compass={false}
      logo={false}
      onPress={props.onMapPress}
      onRegionDidChange={(e) => {
        const [lng, lat] = e.nativeEvent.center;
        props.onCenterChange({ lat, lng });
      }}>
      <Camera ref={cameraRef} />
      <NativeUserLocation />
      {bikeLanesUrl && (
        <RasterSource id="bike-lanes" tiles={[bikeLanesUrl]} tileSize={256} maxzoom={19}>
          <Layer type="raster" id="bike-lanes-layer" />
        </RasterSource>
      )}
      {heatmapUrl && (
        <RasterSource key={heatmapUrl} id="heatmap" tiles={[heatmapUrl]} tileSize={256} maxzoom={18}>
          <Layer type="raster" id="heatmap-layer" />
        </RasterSource>
      )}
      <GeoJSONSource
        id="routes"
        data={routeData}
        onPress={(e) => {
          // Don't let the tap also count as a tap on the empty map (which deselects).
          e.stopPropagation();
          const id = featureId(e.nativeEvent.features);
          if (id) props.onRoutePress(id);
        }}>
        <Layer type="line" id="routes-line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{
            'line-color': ['case', ['get', 'selected'], LIME, 'rgba(200,243,29,0.55)'],
            'line-width': ['case', ['get', 'selected'], 6, 4],
          }} />
      </GeoJSONSource>
      <GeoJSONSource
        id="activities"
        data={activityData}
        onPress={(e) => {
          e.stopPropagation();
          const id = featureId(e.nativeEvent.features);
          if (id) props.onActivityPress(id);
        }}>
        <Layer type="line" id="activities-line" layout={{ 'line-cap': 'round', 'line-join': 'round' }}
          paint={{ 'line-color': ['get', 'color'], 'line-width': 4 }} />
      </GeoJSONSource>
      {selectedStart && (
        <Marker id="selected-start" lngLat={[selectedStart.lng, selectedStart.lat]}>
          <View style={[styles.startDot, { borderColor: INK }]} />
        </Marker>
      )}
    </Map>
  );
}

const styles = StyleSheet.create({
  startDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#22C55E', borderWidth: 3 },
});
