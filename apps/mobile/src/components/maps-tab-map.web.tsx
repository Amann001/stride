import type { LatLng } from '@repo/shared';
import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MapsTabMapProps } from '@/components/maps-tab-map';
import { INK, LIME } from '@/constants/theme';
import { dotElement, maplibregl, roundLine, setLines, setTiles, useWebMap, useYouAreHere, zoomFor } from '@/lib/web-map';

// Web app version of the Maps tab map (maps-tab-map.tsx is the iPhone one,
// maps-tab-map.android.tsx the Android one). Same props.

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

// Lines are thin, so taps and clicks are caught by a wider invisible line on top of each.
const TAP_LAYERS = ['routes-tap', 'activities-tap'];

export function MapsTabMap(props: MapsTabMapProps) {
  const { mapStyle, bikeLanesUrl, heatmapUrl, routes, activities, selectedStart, ref } = props;
  const container = useRef<HTMLDivElement>(null);
  const map = useWebMap(container, { style: mapStyle });
  useYouAreHere(map);

  // The screen may move the map before it has finished loading (e.g. to your location as the
  // tab opens). Remember that and apply it once the map is ready, as the phone maps do.
  const pending = useRef<{ center: [number, number]; zoom: number } | null>(null);
  useEffect(() => {
    if (map && pending.current) map.jumpTo(pending.current);
    pending.current = null;
  }, [map]);

  useImperativeHandle(ref, () => ({
    goTo: (p, delta) => {
      const view = { center: [p.lng, p.lat] as [number, number], zoom: zoomFor(delta) };
      if (map) map.flyTo({ ...view, duration: 500 });
      else pending.current = view;
    },
    setPitched: async (on) => {
      map?.easeTo({ pitch: on ? 60 : 0, duration: 600 });
    },
  }));

  useEffect(() => {
    if (!map) return;
    setTiles(map, 'bike-lanes', bikeLanesUrl, 19);
  }, [map, bikeLanesUrl]);

  useEffect(() => {
    if (!map) return;
    setTiles(map, 'heatmap', heatmapUrl, 18);
  }, [map, heatmapUrl]);

  useEffect(() => {
    if (!map) return;
    setLines(map, 'routes', collection(routes), [
      { id: 'routes-line', type: 'line', source: 'routes', layout: roundLine,
        paint: {
          'line-color': ['case', ['get', 'selected'], LIME, 'rgba(200,243,29,0.55)'],
          'line-width': ['case', ['get', 'selected'], 6, 4],
        } },
      { id: 'routes-tap', type: 'line', source: 'routes', layout: roundLine, paint: { 'line-width': 18, 'line-opacity': 0 } },
    ]);
  }, [map, routes]);

  useEffect(() => {
    if (!map) return;
    setLines(map, 'activities', collection(activities), [
      { id: 'activities-line', type: 'line', source: 'activities', layout: roundLine,
        paint: { 'line-color': ['get', 'color'], 'line-width': 4 } },
      { id: 'activities-tap', type: 'line', source: 'activities', layout: roundLine, paint: { 'line-width': 18, 'line-opacity': 0 } },
    ]);
  }, [map, activities]);

  // Taps: a route, an activity, or the empty map (which closes the selected route's card).
  // The map's listeners are added once; they read the latest handlers from here.
  const handlers = useRef(props);
  useLayoutEffect(() => {
    handlers.current = props;
  });
  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => {
      const layers = TAP_LAYERS.filter((id) => map.getLayer(id));
      const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers }) : [];
      const id = hit[0]?.properties?.id;
      if (typeof id === 'string') {
        if (hit[0].layer.id === 'routes-tap') handlers.current.onRoutePress(id);
        else handlers.current.onActivityPress(id);
      } else {
        handlers.current.onMapPress();
      }
    };
    const onMoveEnd = () => {
      const c = map.getCenter();
      handlers.current.onCenterChange({ lat: c.lat, lng: c.lng });
    };
    const pointer = () => (map.getCanvas().style.cursor = 'pointer');
    const plain = () => (map.getCanvas().style.cursor = '');
    map.on('click', onClick);
    map.on('moveend', onMoveEnd);
    for (const id of TAP_LAYERS) {
      map.on('mouseenter', id, pointer);
      map.on('mouseleave', id, plain);
    }
    return () => {
      map.off('click', onClick);
      map.off('moveend', onMoveEnd);
      for (const id of TAP_LAYERS) {
        map.off('mouseenter', id, pointer);
        map.off('mouseleave', id, plain);
      }
    };
  }, [map]);

  // The start of the selected route.
  useEffect(() => {
    if (!map || !selectedStart) return;
    const marker = new maplibregl.Marker({ element: dotElement('#22C55E', 16, INK) })
      .setLngLat([selectedStart.lng, selectedStart.lat])
      .addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, selectedStart]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}
