import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  effortName,
  formatDistance,
  formatDuration,
  formatDurationShort,
  formatElevation,
  formatPaceOrSpeed,
  type ActivityType,
  type PersonalRecord,
  type Totals,
  type UserStats,
} from '@repo/shared';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MEDAL_COLORS } from '@/components/achievements';
import { Stat } from '@/components/stat';
import { CATEGORY_LOOKS, type IconName } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { API_URL, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// "You" tab: your profile, totals and personal records for each kind of activity.
export default function ProfileScreen() {
  const colors = useColors();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [type, setType] = useState<ActivityType>('run');

  useFocusEffect(
    useCallback(() => {
      api.getStats().then(setStats, () => {});
    }, []),
  );

  const cat = stats?.byType[type];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.top}>
        <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
          <Text style={[styles.avatarText, { color: colors.onBrand }]}>{user?.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
        <Text style={{ color: colors.textSecondary }}>{user?.email}</Text>
        {!!stats?.streakWeeks && (
          <View style={styles.streak}>
            <MaterialCommunityIcons name="fire" size={18} color={colors.accent} />
            <Text style={{ color: colors.text, fontWeight: '600' }}>{stats.streakWeeks}-week streak</Text>
          </View>
        )}
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.card }]}>
        {ACTIVITY_TYPES.map((t) => {
          const selected = t === type;
          return (
            <Pressable key={t} onPress={() => setType(t)}
              style={[styles.tab, selected && { backgroundColor: CATEGORY_LOOKS[t].color }]}>
              <MaterialCommunityIcons name={CATEGORY_LOOKS[t].icon} size={22} color={selected ? INK : colors.textSecondary} />
              <Text style={{ color: selected ? INK : colors.textSecondary, fontWeight: '600', fontSize: 12 }}>
                {ACTIVITY_LABELS[t]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TotalsCard title="This week" totals={cat?.thisWeek} />
      <TotalsCard title="All time" totals={cat?.allTime} />

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Personal records</Text>
        {cat?.bestEfforts.map((e) => (
          <RecordRow key={e.distanceMeters} icon="medal" label={effortName(e.distanceMeters)} record={e}
            value={formatDuration(e.value)} detail={formatPaceOrSpeed(type, e.distanceMeters, e.value)} />
        ))}
        {cat?.longest && (
          <RecordRow icon="map-marker-distance" label={`Longest ${ACTIVITY_LABELS[type].toLowerCase()}`}
            record={cat.longest} value={formatDistance(cat.longest.value)} />
        )}
        {cat?.biggestClimb && (
          <RecordRow icon="image-filter-hdr" label="Biggest climb" record={cat.biggestClimb}
            value={formatElevation(cat.biggestClimb.value)} />
        )}
        {!cat?.longest && (
          <Text style={{ color: colors.textSecondary }}>
            Record your first {ACTIVITY_LABELS[type].toLowerCase()} to start setting records.
          </Text>
        )}
      </View>

      <Pressable style={[styles.button, { borderColor: colors.border }]} onPress={signOut}>
        <Text style={{ color: colors.danger, fontWeight: '600' }}>Log out</Text>
      </Pressable>

      <Text style={[styles.debug, { color: colors.textSecondary }]}>Server: {API_URL}</Text>
    </ScrollView>
  );
}

function TotalsCard({ title, totals }: { title: string; totals: Totals | undefined }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.row}>
        <Stat label="Activities" value={String(totals?.count ?? 0)} />
        <Stat label="Distance" value={formatDistance(totals?.distanceMeters ?? 0)} />
        <Stat label="Time" value={formatDurationShort(totals?.movingSeconds ?? 0)} />
        <Stat label="Elev" value={formatElevation(totals?.elevationGainMeters ?? 0)} />
      </View>
    </View>
  );
}

// One record; tapping it opens the activity where you set it.
function RecordRow({ icon, label, record, value, detail }: {
  icon: IconName; label: string; record: PersonalRecord; value: string; detail?: string;
}) {
  const colors = useColors();
  const date = new Date(record.startedAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
  return (
    <Pressable style={styles.record}
      onPress={() => router.push({ pathname: '/activity/[id]', params: { id: record.activityId } })}>
      <MaterialCommunityIcons name={icon} size={24} color={MEDAL_COLORS[1]} />
      <View style={styles.recordText}>
        <Text style={[styles.recordLabel, { color: colors.text }]}>{label}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{date}</Text>
      </View>
      <View style={styles.recordValue}>
        <Text style={[styles.recordLabel, { color: colors.text }]}>{value}</Text>
        {!!detail && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{detail}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12, paddingBottom: 32 },
  top: { alignItems: 'center', paddingTop: 24, paddingBottom: 8 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 36, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, alignItems: 'center', borderRadius: 10, paddingVertical: 8, gap: 2 },
  card: { borderRadius: 16, padding: 16, gap: 14 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  row: { flexDirection: 'row' },
  record: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordText: { flex: 1 },
  recordLabel: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  recordValue: { alignItems: 'flex-end' },
  button: { alignSelf: 'center', marginTop: 12, borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32 },
  debug: { textAlign: 'center', marginTop: 12, fontSize: 12 },
});
