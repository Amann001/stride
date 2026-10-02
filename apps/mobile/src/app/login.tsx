import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColors } from '@/constants/theme';
import { privacyUrl, termsUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const LOGO_ON_DARK = require('@/assets/images/logo-on-dark.png');
const LOGO_ON_LIGHT = require('@/assets/images/logo-on-light.png');
const LOGO_HEIGHT = 48;

// Sizes the logo from the image file's own proportions, so it never stretches.
function logoSize(source: number) {
  const { width, height } = Image.resolveAssetSource(source);
  return { height: LOGO_HEIGHT, width: (LOGO_HEIGHT * width) / height };
}

// One screen for both "Log in" and "Sign up"; the link at the bottom switches mode.
export default function LoginScreen() {
  const colors = useColors();
  const isDark = useColorScheme() === 'dark';
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') await signIn(email.trim(), password);
      else await signUp(name.trim(), email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = [styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior="padding" style={styles.container}>
        <Image
          source={isDark ? LOGO_ON_DARK : LOGO_ON_LIGHT}
          style={[styles.logo, logoSize(isDark ? LOGO_ON_DARK : LOGO_ON_LIGHT)]}
          resizeMode="contain"
          accessibilityLabel="Stride"
        />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {mode === 'login' ? 'Welcome back. Log in to keep moving.' : 'Create an account to start recording.'}
        </Text>

        {mode === 'signup' && (
          <TextInput style={inputStyle} placeholder="Name" placeholderTextColor={colors.textSecondary}
            value={name} onChangeText={setName} autoComplete="name" />
        )}
        <TextInput style={inputStyle} placeholder="Email" placeholderTextColor={colors.textSecondary}
          value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <TextInput style={inputStyle} placeholder="Password" placeholderTextColor={colors.textSecondary}
          value={password} onChangeText={setPassword} secureTextEntry
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />

        {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

        <Pressable style={[styles.button, { backgroundColor: colors.brand, opacity: busy ? 0.6 : 1 }]}
          onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : (
            <Text style={[styles.buttonText, { color: colors.onBrand }]}>{mode === 'login' ? 'Log in' : 'Sign up'}</Text>
          )}
        </Pressable>

        {mode === 'signup' && (
          <Text style={[styles.legal, { color: colors.textSecondary }]}>
            By signing up, you confirm you’re 18 or older and agree to the{' '}
            <Text style={{ color: colors.accent }} onPress={() => WebBrowser.openBrowserAsync(termsUrl())}>Terms of Use</Text>
            {' '}and{' '}
            <Text style={{ color: colors.accent }} onPress={() => WebBrowser.openBrowserAsync(privacyUrl())}>Privacy Policy</Text>.
          </Text>
        )}

        <View style={styles.switchRow}>
          <Text style={{ color: colors.textSecondary }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>{mode === 'login' ? 'Sign up' : 'Log in'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { alignSelf: 'flex-start', marginBottom: 16 },
  subtitle: { fontSize: 16, marginBottom: 28 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, marginBottom: 12 },
  error: { marginBottom: 12 },
  button: { borderRadius: 10, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  legal: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
});
