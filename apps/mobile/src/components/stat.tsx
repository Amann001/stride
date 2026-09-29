import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/constants/theme';

// A small "label over big number" block, e.g. "Distance / 5.23 km".
export function Stat({ label, value, large = false }: { label: string; value: string; large?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[large ? styles.valueLarge : styles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  label: { fontSize: 13, marginBottom: 2 },
  value: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  valueLarge: { fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
