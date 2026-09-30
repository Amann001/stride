import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

// Edit profile: your name, a short bio, and where you're based.
export default function EditProfileScreen() {
  const colors = useColors();
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Your name is required');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), bio: bio.trim(), location: location.trim() });
      router.back();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
      setSaving(false);
    }
  };

  const input = [styles.input, { backgroundColor: colors.raised, borderColor: colors.border, color: colors.text }];

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={save} disabled={saving} hitSlop={10}>
              {saving ? <ActivityIndicator color={colors.accent} /> : (
                <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>Save</Text>
              )}
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {user && (
          <View style={styles.avatar}>
            <Avatar id={user.id} name={name || user.name} size={88} />
          </View>
        )}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
        <TextInput style={input} value={name} onChangeText={setName} maxLength={80} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
        <TextInput style={input} value={location} onChangeText={setLocation} maxLength={80} placeholder="e.g. Greater Noida, India"
          placeholderTextColor={colors.textSecondary} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
        <TextInput style={[input, styles.multiline]} value={bio} onChangeText={setBio} maxLength={300} multiline
          placeholder="Tell people what you love: morning runs, long rides, weekend hikes…" placeholderTextColor={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: 'right' }}>{bio.length}/300</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 8, paddingBottom: 48 },
  avatar: { alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
});
