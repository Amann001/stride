import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';

// A small "label over big number" block, e.g. "Distance / 5.23 km". Centred by default;
// `align="left"` lines them up on the left, like Strava's activity stats.
export function Stat({ label, value, large = false, align = 'center' }: {
  label: string;
  value: string;
  large?: boolean;
  align?: 'center' | 'left';
}) {
  const colors = useColors();
  return (
    <View style={[styles.wrap, align === 'left' && styles.left]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[large ? styles.valueLarge : styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  left: { alignItems: 'flex-start' },
  label: { fontSize: 13, marginBottom: 2 },
  value: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  valueLarge: { fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
