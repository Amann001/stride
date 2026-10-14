import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View, type AlertButton } from 'react-native';

import { useColors } from '@/constants/theme';

// In a web browser React Native's Alert.alert does nothing at all, so every "Delete this
// activity?", error message and confirmation would silently disappear. This replaces it with a
// pop-up drawn in the app's own style, with the same buttons and the same behaviour: tapping a
// button closes the pop-up and then runs that button's action. Alerts raised while one is open
// wait their turn.

interface Pending {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

const queue: Pending[] = [];
let wake: (() => void) | null = null;

Alert.alert = (title, message, buttons) => {
  queue.push({ title, message, buttons: buttons?.length ? buttons : [{ text: 'OK' }] });
  wake?.();
};

export function AlertHost() {
  const colors = useColors();
  const [current, setCurrent] = useState<Pending | null>(null);

  useEffect(() => {
    wake = () => setCurrent((open) => open ?? queue.shift() ?? null);
    wake(); // anything raised before the app finished loading
    return () => {
      wake = null;
    };
  }, []);

  const press = (button: AlertButton) => {
    setCurrent(queue.shift() ?? null);
    button.onPress?.();
  };

  // Escape works like the Cancel button, when there is one.
  const cancel = current?.buttons.find((b) => b.style === 'cancel');
  const stacked = (current?.buttons.length ?? 0) > 2;

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => cancel && press(cancel)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]} accessibilityRole="alert">
          <Text style={[styles.title, { color: colors.text }]}>{current?.title}</Text>
          {!!current?.message && <Text style={[styles.message, { color: colors.textSecondary }]}>{current.message}</Text>}
          <View style={stacked ? styles.stack : styles.row}>
            {current?.buttons.map((b, i) => (
              <Pressable
                key={`${b.text ?? 'OK'}-${i}`}
                onPress={() => press(b)}
                accessibilityRole="button"
                style={({ hovered }: { hovered?: boolean }) => [
                  styles.button,
                  stacked && styles.stackedButton,
                  hovered && { backgroundColor: colors.raised },
                ]}>
                <Text
                  style={{
                    fontWeight: '700',
                    fontSize: 16,
                    textAlign: stacked ? 'center' : 'right',
                    color: b.style === 'destructive' ? colors.danger : b.style === 'cancel' ? colors.textSecondary : colors.accent,
                  }}>
                  {b.text ?? 'OK'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: { borderRadius: 16, padding: 20, gap: 10, width: '100%', maxWidth: 380 },
  title: { fontSize: 18, fontWeight: '700' },
  message: { fontSize: 15, lineHeight: 21 },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginTop: 6 },
  stack: { gap: 4, marginTop: 6 },
  button: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  stackedButton: { paddingVertical: 12 },
});
