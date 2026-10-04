import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { LIME } from '@/constants/theme';

import { api } from './api';
import { storage } from './storage';

// Push notifications: new followers, kudos, comments, challenge invites and messages reach
// the phone even when the app is closed. They need a real app build: Expo Go and the web
// preview can't receive them, so there this quietly does nothing (the in-app list still works).

const PUSH_TOKEN_KEY = 'push_token';

const canPush = () =>
  Platform.OS !== 'web' && Device.isDevice && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// A notification that arrives while the app is open still shows as a banner.
export function installNotificationHandling() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Asks for permission (once; the phone remembers the answer) and tells the server where to
// send this account's notifications. Safe to call on every app start.
export async function registerForPush(): Promise<void> {
  if (!canPush()) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Friends, challenges and messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: LIME,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.savePushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  await storage.set(PUSH_TOKEN_KEY, token);
}

// On logout: stop notifications for this account on this phone.
export async function unregisterPush(): Promise<void> {
  const token = await storage.get(PUSH_TOKEN_KEY);
  if (!token) return;
  await storage.remove(PUSH_TOKEN_KEY);
  await api.removePushToken(token).catch(() => {});
}

// Tapping a notification opens what it's about (the activity, the chat, the challenge...),
// whether the app was open or closed. `ready` is false until someone is logged in.
// The web preview has no notifications at all, so there this does nothing (the platform never
// changes while the app runs, so picking the function once is safe for hooks).
export const useOpenTappedNotifications: (ready: boolean) => void =
  Platform.OS === 'web' ? () => {} : useOpenTappedNotificationsOnPhone;

function useOpenTappedNotificationsOnPhone(ready: boolean) {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
  }, [ready, response]);
}
