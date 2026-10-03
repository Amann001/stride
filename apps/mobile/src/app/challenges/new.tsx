import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  CHALLENGE_METRIC_LABELS,
  CHALLENGE_METRICS,
  CUSTOM_CHALLENGE_MAX_DAYS,
  describeCustomChallenge,
  type ActivityType,
  type AthleteSummary,
  type ChallengeMetric,
} from '@repo/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { Avatar } from '@/components/avatar';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, LIME, useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// What you type the goal in, for each kind of goal. `toGoal` turns it into the stored units.
const GOAL_INPUT: Record<ChallengeMetric, { unit: string; hint: string; toGoal: (n: number) => number }> = {
  distance: { unit: 'km', hint: 'Add up the distance of every activity.', toGoal: (n) => n * 1000 },
  time: { unit: 'minutes', hint: 'Add up the moving time of every activity.', toGoal: (n) => n * 60 },
  elevation: { unit: 'm', hint: 'Add up the climbing of every activity.', toGoal: (n) => n },
  activeDays: { unit: 'days', hint: 'Count the days with at least one activity.', toGoal: (n) => n },
  longest: { unit: 'km', hint: 'One activity at least this long, e.g. a half marathon.', toGoal: (n) => n * 1000 },
};

const DAY_MS = 86_400_000;
// A date on the phone's calendar as "2026-10-05".
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Create a Challenge: a name, which sport counts, the goal, the dates, and friends to invite.
export default function NewChallengeScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [sport, setSport] = useState<ActivityType | null>('run');
  const [metric, setMetric] = useState<ChallengeMetric>('distance');
  const [amount, setAmount] = useState('');
  const [start, setStart] = useState(startOfToday);
  const [end, setEnd] = useState(() => new Date(startOfToday().getTime() + 13 * DAY_MS));
  const [friends, setFriends] = useState<AthleteSummary[] | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) api.connections(user.id, 'following').then(setFriends, () => setFriends([]));
  }, [user]);

  const goal = GOAL_INPUT[metric].toGoal(Number(amount.replace(',', '.')) || 0);
  const preview = goal > 0
    ? describeCustomChallenge({ sport, metric, goal, startDate: isoDate(start), endDate: isoDate(end) })
    : null;

  const pickStart = (d: Date) => {
    setStart(d);
    // Keep the end on or after the start, and within the longest a challenge can last.
    if (end < d) setEnd(d);
    else if (end.getTime() - d.getTime() >= CUSTOM_CHALLENGE_MAX_DAYS * DAY_MS) setEnd(new Date(d.getTime() + (CUSTOM_CHALLENGE_MAX_DAYS - 1) * DAY_MS));
  };

  const toggleInvite = (id: string) =>
    setInvited((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = async () => {
    if (title.trim().length < 3) {
      Alert.alert('Give your challenge a name');
      return;
    }
    if (goal <= 0) {
      Alert.alert('Set a goal', `How many ${GOAL_INPUT[metric].unit}?`);
      return;
    }
    setSaving(true);
    try {
      const { id } = await api.createCustomChallenge({
        title: title.trim(),
        sport,
        metric,
        goal,
        startDate: isoDate(start),
        endDate: isoDate(end),
        inviteIds: [...invited],
      });
      router.replace({ pathname: '/challenge/[id]', params: { id } });
    } catch (err) {
      Alert.alert('Could not create challenge', err instanceof Error ? err.message : 'Please try again.');
      setSaving(false);
    }
  };

  const input = [styles.input, { backgroundColor: colors.raised, borderColor: colors.border, color: colors.text }];
  const picker = { accentColor: colors.accent, themeVariant: scheme === 'dark' ? 'dark' : 'light' } as const;
  const today = startOfToday();

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Set your own goal and dates. Activities count automatically, and friends you invite get a notification.
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Challenge name</Text>
        <TextInput style={input} value={title} onChangeText={setTitle} maxLength={60} placeholder="e.g. Diwali 100K"
          placeholderTextColor={colors.textSecondary} />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Which activities count</Text>
        <View style={styles.chips}>
          <Chip label="All sports" icon="lightning-bolt" fill={LIME} selected={sport === null} onPress={() => setSport(null)} />
          {ACTIVITY_TYPES.map((t) => (
            <Chip key={t} label={ACTIVITY_LABELS[t]} icon={CATEGORY_LOOKS[t].icon} fill={CATEGORY_LOOKS[t].color}
              selected={sport === t} onPress={() => setSport(t)} />
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Goal</Text>
        <View style={styles.chips}>
          {CHALLENGE_METRICS.map((m) => (
            <Chip key={m} label={CHALLENGE_METRIC_LABELS[m]} fill={colors.brand} selected={metric === m} onPress={() => setMetric(m)} />
          ))}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{GOAL_INPUT[metric].hint}</Text>
        <View style={styles.amountRow}>
          <TextInput style={[input, styles.amount]} value={amount} onChangeText={setAmount} placeholder="0"
            placeholderTextColor={colors.textSecondary} keyboardType={metric === 'activeDays' ? 'number-pad' : 'decimal-pad'} maxLength={7} />
          <Text style={[styles.unit, { color: colors.text }]}>{GOAL_INPUT[metric].unit}</Text>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Dates</Text>
        <View style={[styles.field, { backgroundColor: colors.raised, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="calendar-start" size={22} color={colors.text} />
          <Text style={[styles.fieldText, { color: colors.text }]}>Starts</Text>
          <DateTimePicker value={start} mode="date" display="compact" {...picker}
            minimumDate={today} maximumDate={new Date(today.getTime() + 61 * DAY_MS)}
            onValueChange={(_, d) => pickStart(d)} />
        </View>
        <View style={[styles.field, { backgroundColor: colors.raised, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="calendar-end" size={22} color={colors.text} />
          <Text style={[styles.fieldText, { color: colors.text }]}>Ends</Text>
          <DateTimePicker value={end} mode="date" display="compact" {...picker}
            minimumDate={start} maximumDate={new Date(start.getTime() + (CUSTOM_CHALLENGE_MAX_DAYS - 1) * DAY_MS)}
            onValueChange={(_, d) => setEnd(d)} />
        </View>

        {preview && (
          <View style={[styles.preview, { backgroundColor: colors.raised }]}>
            <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.accent} />
            <Text style={[styles.previewText, { color: colors.text }]}>{preview}</Text>
          </View>
        )}

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Invite friends{invited.size ? ` (${invited.size})` : ''}
        </Text>
        {friends === null ? (
          <ActivityIndicator color={colors.accent} />
        ) : friends.length ? (
          friends.map((f) => {
            const on = invited.has(f.id);
            return (
              <Pressable key={f.id} onPress={() => toggleInvite(f.id)} style={styles.friend}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <Avatar id={f.id} name={f.name} size={36} />
                <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>{f.name}</Text>
                <MaterialCommunityIcons name={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={26}
                  color={on ? colors.accent : colors.textSecondary} />
              </Pressable>
            );
          })
        ) : (
          <Text style={{ color: colors.textSecondary }}>
            You can invite people you follow. Follow some friends first, or do this challenge on your own.
          </Text>
        )}

        <Pressable onPress={create} disabled={saving} style={[styles.create, { backgroundColor: colors.brand }]}>
          {saving ? <ActivityIndicator color={INK} /> : <Text style={styles.createText}>Create Challenge</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, icon, fill, selected, onPress }: {
  label: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  fill: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}
      style={[styles.chip, { borderColor: selected ? fill : colors.border }, selected && { backgroundColor: fill }]}>
      {icon && <MaterialCommunityIcons name={icon} size={18} color={selected ? INK : colors.text} />}
      <Text style={{ color: selected ? INK : colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  intro: { fontSize: 15, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amount: { flex: 1 },
  unit: { fontSize: 16, fontWeight: '600', minWidth: 64 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  fieldText: { flex: 1, fontSize: 16 },
  preview: { flexDirection: 'row', gap: 10, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  previewText: { flex: 1, fontSize: 15, fontWeight: '600' },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  friendName: { flex: 1, fontSize: 15, fontWeight: '600' },
  create: { borderRadius: 999, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  createText: { color: INK, fontWeight: '700', fontSize: 16 },
});
