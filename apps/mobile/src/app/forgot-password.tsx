import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// Forgot password: we email a 6-digit code, then you type it with a new password.
export default function ForgotPasswordScreen() {
  const colors = useColors();
  const { resetPassword } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await api.forgotPassword(email.trim());
      setStep('code');
    });

  // Signing in switches the app to your feed by itself.
  const reset = () =>
    run(async () => {
      if (password.length < 8) throw new Error('Your new password needs at least 8 characters.');
      await resetPassword(email.trim(), code.trim(), password);
    });

  const input = [styles.input, { color: colors.text, backgroundColor: colors.raised, borderColor: colors.border }];

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'email' ? (
          <>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Enter the email you signed up with. If it has a Stride account, we’ll send it a 6-digit code.
            </Text>
            <TextInput style={input} placeholder="Email" placeholderTextColor={colors.textSecondary}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email}
              onChangeText={(t) => { setEmail(t); setError(null); }} />
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Check {email.trim()} for a code (it can take a minute, and may be in spam). It works for 15 minutes.
            </Text>
            <TextInput style={input} placeholder="6-digit code" placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} value={code}
              onChangeText={(t) => { setCode(t.replace(/\D/g, '')); setError(null); }} />
            <TextInput style={input} placeholder="New password" placeholderTextColor={colors.textSecondary}
              secureTextEntry autoComplete="new-password" value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }} />
          </>
        )}
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        <Pressable
          style={[styles.button, { backgroundColor: colors.brand, opacity: busy ? 0.6 : 1 }]}
          disabled={busy || (step === 'email' ? !email.trim() : code.length !== 6 || !password)}
          onPress={step === 'email' ? sendCode : reset}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : (
            <Text style={[styles.buttonText, { color: colors.onBrand }]}>{step === 'email' ? 'Send Code' : 'Set New Password'}</Text>
          )}
        </Pressable>
        {step === 'code' && (
          <Pressable onPress={sendCode} disabled={busy} style={styles.link}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Send a new code</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.back()} style={styles.link}>
          <Text style={{ color: colors.textSecondary }}>Back to log in</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  body: { fontSize: 15, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  button: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '700' },
  link: { alignItems: 'center', paddingVertical: 6 },
});
