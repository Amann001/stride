import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Achievement } from '@repo/shared';
import { StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/constants/categories';
import { useColors } from '@/constants/theme';

// Gold, silver, bronze.
export const MEDAL_COLORS = { 1: '#F5C542', 2: '#C0C4CC', 3: '#CD7F32' } as const;

const KIND_ICONS: Record<Achievement['kind'], IconName> = {
  first: 'flag-checkered',
  effort: 'medal',
  longest: 'map-marker-distance',
  climb: 'image-filter-hdr',
  steps: 'shoe-print',
};

export function Medal({ achievement, size = 22 }: { achievement: Achievement; size?: number }) {
  return <MaterialCommunityIcons name={KIND_ICONS[achievement.kind]} size={size} color={MEDAL_COLORS[achievement.rank]} />;
}

// The headline achievement on a feed card, like Strava's "Kudos on your first activity!".
export function AchievementBanner({ achievement, more }: { achievement: Achievement; more: number }) {
  const colors = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: colors.background }]}>
      <View style={[styles.medalCircle, { borderColor: MEDAL_COLORS[achievement.rank] }]}>
        <Medal achievement={achievement} size={20} />
      </View>
      <View style={styles.bannerText}>
        <Text style={[styles.bannerTitle, { color: colors.text }]}>{achievement.title}</Text>
        {!!achievement.detail && <Text style={{ color: colors.textSecondary }}>{achievement.detail}</Text>}
      </View>
      {more > 0 && <Text style={[styles.more, { color: colors.accent }]}>+{more} more</Text>}
    </View>
  );
}

// Every achievement on the activity screen.
export function AchievementList({ achievements }: { achievements: Achievement[] }) {
  const colors = useColors();
  return (
    <View style={styles.list}>
      {achievements.map((a, i) => (
        <View key={i} style={styles.row}>
          <Medal achievement={a} size={26} />
          <Text style={[styles.rowTitle, { color: colors.text }]}>{a.title}</Text>
          {!!a.detail && <Text style={[styles.rowDetail, { color: colors.textSecondary }]}>{a.detail}</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12 },
  medalCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bannerText: { flex: 1 },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  more: { fontWeight: '600' },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  rowDetail: { fontVariant: ['tabular-nums'] },
});
