import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ActivitySummary, Visibility } from '@repo/shared';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';

export const VISIBILITY_LOOK: Record<Visibility, { label: string; description: string; icon: IconName }> = {
  everyone: { label: 'Everyone', description: 'Anyone on Stride can see it. Counts towards heatmaps.', icon: 'earth' },
  followers: { label: 'Followers', description: 'Only people who follow you.', icon: 'account-multiple' },
  only_me: { label: 'Only You', description: 'Private. Hidden from everyone else and from shared heatmaps.', icon: 'lock' },
};

// Change an activity's title, description, and who can see it.
export function EditActivitySheet({ activity, visible, onClose, onSaved }: {
  activity: ActivitySummary;
  visible: boolean;
  onClose: () => void;
  onSaved: (updated: ActivitySummary) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description ?? '');
  const [visibility, setVisibility] = useState<Visibility>(activity.visibility);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Give it a title');
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateActivity(activity.id, {
        title: title.trim(),
        description: description.trim() || null,
        visibility,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const input = [styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: colors.text, fontSize: 16 }}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Activity</Text>
          <Pressable onPress={save} disabled={saving} hitSlop={10}>
            {saving ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>Save</Text>}
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
          <TextInput style={input} value={title} onChangeText={setTitle} maxLength={120} />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
          <TextInput style={[input, styles.multiline]} value={description} onChangeText={setDescription} multiline
            maxLength={2000} placeholder="How did it go?" placeholderTextColor={colors.textSecondary} />

          <Text style={[styles.section, { color: colors.text }]}>Who can view</Text>
          {(Object.keys(VISIBILITY_LOOK) as Visibility[]).map((v) => {
            const active = v === visibility;
            const look = VISIBILITY_LOOK[v];
            return (
              <Pressable key={v} onPress={() => setVisibility(v)}
                style={[styles.option, { borderColor: active ? colors.accent : colors.border, backgroundColor: colors.card }]}>
                <View style={[styles.optionIcon, { backgroundColor: active ? colors.brand : colors.background }]}>
                  <MaterialCommunityIcons name={look.icon} size={20} color={active ? INK : colors.text} />
                </View>
                <View style={styles.optionText}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{look.label}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{look.description}</Text>
                </View>
                {active && <MaterialCommunityIcons name="check-circle" size={22} color={colors.accent} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { padding: 16, gap: 10 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  section: { fontSize: 18, fontWeight: '800', marginTop: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  optionIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  optionText: { flex: 1 },
});
