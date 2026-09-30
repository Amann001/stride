import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ACTIVITY_LABELS, HEATMAP_INFO, HEATMAP_KINDS, type ActivityType, type HeatmapKind } from '@repo/shared';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useColors } from '@/constants/theme';
import { updateMapPrefs, useMapPrefs, type MapStyle } from '@/lib/map-prefs';

const MAP_STYLES: { key: MapStyle; label: string }[] = [
  { key: 'standard', label: 'Standard' },
  { key: 'satellite', label: 'Satellite' },
  { key: 'hybrid', label: 'Hybrid' },
  { key: 'mutedStandard', label: 'Muted' },
];

// Colours for the little heatmap pictures, matching the real tiles.
const HEAT_COLORS: Record<HeatmapKind, [string, string]> = {
  global: ['#1E4BFF', '#E8F1FF'],
  weekly: ['#8C28FF', '#FF46C8'],
  night: ['#FF8200', '#FFD228'],
  personal: ['#6E9600', '#C8F31D'],
};

const SQUIGGLE = 'M-4 58 C 14 46, 20 30, 36 34 S 58 14, 76 6';
const SQUIGGLE_2 = 'M-4 30 C 14 40, 30 60, 46 52 S 64 70, 76 64';

// A small drawn picture for each choice, standing in for Strava's thumbnails.
function Picture({ kind }: { kind: string }) {
  const art: Record<string, ReactNode> = {
    standard: (
      <>
        <Rect width={72} height={72} fill="#2B3440" />
        <Path d="M0 24 H72 M0 50 H72 M24 0 V72 M52 0 V72" stroke="#4A5566" strokeWidth={4} />
        <Path d={SQUIGGLE} stroke="#C8F31D" strokeWidth={3} fill="none" />
      </>
    ),
    satellite: (
      <>
        <Rect width={72} height={72} fill="#3D5A2A" />
        <Rect x={6} y={8} width={26} height={20} fill="#56733A" />
        <Rect x={40} y={38} width={28} height={26} fill="#6B6A3E" />
        <Circle cx={50} cy={16} r={9} fill="#2F4A22" />
        <Rect x={8} y={42} width={20} height={20} fill="#4E6B34" />
      </>
    ),
    hybrid: (
      <>
        <Rect width={72} height={72} fill="#3D5A2A" />
        <Rect x={40} y={38} width={28} height={26} fill="#6B6A3E" />
        <Circle cx={50} cy={16} r={9} fill="#2F4A22" />
        <Path d="M0 24 H72 M24 0 V72" stroke="#F4F4F5" strokeWidth={3} />
        <Path d={SQUIGGLE} stroke="#C8F31D" strokeWidth={3} fill="none" />
      </>
    ),
    mutedStandard: (
      <>
        <Rect width={72} height={72} fill="#3A3A3E" />
        <Path d="M0 24 H72 M0 50 H72 M24 0 V72 M52 0 V72" stroke="#505056" strokeWidth={4} />
      </>
    ),
    pois: (
      <>
        <Rect width={72} height={72} fill="#2B3440" />
        <Path d="M0 36 H72 M36 0 V72" stroke="#4A5566" strokeWidth={4} />
        <Circle cx={24} cy={46} r={11} fill="#3F7F8C" />
        <Circle cx={48} cy={24} r={11} fill="#E0445E" />
      </>
    ),
    bikeLanes: (
      <>
        <Rect width={72} height={72} fill="#2B3440" />
        <Path d="M0 24 H72 M52 0 V72" stroke="#4A5566" strokeWidth={4} />
        <Path d={SQUIGGLE} stroke="#22C55E" strokeWidth={4} strokeDasharray="6 4" fill="none" />
      </>
    ),
  };
  const heat = HEAT_COLORS[kind as HeatmapKind];
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72">
      {heat ? (
        <>
          <Rect width={72} height={72} fill="#1C2430" />
          <Path d={SQUIGGLE_2} stroke={heat[0]} strokeWidth={9} strokeOpacity={0.45} fill="none" />
          <Path d={SQUIGGLE_2} stroke={heat[1]} strokeWidth={3} fill="none" />
          <Path d={SQUIGGLE} stroke={heat[0]} strokeWidth={7} strokeOpacity={0.45} fill="none" />
          <Path d={SQUIGGLE} stroke={heat[1]} strokeWidth={2.5} fill="none" />
        </>
      ) : (
        art[kind]
      )}
    </Svg>
  );
}

function Choice({ kind, label, sub, selected, onPress }: {
  kind: string; label: string; sub?: string; selected: boolean; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={styles.choice} accessibilityState={{ selected }} accessibilityLabel={label}>
      <View style={[styles.frame, { borderColor: selected ? colors.accent : 'transparent' }]}>
        <View style={styles.picture}>
          <Picture kind={kind} />
        </View>
      </View>
      <Text style={[styles.choiceLabel, { color: selected ? colors.accent : colors.text }]}>{label}</Text>
      {sub && <Text style={[styles.choiceSub, { color: colors.textSecondary }]}>{sub}</Text>}
    </Pressable>
  );
}

// The "layers" sheet on the Maps tab: map style, heatmap, and extra layers.
export function MapLayersSheet({ visible, sport, onClose }: {
  visible: boolean; sport: ActivityType; onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const prefs = useMapPrefs();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.top}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityLabel="Close">
            <MaterialCommunityIcons name="close" size={26} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.section, { color: colors.text }]}>Map Types</Text>
          <View style={styles.row}>
            {MAP_STYLES.map((m) => (
              <Choice key={m.key} kind={m.key} label={m.label} selected={prefs.mapStyle === m.key}
                onPress={() => updateMapPrefs({ mapStyle: m.key })} />
            ))}
          </View>

          <Text style={[styles.section, { color: colors.text }]}>Heatmaps</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            {prefs.heatmap ? HEATMAP_INFO[prefs.heatmap].description : 'Tap one to see where people go. Tap again to hide it.'}
          </Text>
          <View style={styles.row}>
            {HEATMAP_KINDS.map((k) => (
              <Choice key={k} kind={k} label={HEATMAP_INFO[k].label} sub={ACTIVITY_LABELS[sport]}
                selected={prefs.heatmap === k}
                onPress={() => updateMapPrefs({ heatmap: prefs.heatmap === k ? null : k })} />
            ))}
          </View>

          <Text style={[styles.section, { color: colors.text }]}>Layers</Text>
          <View style={styles.row}>
            <Choice kind="pois" label="POIs" selected={prefs.pois} onPress={() => updateMapPrefs({ pois: !prefs.pois })} />
            <Choice kind="bikeLanes" label="Bike Lanes" selected={prefs.bikeLanes}
              onPress={() => updateMapPrefs({ bikeLanes: !prefs.bikeLanes })} />
          </View>
          {prefs.bikeLanes && (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Bike lanes © CyclOSM, OpenStreetMap contributors</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  top: { paddingTop: 8, paddingHorizontal: 16, height: 44 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  close: { position: 'absolute', right: 16, top: 10 },
  content: { paddingHorizontal: 16, paddingBottom: 12 },
  section: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 10 },
  hint: { fontSize: 12, marginTop: -4, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  choice: { width: 78, alignItems: 'center' },
  frame: { borderWidth: 2.5, borderRadius: 12, padding: 2 },
  picture: { width: 72, height: 72, borderRadius: 9, overflow: 'hidden' },
  choiceLabel: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  choiceSub: { fontSize: 11 },
});
