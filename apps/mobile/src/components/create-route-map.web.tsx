import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CreateRouteMapProps } from '@/components/create-route-map';
import { INK, LIME, useColors } from '@/constants/theme';
import { lineFeature, maplibregl, roundLine, setLines, useWebMap, useYouAreHere, zoomFor } from '@/lib/web-map';

// Web app version of the Create Route map: tap or click to add numbered points.

export function CreateRouteMap({ mapStyle, points, line, onAddPoint, ref }: CreateRouteMapProps) {
  const colors = useColors();
  const container = useRef<HTMLDivElement>(null);
  const map = useWebMap(container, { style: mapStyle });
  useYouAreHere(map);

  // A move requested before the map has loaded is applied once it's ready.
  const pending = useRef<{ center: [number, number]; zoom: number } | null>(null);
  useEffect(() => {
    if (map && pending.current) map.jumpTo(pending.current);
    pending.current = null;
  }, [map]);

  useImperativeHandle(ref, () => ({
    goTo: (p, delta) => {
      const view = { center: [p.lng, p.lat] as [number, number], zoom: zoomFor(delta) };
      if (map) map.flyTo({ ...view, duration: 400 });
      else pending.current = view;
    },
  }));

  // The click listener is added once; it reads the latest onAddPoint from here.
  const addPoint = useRef(onAddPoint);
  useLayoutEffect(() => {
    addPoint.current = onAddPoint;
  });
  useEffect(() => {
    if (!map) return;
    const onClick = (e: maplibregl.MapMouseEvent) => addPoint.current({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    map.getCanvas().style.cursor = 'crosshair';
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;
    setLines(map, 'planned', lineFeature(line.length > 1 ? line : []), [
      { id: 'planned-casing', type: 'line', source: 'planned', layout: roundLine, paint: { 'line-color': INK, 'line-width': 8 } },
      { id: 'planned-line', type: 'line', source: 'planned', layout: roundLine, paint: { 'line-color': LIME, 'line-width': 5 } },
    ]);
  }, [map, line]);

  // Numbered points: 1 is green (the start), the rest match the card colour.
  useEffect(() => {
    if (!map) return;
    const markers = points.map((p, i) => {
      const el = document.createElement('div');
      Object.assign(el.style, {
        width: '24px', height: '24px', borderRadius: '50%', boxSizing: 'border-box',
        border: `2px solid ${INK}`, background: i === 0 ? '#22C55E' : colors.card,
        color: i === 0 ? INK : colors.text, font: '700 11px system-ui, sans-serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      });
      el.textContent = String(i + 1);
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
    });
    return () => markers.forEach((m) => m.remove());
  }, [map, points, colors.card, colors.text]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    </View>
  );
}
