import type { ActivityType, TrackPoint } from './schemas';

// The shapes the API sends back. Both apps import these so they always agree.

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// What an activity looks like in a list (no GPS points, to keep it small).
export interface ActivitySummary {
  id: string;
  userId: string;
  type: ActivityType;
  title: string;
  description: string | null;
  startedAt: string;
  elapsedSeconds: number;
  movingSeconds: number;
  distanceMeters: number;
  elevationGainMeters: number;
  // Encoded route line (Google polyline format), enough to draw a small map.
  polyline: string;
  createdAt: string;
}

// A single activity with all its GPS points.
export interface ActivityDetail extends ActivitySummary {
  points: TrackPoint[];
}
