import {
  challengeDays,
  createCustomChallengeSchema,
  CUSTOM_CHALLENGE_MAX_MEMBERS,
  describeCustomChallenge,
  inviteToChallengeSchema,
  type ActivityType,
  type Challenge,
  type ChallengeMetric,
  type CustomChallengeDetail,
} from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import type { PoolClient } from 'pg';
import { z } from 'zod';

import { noBlockBetween } from '../activity-sql';
import { progressFor, TOTALS_COLUMNS, type TotalsRow } from '../challenge-progress';
import { pool } from '../db';
import { messageFor, pushInBackground } from '../push';
import { LIMITS } from '../rate-limits';
import { safeTimeZone, todayIn, tzQuery } from '../time';

// Challenges people create themselves: their own goal and dates, joined by friends they
// invite. Progress counts everyone's activities between the dates (in the creator's time
// zone), except ones set to "Only you", like club leaderboards.

const idParams = z.object({ id: z.uuid() });

interface CustomRow {
  id: string;
  title: string;
  sport: ActivityType | null;
  metric: ChallengeMetric;
  goal: number;
  start_date: string;
  end_date: string;
  time_zone: string;
  // Today in the challenge's time zone.
  today: string;
  creator_id: string;
  creator_name: string;
  participants: number;
  my_status: 'invited' | 'joined' | null;
}

// `$1` is the logged-in user.
const CUSTOM_SELECT = `SELECT ch.id, ch.title, ch.sport, ch.metric, ch.goal, ch.time_zone,
    to_char(ch.start_date, 'YYYY-MM-DD') AS start_date, to_char(ch.end_date, 'YYYY-MM-DD') AS end_date,
    to_char((now() AT TIME ZONE ch.time_zone)::date, 'YYYY-MM-DD') AS today,
    ch.creator_id, cu.name AS creator_name,
    (SELECT count(*)::int FROM custom_challenge_members m WHERE m.challenge_id = ch.id AND m.status = 'joined') AS participants,
    (SELECT m.status FROM custom_challenge_members m WHERE m.challenge_id = ch.id AND m.user_id = $1) AS my_status
  FROM custom_challenges ch JOIN users cu ON cu.id = ch.creator_id`;

const statusOf = (r: CustomRow) => (r.today < r.start_date ? 'upcoming' : r.today > r.end_date ? 'ended' : 'active');

// Each person's progress on a challenge.
async function progressByUser(r: CustomRow, userIds: string[]): Promise<Map<string, number>> {
  if (!userIds.length) return new Map();
  const { rows } = await pool.query<TotalsRow & { user_id: string }>(
    `SELECT a.user_id, ${TOTALS_COLUMNS('$2')}
     FROM activities a
     WHERE a.user_id = ANY($1) AND a.visibility <> 'only_me'
       AND a.started_at >= ($3::timestamp AT TIME ZONE $2)
       AND a.started_at < (($4::timestamp + interval '1 day') AT TIME ZONE $2)
     GROUP BY a.user_id, a.type`,
    [userIds, r.time_zone, r.start_date, r.end_date],
  );
  return new Map(userIds.map((id) => [id, progressFor(r, rows.filter((row) => row.user_id === id))]));
}

function toChallenge(r: CustomRow, progress: number): Challenge {
  const joined = r.my_status === 'joined';
  return {
    id: r.id,
    month: r.end_date.slice(0, 7),
    sport: r.sport,
    metric: r.metric,
    goal: r.goal,
    title: r.title,
    description: describeCustomChallenge({ ...r, startDate: r.start_date, endDate: r.end_date }),
    joined,
    progress,
    completed: joined && progress >= r.goal,
    participants: r.participants,
    custom: {
      startDate: r.start_date,
      endDate: r.end_date,
      creator: { id: r.creator_id, name: r.creator_name },
      invited: r.my_status === 'invited',
      status: statusOf(r),
    },
  };
}

