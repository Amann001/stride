import {
  ACTIVITY_TYPES,
  weeklyGoalSchema,
  activityTypeSchema,
  type ActivityType,
  type CategoryStats,
  type Totals,
  type UserStats,
  type WeekTotals,
} from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { pool } from '../db';
import { addDays, safeTimeZone, tzQuery } from '../time';

const WEEKS_SHOWN = 12;

// Counts back week by week from this week. If nothing is logged this week yet, the
// streak up to last week still counts, so it doesn't "break" every Monday morning.
function weeklyStreak(activeWeeks: Set<string>, currentWeek: string): number {
  let week = activeWeeks.has(currentWeek) ? currentWeek : addDays(currentWeek, -7);
  let streak = 0;
  while (activeWeeks.has(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

const emptyTotals = (): Totals => ({ count: 0, distanceMeters: 0, movingSeconds: 0, elevationGainMeters: 0 });

function addTotals<T extends Totals>(a: T, b: Totals): T {
  return {
    ...a,
    count: a.count + b.count,
    distanceMeters: a.distanceMeters + b.distanceMeters,
    movingSeconds: a.movingSeconds + b.movingSeconds,
    elevationGainMeters: a.elevationGainMeters + b.elevationGainMeters,
  };
}

// `$2` is the time zone. Monday 00:00 of this week, and 1 January of this year, there.
const WEEK_START = `(date_trunc('week', now() AT TIME ZONE $2) AT TIME ZONE $2)`;
const YEAR_START = `(date_trunc('year', now() AT TIME ZONE $2) AT TIME ZONE $2)`;

// Count, distance, time and climbing for the activities matching `cond`, as `<prefix>_count` etc.
const totalsColumns = (prefix: string, cond: string) => `
  count(*) FILTER (WHERE ${cond})::int AS ${prefix}_count,
  coalesce(sum(distance_meters) FILTER (WHERE ${cond}), 0)::float AS ${prefix}_distance,
  coalesce(sum(moving_seconds) FILTER (WHERE ${cond}), 0)::float AS ${prefix}_moving,
  coalesce(sum(elevation_gain_meters) FILTER (WHERE ${cond}), 0)::float AS ${prefix}_elev`;

type TotalsRow = Record<string, number>;
const readTotals = (r: TotalsRow, prefix: string): Totals => ({
  count: r[`${prefix}_count`],
  distanceMeters: r[`${prefix}_distance`],
  movingSeconds: r[`${prefix}_moving`],
  elevationGainMeters: r[`${prefix}_elev`],
});

interface RecordRow {
  type: ActivityType;
  id: string;
  started_at: Date;
  value: number;
}

export async function statsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats', async (req): Promise<UserStats> => {
    const tz = safeTimeZone(tzQuery.parse(req.query).tz);
    const userId = req.user.sub;
    const params = [userId, tz];

    const [meta, totals, weekRows, activeWeeks, dates, efforts, longest, climbs, goals] = await Promise.all([
      pool.query<{ current_week: string }>(
        `SELECT to_char(date_trunc('week', now() AT TIME ZONE $1), 'YYYY-MM-DD') AS current_week`,
        [tz],
      ),
      pool.query<TotalsRow & { type: ActivityType }>(
        `SELECT type, ${totalsColumns('all', 'true')}, ${totalsColumns('week', `started_at >= ${WEEK_START}`)},
           ${totalsColumns('year', `started_at >= ${YEAR_START}`)}
         FROM activities WHERE user_id = $1 GROUP BY type`,
        params,
      ),
      pool.query<TotalsRow & { type: ActivityType; week: string }>(
        `SELECT type, to_char(date_trunc('week', started_at AT TIME ZONE $2), 'YYYY-MM-DD') AS week,
           ${totalsColumns('w', 'true')}
         FROM activities WHERE user_id = $1 AND started_at >= ${WEEK_START} - interval '${WEEKS_SHOWN - 1} weeks'
         GROUP BY type, week`,
        params,
      ),
      pool.query<{ week: string }>(
        `SELECT DISTINCT to_char(date_trunc('week', started_at AT TIME ZONE $2), 'YYYY-MM-DD') AS week
         FROM activities WHERE user_id = $1`,
        params,
      ),
      pool.query<{ day: string }>(
        `SELECT DISTINCT to_char(started_at AT TIME ZONE $2, 'YYYY-MM-DD') AS day FROM activities
         WHERE user_id = $1
           AND started_at >= (date_trunc('month', now() AT TIME ZONE $2) - interval '1 month') AT TIME ZONE $2
         ORDER BY day`,
        params,
      ),
      // Fastest and second-fastest time for each effort distance, per activity type.
      pool.query<RecordRow & { d: number; rank: number }>(
        `SELECT type, id, started_at, d, s AS value, rank FROM (
           SELECT a.type, a.id, a.started_at, e.d, e.s,
             row_number() OVER (PARTITION BY a.type, e.d ORDER BY e.s, a.started_at)::int AS rank
           FROM activities a
           CROSS JOIN LATERAL (
             SELECT (x->>'distanceMeters')::float AS d, (x->>'seconds')::float AS s
             FROM jsonb_array_elements(coalesce(a.best_efforts, '[]'::jsonb)) x
           ) e
           WHERE a.user_id = $1
         ) ranked WHERE rank <= 2 ORDER BY type, d, rank`,
        [userId],
      ),
      pool.query<RecordRow>(
        `SELECT DISTINCT ON (type) type, id, started_at, distance_meters AS value
         FROM activities WHERE user_id = $1 ORDER BY type, distance_meters DESC, started_at`,
        [userId],
      ),
      pool.query<RecordRow>(
        `SELECT DISTINCT ON (type) type, id, started_at, elevation_gain_meters AS value
         FROM activities WHERE user_id = $1 AND elevation_gain_meters > 0
         ORDER BY type, elevation_gain_meters DESC, started_at`,
        [userId],
      ),
      pool.query<{ type: ActivityType; target_meters: number }>(
        'SELECT type, target_meters FROM weekly_goals WHERE user_id = $1',
        [userId],
      ),
    ]);

    const currentWeek = meta.rows[0].current_week;
    const weekStarts = Array.from({ length: WEEKS_SHOWN }, (_, i) => addDays(currentWeek, (i - WEEKS_SHOWN + 1) * 7));
    const emptyWeeks = (): WeekTotals[] => weekStarts.map((weekStart) => ({ weekStart, ...emptyTotals() }));

    const byType = Object.fromEntries(
      ACTIVITY_TYPES.map((t): [ActivityType, CategoryStats] => [
        t,
        {
          thisWeek: emptyTotals(), thisYear: emptyTotals(), allTime: emptyTotals(), weeks: emptyWeeks(),
          bestEfforts: [], longest: null, biggestClimb: null, weeklyGoalMeters: null,
        },
      ]),
    ) as Record<ActivityType, CategoryStats>;

    for (const r of totals.rows) {
      byType[r.type].allTime = readTotals(r, 'all');
      byType[r.type].thisWeek = readTotals(r, 'week');
      byType[r.type].thisYear = readTotals(r, 'year');
    }
    for (const r of weekRows.rows) {
      const i = weekStarts.indexOf(r.week);
      if (i >= 0) byType[r.type].weeks[i] = { weekStart: r.week, ...readTotals(r, 'w') };
    }
    const record = (r: RecordRow) => ({ value: r.value, activityId: r.id, startedAt: r.started_at.toISOString() });
    for (const r of efforts.rows) {
      byType[r.type].bestEfforts.push({ ...record(r), distanceMeters: r.d, rank: r.rank as 1 | 2 });
    }
    for (const r of longest.rows) byType[r.type].longest = record(r);
    for (const r of climbs.rows) byType[r.type].biggestClimb = record(r);
    for (const r of goals.rows) byType[r.type].weeklyGoalMeters = r.target_meters;

    const activeDates = dates.rows.map((r) => r.day);
    const all = ACTIVITY_TYPES.map((t) => byType[t]);
    return {
      streakWeeks: weeklyStreak(new Set(activeWeeks.rows.map((r) => r.week)), currentWeek),
      activeDays: Array.from({ length: 7 }, (_, i) => activeDates.includes(addDays(currentWeek, i))),
      activeDates,
      activityCount: all.reduce((n, c) => n + c.allTime.count, 0),
      thisWeek: all.map((c) => c.thisWeek).reduce(addTotals, emptyTotals()),
      weeks: emptyWeeks().map((w, i) => all.reduce((sum, c) => addTotals(sum, c.weeks[i]), w)),
      byType,
    };
  });

  // Set or clear (targetMeters: 0) your weekly distance goal for one kind of activity.
  app.put('/goals/:type', async (req, reply) => {
    const { type } = z.object({ type: activityTypeSchema }).parse(req.params);
    const { targetMeters } = weeklyGoalSchema.parse(req.body);
    if (targetMeters === 0) {
      await pool.query('DELETE FROM weekly_goals WHERE user_id = $1 AND type = $2', [req.user.sub, type]);
    } else {
      await pool.query(
        `INSERT INTO weekly_goals (user_id, type, target_meters) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, type) DO UPDATE SET target_meters = EXCLUDED.target_meters`,
        [req.user.sub, type, targetMeters],
      );
    }
    return reply.code(204).send();
  });
}
