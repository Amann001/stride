import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

import type { IconName } from '@/constants/categories';
import { strideAudio } from '@/lib/stride-audio';

// Music apps the record screen can open, so you can pick a song and come back.
// Stride never plays music itself: your own app does, with your own account.
export type MusicApp = {
  id: string;
  name: string;
  icon: IconName;
  color: string;
  androidPackage: string;
  iosScheme?: string; // opens the app on iPhone if it's installed
  web: string; // the app's own link: opens the app on most phones, or its web player
};

export const MUSIC_APPS: MusicApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'spotify', color: '#1DB954', androidPackage: 'com.spotify.music', iosScheme: 'spotify:', web: 'https://open.spotify.com' },
  { id: 'youtube-music', name: 'YouTube Music', icon: 'youtube', color: '#FF0033', androidPackage: 'com.google.android.apps.youtube.music', iosScheme: 'youtubemusic://', web: 'https://music.youtube.com' },
  { id: 'jiosaavn', name: 'JioSaavn', icon: 'music-circle', color: '#2BC5B4', androidPackage: 'com.jio.media.jiobeats', web: 'https://www.jiosaavn.com' },
  { id: 'apple-music', name: 'Apple Music', icon: 'apple', color: '#FA2D48', androidPackage: 'com.apple.android.music', iosScheme: 'music://', web: 'https://music.apple.com' },
];

type Step = { kind: 'package'; name: string } | { kind: 'url'; url: string };

// What to try, in order, to open an app on this phone.
export function launchSteps(app: MusicApp, os: string, canOpenPackages: boolean): Step[] {
  const steps: Step[] = [];
  if (os === 'android' && canOpenPackages) steps.push({ kind: 'package', name: app.androidPackage });
  if (os === 'ios' && app.iosScheme) steps.push({ kind: 'url', url: app.iosScheme });
  steps.push({ kind: 'url', url: app.web });
  return steps;
}

export async function openMusicApp(app: MusicApp): Promise<boolean> {
  for (const step of launchSteps(app, Platform.OS, !!strideAudio?.openApp)) {
    if (step.kind === 'package') {
      if (strideAudio?.openApp?.(step.name)) return true;
      continue;
    }
    try {
      await Linking.openURL(step.url);
      return true;
    } catch {
      // Not installed: try the next way.
    }
  }
  return false;
}

// "Another music app": the phone's own music app chooser (Android app builds only).
export const canOpenOtherMusicApp = Platform.OS === 'android' && !!strideAudio?.openMusicPicker;
export const openOtherMusicApp = () => strideAudio?.openMusicPicker?.() ?? false;

// The last app you picked gets a tick, so it's quick to find next time.
const LAST_KEY = 'stride.music-app';
export const getLastMusicApp = () => AsyncStorage.getItem(LAST_KEY).catch(() => null);
export const setLastMusicApp = (id: string) => AsyncStorage.setItem(LAST_KEY, id).catch(() => {});