async function findChallenge(id: string, userId: string): Promise<CustomRow | null> {
  const { rows } = await pool.query<CustomRow>(`${CUSTOM_SELECT} WHERE ch.id = $2`, [userId, id]);
  return rows[0] ?? null;
}

// Every created challenge you've joined or been invited to, with your progress.
export async function myCustomChallenges(userId: string): Promise<Challenge[]> {
  const { rows } = await pool.query<CustomRow>(
    `${CUSTOM_SELECT}
     JOIN custom_challenge_members me ON me.challenge_id = ch.id AND me.user_id = $1
     WHERE ch.creator_id = $1 OR ${noBlockBetween('$1', 'ch.creator_id')}
     ORDER BY ch.start_date, ch.created_at LIMIT 200`,
    [userId],
  );
  return Promise.all(
    rows.map(async (r) => toChallenge(r, r.my_status === 'joined' ? ((await progressByUser(r, [userId])).get(userId) ?? 0) : 0)),
  );
}

// Of `ids`, the people `inviterId` follows (and neither has blocked the other).
async function invitable(inviterId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { rows } = await pool.query<{ id: string }>(
    `SELECT f.followee_id AS id FROM follows f
     WHERE f.follower_id = $1 AND f.followee_id = ANY($2) AND ${noBlockBetween('$1', 'f.followee_id')}`,
    [inviterId, ids],
  );
  return rows.map((r) => r.id);
}

// Adds invites for people not already in the challenge, and tells each of them in the app.
// Returns who was newly invited, to push to their phones once the change is saved.
async function addInvites(client: PoolClient, challengeId: string, inviterId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { rows } = await client.query<{ user_id: string }>(
    `INSERT INTO custom_challenge_members (challenge_id, user_id, status, invited_by)
     SELECT $1, unnest($2::uuid[]), 'invited', $3
     ON CONFLICT DO NOTHING RETURNING user_id`,
    [challengeId, ids, inviterId],
  );
  if (rows.length) {
    await client.query(
      `INSERT INTO notifications (user_id, actor_id, kind, challenge_id)
       SELECT unnest($1::uuid[]), $2, 'challenge_invite', $3`,
      [rows.map((r) => r.user_id), inviterId, challengeId],
    );
  }
  return rows.map((r) => r.user_id);
}

