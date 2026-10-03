import { describe, expect, it } from 'vitest';

import {
  cleanTrack,
  computeStats,
  decodePolyline,
  distanceBetween,
  elevationGain,
  encodePolyline,
  hideEnds,
  hidePolylineEnds,
  type TrackPoint,
} from '../src';

const DEG = (6_371_000 * Math.PI) / 180; // meters in one degree of latitude

// A straight line north from Delhi, one point every `stepSec` seconds.
function line(meters: number, seconds: number, stepSec = 5, alt: (f: number) => number | null = () => 200): TrackPoint[] {
  const pts: TrackPoint[] = [];
  for (let s = 0; s <= seconds; s += stepSec) {
    const f = s / seconds;
    pts.push({ lat: 28.6 + (f * meters) / DEG, lng: 77.2, alt: alt(f), t: 1_700_000_000_000 + s * 1000 });
  }
  return pts;
}

describe('distanceBetween', () => {
  it('measures one degree of latitude as about 111.2 km', () => {
    expect(distanceBetween({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -1);
  });

  it('matches a known city distance (Delhi to Mumbai, about 1,150 km)', () => {
    const km = distanceBetween({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 }) / 1000;
    expect(km).toBeGreaterThan(1140);
    expect(km).toBeLessThan(1160);
  });

  it('is zero for the same point', () => {
    expect(distanceBetween({ lat: 12.97, lng: 77.59 }, { lat: 12.97, lng: 77.59 })).toBe(0);
  });
});

describe('cleanTrack', () => {
  it('drops a point that would need an impossible speed', () => {
    const pts = line(1000, 300);
    const glitch = { ...pts[10], lat: pts[10].lat + 0.1, t: pts[10].t + 1 };
    const cleaned = cleanTrack([...pts.slice(0, 11), glitch, ...pts.slice(11)], 'run');
    expect(cleaned).toHaveLength(pts.length);
    expect(cleaned).not.toContainEqual(glitch);
  });

  it('puts points back in time order', () => {
    const pts = line(500, 150);
    const shuffled = [pts[2], pts[0], pts[1], ...pts.slice(3)];
    expect(cleanTrack(shuffled, 'walk').map((p) => p.t)).toEqual(pts.map((p) => p.t));
  });

  it('allows speeds that are normal for a ride but not for a walk', () => {
    // 1 km in 90 s is 40 km/h.
    const fast = line(1000, 90);
    expect(cleanTrack(fast, 'ride')).toHaveLength(fast.length);
    expect(cleanTrack(fast, 'walk').length).toBeLessThan(fast.length);
  });
});

describe('computeStats', () => {
  it('works out distance, elapsed and moving time', () => {
    const s = computeStats(line(5000, 1500));
    expect(s.distanceMeters).toBeCloseTo(5000, -1);
    expect(s.elapsedSeconds).toBe(1500);
    expect(s.movingSeconds).toBe(1500);
  });

  it("doesn't count standing still as moving time", () => {
    const moving = line(1000, 300);
    const last = moving[moving.length - 1];
    const waiting = Array.from({ length: 12 }, (_, i) => ({ ...last, t: last.t + (i + 1) * 5000 }));
    const s = computeStats([...moving, ...waiting]);
    expect(s.elapsedSeconds).toBe(360);
    expect(s.movingSeconds).toBe(300);
  });
});

describe('elevationGain', () => {
  it('ignores GPS altitude wobble on flat ground', () => {
    const wobbly = line(2000, 600, 5, (f) => 200 + Math.sin(f * 200) * 3);
    expect(elevationGain(wobbly)).toBe(0);
  });

  it('counts a real climb', () => {
    const hill = line(2000, 900, 5, (f) => 200 + f * 120);
    expect(elevationGain(hill)).toBeGreaterThan(100);
    expect(elevationGain(hill)).toBeLessThanOrEqual(121);
  });

  it('is zero without altitude readings', () => {
    expect(elevationGain(line(1000, 300, 5, () => null))).toBe(0);
  });
});

describe('polylines', () => {
  it("matches Google's documented example", () => {
    const coords = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    expect(encodePolyline(coords)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(coords);
  });

  it('round-trips a real track to within a meter', () => {
    const pts = line(3000, 900);
    const back = decodePolyline(encodePolyline(pts));
    expect(back).toHaveLength(pts.length);
    back.forEach((p, i) => expect(distanceBetween(p, pts[i])).toBeLessThan(1));
  });
});

describe('privacy zone (hideEnds)', () => {
  it('removes the first and last 200 m of a route', () => {
    const pts = line(2000, 600, 1);
    const kept = hideEnds(pts);
    expect(distanceBetween(pts[0], kept[0])).toBeGreaterThanOrEqual(200);
    expect(distanceBetween(pts[pts.length - 1], kept[kept.length - 1])).toBeGreaterThanOrEqual(200);
    expect(distanceBetween(kept[0], kept[kept.length - 1])).toBeGreaterThan(1550);
  });

  it('hides a route under 400 m completely', () => {
    expect(hideEnds(line(350, 120))).toEqual([]);
    expect(hidePolylineEnds(encodePolyline(line(350, 120)))).toBe('');
  });

  it('works on encoded routes too', () => {
    const pts = line(2000, 600, 1);
    const shown = decodePolyline(hidePolylineEnds(encodePolyline(pts)));
    expect(distanceBetween(pts[0], shown[0])).toBeGreaterThanOrEqual(199);
  });
});
