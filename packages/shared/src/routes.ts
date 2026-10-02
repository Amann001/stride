import { z } from 'zod';

import { activityTypeSchema, type ActivityType } from './schemas';

// Routes: suggested loops from where you are, routes you draw yourself, and routes
// from your past activities. Used by the Maps tab and to follow a route while recording.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ProfileSample {
  distanceMeters: number;
  altitude: number;
}

export type RouteDifficulty = 'easy' | 'moderate' | 'hard';

export interface RouteSummary {
  // "suggested:..." for generated routes, an activity id for "activity", a uuid for saved.
  id: string;
  source: 'suggested' | 'saved' | 'activity';
  name: string;
  sport: ActivityType;
  distanceMeters: number;
  elevationGainMeters: number;
  // Encoded route line, 5 decimal places.
  polyline: string;
  elevationProfile: ProfileSample[];
  start: LatLng;
  difficulty: RouteDifficulty;
  createdAt: string | null;
}

// Easy / Moderate / Hard from length and climbing, scaled for the sport (a 20 km ride is
// easy, a 20 km run is not).
export function routeDifficulty(sport: ActivityType, meters: number, gain: number): RouteDifficulty {
  const km = meters / 1000;
  // Roughly "flat-equivalent km": every 100 m of climbing counts like 1 km on foot, 3 km on a bike.
  const effort = sport === 'ride' ? km / 4 + gain / 100 : km + gain / 100;
  const [easy, hard] = sport === 'walk' ? [4, 10] : sport === 'hike' ? [6, 15] : [5, 13];
  return effort <= easy ? 'easy' : effort >= hard ? 'hard' : 'moderate';
}

export type ElevationBand = 'flat' | 'rolling' | 'hilly';

// Meters climbed per km: under 5 is flat, over 15 is hilly.
export function elevationBand(meters: number, gain: number): ElevationBand {
  const perKm = meters > 0 ? gain / (meters / 1000) : 0;
  return perKm < 5 ? 'flat' : perKm > 15 ? 'hilly' : 'rolling';
}

// Route lengths offered by default for each sport, in km.
export const SUGGESTION_KM: Record<ActivityType, number[]> = {
  run: [2, 5, 8],
  walk: [1.5, 3, 5],
  hike: [3, 6, 10],
  ride: [10, 20, 40],
};

// "Length" filter choices per sport, in km. The last one is open-ended.
export const LENGTH_FILTERS: Record<ActivityType, { label: string; min: number; max: number }[]> = {
  run: [{ label: 'Under 5 km', min: 1, max: 5 }, { label: '5–10 km', min: 5, max: 10 }, { label: '10 km+', min: 10, max: 21 }],
  walk: [{ label: 'Under 3 km', min: 1, max: 3 }, { label: '3–6 km', min: 3, max: 6 }, { label: '6 km+', min: 6, max: 12 }],
  hike: [{ label: 'Under 5 km', min: 2, max: 5 }, { label: '5–10 km', min: 5, max: 10 }, { label: '10 km+', min: 10, max: 20 }],
  ride: [{ label: 'Under 20 km', min: 5, max: 20 }, { label: '20–50 km', min: 20, max: 50 }, { label: '50 km+', min: 50, max: 100 }],
};

const latLngSchema = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const suggestRoutesSchema = z.object({
  start: latLngSchema,
  sport: activityTypeSchema,
  minKm: z.number().min(0.5).max(200).optional(),
  maxKm: z.number().min(0.5).max(200).optional(),
  // Change this to get a different set of loops from the same place.
  variant: z.number().int().min(0).max(100).default(0),
});

export const planRouteSchema = z.object({
  sport: activityTypeSchema,
  waypoints: z.array(latLngSchema).min(2).max(25),
  // Follow roads and paths (true) or draw straight lines between the points (false).
  snap: z.boolean().default(true),
});

export interface PlannedRoute {
  polyline: string;
  distanceMeters: number;
}

export const saveRouteSchema = z.object({
  name: z.string().trim().min(1, 'Give your route a name').max(80),
  sport: activityTypeSchema,
  polyline: z.string().min(2).max(200_000),
});

export const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  sport: activityTypeSchema,
});

// What the app sends (fields with defaults may be left out).
export type SuggestRoutesInput = z.input<typeof suggestRoutesSchema>;
export type PlanRouteInput = z.input<typeof planRouteSchema>;
export type SaveRouteInput = z.infer<typeof saveRouteSchema>;

// ---------- Heatmaps ----------

export const HEATMAP_KINDS = ['global', 'weekly', 'night', 'personal'] as const;
export type HeatmapKind = (typeof HEATMAP_KINDS)[number];

export const HEATMAP_INFO: Record<HeatmapKind, { label: string; description: string }> = {
  global: { label: 'Global', description: 'Where Stride athletes go, all time.' },
  weekly: { label: 'Weekly', description: 'Where Stride athletes went in the last 7 days.' },
  night: { label: 'Night', description: 'Popular after dark (7 pm to 5 am), for safer night routes.' },
  personal: { label: 'Personal', description: 'Everywhere you have been.' },
};

export const heatmapParamsSchema = z.object({
  kind: z.enum(HEATMAP_KINDS),
  sport: z.union([activityTypeSchema, z.literal('all')]),
  z: z.coerce.number().int().min(0).max(20),
  x: z.coerce.number().int().min(0),
  // The URL ends in "<y>.png".
  y: z.string().regex(/^\d+\.png$/).transform((s) => Number(s.slice(0, -4))),
});
