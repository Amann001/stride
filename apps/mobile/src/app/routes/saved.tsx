import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  elevationBand,
  type ActivityType,
  type ElevationBand,
  type RouteDifficulty,
  type RouteSummary,
} from '@repo/shared';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { OptionSheet } from '@/components/option-sheet';
import { DIFFICULTY_LOOK, RouteCard } from '@/components/route-card';
import { useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { rememberRoutes, setActiveRoute } from '@/lib/route-store';

const LENGTHS = [
  { label: 'Under 5 km', min: 0, max: 5 },
  { label: '5–15 km', min: 5, max: 15 },
  { label: '15 km+', min: 15, max: Infinity },
];

// "Saved Routes": every route you've saved or drawn. With ?pick=1 (from Record), tapping a
// route picks it to follow instead of opening it.
export default function SavedRoutesScreen() {
  const colors = useColors();
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const picking = pick === '1';
  const [routes, setRoutes] = useState<RouteSummary[] | null>(null);
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<ActivityType | null>(null);
  const [length, setLength] = useState<number | null>(null);
  const [elevation, setElevation] = useState<ElevationBand | null>(null);
  const [difficulty, setDifficulty] = useState<RouteDifficulty | null>(null);
  const [sheet, setSheet] = useState<'sport' | 'length' | 'elevation' | 'difficulty' | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.listRoutes().then((r) => {
        rememberRoutes(r);
        setRoutes(r);
      }, () => setRoutes([]));
    }, []),
  );

  const shown = (routes ?? []).filter((r) => {
    const km = r.distanceMeters / 1000;
    const len = length == null ? null : LENGTHS[length];
    return (
      (!query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase())) &&
      (!sport || r.sport === sport) &&
      (!len || (km >= len.min && km < len.max)) &&
      (!elevation || elevationBand(r.distanceMeters, r.elevationGainMeters) === elevation) &&
      (!difficulty || r.difficulty === difficulty)
    );
  });

  const choose = (r: RouteSummary) => {
    if (picking) {
      setActiveRoute(r);
      router.back();
    } else {
      router.push({ pathname: '/route/[id]', params: { id: r.id } });
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: picking ? 'Add a Route' : 'Saved Routes',
          headerRight: () => (
            <Pressable onPress={() => router.push('/routes/create')} hitSlop={10} accessibilityLabel="Create a route">
              <MaterialCommunityIcons name="map-marker-plus-outline" size={26} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <View style={[styles.search, { backgroundColor: colors.card }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
        <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search by keyword"
          placeholderTextColor={colors.textSecondary} value={query} onChangeText={setQuery} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
        <Chip label={sport ? ACTIVITY_LABELS[sport] : 'All sports'} active={!!sport} onPress={() => setSheet('sport')} />
        <Chip label={length == null ? 'Length' : LENGTHS[length].label} active={length != null} onPress={() => setSheet('length')} />
        <Chip label={elevation ? elevation[0].toUpperCase() + elevation.slice(1) : 'Elevation'} active={!!elevation}
          onPress={() => setSheet('elevation')} />
        <Chip label={difficulty ? DIFFICULTY_LOOK[difficulty].label : 'Difficulty'} active={!!difficulty}
          onPress={() => setSheet('difficulty')} />
      </ScrollView>

      {routes === null ? (
        <ActivityIndicator style={styles.center} color={colors.accent} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <RouteCard route={item} onPress={() => choose(item)} style={styles.card} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="map-marker-path" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {routes.length ? 'No routes match' : 'No saved routes yet'}
              </Text>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                {routes.length
                  ? 'Try clearing a filter.'
                  : 'Save a suggested route from the Maps tab, or draw your own.'}
              </Text>
              {!routes.length && (
                <Pressable style={[styles.button, { backgroundColor: colors.brand }]} onPress={() => router.push('/routes/create')}>
                  <Text style={{ color: colors.onBrand, fontWeight: '800' }}>Create a Route</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      <OptionSheet visible={sheet === 'sport'} title="Sport" value={sport} onSelect={setSport} onClose={() => setSheet(null)}
        options={[{ value: null, label: 'All sports' }, ...ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABELS[t] }))]} />
      <OptionSheet visible={sheet === 'length'} title="Length" value={length} onSelect={setLength} onClose={() => setSheet(null)}
        options={[{ value: null, label: 'Any length' }, ...LENGTHS.map((l, i) => ({ value: i, label: l.label }))]} />
      <OptionSheet visible={sheet === 'elevation'} title="Elevation" value={elevation} onSelect={setElevation} onClose={() => setSheet(null)}
        options={[{ value: null, label: 'Any' }, { value: 'flat', label: 'Flat' }, { value: 'rolling', label: 'Rolling' }, { value: 'hilly', label: 'Hilly' }]} />
      <OptionSheet visible={sheet === 'difficulty'} title="Difficulty" value={difficulty} onSelect={setDifficulty} onClose={() => setSheet(null)}
        options={[{ value: null, label: 'Any' }, { value: 'easy', label: 'Easy' }, { value: 'moderate', label: 'Moderate' }, { value: 'hard', label: 'Hard' }]} />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.chip, { borderColor: active ? colors.accent : colors.border }]}>
      <Text style={{ color: active ? colors.accent : colors.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
      <MaterialCommunityIcons name="chevron-down" size={16} color={active ? colors.accent : colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { marginTop: 48 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, marginBottom: 8, borderRadius: 999, paddingHorizontal: 14, height: 44 },
  searchInput: { flex: 1, fontSize: 15 },
  chipBar: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  list: { padding: 12, gap: 20, flexGrow: 1 },
  card: { width: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  button: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, marginTop: 8 },
});
