import {
  formatDistance,
  formatDuration,
  formatDurationShort,
  formatElevation,
  formatPaceOrSpeed,
  formatSpeed,
  formatSteps,
  paceOrSpeedLabel,
  type ActivitySummary,
} from '@repo/shared';

// Each kind of activity leads with the numbers that matter for it: pace for runs,
// speed for rides, steps for walks, climbing for hikes.

export interface StatItem {
  label: string;
  value: string;
}

function common(a: ActivitySummary) {
  return {
    distance: { label: 'Distance', value: formatDistance(a.distanceMeters) },
    pace: { label: paceOrSpeedLabel(a.type), value: formatPaceOrSpeed(a.type, a.distanceMeters, a.movingSeconds) },
    time: { label: 'Time', value: formatDurationShort(a.movingSeconds) },
    moving: { label: 'Moving time', value: formatDuration(a.movingSeconds) },
    elapsed: { label: 'Elapsed time', value: formatDuration(a.elapsedSeconds) },
    elevation: { label: 'Elev gain', value: formatElevation(a.elevationGainMeters) },
    steps: a.steps != null ? { label: 'Steps', value: formatSteps(a.steps) } : null,
  };
}

// The three numbers on a feed card.
export function cardStats(a: ActivitySummary): StatItem[] {
  const s = common(a);
  switch (a.type) {
    case 'run':
      return [s.distance, s.pace, s.time];
    case 'ride':
      return [s.distance, s.pace, s.elevation];
    case 'walk':
      return [s.distance, s.steps ?? s.pace, s.time];
    case 'hike':
      return [s.distance, s.elevation, s.time];
  }
}

// The full grid on the activity screen. `highestPoint` comes from the elevation profile.
export function detailStats(a: ActivitySummary, highestPoint: number | null): StatItem[] {
  const s = common(a);
  // Steps per minute: a key number for runners (around 170-180 is typical for a good stride).
  const cadence =
    a.steps != null && a.movingSeconds >= 60
      ? { label: 'Cadence', value: `${Math.round(a.steps / (a.movingSeconds / 60))} spm` }
      : null;
  const maxSpeed = { label: 'Max speed', value: formatSpeed(a.maxSpeedMps) };
  const highest = highestPoint != null ? { label: 'Highest point', value: formatElevation(highestPoint) } : null;

  const items: (StatItem | null)[] = {
    run: [s.distance, s.pace, s.moving, s.elevation, cadence, s.steps, s.elapsed],
    ride: [s.distance, s.pace, maxSpeed, s.moving, s.elevation, s.elapsed],
    walk: [s.distance, s.steps, s.pace, s.moving, s.elevation, s.elapsed],
    hike: [s.distance, s.elevation, highest, s.moving, s.pace, s.steps, s.elapsed],
  }[a.type];
  return items.filter((i): i is StatItem => i != null);
}
