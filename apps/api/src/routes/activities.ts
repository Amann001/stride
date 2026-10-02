import {
  CATEGORIES,
  cleanTrack,
  hideEnds,
  computeAchievements,
  createActivitySchema,
  encodePolyline,
  manualActivitySchema,
  updateActivitySchema,
  type ActivityDetail,
  type ActivitySummary,
  type TrackPoint,
} from '@repo/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { findActivity, findByClientId, selectActivities, toSummary, type ActivityRow } from '../activity-sql';
import { analyseActivity, earlierActivities } from '../analysis';
import { pool } from '../db';
import { LIMITS } from '../rate-limits';

const idParams = z.object({ id: z.uuid() });

// [minLat, maxLat, minLng, maxLng] of a track.
function boundingBox(points: TrackPoint[]): [number, number, number, number] {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return [minLat, maxLat, minLng, maxLng];
}

export async function activityRoutes(app: FastifyInstance) {
  // Every route in this file requires login.
  app.addHook('onRequest', app.authenticate);

  // Save a recorded activity. The server works out the stats itself
  // from the GPS points instead of trusting numbers sent by the phone.
  app.post('/activities', { config: { rateLimit: LIMITS.activity } }, async (req, reply) => {
    const input = createActivitySchema.parse(req.body);
    // Already saved this exact recording (a retried upload)? Return it instead of a duplicate.
    const existingId = input.clientId ? await findByClientId(req.user.sub, input.clientId) : null;
    if (existingId) return reply.code(200).send(toSummary((await findActivity(existingId, req.user.sub))!, req.user.sub));
    // Sort by time and drop GPS glitches (impossible jumps) before doing any maths.
    const points = cleanTrack(input.points, input.type);
    if (points.length < 2) {
      return reply.code(400).send({ error: 'Not enough good GPS points to save this activity' });
    }
    // Rides don't count steps, even if the phone sent some.
    const steps = CATEGORIES[input.type].countsSteps ? (input.steps ?? null) : null;
    const { stats, maxSpeedMps, bestEfforts, achievements } = await analyseActivity(
      pool,
      req.user.sub,
      input.type,
      points,
      steps,
    );
    // ON CONFLICT covers two uploads of the same recording arriving at the same moment.
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO activities (user_id, type, title, description, started_at, elapsed_seconds, moving_seconds,
         distance_meters, elevation_gain_meters, polyline, points, steps, max_speed_mps, best_efforts, achievements,
         min_lat, max_lat, min_lng, max_lng, client_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (user_id, client_id) WHERE client_id IS NOT NULL DO NOTHING
       RETURNING id`,
      [
        req.user.sub,
        input.type,
        input.title,
        input.description ?? null,
        new Date(points[0].t),
        stats.elapsedSeconds,
        stats.movingSeconds,
        stats.distanceMeters,
        stats.elevationGainMeters,
        encodePolyline(points),
        JSON.stringify(points),
        steps,
        maxSpeedMps,
        JSON.stringify(bestEfforts),
        JSON.stringify(achievements),
        // The box around the route, so heatmap tiles can find it quickly.
        ...boundingBox(points),
        input.clientId ?? null,
      ],
    );
    const id = rows[0]?.id ?? (await findByClientId(req.user.sub, input.clientId!));
    return reply.code(rows[0] ? 201 : 200).send(toSummary((await findActivity(id!, req.user.sub))!, req.user.sub));
  });

  // Save an activity typed in by hand (e.g. a treadmill run or a ride without the phone).
  // There's no GPS track, so no map, splits or best efforts, but it counts for totals,
  // streaks, challenges, and the longest/biggest-climb achievements.
  app.post('/activities/manual', { config: { rateLimit: LIMITS.activity } }, async (req, reply) => {
    const input = manualActivitySchema.parse(req.body);
    const startedAt = new Date(input.startedAt);
    const previous = await earlierActivities(pool, req.user.sub, input.type, startedAt);
    const achievements = computeAchievements(
      input.type,
      { distanceMeters: input.distanceMeters, elevationGainMeters: input.elevationGainMeters, steps: null, bestEfforts: [] },
      previous,
    );
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO activities (user_id, type, title, description, started_at, elapsed_seconds, moving_seconds,
         distance_meters, elevation_gain_meters, polyline, points, max_speed_mps, best_efforts, achievements)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, '', '[]', 0, '[]', $9)
       RETURNING id`,
      [
        req.user.sub,
        input.type,
        input.title,
        input.description ?? null,
        startedAt,
        input.elapsedSeconds,
        input.distanceMeters,
        input.elevationGainMeters,
        JSON.stringify(achievements),
      ],
    );
    return reply.code(201).send(toSummary((await findActivity(rows[0].id, req.user.sub))!, req.user.sub));
  });

  // Your own activities, newest first.
  app.get('/activities', async (req): Promise<ActivitySummary[]> => {
    const { rows } = await pool.query<ActivityRow>(
      `${selectActivities('$1')} WHERE a.user_id = $1 ORDER BY a.started_at DESC LIMIT 50`,
      [req.user.sub],
    );
    return rows.map((r) => toSummary(r, req.user.sub));
  });

  // Any activity you're allowed to see: yours, public ones, and followers-only ones from
  // people you follow.
  app.get('/activities/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const row = await findActivity(id, req.user.sub, true);
    if (!row) return reply.code(404).send({ error: 'Activity not found' });
    // Other people get the track without its first and last 200 m (privacy zone).
    const points = row.points ?? [];
    const detail: ActivityDetail = {
      ...toSummary(row, req.user.sub),
      points: row.user_id === req.user.sub ? points : hideEnds(points),
    };
    return detail;
  });

  // Edit your activity's title, description, or who can see it.
  app.patch('/activities/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const input = updateActivitySchema.parse(req.body);
    const { rowCount } = await pool.query(
      `UPDATE activities SET
         title = coalesce($3, title),
         description = CASE WHEN $4::boolean THEN $5 ELSE description END,
         visibility = coalesce($6, visibility)
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.sub, input.title ?? null, input.description !== undefined, input.description ?? null, input.visibility ?? null],
    );
    if (!rowCount) return reply.code(404).send({ error: 'Activity not found' });
    return toSummary((await findActivity(id, req.user.sub))!, req.user.sub);
  });

  app.delete('/activities/:id', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { rowCount } = await pool.query('DELETE FROM activities WHERE id = $1 AND user_id = $2', [id, req.user.sub]);
    if (!rowCount) return reply.code(404).send({ error: 'Activity not found' });
    return reply.code(204).send();
  });
}
