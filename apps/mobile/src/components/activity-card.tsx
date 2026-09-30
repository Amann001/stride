import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACTIVITY_LABELS, decodePolyline, type ActivitySummary } from '@repo/shared';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { AchievementBanner, MEDAL_COLORS } from '@/components/achievements';
import { CategoryIcon } from '@/components/category-icon';
import { RouteMap } from '@/components/route-map';
import { useColors } from '@/constants/theme';
import { cardStats } from '@/lib/activity-stats';
import { useAuth } from '@/lib/auth';

// Opens the iPhone share sheet with a short summary, e.g. to send to a friend.
export function shareActivity(a: ActivitySummary) {
  const stats = cardStats(a).map((s) => `${s.label}: ${s.value}`).join(' · ');
  const medals = a.achievements.length ? `\n🏅 ${a.achievements.map((x) => x.title).join(', ')}` : '';
  Share.share({ message: `${a.title} (${ACTIVITY_LABELS[a.type]}) on Stride\n${stats}${medals}` });
}

// One activity in the feed: who and when, the numbers that matter for this kind of
// activity, its best achievement, and a map of the route. Tapping opens the detail screen.
export function ActivityCard({ activity }: { activity: ActivitySummary }) {
  const colors = useColors();
  const { user } = useAuth();
  const route = useMemo(() => decodePolyline(activity.polyline), [activity.polyline]);
  const date = new Date(activity.startedAt).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
  const [headline, ...others] = activity.achievements;

  return (
    // <Link asChild> only accepts a single style object on its child, not an array, so merge them first.
    <Link href={{ pathname: '/activity/[id]', params: { id: activity.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.card, { backgroundColor: colors.card }])}>
        <View style={styles.padded}>
          <View style={styles.header}>
            <CategoryIcon type={activity.type} size={44} />
            <View style={styles.headerText}>
              <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {date} · {ACTIVITY_LABELS[activity.type]}
              </Text>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{activity.title}</Text>

          <View style={styles.stats}>
            {cardStats(activity).map((s) => (
              <View key={s.label} style={styles.stat}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
              </View>
            ))}
            {activity.achievements.length > 0 && (
              <View style={styles.stat}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Achievements</Text>
                <View style={styles.medalCount}>
                  <MaterialCommunityIcons name="medal" size={20} color={MEDAL_COLORS[1]} />
                  <Text style={[styles.statValue, { color: colors.text }]}>{activity.achievements.length}</Text>
                </View>
              </View>
            )}
          </View>

          {headline && <AchievementBanner achievement={headline} more={others.length} />}
        </View>

        {route.length > 1 && <RouteMap coords={route} preview style={styles.map} />}

        <View style={[styles.actions, { borderColor: colors.border }]}>
          <Pressable hitSlop={10} accessibilityLabel="Share activity" onPress={() => shareActivity(activity)}>
            <MaterialCommunityIcons name="export-variant" size={24} color={colors.text} />
          </Pressable>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  padded: { padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: 2 },
  title: { fontSize: 22, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 16 },
  stat: { flexShrink: 1 },
  statLabel: { fontSize: 13, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  medalCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  map: { height: 190 },
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
