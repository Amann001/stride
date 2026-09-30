import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACTIVITY_LABELS, type ActivityType } from '@repo/shared';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORY_LOOKS, SPORT_GROUPS } from '@/constants/categories';
import { useColors } from '@/constants/theme';

// "Choose a Sport": a sheet that slides up from the bottom, grouped into foot and cycle sports.
export function SportSheet({ visible, selected, onSelect, onClose }: {
  visible: boolean;
  selected: ActivityType;
  onSelect: (type: ActivityType) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Choose a Sport</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        {SPORT_GROUPS.map((group) => (
          <View key={group.title}>
            <Text style={[styles.group, { color: colors.text }]}>{group.title}</Text>
            {group.types.map((t) => {
              const active = t === selected;
              return (
                <Pressable key={t} style={styles.row} onPress={() => { onSelect(t); onClose(); }}>
                  <MaterialCommunityIcons name={CATEGORY_LOOKS[t].icon} size={26} color={active ? colors.accent : colors.text} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: active ? colors.accent : colors.text }]}>{ACTIVITY_LABELS[t]}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{CATEGORY_LOOKS[t].tagline}</Text>
                  </View>
                  {active && <MaterialCommunityIcons name="check" size={22} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  group: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
});
