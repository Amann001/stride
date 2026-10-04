import type { HeatmapKind } from '@repo/shared';
import { useSyncExternalStore } from 'react';

import { storage } from '@/lib/storage';

// How the Maps tab looks: map style, which heatmap is on, and extra layers. Saved on the
// phone so the map looks the same next time you open the app.

export type MapStyle = 'standard' | 'dark' | 'satellite' | 'hybrid' | 'mutedStandard';

// Apple Maps (iPhone) has no separate dark map: "Dark" is its standard map drawn in dark mode.
export function appleMapProps(style: MapStyle) {
  return style === 'dark'
    ? { mapType: 'standard' as const, userInterfaceStyle: 'dark' as const }
    : { mapType: style };
}

export interface MapPrefs {
  mapStyle: MapStyle;
  heatmap: HeatmapKind | null;
  pois: boolean;
  bikeLanes: boolean;
}

const KEY = 'map_prefs';
const DEFAULTS: MapPrefs = { mapStyle: 'standard', heatmap: null, pois: true, bikeLanes: false };

let prefs: MapPrefs = DEFAULTS;
const listeners = new Set<() => void>();

// Load saved settings once, at startup.
storage.get(KEY)
  .then((saved) => {
    if (saved) {
      prefs = { ...DEFAULTS, ...JSON.parse(saved) };
      for (const l of listeners) l();
    }
  })
  .catch(() => {});

export function updateMapPrefs(change: Partial<MapPrefs>) {
  prefs = { ...prefs, ...change };
  for (const l of listeners) l();
  storage.set(KEY, JSON.stringify(prefs)).catch(() => {});
}

export function useMapPrefs(): MapPrefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => prefs,
  );
}
