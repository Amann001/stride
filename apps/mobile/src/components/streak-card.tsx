import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { UserStats } from '@repo/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';

// "Your streak", like Strava's: weeks in a row you've been active, and a Record button
// if you haven't logged anything yet this week. "View calendar" opens your Progress.
export function StreakCard({ stats }: { stats: UserStats | null }) {
  const colors = useColors();
  const streak = stats?.streakWeeks ?? 0;
  const loggedThisWeek = stats?.activeDays.some(Boolean) ?? false;

  const message =
    streak === 0
      ? 'Start your streak by logging an activity.'
      : loggedThisWeek
        ? `${streak} ${streak === 1 ? 'week' : 'weeks'} in a row. Keep it going!`
        : `Log an activity this week to keep your streak alive.`;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={[styles.heading, { color: colors.text }]}>Your streak</Text>
        <Pressable onPress={() => router.navigate('/profile')} hitSlop={8}>
          <Text style={[styles.link, { color: colors.accent }]}>View calendar</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.flame}>
          <View>
            <MaterialCommunityIcons name="fire" size={48} color={streak > 0 ? colors.brand : colors.raised} />
            <Text style={[styles.count, { color: streak > 0 ? colors.onBrand : colors.text }]}>{streak}</Text>
          </View>
          <Text style={[styles.weeks, { color: colors.textSecondary }]}>{streak === 1 ? 'Week' : 'Weeks'}</Text>
        </View>
        <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
        {!loggedThisWeek && (
          <Pressable style={[styles.button, { backgroundColor: colors.brand }]} onPress={() => router.navigate('/record')}>
            <Text style={[styles.buttonText, { color: colors.onBrand }]}>Record now</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// Both carousel pages are the same height so the dots don't jump when you swipe.
export const HIGHLIGHT_HEIGHT = 150;

const styles = StyleSheet.create({
  card: { height: HIGHLIGHT_HEIGHT, paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 17, fontWeight: '700' },
  link: { fontSize: 14, fontWeight: '700' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flame: { alignItems: 'center', width: 56 },
  // Sits inside the flame icon.
  count: { position: 'absolute', top: 19, left: 0, right: 0, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  weeks: { fontSize: 13, fontWeight: '600' },
  message: { flex: 1, fontSize: 15, lineHeight: 20 },
  button: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  buttonText: { fontWeight: '700' },
});
