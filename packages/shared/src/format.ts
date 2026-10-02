import { CATEGORIES } from './categories';
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

// 3725 -> "1h 2m", 403 -> "6m 43s". Shorter, for totals and cards.
export function formatDurationShort(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

// For voice updates: 330 -> "5 minutes 30 seconds".
export function speakDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const part = (n: number, unit: string) => (n ? `${n} ${unit}${n === 1 ? '' : 's'}` : '');
  return [part(h, 'hour'), part(m, 'minute'), h ? '' : part(sec, 'second')].filter(Boolean).join(' ') || '0 seconds';
}

// Meters per second -> "24.5 km/h"
export function formatSpeed(metersPerSecond: number): string {
  return `${(metersPerSecond * 3.6).toFixed(1)} km/h`;
}

// Seconds per km -> "5:30 /km"
export function formatPace(secondsPerKm: number): string {
  return Number.isFinite(secondsPerKm) && secondsPerKm > 0 ? `${formatDuration(secondsPerKm)} /km` : '--:-- /km';
}

// Runners care about pace (min per km), cyclists about speed (km/h).
export function formatPaceOrSpeed(type: ActivityType, meters: number, seconds: number): string {
  const speed = CATEGORIES[type].metric === 'speed';
  if (meters < 10 || seconds <= 0) return speed ? '0.0 km/h' : '--:-- /km';
  return speed ? formatSpeed(meters / seconds) : formatPace(seconds / (meters / 1000));
}

export function paceOrSpeedLabel(type: ActivityType): string {
  return CATEGORIES[type].metric === 'speed' ? 'Speed' : 'Pace';
}

export function formatElevation(meters: number): string {
  return `${Math.round(meters)} m`;
}

// 12345 -> "12,345"
export function formatSteps(steps: number): string {
  return Math.round(steps).toLocaleString('en-US');
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  run: CATEGORIES.run.label,
  ride: CATEGORIES.ride.label,
  walk: CATEGORIES.walk.label,
  hike: CATEGORIES.hike.label,
};

// Suggests a title like "Morning Run" from the start time.
export function defaultActivityTitle(type: ActivityType, start: Date): string {
  const h = start.getHours();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  return `${part} ${ACTIVITY_LABELS[type]}`;
}
