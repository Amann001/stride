import type { ActivityType } from './schemas';

// Helpers that turn raw numbers into text people read, e.g. 5234 -> "5.23 km".

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(2)} km`;
}

// 3725 -> "1:02:05", 185 -> "3:05"
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Runners care about pace (min per km), cyclists about speed (km/h).
export function formatPaceOrSpeed(type: ActivityType, meters: number, seconds: number): string {
  if (meters < 10 || seconds <= 0) return type === 'ride' ? '0.0 km/h' : '--:-- /km';
  if (type === 'ride') {
    return `${((meters / seconds) * 3.6).toFixed(1)} km/h`;
  }
  const secPerKm = seconds / (meters / 1000);
  return `${formatDuration(secPerKm)} /km`;
}

export function paceOrSpeedLabel(type: ActivityType): string {
  return type === 'ride' ? 'Speed' : 'Pace';
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: 'Run',
  ride: 'Ride',
  walk: 'Walk',
  hike: 'Hike',
};

// Suggests a title like "Morning Run" from the start time.
export function defaultActivityTitle(type: ActivityType, start: Date): string {
  const h = start.getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${part} ${ACTIVITY_LABELS[type]}`;
}
