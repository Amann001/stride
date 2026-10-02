import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from '@repo/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// Create Your Own Club: a name, a sport, where you're based, and what it's about.
export default function NewClubScreen() {
  const colors = useColors();
  const [name, setName] = useState('');
  const [sport, setSport] = useState<ActivityType>('run');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (name.trim().length < 2) {
      Alert.alert('Give your club a name');
      return;
    }
    setSaving(true);
    try {
      const club = await api.createClub({
        name: name.trim(),
        sport,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      });
      router.replace({ pathname: '/club/[id]', params: { id: club.id } });
    } catch (err) {
      Alert.alert('Could not create club', err instanceof Error ? err.message : 'Please try again.');
      setSaving(false);
    }
  };

  const input = [styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }];

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Give your running group or cycling crew a home on Stride, with a weekly leaderboard.
        </Text>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Club name</Text>
        <TextInput style={input} value={name} onChangeText={setName} maxLength={80} placeholder="e.g. Noida Morning Runners"
          placeholderTextColor={colors.textSecondary} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>Sport</Text>
        <View style={styles.sports}>
          {ACTIVITY_TYPES.map((t) => {
            const active = t === sport;
            return (
              <Pressable key={t} onPress={() => setSport(t)}
                style={[styles.sport, { borderColor: active ? CATEGORY_LOOKS[t].color : colors.border }, active && { backgroundColor: CATEGORY_LOOKS[t].color }]}>
                <MaterialCommunityIcons name={CATEGORY_LOOKS[t].icon} size={20} color={active ? INK : colors.text} />
                <Text style={{ color: active ? INK : colors.text, fontWeight: '700' }}>{ACTIVITY_LABELS[t]}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Location (optional)</Text>
        <TextInput style={input} value={location} onChangeText={setLocation} maxLength={80} placeholder="e.g. Greater Noida"
          placeholderTextColor={colors.textSecondary} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>About (optional)</Text>
        <TextInput style={[input, styles.multiline]} value={description} onChangeText={setDescription} multiline maxLength={1000}
          placeholder="When do you meet? Who's it for?" placeholderTextColor={colors.textSecondary} />
        <Pressable onPress={create} disabled={saving} style={[styles.create, { backgroundColor: colors.brand }]}>
          {saving ? <ActivityIndicator color={INK} /> : <Text style={styles.createText}>Create Club</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  intro: { fontSize: 15, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  sports: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sport: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  create: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  createText: { color: INK, fontWeight: '800', fontSize: 16 },
});
