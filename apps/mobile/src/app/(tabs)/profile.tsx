import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  effortName,
  formatDistance,
  formatDuration,
  formatDurationShort,
  formatElevation,
  formatPaceOrSpeed,
  type ActivitySummary,
  type ActivityType,
  type AthleteProfile,
  type Challenge,
  type PersonalRecord,
  type Totals,
  type UserStats,
} from '@repo/shared';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { MEDAL_COLORS } from '@/components/achievements';
import { ActivityCard } from '@/components/activity-card';
import { Avatar } from '@/components/avatar';
import { ChallengeBadge } from '@/components/challenge-card';
import { StreakCalendar } from '@/components/streak-calendar';
import { HeaderButton, TabHeader } from '@/components/tab-header';
import { WeeklyChart } from '@/components/weekly-chart';
import { CATEGORY_LOOKS, type IconName } from '@/constants/categories';
import { INK, LIME, useColors } from '@/constants/theme';
import { API_URL, api, privacyUrl, termsUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Section = 'progress' | 'activities' | 'more';

// "You" tab: your profile, then three sections like Strava's: Progress (this week,
// 12-week chart, streak, goal, best efforts), Activities, and More (statistics,
// trophy case, settings).
export default function ProfileScreen() {
  const colors = useColors();
  const { user, signOut } = useAuth();
  const [me, setMe] = useState<AthleteProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const [trophies, setTrophies] = useState<Challenge[]>([]);
  const [section, setSection] = useState<Section>('progress');
  const [sport, setSport] = useState<ActivityType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, list, c, profile] = await Promise.all([
      api.getStats(), api.listActivities(), api.getChallenges(), user ? api.athlete(user.id) : Promise.resolve(null),
    ]).catch(() => [null, null, null, null] as const);
    if (profile) setMe(profile);
    if (s) setStats(s);
    if (list) setActivities(list);
    if (c) setTrophies(c.completed);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const editProfile = () => router.push('/edit-profile');

  const shareProfile = () => {
    const year = ACTIVITY_TYPES.reduce((n, t) => n + (stats?.byType[t].thisYear.distanceMeters ?? 0), 0);
    Share.share({ message: `${user?.name} on Stride: ${stats?.activityCount ?? 0} activities, ${formatDistance(year)} this year.` });
  };

  const allActivitiesCount = stats?.activityCount ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TabHeader
        left={<HeaderButton icon="plus" label="Add manual activity" onPress={() => router.push('/manual')} />}
        title={user?.name}
        right={<HeaderButton icon="cog-outline" label="Settings" onPress={() => setSection('more')} />}
      />
      <ScrollView
        style={{ backgroundColor: colors.separator }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} />}>
        <View style={[styles.headerBlock, { backgroundColor: colors.card }]}>
        <View style={styles.profileRow}>
          {user && <Avatar id={user.id} name={user.name} size={72} />}
          <View style={styles.profileText}>
            <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {allActivitiesCount} {allActivitiesCount === 1 ? 'activity' : 'activities'}
              {user?.location ? ` · ${user.location}` : ''}
            </Text>
          </View>
        </View>
        {!!user?.bio && <Text style={{ color: colors.text, fontSize: 15 }}>{user.bio}</Text>}
        <View style={styles.follows}>
          {([['followers', me?.followerCount ?? 0], ['following', me?.followingCount ?? 0]] as const).map(([list, n]) => (
            <Pressable key={list} hitSlop={6}
              onPress={() => user && router.push({ pathname: '/connections', params: { athleteId: user.id, list, name: user.name } })}>
              <Text style={{ color: colors.text }}>
                <Text style={{ fontWeight: '700' }}>{n}</Text>{' '}
                <Text style={{ color: colors.textSecondary }}>{list === 'followers' ? (n === 1 ? 'follower' : 'followers') : 'following'}</Text>
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/search')} hitSlop={6} style={styles.findFriends}>
            <MaterialCommunityIcons name="account-plus-outline" size={16} color={colors.accent} />
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Find friends</Text>
          </Pressable>
        </View>
        <View style={styles.profileButtons}>
          <OutlineButton label="Edit profile" onPress={editProfile} />
          <OutlineButton label="Share profile" onPress={shareProfile} />
        </View>

        <View style={[styles.segments, { borderColor: colors.border }]}>
          {([['progress', 'Progress', 'chart-box-outline'], ['activities', 'Activities', 'pulse'], ['more', 'More', 'menu']] as const).map(
            ([key, label, icon]) => {
              const active = section === key;
              return (
                <Pressable key={key} onPress={() => setSection(key)}
                  style={[styles.segment, active && { borderBottomColor: colors.accent }]}>
                  <MaterialCommunityIcons name={icon} size={22} color={active ? colors.text : colors.textSecondary} />
                  <Text style={{ color: active ? colors.text : colors.textSecondary, fontWeight: '600', fontSize: 12 }}>{label}</Text>
                </Pressable>
              );
            },
          )}
        </View>
        </View>

        {section === 'progress' && <Progress stats={stats} sport={sport} setSport={setSport} onGoalSaved={load} />}
        {section === 'activities' && (
          <View style={styles.sectionBody}>
            {activities.length ? activities.map((a) => <ActivityCard key={a.id} activity={a} />) : (
              <Card>
                <Text style={[styles.empty, { color: colors.textSecondary }]}>No activities yet.</Text>
              </Card>
            )}
          </View>
        )}
        {section === 'more' && <More stats={stats} trophies={trophies} activities={activities} onLogOut={signOut} />}
      </ScrollView>
    </View>
  );
}

// ---------- Progress ----------

function Progress({ stats, sport, setSport, onGoalSaved }: {
  stats: UserStats | null;
  sport: ActivityType | 'all';
  setSport: (s: ActivityType | 'all') => void;
  onGoalSaved: () => void;
}) {
  const colors = useColors();
  const cat = sport === 'all' ? null : stats?.byType[sport];
  const week = sport === 'all' ? stats?.thisWeek : cat?.thisWeek;
  const weeks = sport === 'all' ? stats?.weeks : cat?.weeks;
  const color = sport === 'all' ? LIME : CATEGORY_LOOKS[sport].color;

  const setGoal = () => {
    if (sport === 'all') return;
    Alert.prompt(
      `Weekly ${ACTIVITY_LABELS[sport].toLowerCase()} goal`,
      'How many kilometers a week? Enter 0 to remove the goal.',
      async (text) => {
        const km = Number(text?.replace(',', '.'));
        if (!Number.isFinite(km) || km < 0) return;
        try {
          await api.setWeeklyGoal(sport, Math.round(km * 1000));
          onGoalSaved();
        } catch (err) {
          Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again.');
        }
      },
      'plain-text',
      cat?.weeklyGoalMeters ? String(cat.weeklyGoalMeters / 1000) : '',
      'decimal-pad',
    );
  };

  return (
    <View style={styles.sectionBody}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipBar, { backgroundColor: colors.card }]}
        contentContainerStyle={styles.chips}>
        {(['all', ...ACTIVITY_TYPES] as const).map((t) => {
          const active = sport === t;
          const fill = t === 'all' ? colors.brand : CATEGORY_LOOKS[t].color;
          return (
            <Pressable key={t} onPress={() => setSport(t)}
              style={[styles.chip, { borderColor: active ? fill : colors.border }, active && { backgroundColor: fill }]}>
              <MaterialCommunityIcons name={t === 'all' ? 'lightning-bolt' : CATEGORY_LOOKS[t].icon} size={16}
                color={active ? INK : colors.text} />
              <Text style={{ color: active ? INK : colors.text, fontWeight: '600' }}>
                {t === 'all' ? 'All Sports' : ACTIVITY_LABELS[t]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>This week</Text>
        <View style={styles.inlineStats}>
          <InlineStat label="Distance" value={formatDistance(week?.distanceMeters ?? 0)} />
          <InlineStat label="Time" value={formatDurationShort(week?.movingSeconds ?? 0)} />
          <InlineStat label="Elev Gain" value={formatElevation(week?.elevationGainMeters ?? 0)} />
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Past 12 weeks</Text>
        {weeks && (
          <WeeklyChart weeks={weeks} value={(w) => w.distanceMeters} color={color}
            format={(m) => (m >= 10_000 ? `${Math.round(m / 1000)} km` : `${(m / 1000).toFixed(1)} km`)} />
        )}
      </Card>

      <StreakCalendar streakWeeks={stats?.streakWeeks ?? 0} activeDates={stats?.activeDates ?? []} />

      {sport !== 'all' && cat && (
        <Card>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly {ACTIVITY_LABELS[sport]} Goal</Text>
            <Pressable onPress={setGoal} hitSlop={8}>
              <Text style={{ color: colors.accent, fontWeight: '700' }}>{cat.weeklyGoalMeters ? 'Edit' : 'Set goal'}</Text>
            </Pressable>
          </View>
          {cat.weeklyGoalMeters ? (
            <>
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <View style={[styles.fill, {
                  backgroundColor: color,
                  width: `${Math.min(100, (cat.thisWeek.distanceMeters / cat.weeklyGoalMeters) * 100)}%`,
                }]} />
              </View>
              <Text style={{ color: colors.textSecondary }}>
                {formatDistance(cat.thisWeek.distanceMeters)} of {formatDistance(cat.weeklyGoalMeters)}
                {cat.thisWeek.distanceMeters >= cat.weeklyGoalMeters ? ' · Goal reached! 🎉' : ''}
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.textSecondary }}>Set a weekly distance to aim for and track it here.</Text>
          )}
        </Card>
      )}

      {sport !== 'all' && cat && (cat.bestEfforts.length > 0 || cat.longest) && (
        <Card>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Best Efforts</Text>
          {cat.bestEfforts.map((e) => (
            <RecordRow key={`${e.distanceMeters}-${e.rank}`} record={e}
              icon="medal" iconColor={MEDAL_COLORS[e.rank]} dim={e.rank === 2}
              label={e.rank === 1 ? `${effortName(e.distanceMeters)} PR` : `2nd-fastest ${effortName(e.distanceMeters)}`}
              value={formatDuration(e.value)} detail={formatPaceOrSpeed(sport, e.distanceMeters, e.value)} />
          ))}
          {cat.longest && (
            <RecordRow record={cat.longest} icon="map-marker-distance" iconColor={MEDAL_COLORS[1]}
              label={`Longest ${ACTIVITY_LABELS[sport].toLowerCase()}`} value={formatDistance(cat.longest.value)} />
          )}
          {cat.biggestClimb && (
            <RecordRow record={cat.biggestClimb} icon="image-filter-hdr" iconColor={MEDAL_COLORS[1]}
              label="Biggest climb" value={formatElevation(cat.biggestClimb.value)} />
          )}
        </Card>
      )}
    </View>
  );
}

// ---------- More ----------

function More({ stats, trophies, activities, onLogOut }: {
  stats: UserStats | null; trophies: Challenge[]; activities: ActivitySummary[]; onLogOut: () => void;
}) {
  const colors = useColors();
  const achievementCount = activities.reduce((n, a) => n + a.achievements.length, 0);
  return (
    <View style={styles.sectionBody}>
      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Statistics</Text>
        {ACTIVITY_TYPES.map((t) => {
          const c = stats?.byType[t];
          if (!c?.allTime.count) return null;
          return (
            <View key={t} style={styles.statBlock}>
              <View style={styles.statBlockHeader}>
                <MaterialCommunityIcons name={CATEGORY_LOOKS[t].icon} size={20} color={colors.text} />
                <Text style={[styles.statBlockTitle, { color: colors.text }]}>{ACTIVITY_LABELS[t]}</Text>
              </View>
              <TotalsRow label="This year" totals={c.thisYear} />
              <TotalsRow label="All time" totals={c.allTime} />
            </View>
          );
        })}
        {!stats?.activityCount && <Text style={{ color: colors.textSecondary }}>Your yearly and all-time totals will show here.</Text>}
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Trophy Case</Text>
          <Text style={{ color: colors.textSecondary }}>{trophies.length}</Text>
        </View>
        {trophies.length > 0 ? (
          <View style={styles.trophies}>
            {trophies.map((c) => (
              <View key={c.id} style={styles.trophy}>
                <ChallengeBadge challenge={c} size={64} />
                <Text style={[styles.trophyTitle, { color: colors.text }]} numberOfLines={2}>{c.title}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.textSecondary }}>Join challenges to find motivation, build a habit, and earn trophies.</Text>
        )}
        <Pressable style={[styles.primary, { backgroundColor: colors.brand }]} onPress={() => router.navigate('/groups')}>
          <Text style={{ color: colors.onBrand, fontWeight: '700' }}>Find new Challenges</Text>
        </Pressable>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          🏅 {achievementCount} {achievementCount === 1 ? 'achievement' : 'achievements'} earned on your activities.
        </Text>
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Settings</Text>
        <SettingRow label="Units of Measurement" value="Metric" />
        {__DEV__ && <SettingRow label="Server" value={API_URL} />}
        <LinkRow label="Blocked People" onPress={() => router.push('/blocked')} />
        <LinkRow label="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(privacyUrl())} />
        <LinkRow label="Terms of Use" onPress={() => WebBrowser.openBrowserAsync(termsUrl())} />
        <Pressable onPress={onLogOut} style={[styles.logout, { borderColor: colors.danger }]}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Log Out</Text>
        </Pressable>
        <LinkRow label="Delete Account" danger onPress={() => router.push('/delete-account')} />
      </Card>
    </View>
  );
}

// ---------- Small pieces ----------

function Card({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <View style={[styles.card, { backgroundColor: colors.card }]}>{children}</View>;
}

function OutlineButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.outline, { borderColor: colors.border }]}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function InlineStat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
      <Text style={[styles.inlineValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function TotalsRow({ label, totals }: { label: string; totals: Totals }) {
  const colors = useColors();
  return (
    <View style={styles.totalsRow}>
      <Text style={[styles.totalsLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.totalsValue, { color: colors.text }]}>
        {totals.count} · {formatDistance(totals.distanceMeters)} · {formatDurationShort(totals.movingSeconds)} · {formatElevation(totals.elevationGainMeters)}
      </Text>
    </View>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.settingRow}>
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
      <Text style={{ color: colors.textSecondary, flexShrink: 1 }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// A settings row that opens something (a screen or a web page).
function LinkRow({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  const colors = useColors();
  return (
    <Pressable style={styles.settingRow} onPress={onPress} accessibilityRole="button">
      <Text style={{ color: danger ? colors.danger : colors.text, fontSize: 15 }}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

// One record; tapping it opens the activity where you set it.
function RecordRow({ icon, iconColor, label, record, value, detail, dim = false }: {
  icon: IconName; iconColor: string; label: string; record: PersonalRecord; value: string; detail?: string; dim?: boolean;
}) {
  const colors = useColors();
  const date = new Date(record.startedAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
  const text = dim ? colors.textSecondary : colors.text;
  return (
    <Pressable style={styles.record}
      onPress={() => router.push({ pathname: '/activity/[id]', params: { id: record.activityId } })}>
      <MaterialCommunityIcons name={icon} size={28} color={iconColor} />
      <View style={styles.recordText}>
        <Text style={[styles.recordLabel, { color: text }]}>{label}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{date}</Text>
      </View>
      <View style={styles.recordValue}>
        <Text style={[styles.recordLabel, { color: text }]}>{value}</Text>
        {!!detail && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{detail}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 40 },
  // Everything above the Progress / Activities / More tabs.
  headerBlock: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '700' },
  profileText: { flex: 1 },
  name: { fontSize: 22, fontWeight: '700' },
  profileButtons: { flexDirection: 'row', gap: 10 },
  follows: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  findFriends: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  outline: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 9, alignItems: 'center' },
  segments: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  segment: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  // Sections under the tabs, with a band between each (the page colour shows through the gap).
  sectionBody: { gap: 8 },
  empty: { textAlign: 'center', paddingVertical: 16 },
  // The sport chips join straight onto the first section below them.
  chipBar: { marginBottom: -8 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  card: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  inlineStats: { flexDirection: 'row', gap: 28 },
  inlineValue: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  record: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordText: { flex: 1 },
  recordLabel: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  recordValue: { alignItems: 'flex-end' },
  statBlock: { gap: 6 },
  statBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statBlockTitle: { fontSize: 15, fontWeight: '700' },
  totalsRow: { flexDirection: 'row', gap: 8 },
  totalsLabel: { width: 72 },
  totalsValue: { flex: 1, fontVariant: ['tabular-nums'] },
  trophies: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  trophy: { width: 90, alignItems: 'center', gap: 6 },
  trophyTitle: { fontSize: 12, textAlign: 'center', fontWeight: '600' },
  primary: { borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 4 },
  logout: { borderWidth: 1, borderRadius: 999, paddingVertical: 11, alignItems: 'center', marginTop: 4 },
});
