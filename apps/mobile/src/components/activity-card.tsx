import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACTIVITY_LABELS, decodePolyline, type ActivitySummary } from '@repo/shared';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { AchievementBanner, MEDAL_COLORS } from '@/components/achievements';
import { Avatar } from '@/components/avatar';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { RouteMap } from '@/components/route-map';
import { useColors } from '@/constants/theme';
import { cardStats } from '@/lib/activity-stats';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatLongDateTime } from '@/lib/dates';

// Opens the iPhone share sheet with a short summary, e.g. to send to a friend.
export function shareActivity(a: ActivitySummary) {
  const stats = cardStats(a).map((s) => `${s.label}: ${s.value}`).join(' · ');
  const medals = a.achievements.length ? `\n🏅 ${a.achievements.map((x) => x.title).join(', ')}` : '';
  Share.share({ message: `${a.athlete.name}: ${a.title} (${ACTIVITY_LABELS[a.type]}) on Stride\n${stats}${medals}` });
}

// Kudos: a thumbs-up. It fills in straight away and quietly undoes itself if the server
// says no. On your own activity it shows who gave kudos instead.
export function KudosButton({ activity, onChange }: { activity: ActivitySummary; onChange?: (a: ActivitySummary) => void }) {
  const colors = useColors();
  const { user } = useAuth();
  const [state, setState] = useState({ given: activity.hasKudoed, count: activity.kudosCount });
  const mine = activity.userId === user?.id;

  const toggle = async () => {
    if (mine) {
      router.push({ pathname: '/activity/[id]', params: { id: activity.id, show: 'kudos' } });
      return;
    }
    const next = { given: !state.given, count: state.count + (state.given ? -1 : 1) };
    setState(next);
    try {
      if (next.given) await api.giveKudos(activity.id);
      else await api.removeKudos(activity.id);
      onChange?.({ ...activity, hasKudoed: next.given, kudosCount: next.count });
    } catch {
      setState(state);
    }
  };

  return (
    <Pressable onPress={toggle} hitSlop={10} style={styles.action} accessibilityLabel={state.given ? 'Remove kudos' : 'Give kudos'}>
      <MaterialCommunityIcons name={state.given ? 'thumb-up' : 'thumb-up-outline'} size={24} color={state.given ? colors.accent : colors.text} />
      {state.count > 0 && <Text style={[styles.count, { color: colors.text }]}>{state.count}</Text>}
    </Pressable>
  );
}

// One activity in the feed: who and when, the numbers that matter for this kind of
// activity, its best achievement, a map of the route, and kudos / comment / share.
export function ActivityCard({ activity }: { activity: ActivitySummary }) {
  const colors = useColors();
  const route = useMemo(() => decodePolyline(activity.polyline), [activity.polyline]);
  const date = formatLongDateTime(activity.startedAt);
  const [headline, ...others] = activity.achievements;
  const openAthlete = () => router.push({ pathname: '/athlete/[id]', params: { id: activity.athlete.id } });

  return (
    // <Link asChild> only accepts a single style object on its child, not an array, so merge them first.
    <Link href={{ pathname: '/activity/[id]', params: { id: activity.id } }} asChild>
      <Pressable style={StyleSheet.flatten([styles.card, { backgroundColor: colors.card }])}>
        <View style={styles.padded}>
          <View style={styles.header}>
            <Pressable onPress={openAthlete} hitSlop={6}>
              <Avatar id={activity.athlete.id} name={activity.athlete.name} size={44} />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={[styles.name, { color: colors.text }]} onPress={openAthlete}>{activity.athlete.name}</Text>
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name={CATEGORY_LOOKS[activity.type].icon} size={14} color={colors.textSecondary} />
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {date} · {ACTIVITY_LABELS[activity.type]}
                </Text>
              </View>
            </View>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{activity.title}</Text>
          {!!activity.description && (
            <Text style={{ color: colors.text, fontSize: 15, marginTop: -6 }} numberOfLines={3}>{activity.description}</Text>
          )}

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

        <View style={styles.actions}>
          <KudosButton activity={activity} />
          <Pressable hitSlop={10} style={styles.action} accessibilityLabel="Comment"
            onPress={() => router.push({ pathname: '/activity/[id]', params: { id: activity.id, show: 'comments' } })}>
            <MaterialCommunityIcons name="comment-outline" size={24} color={colors.text} />
            {activity.commentCount > 0 && <Text style={[styles.count, { color: colors.text }]}>{activity.commentCount}</Text>}
          </Pressable>
          <Pressable hitSlop={10} style={styles.action} accessibilityLabel="Share activity" onPress={() => shareActivity(activity)}>
            <MaterialCommunityIcons name="export-variant" size={24} color={colors.text} />
          </Pressable>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  // Full width, no rounded corners: the band between posts separates them, like Strava.
  card: { overflow: 'hidden' },
  padded: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { fontSize: 13, flexShrink: 1 },
  title: { fontSize: 22, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 16 },
  stat: { flexShrink: 1 },
  statLabel: { fontSize: 13, marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  medalCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  map: { height: 190 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 60, justifyContent: 'center' },
  count: { fontWeight: '700', fontSize: 15 },
});
