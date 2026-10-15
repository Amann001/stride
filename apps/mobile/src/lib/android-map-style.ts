import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { Appearance, PixelRatio } from 'react-native';

import type { MapStyle } from '@/lib/map-prefs';

// Map looks for Android and the web app. All free: no account, no key, and they never learn
// who you are (like any online map, they only see which map tiles are loaded).
// Credits are shown by MapLibre's built-in (i) button.
// - Street maps: OpenFreeMap, https://openfreemap.org (© OpenMapTiles, data © OpenStreetMap).
// - Satellite: Esri World Imagery, sharp aerial photos down to single buildings and paths.
//   Underneath it sits EOxCloudless 2016 by EOX (https://cloudless.eox.at, CC BY 4.0): 10 m
//   Sentinel-2 photos, blurry up close, but if Esri's photos ever fail to load the map shows
//   these instead of going blank.
const BASE = 'https://tiles.openfreemap.org/styles';

// Phone screens pack 2-3 real pixels into each point. Asking for tiles as if they were half
// size loads the next level of detail, so the photos stay crisp instead of being enlarged.
const SHARP_TILE = PixelRatio.get() >= 2 ? 128 : 256;

// Hybrid would need satellite plus a road/label layer on top, so Android offers these four;
// a saved "hybrid" choice from an iPhone falls back to Standard.
export const ANDROID_MAP_STYLES: MapStyle[] = ['standard', 'dark', 'satellite', 'mutedStandard'];

const SATELLITE: StyleSpecification = {
  version: 8,
  sources: {
    backup: {
      type: 'raster',
      tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'],
      tileSize: 256,
      // The photos' real detail ends around here; closer in, the map enlarges these tiles.
      maxzoom: 15,
      attribution:
        'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), CC BY 4.0',
    },
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: SHARP_TILE,
      // Covered almost everywhere down to here; some places have no closer photos at all.
      maxzoom: 18,
      attribution: 'Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [
    { id: 'backup', type: 'raster', source: 'backup' },
    { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-fade-duration': 150 } },
  ],
};

export function mapStyleFor(style: MapStyle): string | StyleSpecification {
  const phoneIsDark = Appearance.getColorScheme() === 'dark';
  switch (style) {
    case 'satellite':
      return SATELLITE;
    case 'dark':
      return `${BASE}/dark`;
    case 'mutedStandard':
      return `${BASE}/${phoneIsDark ? 'fiord' : 'positron'}`;
    default:
      return `${BASE}/${phoneIsDark ? 'dark' : 'liberty'}`;
  }
}
