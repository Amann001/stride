import { describe, expect, it, vi } from 'vitest';

const phone = vi.hoisted(() => ({ scheme: 'light' as 'light' | 'dark' }));
vi.mock('react-native', () => ({ Appearance: { getColorScheme: () => phone.scheme } }));
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

  it('satellite uses the free-forever 2016 photos, with no key and with the required credit', () => {
    const style = mapStyleFor('satellite') as unknown as { sources: { satellite: { tiles: string[]; attribution: string } } };
    const source = style.sources.satellite;
    // The 2016 layer is CC BY 4.0; later years are non-commercial only.
    expect(source.tiles).toEqual(['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg']);
    expect(source.tiles[0]).not.toMatch(/key|token|20(1[7-9]|2\d)/);
    expect(source.attribution).toMatch(/EOxCloudless .* Copernicus Sentinel data 2016/);
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
