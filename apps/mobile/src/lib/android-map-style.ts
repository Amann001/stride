import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { Appearance } from 'react-native';

import type { MapStyle } from '@/lib/map-prefs';

// Map looks for Android. All free for good: no account, no key, no usage limit, and they
// never learn who you are (like any online map, they only see which map tiles are loaded).
// Credits are shown by MapLibre's built-in (i) button.
// - Street maps: OpenFreeMap, https://openfreemap.org (© OpenMapTiles, data © OpenStreetMap).
// - Satellite: EOxCloudless 2016 by EOX, https://cloudless.eox.at. Sentinel-2 satellite photos
//   at 10 m per pixel: fields, parks, rivers and towns, not single buildings. The 2016 edition
//   is CC BY 4.0, so it stays free even for commercial use (later years are non-commercial only).
const BASE = 'https://tiles.openfreemap.org/styles';

// Hybrid would need satellite plus a road/label layer on top, so Android offers these four;
// a saved "hybrid" choice from an iPhone falls back to Standard.
export const ANDROID_MAP_STYLES: MapStyle[] = ['standard', 'dark', 'satellite', 'mutedStandard'];

const SATELLITE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg'],
      tileSize: 256,
      // The photos' real detail ends around here; closer in, the map enlarges these tiles.
      maxzoom: 15,
      attribution:
        'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016), CC BY 4.0',
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
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
