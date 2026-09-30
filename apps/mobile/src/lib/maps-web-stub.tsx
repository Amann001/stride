import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

// Apple Maps only exists on the phone. When the app is previewed in a web browser (to
// check layouts), map screens show this placeholder instead, so the rest of the page
// still renders. Only used on web; see metro.config.js.

interface Props {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

const MapView = forwardRef<unknown, Props>(function MapView({ style }, ref) {
  useImperativeHandle(ref, () => ({
    fitToCoordinates: () => {},
    animateToRegion: () => {},
    animateCamera: () => {},
    getCamera: async () => ({ pitch: 0, heading: 0, altitude: 1000, zoom: 14, center: { latitude: 0, longitude: 0 } }),
  }));
  return (
    <View style={[styles.map, style]}>
      <Text style={styles.label}>Map (shown on iPhone)</Text>
    </View>
  );
});

const Nothing = () => null;

export default MapView;
export const Polyline = Nothing;
export const Marker = Nothing;
export const UrlTile = Nothing;
export const Circle = Nothing;
export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type MapPressEvent = { nativeEvent: { coordinate: { latitude: number; longitude: number } } };

const styles = StyleSheet.create({
  map: { backgroundColor: '#2B3440', alignItems: 'center', justifyContent: 'center' },
  label: { color: '#7A8594', fontSize: 12 },
});
