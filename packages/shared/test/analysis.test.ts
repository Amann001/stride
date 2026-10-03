import { describe, expect, it } from 'vitest';

import {
  bestEfforts,
  computeAchievements,
  computeSplits,
  effortName,
  elevationProfile,
  maxSpeed,
  recentSpeed,
  type ActivityFacts,
  type TrackPoint,
} from '../src';

const DEG = (6_371_000 * Math.PI) / 180;

// A run made of legs, each `meters` long at `secondsPerKm`, one point every 2 seconds.
function run(legs: { meters: number; secondsPerKm: number }[], start = 1_700_000_000_000): TrackPoint[] {
  const pts: TrackPoint[] = [{ lat: 18.5, lng: 73.8, alt: 500, t: start }];
  let lat = 18.5;
  let t = start;
  for (const leg of legs) {
    const speed = 1000 / leg.secondsPerKm;
    const steps = Math.round(leg.meters / speed / 2);
    for (let i = 0; i < steps; i++) {
      lat += (leg.meters / steps) / DEG;
      t += (leg.meters / steps / speed) * 1000;
      pts.push({ lat, lng: 73.8, alt: 500, t });
    }
  }
  return pts;
}

describe('computeSplits', () => {
  it('cuts a 5.3 km run into five 1 km splits plus the last 300 m', () => {
    const splits = computeSplits(run([{ meters: 5300.5, secondsPerKm: 300 }]), 1000);
    expect(splits).toHaveLength(6);
    splits.slice(0, 5).forEach((s) => {
      expect(s.distanceMeters).toBe(1000);
      expect(s.movingSeconds).toBeCloseTo(300, 0);
    });
    expect(splits[5].distanceMeters).toBeCloseTo(300, 0);
  });

  it('shows which kilometre was faster', () => {
    const splits = computeSplits(run([{ meters: 1000, secondsPerKm: 360 }, { meters: 1000.5, secondsPerKm: 270 }]), 1000);
    expect(splits[0].movingSeconds).toBeCloseTo(360, 0);
    expect(splits[1].movingSeconds).toBeCloseTo(270, 0);
  });

  it('is empty for a single point', () => {
    expect(computeSplits(run([]), 1000)).toEqual([]);
  });
});

describe('bestEfforts', () => {
  it('finds the fastest 1K hidden inside a longer run', () => {
    // Easy 2 km, a fast 1 km, easy 2 km.
    const efforts = bestEfforts(
      run([{ meters: 2000, secondsPerKm: 360 }, { meters: 1000, secondsPerKm: 240 }, { meters: 2000.5, secondsPerKm: 360 }]),
      [1000, 5000],
    );
    expect(efforts.find((e) => e.distanceMeters === 1000)?.seconds).toBeCloseTo(240, -1);
    expect(efforts.find((e) => e.distanceMeters === 5000)?.seconds).toBeCloseTo(1680, -1);
  });

  it('skips distances longer than the run', () => {
    expect(bestEfforts(run([{ meters: 3000, secondsPerKm: 300 }]), [5000])).toEqual([]);
  });
});

describe('speed', () => {
  it('reports the top speed held for at least 10 seconds', () => {
    const pts = run([{ meters: 1000, secondsPerKm: 300 }, { meters: 500, secondsPerKm: 150 }, { meters: 1000, secondsPerKm: 300 }]);
    expect(maxSpeed(pts)).toBeCloseTo(1000 / 150, 1);
  });

  it('shows 0 current speed once you stop and no new GPS points arrive', () => {
    const pts = run([{ meters: 1000, secondsPerKm: 300 }]);
    const lastT = pts[pts.length - 1].t;
    expect(recentSpeed(pts, lastT)).toBeCloseTo(1000 / 300, 1);
    expect(recentSpeed(pts, lastT + 60_000)).toBe(0);
  });
});

describe('elevationProfile', () => {
  it('is empty when the phone gave no altitude', () => {
    const pts = run([{ meters: 1000, secondsPerKm: 300 }]).map((p) => ({ ...p, alt: null }));
    expect(elevationProfile(pts)).toEqual([]);
  });
});

describe('achievements', () => {
  const facts = (km: number, fiveK?: number, climb = 0): ActivityFacts => ({
    distanceMeters: km * 1000,
    elevationGainMeters: climb,
    steps: null,
    bestEfforts: fiveK ? [{ distanceMeters: 5000, seconds: fiveK }] : [],
  });

  it('celebrates your first activity', () => {
    expect(computeAchievements('run', facts(5, 1500), [])[0]).toMatchObject({ kind: 'first', title: 'Your first run!' });
  });

  it('awards gold, silver and bronze for the fastest efforts', () => {
    const previous = [facts(5, 1400), facts(5, 1450), facts(5, 1600)];
    const titles = (seconds: number) => computeAchievements('run', facts(5, seconds), previous).map((a) => a.title);
    expect(titles(1390)).toContain('PR: 5K');
    expect(titles(1420)).toContain('2nd fastest 5K');
    expect(titles(1500)).toContain('3rd fastest 5K');
    expect(titles(1700).some((t) => t.includes('5K'))).toBe(false);
  });

  it('notices the longest run and the biggest climb, but not a tiny climb', () => {
    const previous = [facts(10, undefined, 50)];
    const kinds = computeAchievements('run', facts(12, undefined, 80), previous).map((a) => a.kind);
    expect(kinds).toEqual(['longest', 'climb']);
    expect(computeAchievements('walk', facts(1, undefined, 8), [facts(0.5, undefined, 2)]).map((a) => a.kind)).toEqual(['longest']);
  });

  it('names effort distances the way runners say them', () => {
    expect([400, 1000, 1609.34, 5000, 21097.5, 42195].map(effortName)).toEqual(['400m', '1K', '1 mile', '5K', 'Half marathon', 'Marathon']);
  });
});
