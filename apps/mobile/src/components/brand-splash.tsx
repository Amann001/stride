import { Image, StyleSheet, View } from 'react-native';

import { INK } from '@/constants/theme';

const WORDMARK = require('@/assets/images/splash-wordmark.png');
// Same width as `imageWidth` in app.json, so the native splash and this screen line up exactly.
// About 45% of an iPhone's width, like Strava's.
const WIDTH = 180;
const { width: fileW, height: fileH } = Image.resolveAssetSource(WORDMARK);

// The opening screen: STRIDE on black. It matches the native splash screen in app.json
// so the switch from one to the other is invisible.
export function BrandSplash() {
  return (
    <View style={styles.screen}>
      <Image source={WORDMARK} style={styles.wordmark} resizeMode="contain" accessibilityLabel="Stride" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  // Exact size worked out from the image file, so it can never show at full file size.
  wordmark: { width: WIDTH, height: Math.round((WIDTH * fileH) / fileW) },
});
