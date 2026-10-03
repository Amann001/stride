import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, AppState, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { BrandSplash } from '@/components/brand-splash';
import { TextPromptHost } from '@/components/text-prompt';
import { useColors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { installErrorReporting, reportError } from '@/lib/error-reporting';
import { uploadPending } from '@/lib/pending-activities';
import { installNotificationHandling, registerForPush, useOpenTappedNotifications } from '@/lib/push';

SplashScreen.preventAutoHideAsync();
installErrorReporting();
installNotificationHandling();

// Shown instead of a crash if a screen breaks: the error is reported, and "Try again"
// reloads the screen.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const colors = useColors();
  useEffect(() => reportError(error, { fatal: false, screen: 'error-boundary' }), [error]);
  return (
    <View style={[styles.crash, { backgroundColor: colors.background }]}>
      <Text style={[styles.crashTitle, { color: colors.text }]}>Something went wrong</Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center', lineHeight: 21 }}>
        Sorry about that. We’ve been told about the problem. Your activities are safe.
      </Text>
      <Pressable onPress={retry} style={[styles.crashButton, { backgroundColor: colors.brand }]}>
        <Text style={{ color: colors.onBrand, fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

// How long the STRIDE opening screen stays up at minimum, and how long it takes to fade away.
// Short, like Strava's: just long enough to register the brand.
const MIN_INTRO_MS = 900;
const FADE_MS = 250;

// The root of the app. Logged-out users only see the login screen;
// logged-in users see the tabs and activity screens.
function RootNavigator() {
  const { user, loading } = useAuth();
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [introOpacity] = useState(() => new Animated.Value(1));

  // Our own STRIDE screen looks identical to the native splash, so swap to it straight away.
  // (In Expo Go the native splash shows the app icon instead; this screen still shows.)
  useEffect(() => {
    SplashScreen.hideAsync();
    const timer = setTimeout(() => setMinTimePassed(true), MIN_INTRO_MS);
    return () => clearTimeout(timer);
  }, []);

  // Upload any activities that were saved on the phone while offline: when you log in or
  // open the app, and whenever the app comes back to the front. Also sign this phone up for
  // push notifications (the phone asks permission only the first time).
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    uploadPending(userId).catch(() => {});
    registerForPush().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') uploadPending(userId).catch(() => {});
    });
    return () => sub.remove();
  }, [userId]);

  useOpenTappedNotifications(!loading && !!user);

  // Once login state is known and the minimum time is up, fade the intro out.
  useEffect(() => {
    if (loading || !minTimePassed) return;
    Animated.timing(introOpacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() =>
      setShowIntro(false),
    );
  }, [loading, minTimePassed, introOpacity]);

  return (
    <View style={styles.root}>
      {!loading && (
        <Stack>
          <Stack.Protected guard={!!user}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="activity/[id]" options={{ title: 'Activity', headerBackTitle: 'Back' }} />
            <Stack.Screen name="manual" options={{ title: 'Add Activity', presentation: 'modal' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications', headerBackTitle: 'Back' }} />
            <Stack.Screen name="route/[id]" options={{ title: 'Route', headerBackTitle: 'Back' }} />
            <Stack.Screen name="routes/saved" options={{ title: 'Saved Routes', headerBackTitle: 'Back' }} />
            <Stack.Screen name="routes/create" options={{ title: 'Create Route', headerBackTitle: 'Back' }} />
            <Stack.Screen name="search" options={{ title: 'Search', headerBackTitle: 'Back' }} />
            <Stack.Screen name="scan" options={{ title: 'Scan QR Code', presentation: 'modal' }} />
            <Stack.Screen name="athlete/[id]" options={{ title: 'Athlete', headerBackTitle: 'Back' }} />
            <Stack.Screen name="connections" options={{ title: 'Followers', headerBackTitle: 'Back' }} />
            <Stack.Screen name="messages/index" options={{ title: 'Messages', headerBackTitle: 'Back' }} />
            <Stack.Screen name="messages/[id]" options={{ title: 'Chat', headerBackTitle: 'Back' }} />
            <Stack.Screen name="messages/new" options={{ title: 'New Message', presentation: 'modal' }} />
            <Stack.Screen name="club/[id]" options={{ title: 'Club', headerBackTitle: 'Back' }} />
            <Stack.Screen name="clubs/new" options={{ title: 'Create a Club', presentation: 'modal' }} />
            <Stack.Screen name="challenge/[id]" options={{ title: 'Challenge', headerBackTitle: 'Back' }} />
            <Stack.Screen name="challenges/new" options={{ title: 'Create a Challenge', presentation: 'modal' }} />
            <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', presentation: 'modal' }} />
            <Stack.Screen name="blocked" options={{ title: 'Blocked People', headerBackTitle: 'Back' }} />
            <Stack.Screen name="delete-account" options={{ title: 'Delete Account', headerBackTitle: 'Back' }} />
            <Stack.Screen name="change-password" options={{ title: 'Change Password', headerBackTitle: 'Back' }} />
            <Stack.Screen name="change-email" options={{ title: 'Change Email', headerBackTitle: 'Back' }} />
          </Stack.Protected>
          <Stack.Protected guard={!user}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ title: 'Reset Password', headerBackTitle: 'Back' }} />
          </Stack.Protected>
        </Stack>
      )}
      {/* Text pop-ups on Android (iPhone uses the system Alert.prompt). */}
      <TextPromptHost />
      {showIntro && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: introOpacity }]} pointerEvents="none">
          <BrandSplash />
        </Animated.View>
      )}
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  crash: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  crashTitle: { fontSize: 20, fontWeight: '700' },
  crashButton: { borderRadius: 999, paddingVertical: 13, paddingHorizontal: 28, marginTop: 6 },
});