function pushInvites(challengeId: string, inviterId: string, invited: string[]) {
  if (!invited.length) return;
  const message = messageFor(inviterId, 'challenge_invite', { challengeId });
  for (const userId of invited) pushInBackground(userId, inviterId, message);
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// The phone's time zone, if the database knows it too (the dates are counted there).
async function databaseTimeZone(tz: string): Promise<string> {
  try {
    await pool.query('SELECT now() AT TIME ZONE $1', [tz]);
    return tz;
  } catch {
    return 'UTC';
  }
}

export async function customChallengeRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post('/custom-challenges', { config: { rateLimit: LIMITS.newChallenge } }, async (req, reply) => {
    const input = createCustomChallengeSchema.parse(req.body);
    const me = req.user.sub;
    const tz = await databaseTimeZone(safeTimeZone(tzQuery.parse(req.query).tz));
    const today = todayIn(tz);
    if (input.startDate < today) return reply.code(400).send({ error: "The start date can't be in the past" });
    if (challengeDays(today, input.startDate) > 61) return reply.code(400).send({ error: 'Pick a start date in the next 2 months' });

    const invitees = await invitable(me, input.inviteIds.filter((id) => id !== me));
    const { id, invited } = await inTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO custom_challenges (creator_id, title, sport, metric, goal, start_date, end_date, time_zone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [me, input.title, input.sport, input.metric, input.goal, input.startDate, input.endDate, tz],
      );
      await client.query(
        "INSERT INTO custom_challenge_members (challenge_id, user_id, status) VALUES ($1, $2, 'joined')",
        [rows[0].id, me],
      );
      return { id: rows[0].id, invited: await addInvites(client, rows[0].id, me, invitees) };
    });
    pushInvites(id, me, invited);
    return reply.code(201).send({ id });
  });

  // A challenge's page. Only people in it (joined or invited) can see it.
  app.get('/custom-challenges/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const me = req.user.sub;
    const r = await findChallenge(id, me);
    if (!r?.my_status) return reply.code(404).send({ error: 'Challenge not found' });

    const { rows: members } = await pool.query<{ id: string; name: string; status: 'invited' | 'joined' }>(
      `SELECT u.id, u.name, m.status FROM custom_challenge_members m JOIN users u ON u.id = m.user_id
       WHERE m.challenge_id = $2 AND (u.id = $1 OR ${noBlockBetween('$1', 'u.id')})
       ORDER BY m.created_at`,
      [me, id],
    );
    const joined = members.filter((m) => m.status === 'joined');
    const progress = await progressByUser(r, joined.map((m) => m.id));
    const base = toChallenge(r, progress.get(me) ?? 0);
    const detail: CustomChallengeDetail = {
      ...base,
      custom: base.custom!,
      isCreator: r.creator_id === me,
      leaderboard: joined
        .map((m) => {
          const p = progress.get(m.id) ?? 0;
          return { athlete: { id: m.id, name: m.name }, progress: p, completed: p >= r.goal };
        })
        .sort((a, b) => b.progress - a.progress),
      invited: members.filter((m) => m.status === 'invited').map((m) => ({ id: m.id, name: m.name })),
    };
    return detail;
  });

  // Accept an invite.
  app.post('/custom-challenges/:id/join', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const r = await findChallenge(id, req.user.sub);
    if (!r?.my_status) return reply.code(404).send({ error: 'Challenge not found' });
    if (statusOf(r) === 'ended') return reply.code(400).send({ error: 'This challenge has ended' });
    await pool.query(
      "UPDATE custom_challenge_members SET status = 'joined' WHERE challenge_id = $1 AND user_id = $2",
      [id, req.user.sub],
    );
    return reply.code(204).send();
  });

  // Leave, or decline an invite. The creator deletes the challenge instead.
  app.delete('/custom-challenges/:id/join', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const r = await findChallenge(id, req.user.sub);
    if (!r?.my_status) return reply.code(404).send({ error: 'Challenge not found' });
    if (r.creator_id === req.user.sub) {
      return reply.code(400).send({ error: "You created this challenge, so you can't leave it. You can delete it instead." });
    }
    await pool.query('DELETE FROM custom_challenge_members WHERE challenge_id = $1 AND user_id = $2', [id, req.user.sub]);
    return reply.code(204).send();
  });

  // Anyone who has joined can invite more people they follow.
  app.post('/custom-challenges/:id/invite', { config: { rateLimit: LIMITS.challengeInvite } }, async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { ids } = inviteToChallengeSchema.parse(req.body);
    const me = req.user.sub;
    const r = await findChallenge(id, me);
    if (!r?.my_status) return reply.code(404).send({ error: 'Challenge not found' });
    if (r.my_status !== 'joined') return reply.code(403).send({ error: 'Join the challenge to invite people' });
    if (statusOf(r) === 'ended') return reply.code(400).send({ error: 'This challenge has ended' });

    const { rows } = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM custom_challenge_members WHERE challenge_id = $1',
      [id],
    );
    const invitees = await invitable(me, ids.filter((x) => x !== me));
    if (rows[0].n + invitees.length > CUSTOM_CHALLENGE_MAX_MEMBERS) {
      return reply.code(400).send({ error: `A challenge can have up to ${CUSTOM_CHALLENGE_MAX_MEMBERS} people` });
    }
    pushInvites(id, me, await inTransaction((client) => addInvites(client, id, me, invitees)));
    return reply.code(204).send();
  });

  app.delete('/custom-challenges/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { rowCount } = await pool.query('DELETE FROM custom_challenges WHERE id = $1 AND creator_id = $2', [id, req.user.sub]);
    if (!rowCount) return reply.code(404).send({ error: 'Challenge not found' });
    return reply.code(204).send();
  });
}
