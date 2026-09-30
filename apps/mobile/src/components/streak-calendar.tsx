import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "Streak": the flame with your weekly streak, and this month as a grid of days
// (Monday first). Days you were active are filled in.
export function StreakCalendar({ streakWeeks, activeDates }: { streakWeeks: number; activeDates: string[] }) {
  const colors = useColors();
  const today = new Date();
  const todayIso = isoDate(today);
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // blank cells before the 1st, Monday = 0
  const active = new Set(activeDates);
  const cells: (string | null)[] = [
    ...Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoDate(new Date(today.getFullYear(), today.getMonth(), i + 1))),
  ];
  const rows = Array.from({ length: Math.ceil(cells.length / 7) }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const monthLabel = today.toLocaleDateString(undefined, { month: 'long' });

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Streak</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{monthLabel}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.flame}>
          <MaterialCommunityIcons name="fire" size={64} color={streakWeeks > 0 ? colors.brand : colors.border} />
          <Text style={[styles.count, { color: streakWeeks > 0 ? colors.onBrand : colors.textSecondary }]}>{streakWeeks}</Text>
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{streakWeeks === 1 ? 'Week' : 'Weeks'}</Text>
        </View>
        <View style={styles.grid}>
          {rows.map((row, r) => (
            <View key={r} style={styles.gridRow}>
              {Array.from({ length: 7 }, (_, c) => {
                const day = row[c];
                if (!day) return <View key={c} style={styles.cell} />;
                const done = active.has(day);
                const future = day > todayIso;
                return (
                  <View key={c} style={styles.cell}>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: done ? colors.brand : future ? 'transparent' : colors.border },
                        future && { borderWidth: 1, borderColor: colors.border },
                        day === todayIso && { borderWidth: 2, borderColor: colors.accent },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  body: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  flame: { alignItems: 'center', width: 80 },
  // Sits inside the flame icon.
  count: { position: 'absolute', top: 26, left: 0, right: 0, textAlign: 'center', fontSize: 20, fontWeight: '700' },
  grid: { flex: 1, gap: 6 },
  gridRow: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
