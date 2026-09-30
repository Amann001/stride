import { ACTIVITY_TYPES, type ActivityType, type CategoryStats, type Totals, type UserStats } from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { pool } from '../db';

const statsQuery = z.object({ tz: z.string().max(64).optional() });

// Weeks run Monday to Sunday in the user's own time zone. The phone sends it (e.g.
// "Asia/Kolkata"); anything we don't recognise falls back to UTC.
function safeTimeZone(tz: string | undefined): string {
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

const DAY_MS = 86_400_000;
const dayMs = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);

// Counts back week by week from this week. If nothing is logged this week yet, the
// streak up to last week still counts, so it doesn't "break" every Monday morning.
function weeklyStreak(activeWeeks: string[], currentWeek: string): number {
  const weeks = new Set(activeWeeks.map(dayMs));
  let week = dayMs(currentWeek);
  if (!weeks.has(week)) week -= 7 * DAY_MS;
  let streak = 0;
  while (weeks.has(week)) {
    streak++;
    week -= 7 * DAY_MS;
  }
  return streak;
}

const emptyTotals = (): Totals => ({ count: 0, distanceMeters: 0, movingSeconds: 0, elevationGainMeters: 0 });

function addTotals(a: Totals, b: Totals): Totals {
  return {
    count: a.count + b.count,
    distanceMeters: a.distanceMeters + b.distanceMeters,
    movingSeconds: a.movingSeconds + b.movingSeconds,
    elevationGainMeters: a.elevationGainMeters + b.elevationGainMeters,
  };
}

// `$2` is the time zone. This is Monday 00:00 of the current week there.
const WEEK_START = `date_trunc('week', now() AT TIME ZONE $2) AT TIME ZONE $2`;

export async function statsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats', async (req): Promise<UserStats> => {
    const tz = safeTimeZone(statsQuery.parse(req.query).tz);
    const params = [req.user.sub, tz];

    const [totals, weeks, days, efforts, longest, climbs] = await Promise.all([
      pool.query<{ type: ActivityType; count: number; distance: number; moving: number; elev: number;
        w_count: number; w_distance: number; w_moving: number; w_elev: number }>(
        `SELECT type,
           count(*)::int AS count,
           sum(distance_meters)::float AS distance,
           sum(moving_seconds)::float AS moving,
           sum(elevation_gain_meters)::float AS elev,
           count(*) FILTER (WHERE started_at >= ${WEEK_START})::int AS w_count,
           coalesce(sum(distance_meters) FILTER (WHERE started_at >= ${WEEK_START}), 0)::float AS w_distance,
           coalesce(sum(moving_seconds) FILTER (WHERE started_at >= ${WEEK_START}), 0)::float AS w_moving,
           coalesce(sum(elevation_gain_meters) FILTER (WHERE started_at >= ${WEEK_START}), 0)::float AS w_elev
         FROM activities WHERE user_id = $1 GROUP BY type`,
        params,
      ),
      pool.query<{ week: string; current: string }>(
        `SELECT DISTINCT to_char(date_trunc('week', started_at AT TIME ZONE $2), 'YYYY-MM-DD') AS week,
           to_char(date_trunc('week', now() AT TIME ZONE $2), 'YYYY-MM-DD') AS current
         FROM activities WHERE user_id = $1`,
        params,
      ),
      pool.query<{ dow: number }>(
        `SELECT DISTINCT extract(isodow FROM started_at AT TIME ZONE $2)::int AS dow
         FROM activities WHERE user_id = $1 AND started_at >= ${WEEK_START}`,
        params,
      ),
      // Fastest time for each effort distance, per activity type.
      pool.query<{ type: ActivityType; id: string; started_at: Date; d: number; s: number }>(
        `SELECT DISTINCT ON (a.type, e.d) a.type, a.id, a.started_at, e.d, e.s
         FROM activities a
         CROSS JOIN LATERAL (
           SELECT (x->>'distanceMeters')::float AS d, (x->>'seconds')::float AS s
           FROM jsonb_array_elements(coalesce(a.best_efforts, '[]'::jsonb)) x
         ) e
         WHERE a.user_id = $1
         ORDER BY a.type, e.d, e.s, a.started_at`,
        [req.user.sub],
      ),
      pool.query<{ type: ActivityType; id: string; started_at: Date; value: number }>(
        `SELECT DISTINCT ON (type) type, id, started_at, distance_meters AS value
         FROM activities WHERE user_id = $1 ORDER BY type, distance_meters DESC, started_at`,
        [req.user.sub],
      ),
      pool.query<{ type: ActivityType; id: string; started_at: Date; value: number }>(
        `SELECT DISTINCT ON (type) type, id, started_at, elevation_gain_meters AS value
         FROM activities WHERE user_id = $1 AND elevation_gain_meters > 0
         ORDER BY type, elevation_gain_meters DESC, started_at`,
        [req.user.sub],
      ),
    ]);

    const byType = Object.fromEntries(
      ACTIVITY_TYPES.map((t): [ActivityType, CategoryStats] => [
        t,
        { thisWeek: emptyTotals(), allTime: emptyTotals(), bestEfforts: [], longest: null, biggestClimb: null },
      ]),
    ) as Record<ActivityType, CategoryStats>;

    for (const r of totals.rows) {
      byType[r.type].allTime = { count: r.count, distanceMeters: r.distance, movingSeconds: r.moving, elevationGainMeters: r.elev };
      byType[r.type].thisWeek = { count: r.w_count, distanceMeters: r.w_distance, movingSeconds: r.w_moving, elevationGainMeters: r.w_elev };
    }
    for (const r of efforts.rows) {
      byType[r.type].bestEfforts.push({ distanceMeters: r.d, value: r.s, activityId: r.id, startedAt: r.started_at.toISOString() });
    }
    for (const r of longest.rows) {
      byType[r.type].longest = { value: r.value, activityId: r.id, startedAt: r.started_at.toISOString() };
    }
    for (const r of climbs.rows) {
      byType[r.type].biggestClimb = { value: r.value, activityId: r.id, startedAt: r.started_at.toISOString() };
    }

    const activeDays = Array.from({ length: 7 }, (_, i) => days.rows.some((r) => r.dow === i + 1));
    const currentWeek = weeks.rows[0]?.current;
    return {
      streakWeeks: currentWeek ? weeklyStreak(weeks.rows.map((r) => r.week), currentWeek) : 0,
      activeDays,
      thisWeek: ACTIVITY_TYPES.map((t) => byType[t].thisWeek).reduce(addTotals, emptyTotals()),
      byType,
    };
  });
}
