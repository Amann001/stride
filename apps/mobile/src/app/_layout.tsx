import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, useColorScheme, View } from 'react-native';

import { BrandSplash } from '@/components/brand-splash';
import { AuthProvider, useAuth } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

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
            <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile', presentation: 'modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={!user}>
            <Stack.Screen name="login" options={{ headerShown: false }} />
          </Stack.Protected>
        </Stack>
      )}
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
});
