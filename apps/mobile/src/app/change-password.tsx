import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

// Change your password. Every other phone signed in to your account is logged out.
export default function ChangePasswordScreen() {
  const colors = useColors();
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (next.length < 8) {
      setError('Your new password needs at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      Alert.alert('Password changed', 'Any other phones signed in to your account have been logged out.');
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { color: colors.text, backgroundColor: colors.raised, borderColor: colors.border }];
  const ready = !!current && !!next && !busy;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Choose a new password with at least 8 characters. Changing it logs you out on every other phone, which
          is handy if you think someone else knows your password.
        </Text>
        <TextInput style={input} placeholder="Current password" placeholderTextColor={colors.textSecondary}
          secureTextEntry autoComplete="current-password" value={current}
          onChangeText={(t) => { setCurrent(t); setError(null); }} />
        <TextInput style={input} placeholder="New password" placeholderTextColor={colors.textSecondary}
          secureTextEntry autoComplete="new-password" value={next}
          onChangeText={(t) => { setNext(t); setError(null); }} />
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        <Pressable style={[styles.button, { backgroundColor: colors.brand, opacity: ready ? 1 : 0.5 }]} disabled={!ready} onPress={save}>
          {busy ? <ActivityIndicator color={colors.onBrand} /> : <Text style={[styles.buttonText, { color: colors.onBrand }]}>Change Password</Text>}
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
});
