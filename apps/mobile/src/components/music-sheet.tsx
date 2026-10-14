import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/constants/theme';
import {
  MUSIC_APPS,
  canOpenOtherMusicApp,
  getLastMusicApp,
  openMusicApp,
  openOtherMusicApp,
  setLastMusicApp,
  type MusicApp,
} from '@/lib/music-apps';
import { strideAudio } from '@/lib/stride-audio';

// "Play Music": opens your own music app so you can pick a song, then come back.
// Looks and works like the "Choose a Sport" sheet.
export function MusicSheet({ visible, recording, onClose }: { visible: boolean; recording: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    if (visible) getLastMusicApp().then(setLast);
  }, [visible]);

  const open = async (app: MusicApp) => {
    setLastMusicApp(app.id);
    setLast(app.id);
    onClose();
    if (!(await openMusicApp(app))) Alert.alert(`Could not open ${app.name}`, 'Check that it is installed, then try again.');
  };
  const openOther = () => {
    onClose();
    if (!openOtherMusicApp()) Alert.alert('No music app found', 'Install a music app, then try again.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Play Music</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
            <MaterialCommunityIcons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {recording
            ? 'Pick a song, then come straight back. Your time keeps going, but GPS only tracks while Stride is on screen.'
            : 'Start your music, then come back to Stride and press Start.'}
        </Text>
        {MUSIC_APPS.map((app) => (
          <Pressable key={app.id} style={styles.row} onPress={() => open(app)} accessibilityLabel={`Open ${app.name}`}>
            <MaterialCommunityIcons name={app.icon} size={26} color={app.color} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>{app.name}</Text>
            {app.id === last && <MaterialCommunityIcons name="check" size={22} color={colors.accent} />}
          </Pressable>
        ))}
        {canOpenOtherMusicApp && (
          <Pressable style={styles.row} onPress={openOther} accessibilityLabel="Open another music app">
            <MaterialCommunityIcons name="music-box-multiple" size={26} color={colors.text} />
            <Text style={[styles.rowLabel, { color: colors.text }]}>Another music app</Text>
          </Pressable>
        )}
        {strideAudio && (
          <Text style={[styles.foot, { color: colors.textSecondary }]}>
            Voice updates turn your music down while they speak, then back up.
          </Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  foot: { fontSize: 12, marginTop: 8 },
});
