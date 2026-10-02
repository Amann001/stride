import type { UserStats } from '@repo/shared';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { StreakCard } from '@/components/streak-card';
import { WeekSummary } from '@/components/week-summary';
import { useColors } from '@/constants/theme';

// The swipeable panel at the top of Home, like Strava's: your streak, then this week's
// totals, with page dots underneath.
export function HighlightsCarousel({ stats }: { stats: UserStats | null }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const pages: ReactNode[] = [<StreakCard key="streak" stats={stats} />, <WeekSummary key="week" stats={stats} />];

  return (
    <View style={[styles.wrap, { backgroundColor: colors.card }]}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {pages.map((p, i) => (
          <View key={i} style={{ width }}>
            {p}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {pages.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === page ? colors.text : colors.border }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
