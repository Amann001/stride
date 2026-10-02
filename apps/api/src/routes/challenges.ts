import {
  CHALLENGE_TEMPLATES,
  challengeId,
  challengeIdSchema,
  monthName,
  parseChallengeId,
  type ActivityType,
  type Challenge,
  type ChallengesResponse,
  type ChallengeTemplate,
} from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { pool } from '../db';
import { currentMonth, safeTimeZone, tzQuery } from '../time';

interface MonthRow {
  type: ActivityType;
  distance: number;
  moving: number;
  elev: number;
  longest: number;
  days: string[];
}

// Your totals for each kind of activity in one calendar month ("2026-10"), in your time zone.
async function monthTotals(userId: string, tz: string, month: string): Promise<MonthRow[]> {
  const { rows } = await pool.query<MonthRow>(
    `SELECT type,
       sum(distance_meters)::float AS distance,
       sum(moving_seconds)::float AS moving,
       sum(elevation_gain_meters)::float AS elev,
       max(distance_meters)::float AS longest,
       array_agg(DISTINCT to_char(started_at AT TIME ZONE $2, 'YYYY-MM-DD')) AS days
     FROM activities
     WHERE user_id = $1
       AND started_at >= ($3::timestamp AT TIME ZONE $2)
       AND started_at < (($3::timestamp + interval '1 month') AT TIME ZONE $2)
     GROUP BY type`,
    [userId, tz, `${month}-01`],
  );
  return rows;
}

function progressFor(template: ChallengeTemplate, rows: MonthRow[]): number {
  const counted = rows.filter((r) => template.sport === null || r.type === template.sport);
  const sum = (f: (r: MonthRow) => number) => counted.reduce((n, r) => n + f(r), 0);
  switch (template.metric) {
    case 'distance':
      return sum((r) => r.distance);
    case 'time':
      return sum((r) => r.moving);
    case 'elevation':
      return sum((r) => r.elev);
    case 'longest':
      return Math.max(0, ...counted.map((r) => r.longest));
    case 'activeDays':
      return new Set(counted.flatMap((r) => r.days)).size;
  }
}

const idParams = z.object({ id: challengeIdSchema });

export async function challengeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // This month's challenges with your progress, plus every challenge you've completed.
  app.get('/challenges', async (req): Promise<ChallengesResponse> => {
    const tz = safeTimeZone(tzQuery.parse(req.query).tz);
    const userId = req.user.sub;
    const month = currentMonth(tz);

    const { rows: joins } = await pool.query<{ challenge_id: string }>(
      'SELECT challenge_id FROM challenge_joins WHERE user_id = $1',
      [userId],
    );
    const joined = new Set(joins.map((j) => j.challenge_id).filter((id) => parseChallengeId(id)));

    // Progress is needed for this month, and for past months where you joined something.
    const months = [...new Set([month, ...[...joined].map((id) => id.slice(0, 7))])];
    const totals = new Map(await Promise.all(months.map(async (m) => [m, await monthTotals(userId, tz, m)] as const)));

    const currentIds = CHALLENGE_TEMPLATES.map((t) => challengeId(month, t.key));
    const allIds = [...new Set([...currentIds, ...joined])];
    const { rows: counts } = await pool.query<{ challenge_id: string; n: number }>(
      'SELECT challenge_id, count(*)::int AS n FROM challenge_joins WHERE challenge_id = ANY($1) GROUP BY challenge_id',
      [allIds],
    );
    const participants = new Map(counts.map((c) => [c.challenge_id, c.n]));

    const build = (id: string): Challenge => {
      const { month: m, template } = parseChallengeId(id)!;
      const progress = progressFor(template, totals.get(m) ?? []);
      const name = monthName(m);
      return {
        id,
        month: m,
        sport: template.sport,
        metric: template.metric,
        goal: template.goal,
        title: template.title.replace('{month}', name),
        description: template.description.replace('{month}', name),
        joined: joined.has(id),
        progress,
        completed: joined.has(id) && progress >= template.goal,
        participants: participants.get(id) ?? 0,
      };
    };

    return {
      current: currentIds.map(build),
      completed: [...joined].map(build).filter((c) => c.completed).sort((a, b) => b.month.localeCompare(a.month)),
    };
  });

  // Only this month's challenges can be joined.
  app.post('/challenges/:id/join', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const tz = safeTimeZone(tzQuery.parse(req.query).tz);
    if (id.slice(0, 7) !== currentMonth(tz)) {
      return reply.code(400).send({ error: 'This challenge has ended' });
    }
    await pool.query(
      'INSERT INTO challenge_joins (user_id, challenge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.sub, id],
    );
    return reply.code(204).send();
  });

  app.delete('/challenges/:id/join', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await pool.query('DELETE FROM challenge_joins WHERE user_id = $1 AND challenge_id = $2', [req.user.sub, id]);
    return reply.code(204).send();
  });
}
