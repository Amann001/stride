import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, LayerSpecification, Map as MlMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { mapStyleFor } from '@/lib/android-map-style';
import type { MapStyle } from '@/lib/map-prefs';

// Shared helpers for the web app's maps (the *.web.tsx map components). They use MapLibre GL,
// the browser sibling of the Android app's map engine, on the same free OpenFreeMap maps.
// Only web files import this, so the phone apps never load it.

// MapLibre draws in a background worker. Its script is served from our own site (copied in
// when the web app is built), so the maps never depend on an outside server. The local dev
// server serves such files from the root instead of /app.
const base = process.env.NODE_ENV === 'development' ? '' : (process.env.EXPO_BASE_URL ?? '');
maplibregl.setWorkerUrl(`${base}/maplibre-gl-worker.mjs`);

export { maplibregl };
export type { MlMap };

const styleFor = (style: MapStyle) => mapStyleFor(style) as string | StyleSpecification;

// Apple-style "area across" (degrees) to a MapLibre zoom level, as on Android.
export const zoomFor = (delta: number) => Math.max(1, Math.min(18, Math.log2(360 / delta)));

// What we draw on top of the base map. A style change (Standard -> Satellite) wipes the map, so
// everything is remembered here and drawn again when the new style has loaded.
interface Extras {
  tiles: Map<string, { url: string; maxzoom: number }>;
  lines: Map<string, { data: GeoJSON.GeoJSON; layers: LayerSpecification[] }>;
  // True once the current style has loaded, so our layers can be added. (MapLibre's own
  // isStyleLoaded() is also false while map tiles are still downloading, which is no reason
  // to wait.)
  ready: boolean;
}
const extras = new WeakMap<MlMap, Extras>();

function drawTiles(map: MlMap, id: string, t: { url: string; maxzoom: number }, before?: string) {
  map.addSource(id, { type: 'raster', tiles: [t.url], tileSize: 256, maxzoom: t.maxzoom });
  map.addLayer({ id: `${id}-layer`, type: 'raster', source: id }, before);
}

function drawLines(map: MlMap, id: string, o: { data: GeoJSON.GeoJSON; layers: LayerSpecification[] }) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) source.setData(o.data);
  else map.addSource(id, { type: 'geojson', data: o.data });
  for (const layer of o.layers) if (!map.getLayer(layer.id)) map.addLayer(layer);
}

function redrawAll(map: MlMap) {
  const e = extras.get(map);
  if (!e) return;
  e.ready = true;
  e.tiles.forEach((t, id) => drawTiles(map, id, t)); // tiles first, so lines sit on top
  e.lines.forEach((o, id) => drawLines(map, id, o));
}

export type InitialView =
  | { bounds: [[number, number], [number, number]]; padding?: number; maxZoom?: number }
  | { center: [number, number]; zoom: number };

// A map inside a <div>, created once and opened straight at `initial` (so it doesn't fetch a
// view of the whole world first). Returns null until its style has loaded.
export function useWebMap(
  container: RefObject<HTMLDivElement | null>,
  options: { style: MapStyle; interactive?: boolean; initial?: InitialView | null },
): MlMap | null {
  const [map, setMap] = useState<MlMap | null>(null);
  const initial = useRef(options);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const view = initial.current.initial;
    const m = new maplibregl.Map({
      container: el,
      style: styleFor(initial.current.style),
      interactive: initial.current.interactive ?? true,
      attributionControl: { compact: true },
      ...(view && 'bounds' in view
        ? { bounds: view.bounds, fitBoundsOptions: { padding: view.padding ?? 40, maxZoom: view.maxZoom ?? 17 } }
        : view
          ? { center: view.center, zoom: view.zoom }
          : { center: [0, 20], zoom: 1.5 }),
    });
    extras.set(m, { tiles: new Map(), lines: new Map(), ready: false });
    m.on('style.load', () => redrawAll(m));
    m.once('style.load', () => setMap(m));
    // The map fills a box that can change size (rotating the phone, resizing the window).
    const resize = new ResizeObserver(() => m.resize());
    resize.observe(el);
    return () => {
      resize.disconnect();
      m.remove();
      setMap(null);
    };
  }, [container]);

  // Switching between Standard, Dark and Satellite.
  const style = options.style;
  const shown = useRef(style);
  useEffect(() => {
    if (!map || shown.current === style) return;
    shown.current = style;
    const e = extras.get(map);
    if (e) e.ready = false; // our layers wait for the new style
    map.setStyle(styleFor(style));
  }, [map, style]);

  return map;
}

// Draws (or updates) one of our lines: a GeoJSON source with its layers.
export function setLines(map: MlMap, id: string, data: GeoJSON.GeoJSON, layers: LayerSpecification[]) {
  const o = { data, layers };
  const e = extras.get(map);
  e?.lines.set(id, o);
  if (e?.ready) drawLines(map, id, o);
}

// Shows a layer of map tiles (heatmap, bike lanes) under our lines; null removes it.
export function setTiles(map: MlMap, id: string, url: string | null, maxzoom: number) {
  const e = extras.get(map);
  if (map.getLayer(`${id}-layer`)) map.removeLayer(`${id}-layer`);
  if (map.getSource(id)) map.removeSource(id);
  if (!url) {
    e?.tiles.delete(id);
    return;
  }
  const t = { url, maxzoom };
  e?.tiles.set(id, t);
  if (!e?.ready) return; // drawn by redrawAll when the style is ready
  const ownLayerIds = new Set([...(e?.lines.values() ?? [])].flatMap((o) => o.layers.map((l) => l.id)));
  const firstOwn = map.getStyle().layers.find((l) => ownLayerIds.has(l.id))?.id;
  drawTiles(map, id, t, firstOwn);
}

export const lineFeature = (points: { lat: number; lng: number }[]): GeoJSON.Feature<GeoJSON.LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: points.map((p) => [p.lng, p.lat]) },
});

export const roundLine = { 'line-cap': 'round', 'line-join': 'round' } as const;

// A small round marker, like the Android map's start/finish dots.
export function dotElement(color: string, size = 16, border = '#fff'): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    background: color,
    border: `3px solid ${border}`,
    boxSizing: 'border-box',
    boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
  });
  return el;
}

// The area around the points, for fitBounds.
export function boundsOf(points: { lat: number; lng: number }[]): [[number, number], [number, number]] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [[w, s], [e, n]];
}

// Shows "you are here" on the map, but only if this site already has location permission: the
// map never asks on its own (the Record screen and the locate button ask when you use them).
export function useYouAreHere(map: MlMap | null) {
  useEffect(() => {
    if (!map || typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions) return;
    let watch: number | null = null;
    let marker: maplibregl.Marker | null = null;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return;
        watch = navigator.geolocation.watchPosition(
          (pos) => {
            const at: [number, number] = [pos.coords.longitude, pos.coords.latitude];
            marker ??= new maplibregl.Marker({ element: dotElement('#2563EB', 18) }).setLngLat(at).addTo(map);
            marker.setLngLat(at);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 10_000 },
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (watch != null) navigator.geolocation.clearWatch(watch);
      marker?.remove();
    };
  }, [map]);
}
