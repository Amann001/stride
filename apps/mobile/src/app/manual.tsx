import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ACTIVITY_LABELS,
  defaultActivityTitle,
  formatPaceOrSpeed,
  paceOrSpeedLabel,
  type ActivityType,
} from '@repo/shared';
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
  useColorScheme,
  View,
} from 'react-native';

import { SportSheet } from '@/components/sport-sheet';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';

// "Add Activity": log something you didn't record with GPS, like a treadmill run or a
// ride on a bike computer. It counts for totals, streaks, goals and challenges.
export default function ManualActivityScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const [type, setType] = useState<ActivityType>('run');
  const [title, setTitle] = useState('');
  const [startedAt, setStartedAt] = useState(() => new Date());
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [km, setKm] = useState('');
  const [elevation, setElevation] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const num = (s: string) => Number(s.replace(',', '.')) || 0;
  const duration = num(hours) * 3600 + num(minutes) * 60 + num(seconds);
  const meters = num(km) * 1000;

  const save = async () => {
    if (duration < 1) {
      Alert.alert('Add a duration', 'How long did the activity take?');
      return;
    }
    setSaving(true);
    try {
      const saved = await api.createManualActivity({
        type,
        title: title.trim() || defaultActivityTitle(type, startedAt),
        startedAt: startedAt.toISOString(),
        elapsedSeconds: Math.round(duration),
        distanceMeters: meters,
        elevationGainMeters: num(elevation),
      });
      router.replace({ pathname: '/activity/[id]', params: { id: saved.id } });
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
      setSaving(false);
    }
  };

  const input = [styles.input, { backgroundColor: colors.raised, borderColor: colors.border, color: colors.text }];

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.heading, { color: colors.text }]}>Activity</Text>
        <Pressable onPress={() => setSheetOpen(true)} style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name={CATEGORY_LOOKS[type].icon} size={22} color={colors.text} />
          <Text style={[styles.fieldText, { color: colors.text }]}>{ACTIVITY_LABELS[type]}</Text>
          <MaterialCommunityIcons name="chevron-down" size={22} color={colors.textSecondary} />
        </Pressable>
        <TextInput style={input} placeholder={defaultActivityTitle(type, startedAt)} placeholderTextColor={colors.textSecondary}
          value={title} onChangeText={setTitle} maxLength={120} />

        <Text style={[styles.heading, { color: colors.text }]}>Activity Stats</Text>
        <View style={[styles.field, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="calendar-clock" size={22} color={colors.text} />
          <Text style={[styles.fieldText, { color: colors.text }]}>Started</Text>
          <DateTimePicker value={startedAt} mode="datetime" display="compact" maximumDate={new Date()}
            accentColor={colors.accent} themeVariant={scheme === 'dark' ? 'dark' : 'light'}
            onValueChange={(_, d) => setStartedAt(d)} />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Duration</Text>
        <View style={styles.row}>
          <TextInput style={[input, styles.third]} placeholder="h" placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad" value={hours} onChangeText={setHours} maxLength={3} />
          <TextInput style={[input, styles.third]} placeholder="min" placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad" value={minutes} onChangeText={setMinutes} maxLength={2} />
          <TextInput style={[input, styles.third]} placeholder="sec" placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad" value={seconds} onChangeText={setSeconds} maxLength={2} />
        </View>

        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Distance (km)</Text>
            <TextInput style={input} placeholder="0.00" placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad" value={km} onChangeText={setKm} />
          </View>
          <View style={styles.half}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Elevation gain (m)</Text>
            <TextInput style={input} placeholder="0" placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad" value={elevation} onChangeText={setElevation} />
          </View>
        </View>

        {meters > 0 && duration > 0 && (
          <Text style={{ color: colors.textSecondary }}>
            {paceOrSpeedLabel(type)}: {formatPaceOrSpeed(type, meters, duration)}
          </Text>
        )}

        <Pressable disabled={saving} onPress={save} style={[styles.save, { backgroundColor: colors.brand }]}>
          {saving ? <ActivityIndicator color={INK} /> : <Text style={styles.saveText}>Save Activity</Text>}
        </Pressable>
      </ScrollView>
      <SportSheet visible={sheetOpen} selected={type} onSelect={setType} onClose={() => setSheetOpen(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  heading: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: -4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 52 },
  fieldText: { flex: 1, fontSize: 16 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16 },
  row: { flexDirection: 'row', gap: 10 },
  third: { flex: 1, textAlign: 'center' },
  half: { flex: 1, gap: 8 },
  save: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  saveText: { color: INK, fontWeight: '700', fontSize: 16 },
});
