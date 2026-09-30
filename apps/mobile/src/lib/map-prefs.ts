import type { HeatmapKind } from '@repo/shared';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';

// How the Maps tab looks: map style, which heatmap is on, and extra layers. Saved on the
// phone so the map looks the same next time you open the app.

export type MapStyle = 'standard' | 'satellite' | 'hybrid' | 'mutedStandard';

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
SecureStore.getItemAsync(KEY)
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
  SecureStore.setItemAsync(KEY, JSON.stringify(prefs)).catch(() => {});
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
