import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { INK, useColors } from '@/constants/theme';

const ATHLETE_LINK = /^stride:\/\/athlete\/([0-9a-f-]{36})$/i;

// Scan a friend's Stride QR code to open their profile and follow them.
export default function ScanScreen() {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Camera access needed</Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
          Stride uses the camera only to scan a friend’s QR code.
        </Text>
        <Pressable style={[styles.button, { backgroundColor: colors.brand }]}
          onPress={permission.canAskAgain ? requestPermission : () => Linking.openSettings()}>
          <Text style={styles.buttonText}>{permission.canAskAgain ? 'Allow Camera' : 'Open Settings'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={done ? undefined : ({ data }) => {
          const match = ATHLETE_LINK.exec(data.trim());
          if (match) {
            setDone(true);
            router.replace({ pathname: '/athlete/[id]', params: { id: match[1] } });
          } else {
            setMessage("That's not a Stride code. Ask your friend to open Search > QR Code.");
          }
        }}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={[styles.hint, { backgroundColor: colors.card }]}>
        <Text style={{ color: colors.text, textAlign: 'center', fontWeight: '600' }}>
          {message ?? "Point your camera at a friend's Stride QR code"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 20, fontWeight: '800' },
  button: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  buttonText: { color: INK, fontWeight: '800' },
  frame: {
    position: 'absolute', alignSelf: 'center', top: '28%', width: 240, height: 240,
    borderWidth: 4, borderColor: '#C8F31D', borderRadius: 24,
  },
  hint: { position: 'absolute', left: 24, right: 24, bottom: 60, borderRadius: 16, padding: 16 },
});
