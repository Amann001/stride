import type { UserStats } from '@repo/shared';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { StreakCard } from '@/components/streak-card';
import { WeekSummary } from '@/components/week-summary';
import { useColors } from '@/constants/theme';

const SIDE_PADDING = 12;

// The swipeable cards at the top of Home: your streak, then this week's totals.
export function HighlightsCarousel({ stats }: { stats: UserStats | null }) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const pageWidth = width - SIDE_PADDING * 2;
  const [page, setPage] = useState(0);
  const pages: ReactNode[] = [<StreakCard key="streak" stats={stats} />, <WeekSummary key="week" stats={stats} />];

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}>
        {pages.map((p, i) => (
          <View key={i} style={{ width: pageWidth }}>
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
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
