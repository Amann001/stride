import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { UserStats } from '@repo/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// "Your streak": how many weeks in a row you've been active, and this week's days.
export function StreakCard({ stats }: { stats: UserStats | null }) {
  const colors = useColors();
  const streak = stats?.streakWeeks ?? 0;
  const loggedThisWeek = stats?.activeDays.some(Boolean) ?? false;
  const today = (new Date().getDay() + 6) % 7; // Monday = 0

  const message =
    streak === 0
      ? 'Start your streak by logging an activity.'
      : loggedThisWeek
        ? `${streak} ${streak === 1 ? 'week' : 'weeks'} in a row. Keep it going!`
        : `Log an activity this week to keep your ${streak}-week streak alive.`;

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <Text style={[styles.heading, { color: colors.text }]}>Your streak</Text>
      <View style={styles.body}>
        <View style={styles.flame}>
          <MaterialCommunityIcons name="fire" size={44} color={streak > 0 ? colors.brand : colors.border} />
          <Text style={[styles.count, { color: streak > 0 ? colors.onBrand : colors.textSecondary }]}>{streak}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{streak === 1 ? 'Week' : 'Weeks'}</Text>
        </View>
        <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
        {!loggedThisWeek && (
          <Pressable style={[styles.button, { backgroundColor: colors.brand }]} onPress={() => router.navigate('/record')}>
            <Text style={[styles.buttonText, { color: colors.onBrand }]}>Record now</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.days}>
        {DAY_LETTERS.map((letter, i) => {
          const active = stats?.activeDays[i] ?? false;
          return (
            <View key={i} style={styles.day}>
              <View
                style={[
                  styles.dot,
                  { borderColor: i === today ? colors.accent : colors.border },
                  active && { backgroundColor: colors.brand, borderColor: colors.brand },
                ]}>
                {active && <MaterialCommunityIcons name="check" size={14} color={colors.onBrand} />}
              </View>
              <Text style={[styles.dayLetter, { color: i === today ? colors.text : colors.textSecondary }]}>{letter}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, gap: 14 },
  heading: { fontSize: 17, fontWeight: '700' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  flame: { alignItems: 'center', width: 60 },
  // Sits inside the flame icon.
  count: { position: 'absolute', top: 18, left: 0, right: 0, textAlign: 'center', fontSize: 15, fontWeight: '800' },
  message: { flex: 1, fontSize: 15, lineHeight: 20 },
  button: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  buttonText: { fontWeight: '700' },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dayLetter: { fontSize: 12, fontWeight: '600' },
});
