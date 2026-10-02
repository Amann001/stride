import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { decodePolyline, formatDistance, type RouteDifficulty, type RouteSummary } from '@repo/shared';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { RouteMap } from '@/components/route-map';
import { CATEGORY_LOOKS } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';

export const DIFFICULTY_LOOK: Record<RouteDifficulty, { label: string; color: string }> = {
  easy: { label: 'Easy', color: '#22C55E' },
  moderate: { label: 'Moderate', color: '#F59E0B' },
  hard: { label: 'Hard', color: '#EF4444' },
};

export function DifficultyTag({ difficulty }: { difficulty: RouteDifficulty }) {
  const look = DIFFICULTY_LOOK[difficulty];
  return (
    <View style={[styles.tag, { backgroundColor: look.color }]}>
      <Text style={styles.tagText}>{look.label}</Text>
    </View>
  );
}

// "Made for you" / "Saved" / "Your activity": where a route came from.
export function routeSourceLabel(route: RouteSummary): string {
  return route.source === 'suggested' ? 'Made for you' : route.source === 'saved' ? 'Saved route' : 'Your activity';
}

// A route in a list: small map, bookmark, name, length and climb.
export function RouteCard({ route, place, saved, onPress, onToggleSave, style }: {
  route: RouteSummary;
  place?: string | null;
  saved?: boolean;
  onPress: () => void;
  onToggleSave?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const coords = useMemo(() => decodePolyline(route.polyline), [route.polyline]);
  return (
    <Pressable onPress={onPress} style={[styles.card, style]} accessibilityLabel={`${route.name}, ${formatDistance(route.distanceMeters)}`}>
      <View style={[styles.thumb, { backgroundColor: colors.card }]}>
        <RouteMap coords={coords} preview style={styles.map} />
        <View style={[styles.sport, { backgroundColor: CATEGORY_LOOKS[route.sport].color }]}>
          <MaterialCommunityIcons name={CATEGORY_LOOKS[route.sport].icon} size={14} color={INK} />
        </View>
        {onToggleSave && (
          <Pressable onPress={onToggleSave} hitSlop={10} style={[styles.bookmark, { backgroundColor: colors.card }]}
            accessibilityLabel={saved ? 'Remove from saved routes' : 'Save route'}>
            <MaterialCommunityIcons name={saved ? 'bookmark' : 'bookmark-outline'} size={20} color={saved ? colors.accent : colors.text} />
          </Pressable>
        )}
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{route.name}</Text>
      <View style={styles.meta}>
        <DifficultyTag difficulty={route.difficulty} />
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          {formatDistance(route.distanceMeters)} · {Math.round(route.elevationGainMeters)} m
        </Text>
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
        {place ?? routeSourceLabel(route)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 250, gap: 4 },
  thumb: { height: 150, borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  map: { height: 150 },
  sport: { position: 'absolute', left: 8, top: 8, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bookmark: { position: 'absolute', right: 8, top: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { color: INK, fontSize: 11, fontWeight: '800' },
});
