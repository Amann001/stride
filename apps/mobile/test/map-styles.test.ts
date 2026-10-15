import { describe, expect, it, vi } from 'vitest';

const phone = vi.hoisted(() => ({ scheme: 'light' as 'light' | 'dark' }));
vi.mock('react-native', () => ({ Appearance: { getColorScheme: () => phone.scheme }, PixelRatio: { get: () => 3 } }));
// Saved map settings live in the phone's storage, which tests don't have.
vi.mock('@/lib/storage', () => ({ storage: { get: async () => null, set: async () => {}, remove: async () => {} } }));

const { ANDROID_MAP_STYLES, mapStyleFor } = await import('@/lib/android-map-style');
const { appleMapProps } = await import('@/lib/map-prefs');

describe('Android map types', () => {
  it('offers Standard, Dark, Satellite and Muted', () => {
    expect(ANDROID_MAP_STYLES).toEqual(['standard', 'dark', 'satellite', 'mutedStandard']);
  });

  it('Dark is dark even when the phone is in light mode', () => {
    phone.scheme = 'light';
    expect(mapStyleFor('dark')).toBe('https://tiles.openfreemap.org/styles/dark');
    expect(mapStyleFor('standard')).toBe('https://tiles.openfreemap.org/styles/liberty');
  });

  it('satellite shows sharp Esri photos, with the free-forever 2016 photos underneath as a backup', () => {
    type Source = { tiles: string[]; attribution: string; tileSize: number };
    const style = mapStyleFor('satellite') as unknown as { sources: Record<string, Source>; layers: { source: string }[] };
    const { satellite, backup } = style.sources;
    expect(satellite.tiles).toEqual(['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}']);
    expect(satellite.attribution).toMatch(/Esri/);
    // A phone screen packs 3 pixels into each point, so tiles load one level closer in.
    expect(satellite.tileSize).toBe(128);
    // The 2016 layer is CC BY 4.0; later years are non-commercial only.
    expect(backup.tiles).toEqual(['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg']);
    expect(backup.attribution).toMatch(/EOxCloudless .* Copernicus Sentinel data 2016/);
    for (const s of [satellite, backup]) expect(s.tiles[0]).not.toMatch(/key|token/);
    // The backup is drawn first, so the sharp photos cover it wherever they load.
    expect(style.layers.map((l) => l.source)).toEqual(['backup', 'satellite']);
  });

  it('a saved Hybrid choice (from an iPhone) falls back to Standard', () => {
    expect(mapStyleFor('hybrid')).toBe(mapStyleFor('standard'));
  });
});

describe('iPhone map types', () => {
  it('draws Dark as the standard Apple map in dark mode', () => {
    expect(appleMapProps('dark')).toEqual({ mapType: 'standard', userInterfaceStyle: 'dark' });
    expect(appleMapProps('satellite')).toEqual({ mapType: 'satellite' });
  });
});
