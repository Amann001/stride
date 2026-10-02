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

type Db = pg.Pool | pg.PoolClient;

export interface Analysis {
  stats: TrackStats;
  maxSpeedMps: number;
  bestEfforts: BestEffort[];
  achievements: Achievement[];
}

// The same user's activities of this type that started before `before`, for achievements.
export async function earlierActivities(db: Db, userId: string, type: ActivityType, before: Date): Promise<ActivityFacts[]> {
  const { rows } = await db.query<{
    distance_meters: number;
    elevation_gain_meters: number;
    steps: number | null;
    best_efforts: BestEffort[] | null;
  }>(
    `SELECT distance_meters, elevation_gain_meters, steps, best_efforts FROM activities
     WHERE user_id = $1 AND type = $2 AND started_at < $3`,
    [userId, type, before],
  );
  return rows.map((r) => ({
    distanceMeters: r.distance_meters,
    elevationGainMeters: r.elevation_gain_meters,
    steps: r.steps,
    bestEfforts: r.best_efforts ?? [],
  }));
}

// Works out everything we store about an activity from its (already cleaned) GPS points,
// including achievements earned against the same user's earlier activities of that type.
export async function analyseActivity(
  db: Db,
  userId: string,
  type: ActivityType,
  points: TrackPoint[],
  steps: number | null,
): Promise<Analysis> {
  const stats = computeStats(points);
  const efforts = bestEfforts(points, CATEGORIES[type].bestEffortDistances);
  const previous = await earlierActivities(db, userId, type, new Date(points[0].t));
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
