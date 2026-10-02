import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  type ActivityType,
  type AthleteSummary,
  type Club,
} from '@repo/shared';
import { Contact } from 'expo-contacts';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { AthleteRow } from '@/components/athlete-row';
import { ClubRow } from '@/components/club-row';
import { OptionSheet } from '@/components/option-sheet';
import type { IconName } from '@/constants/categories';
import { INK, useColors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Tab = 'friends' | 'clubs';
type FriendsView = 'suggested' | 'contacts' | 'qr';

export const inviteMessage = (name?: string) =>
  `Join me on Stride! It's a running, riding, walking and hiking app. Search for ${name ?? 'me'} and follow me so we can cheer each other on.`;

// Search: find people to follow (or invite), and find clubs to join.
export default function SearchScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'clubs' ? 'clubs' : 'friends');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.tabs, { borderColor: colors.border }]}>
        {(['friends', 'clubs'] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && { borderBottomColor: colors.accent }]}>
            <Text style={{ color: tab === t ? colors.text : colors.textSecondary, fontWeight: '700', fontSize: 16 }}>
              {t === 'friends' ? 'Friends' : 'Clubs'}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'friends' ? <Friends /> : <Clubs />}
    </View>
  );
}

// ---------- Friends ----------

function Friends() {
  const colors = useColors();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AthleteSummary[] | null>(null);
  const [view, setView] = useState<FriendsView>('suggested');
  const [suggested, setSuggested] = useState<AthleteSummary[] | null>(null);
  const [followingAll, setFollowingAll] = useState(false);

  useEffect(() => {
    api.suggestedAthletes().then(setSuggested, () => setSuggested([]));
  }, []);

  // Search as you type, waiting for a short pause so we don't search every letter.
  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const id = setTimeout(() => {
      api.searchAthletes(q).then(setResults, () => setResults([]));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const toFollow = (suggested ?? []).filter((a) => !a.isFollowing);

  const followAll = async () => {
    setFollowingAll(true);
    try {
      await api.followAll(toFollow.map((a) => a.id));
      setSuggested(await api.suggestedAthletes());
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setFollowingAll(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SearchBox value={query} onChange={setQuery} placeholder="Search for people on Stride" />

      {query.trim() ? (
        results === null ? (
          <ActivityIndicator style={styles.loading} color={colors.accent} />
        ) : results.length ? (
          results.map((a) => <AthleteRow key={a.id} athlete={a} />)
        ) : (
          <Text style={[styles.note, { color: colors.textSecondary }]}>No one called “{query.trim()}” yet. Invite them below.</Text>
        )
      ) : (
        <>
          <View style={styles.views}>
            <ViewTab icon="account-multiple-plus-outline" label="Suggested" active={view === 'suggested'} onPress={() => setView('suggested')} />
            <ViewTab icon="card-account-phone-outline" label="Contacts" active={view === 'contacts'} onPress={() => setView('contacts')} />
            <ViewTab icon="qrcode" label="QR Code" active={view === 'qr'} onPress={() => setView('qr')} />
          </View>

          {view === 'suggested' && (
            suggested === null ? (
              <ActivityIndicator style={styles.loading} color={colors.accent} />
            ) : (
              <>
                <View style={styles.listHeader}>
                  <Text style={[styles.caps, { color: colors.textSecondary }]}>
                    {toFollow.length} {toFollow.length === 1 ? 'ATHLETE' : 'ATHLETES'} TO FOLLOW
                  </Text>
                  {toFollow.length > 1 && (
                    <Pressable onPress={followAll} disabled={followingAll} style={[styles.smallButton, { borderColor: colors.accent }]}>
                      {followingAll ? <ActivityIndicator size="small" color={colors.accent} /> : (
                        <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Follow All</Text>
                      )}
                    </Pressable>
                  )}
                </View>
                {suggested.length ? suggested.map((a) => <AthleteRow key={a.id} athlete={a} />) : (
                  <Text style={[styles.note, { color: colors.textSecondary }]}>
                    You’re following everyone on Stride so far. Invite more friends!
                  </Text>
                )}
              </>
            )
          )}

          {view === 'contacts' && <InviteContacts />}
          {view === 'qr' && user && (
            <View style={[styles.qrCard, { backgroundColor: colors.raised }]}>
              <Text style={[styles.qrTitle, { color: colors.text }]}>{user.name}</Text>
              <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                Friends can scan this in Stride to find and follow you.
              </Text>
              <View style={styles.qrBox}>
                <QRCode value={`stride://athlete/${user.id}`} size={200} color={INK} backgroundColor="#FFFFFF" />
              </View>
              <Pressable style={[styles.primary, { backgroundColor: colors.brand }]} onPress={() => router.push('/scan')}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={INK} />
                <Text style={styles.primaryText}>Scan a Friend’s Code</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.invite}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Invite friends that aren’t on Stride</Text>
            <Pressable style={[styles.primary, { backgroundColor: colors.brand }]}
              onPress={() => Share.share({ message: inviteMessage(user?.name) })}>
              <MaterialCommunityIcons name="export-variant" size={20} color={INK} />
              <Text style={styles.primaryText}>Invite</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// Pick someone from your contacts and send them an invite by text message. Nothing from
// your contacts is uploaded.
function InviteContacts() {
  const colors = useColors();
  const { user } = useAuth();

  const pick = async () => {
    try {
      const contact = await Contact.presentPicker();
      if (!contact) return;
      const [name, phones] = await Promise.all([contact.getFullName(), contact.getPhones()]);
      const number = phones[0]?.number;
      const message = inviteMessage(user?.name);
      if (number) {
        // iPhone's Messages app takes the text after "&body=".
        await Linking.openURL(`sms:${number.replace(/[^\d+]/g, '')}&body=${encodeURIComponent(message)}`);
      } else {
        Alert.alert(`${name || 'This contact'} has no phone number`, 'You can share an invite another way.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Share Invite', onPress: () => Share.share({ message }) },
        ]);
      }
    } catch (err) {
      Alert.alert('Could not open contacts', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <View style={[styles.qrCard, { backgroundColor: colors.raised }]}>
      <MaterialCommunityIcons name="card-account-phone-outline" size={48} color={colors.accent} />
      <Text style={[styles.qrTitle, { color: colors.text }]}>Invite from your contacts</Text>
      <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
        Pick a friend and we’ll open a text message with an invite. Your contacts stay on your phone.
      </Text>
      <Pressable style={[styles.primary, { backgroundColor: colors.brand }]} onPress={pick}>
        <MaterialCommunityIcons name="account-search-outline" size={20} color={INK} />
        <Text style={styles.primaryText}>Choose a Contact</Text>
      </Pressable>
    </View>
  );
}

// ---------- Clubs ----------

function Clubs() {
  const colors = useColors();
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<ActivityType | null>(null);
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      api.clubs(query.trim(), sport ?? undefined).then(setClubs, () => setClubs([]));
    }, 250);
    return () => clearTimeout(id);
  }, [query, sport]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SearchBox value={query} onChange={setQuery} placeholder="Search for Clubs on Stride" />
      <View style={styles.clubFilters}>
        <Pressable onPress={() => setSheet(true)} style={[styles.chip, { borderColor: sport ? colors.accent : colors.border }]}>
          <MaterialCommunityIcons name="run" size={16} color={sport ? colors.accent : colors.text} />
          <Text style={{ color: sport ? colors.accent : colors.text, fontWeight: '600' }}>{sport ? ACTIVITY_LABELS[sport] : 'Sport Type'}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/clubs/new')} style={[styles.chip, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="plus" size={16} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: '600' }}>Create a Club</Text>
        </Pressable>
      </View>
      {clubs === null ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : clubs.length ? (
        clubs.map((c) => <ClubRow key={c.id} club={c} />)
      ) : (
        <View style={styles.emptyClubs}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            {query || sport ? 'No clubs match yet.' : 'No clubs yet.'} Start one for your running group or cycling crew.
          </Text>
          <Pressable style={[styles.primary, { backgroundColor: colors.brand }]} onPress={() => router.push('/clubs/new')}>
            <Text style={styles.primaryText}>Create a Club</Text>
          </Pressable>
        </View>
      )}
      <OptionSheet visible={sheet} title="Sport Type" value={sport} onSelect={setSport} onClose={() => setSheet(false)}
        options={[{ value: null, label: 'All sports' }, ...ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABELS[t] }))]} />
    </ScrollView>
  );
}

// ---------- Small pieces ----------

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  const colors = useColors();
  return (
    <View style={[styles.search, { backgroundColor: colors.raised }]}>
      <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
      <TextInput style={[styles.searchInput, { color: colors.text }]} value={value} onChangeText={onChange}
        placeholder={placeholder} placeholderTextColor={colors.textSecondary} autoCorrect={false} returnKeyType="search" />
      {!!value && (
        <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Clear search">
          <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}

function ViewTab({ icon, label, active, onPress }: { icon: IconName; label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.viewTab, active && { borderBottomColor: colors.accent }]}>
      <MaterialCommunityIcons name={icon} size={24} color={active ? colors.text : colors.textSecondary} />
      <Text style={{ color: active ? colors.text : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  content: { padding: 12, paddingBottom: 40, gap: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, height: 44, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15 },
  views: { flexDirection: 'row', marginBottom: 8 },
  viewTab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  caps: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  smallButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, minWidth: 80, alignItems: 'center' },
  note: { textAlign: 'center', marginTop: 24 },
  loading: { marginTop: 32 },
  qrCard: { borderRadius: 16, padding: 20, alignItems: 'center', gap: 12, marginTop: 8 },
  qrTitle: { fontSize: 20, fontWeight: '700' },
  qrBox: { padding: 14, backgroundColor: '#FFFFFF', borderRadius: 16 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 22, alignSelf: 'stretch' },
  primaryText: { color: INK, fontWeight: '700', fontSize: 15 },
  invite: { alignItems: 'center', gap: 10, marginTop: 28 },
  clubFilters: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  emptyClubs: { alignItems: 'center', gap: 14, marginTop: 24 },
});
