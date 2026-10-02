import {
  hidePolylineEnds,
  type Achievement,
  type ActivitySummary,
  type ActivityType,
  type BestEffort,
  type TrackPoint,
  type Visibility,
} from '@repo/shared';

import { pool } from './db';

// SQL shared by everything that shows activities (your list, the feed, athlete pages,
// clubs): the columns, who did it, kudos and comment counts, and who is allowed to see it.

export interface ActivityRow {
  id: string;
  user_id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  started_at: Date;
  elapsed_seconds: number;
  moving_seconds: number;
  distance_meters: number;
  elevation_gain_meters: number;
  max_speed_mps: number;
  steps: number | null;
  best_efforts: BestEffort[] | null;
  achievements: Achievement[];
  visibility: Visibility;
  polyline: string;
  points?: TrackPoint[];
  created_at: Date;
  athlete_name: string;
  kudos_count: number;
  comment_count: number;
  has_kudoed: boolean;
}

// `viewer` is the SQL parameter holding the logged-in user's id, e.g. '$1'. The full GPS
// track is only included when asked for, since it can be large.
export function selectActivities(viewer: string, { points = false } = {}): string {
  return `SELECT a.id, a.user_id, a.type, a.title, a.description, a.started_at, a.elapsed_seconds, a.moving_seconds,
      a.distance_meters, a.elevation_gain_meters, a.max_speed_mps, a.steps, a.best_efforts, a.achievements,
      a.visibility, a.polyline, a.created_at,${points ? ' a.points,' : ''}
      u.name AS athlete_name,
      (SELECT count(*)::int FROM kudos k WHERE k.activity_id = a.id) AS kudos_count,
      (SELECT count(*)::int FROM comments c WHERE c.activity_id = a.id) AS comment_count,
      EXISTS (SELECT 1 FROM kudos k WHERE k.activity_id = a.id AND k.user_id = ${viewer}) AS has_kudoed
    FROM activities a JOIN users u ON u.id = a.user_id`;
}

// True when neither user has blocked the other. `x` and `y` are SQL expressions (e.g. '$1', 'u.id').
export function noBlockBetween(x: string, y: string): string {
  return `NOT EXISTS (SELECT 1 FROM blocks bl
    WHERE (bl.blocker_id = ${x} AND bl.blocked_id = ${y}) OR (bl.blocker_id = ${y} AND bl.blocked_id = ${x}))`;
}

// True when the viewer may see activity `a`: it's theirs, or (as long as neither has blocked
// the other) it's public, or it's for followers and they follow the owner.
export function canSee(viewer: string): string {
  return `(a.user_id = ${viewer} OR (${noBlockBetween(viewer, 'a.user_id')} AND (a.visibility = 'everyone'
    OR (a.visibility = 'followers' AND EXISTS (
      SELECT 1 FROM follows f WHERE f.follower_id = ${viewer} AND f.followee_id = a.user_id)))))`;
}

// `viewerId` is who is looking. Anyone other than the owner gets the route without its first
// and last 200 m (the privacy zone), so nobody can see where an athlete starts from home.
export function toSummary(row: ActivityRow, viewerId: string): ActivitySummary {
  const isOwner = row.user_id === viewerId;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    description: row.description,
    startedAt: row.started_at.toISOString(),
    elapsedSeconds: row.elapsed_seconds,
    movingSeconds: row.moving_seconds,
    distanceMeters: row.distance_meters,
    elevationGainMeters: row.elevation_gain_meters,
    maxSpeedMps: row.max_speed_mps,
    steps: row.steps,
    bestEfforts: row.best_efforts ?? [],
    achievements: row.achievements,
    visibility: row.visibility,
    polyline: isOwner ? row.polyline : hidePolylineEnds(row.polyline),
    createdAt: row.created_at.toISOString(),
    athlete: { id: row.user_id, name: row.athlete_name },
    kudosCount: row.kudos_count,
    commentCount: row.comment_count,
    hasKudoed: row.has_kudoed,
  };
}

// One activity as the viewer sees it, or null if it doesn't exist or they can't see it.
export async function findActivity(id: string, viewerId: string, withPoints = false) {
  const { rows } = await pool.query<ActivityRow>(
    `${selectActivities('$2', { points: withPoints })} WHERE a.id = $1 AND ${canSee('$2')}`,
    [id, viewerId],
  );
  return rows[0] ?? null;
}

// The id of the user's activity saved with this phone-made tag, if any (see createActivitySchema.clientId).
export async function findByClientId(userId: string, clientId: string): Promise<string | null> {
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM activities WHERE user_id = $1 AND client_id = $2',
    [userId, clientId],
  );
  return rows[0]?.id ?? null;
}
