import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// Change your email: your password and the new address, then the 6-digit code we send to
// that address (so nobody can switch your account to an email they don't own).
export default function ChangeEmailScreen() {
  const colors = useColors();
  const { user, confirmEmailChange } = useAuth();
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
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
      await api.startEmailChange(newEmail.trim(), password);
      setStep('code');
    });

  const confirm = () =>
    run(async () => {
      await confirmEmailChange(code.trim());
      Alert.alert('Email changed', `Your Stride email is now ${newEmail.trim().toLowerCase()}. Other phones signed in to your account have been logged out.`);
      router.back();
    });

  const input = [styles.input, { color: colors.text, backgroundColor: colors.raised, borderColor: colors.border }];
  const canSend = !!newEmail.trim() && !!password && !busy;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'details' ? (
          <>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Your email now: <Text style={{ color: colors.text, fontWeight: '600' }}>{user?.email}</Text>
            </Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              We’ll send a 6-digit code to the new address to check it’s yours.
            </Text>
            <TextInput style={input} placeholder="New email" placeholderTextColor={colors.textSecondary}
              autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={newEmail}
              onChangeText={(t) => { setNewEmail(t); setError(null); }} />
            <TextInput style={input} placeholder="Your password" placeholderTextColor={colors.textSecondary}
              secureTextEntry autoComplete="current-password" value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }} />
          </>
        ) : (
          <>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Check {newEmail.trim()} for a code (it can take a minute, and may be in spam). It works for 15 minutes.
            </Text>
            <TextInput style={input} placeholder="6-digit code" placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} value={code}
              onChangeText={(t) => { setCode(t.replace(/\D/g, '')); setError(null); }} />
          </>
        )}
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        <Pressable
          style={[styles.button, { backgroundColor: colors.brand, opacity: (step === 'details' ? canSend : code.length === 6 && !busy) ? 1 : 0.5 }]}
          disabled={step === 'details' ? !canSend : code.length !== 6 || busy}
          onPress={step === 'details' ? sendCode : confirm}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : (
            <Text style={[styles.buttonText, { color: colors.onBrand }]}>{step === 'details' ? 'Send Code' : 'Change Email'}</Text>
          )}
        </Pressable>
        {step === 'code' && (
          <Pressable onPress={sendCode} disabled={busy} style={styles.link}>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>Send a new code</Text>
          </Pressable>
        )}
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
