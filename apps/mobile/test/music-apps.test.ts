import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' }, Linking: { openURL: vi.fn() } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(), setItem: vi.fn() } }));
vi.mock('@/lib/stride-audio', () => ({ strideAudio: null }));

import { MUSIC_APPS, launchSteps } from '@/lib/music-apps';

const spotify = MUSIC_APPS.find((a) => a.id === 'spotify')!;
const jiosaavn = MUSIC_APPS.find((a) => a.id === 'jiosaavn')!;

describe('opening a music app', () => {
  it('on a new Android build, opens the installed app, then falls back to its link', () => {
    expect(launchSteps(spotify, 'android', true)).toEqual([
      { kind: 'package', name: 'com.spotify.music' },
      { kind: 'url', url: 'https://open.spotify.com' },
    ]);
  });

  it('on an older Android build without the native part, uses the link', () => {
    expect(launchSteps(spotify, 'android', false)).toEqual([{ kind: 'url', url: 'https://open.spotify.com' }]);
  });

  it('on iPhone, tries the app first, then the link', () => {
    expect(launchSteps(spotify, 'ios', false)).toEqual([
      { kind: 'url', url: 'spotify:' },
      { kind: 'url', url: 'https://open.spotify.com' },
    ]);
    expect(launchSteps(jiosaavn, 'ios', false)).toEqual([{ kind: 'url', url: 'https://www.jiosaavn.com' }]);
  });

  it('in the web app, only uses links (they open the app on most phones)', () => {
    for (const app of MUSIC_APPS) {
      const steps = launchSteps(app, 'web', false);
      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({ kind: 'url' });
      expect((steps[0] as { url: string }).url).toMatch(/^https:\/\//);
    }
  });
});
