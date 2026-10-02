import {
  bestEfforts,
  CATEGORIES,
  computeAchievements,
  computeStats,
  maxSpeed,
  type Achievement,
  type ActivityFacts,
  type ActivityType,
  type BestEffort,
  type TrackPoint,
  type TrackStats,
} from '@repo/shared';
import type pg from 'pg';

export interface Analysis {
  stats: TrackStats;
  maxSpeedMps: number;
  bestEfforts: BestEffort[];
  achievements: Achievement[];
}

// Works out everything we store about an activity from its (already cleaned) GPS points,
// including achievements earned against the same user's earlier activities of that type.
export async function analyseActivity(
  db: pg.Pool | pg.PoolClient,
  userId: string,
  type: ActivityType,
  points: TrackPoint[],
  steps: number | null,
): Promise<Analysis> {
  const stats = computeStats(points);
  const efforts = bestEfforts(points, CATEGORIES[type].bestEffortDistances);
  const { rows } = await db.query<{
    distance_meters: number;
    elevation_gain_meters: number;
    steps: number | null;
    best_efforts: BestEffort[] | null;
  }>(
    `SELECT distance_meters, elevation_gain_meters, steps, best_efforts FROM activities
     WHERE user_id = $1 AND type = $2 AND started_at < $3`,
    [userId, type, new Date(points[0].t)],
  );
  const previous: ActivityFacts[] = rows.map((r) => ({
    distanceMeters: r.distance_meters,
    elevationGainMeters: r.elevation_gain_meters,
    steps: r.steps,
    bestEfforts: r.best_efforts ?? [],
  }));
  const current: ActivityFacts = {
    distanceMeters: stats.distanceMeters,
    elevationGainMeters: stats.elevationGainMeters,
    steps,
    bestEfforts: efforts,
  };
  return {
    stats,
    maxSpeedMps: maxSpeed(points),
    bestEfforts: efforts,
    achievements: computeAchievements(type, current, previous),
  };
}
