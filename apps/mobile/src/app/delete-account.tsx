import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clearPending } from '@/lib/pending-activities';

// Permanently delete your account. Asks for your password, then confirms once more.
export default function DeleteAccountScreen() {
  const colors = useColors();
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      if (user) await clearPending(user.id).catch(() => {});
      // Signing out switches the app to the login screen by itself.
      await signOut();
      Alert.alert('Account deleted', 'Your account and everything in it have been permanently deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    Alert.alert('Delete your account?', 'This permanently deletes everything and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>Delete your account</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          This permanently deletes your Stride account and everything in it: all your activities and routes,
          followers and following, kudos, comments, messages, and clubs you created. It can’t be undone.
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Just want a break? You can log out instead, or set your activities to Only You.
        </Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.raised, borderColor: colors.border }]}
          placeholder="Your password"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
          autoComplete="current-password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
        />
        {error && <Text style={{ color: colors.danger }}>{error}</Text>}
        <Pressable
          style={[styles.button, { backgroundColor: colors.danger, opacity: busy || !password ? 0.5 : 1 }]}
          disabled={busy || !password}
          onPress={confirm}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Delete Account</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, marginTop: 8 },
  button: { borderRadius: 999, paddingVertical: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
