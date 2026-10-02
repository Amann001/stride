import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/constants/theme';

export interface Option<T> {
  value: T;
  label: string;
  description?: string;
}

// A small sheet listing choices with a tick on the current one, used by filter chips.
export function OptionSheet<T>({ visible, title, options, value, onSelect, onClose }: {
  visible: boolean;
  title: string;
  options: Option<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable key={o.label} style={styles.row} onPress={() => { onSelect(o.value); onClose(); }}>
              <View style={styles.rowText}>
                <Text style={[styles.label, { color: active ? colors.accent : colors.text }]}>{o.label}</Text>
                {o.description && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{o.description}</Text>}
              </View>
              {active && <MaterialCommunityIcons name="check" size={22} color={colors.accent} />}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  rowText: { flex: 1 },
  label: { fontSize: 16, fontWeight: '600' },
});
