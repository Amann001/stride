import { Appearance } from 'react-native';

import type { MapStyle } from '@/lib/map-prefs';

// Map looks for Android, from OpenFreeMap: free for apps, no account, no key, no usage limit.
// Attribution ("OpenFreeMap © OpenMapTiles Data from OpenStreetMap") is shown by MapLibre's
// built-in (i) button. https://openfreemap.org
const BASE = 'https://tiles.openfreemap.org/styles';

// Satellite and hybrid imagery need a paid or keyed provider, so Android offers Standard and
// Muted only; anything else falls back to Standard.
export const ANDROID_MAP_STYLES: MapStyle[] = ['standard', 'mutedStandard'];

export function mapStyleUrl(style: MapStyle): string {
  const dark = Appearance.getColorScheme() === 'dark';
  if (style === 'mutedStandard') return `${BASE}/${dark ? 'fiord' : 'positron'}`;
  return `${BASE}/${dark ? 'dark' : 'liberty'}`;
}
