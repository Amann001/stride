import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/constants/categories';
import { useColors } from '@/constants/theme';

// The bar at the top of each tab: icon buttons on the left and right, a title in the middle.
export function TabHeader({ left, title, right }: { left?: ReactNode; title?: ReactNode; right?: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6, backgroundColor: colors.background, borderColor: colors.border }]}>
      <View style={[styles.side, styles.leftSide]}>{left}</View>
      <View style={styles.center}>
        {typeof title === 'string' ? <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text> : title}
      </View>
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

// `dot` shows a small red dot, e.g. for unread messages.
export function HeaderButton({ icon, onPress, label, dot = false }: { icon: IconName; onPress: () => void; label: string; dot?: boolean }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={dot ? `${label}, new` : label} style={styles.button}>
      <MaterialCommunityIcons name={icon} size={27} color={colors.text} />
      {dot && <View style={[styles.dot, { borderColor: colors.background }]} />}
    </Pressable>
  );
}

// "STRIDE" in the brand's lime, for the Home tab.
export function Wordmark() {
  const colors = useColors();
  return <Text style={[styles.wordmark, { color: colors.accent }]}>STRIDE</Text>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  side: { width: 96, flexDirection: 'row', gap: 14 },
  leftSide: { justifyContent: 'flex-start' },
  rightSide: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  button: { padding: 2 },
  dot: { position: 'absolute', top: 1, right: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: '#EF4444', borderWidth: 2 },
  wordmark: { fontSize: 22, fontWeight: '900', fontStyle: 'italic', letterSpacing: 2 },
});
