import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { useColors } from '@/constants/theme';

// Ask for a bit of text (a route name, a weekly goal). On iPhone this is the system
// Alert.prompt, as before. Android has no Alert.prompt, so there it's a small pop-up drawn by
// <TextPromptHost />, which sits once at the root of the app.

interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  keyboardType?: KeyboardTypeOptions;
}

interface Request extends PromptOptions {
  resolve: (value: string | null) => void;
}

let show: ((r: Request) => void) | null = null;

// Resolves with the text, or null if cancelled.
export function promptText(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        options.title,
        options.message,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
          { text: 'OK', onPress: (value?: string) => resolve(value ?? '') },
        ],
        'plain-text',
        options.defaultValue,
        options.keyboardType,
      );
    } else if (show) {
      show({ ...options, resolve });
    } else {
      resolve(null);
    }
  });
}

export function TextPromptHost() {
  const colors = useColors();
  const [request, setRequest] = useState<Request | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    show = (r) => {
      setValue(r.defaultValue ?? '');
      setRequest(r);
    };
    return () => {
      show = null;
    };
  }, []);

  const finish = (result: string | null) => {
    request?.resolve(result);
    setRequest(null);
  };

  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={() => finish(null)}>
      <KeyboardAvoidingView behavior="height" style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>{request?.title}</Text>
          {!!request?.message && <Text style={{ color: colors.textSecondary }}>{request.message}</Text>}
          <TextInput
            autoFocus
            value={value}
            onChangeText={setValue}
            keyboardType={request?.keyboardType}
            onSubmitEditing={() => finish(value)}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.raised }]}
          />
          <View style={styles.buttons}>
            <Pressable onPress={() => finish(null)} style={styles.button}>
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => finish(value)} style={styles.button}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>OK</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 28 },
  card: { borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  button: { paddingHorizontal: 14, paddingVertical: 8 },
});
