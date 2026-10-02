import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '@/constants/theme';

// Layout pieces shared by every screen, following Strava: content sits in flat,
// full-width sections, split by thin bands.

// The gap between two sections.
export function Band({ height = 8 }: { height?: number }) {
  const colors = useColors();
  return <View style={{ height, backgroundColor: colors.separator }} />;
}

// A full-width block of content with the standard side padding.
export function Section({ children, style, flush = false }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  // No side padding, for things that run edge to edge (maps, horizontal lists).
  flush?: boolean;
}) {
  const colors = useColors();
  return <View style={[styles.section, flush && styles.flush, { backgroundColor: colors.card }, style]}>{children}</View>;
}

// "Suggested Challenges ......... See All"
export function SectionHeader({ title, subtitle, action, onAction, style }: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {action && (
          <Pressable onPress={onAction} hitSlop={10}>
            <Text style={[styles.action, { color: colors.accent }]}>{action}</Text>
          </Pressable>
        )}
      </View>
      {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
    </View>
  );
}

export const SIDE = 16;

const styles = StyleSheet.create({
  section: { paddingHorizontal: SIDE, paddingVertical: 16, gap: 12 },
  flush: { paddingHorizontal: 0 },
  header: { gap: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  action: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 14 },
});
