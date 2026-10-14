import run from "@/data/cubbon-park-run.json";

// The landing page's route: a real 3.68 km loop around Cubbon Park, Bengaluru (OpenStreetMap
// foot routing), placed on the map image /landing/cubbon-park-map.webp.
//
// That image is a top-down MapLibre render at a fixed centre and zoom (C:/Stride-promo,
// src/scenes/SitePlate.tsx). Web Mercator maths with the same numbers puts every GPS point on
// the right pixel, so the route can be drawn (and animated) as SVG on top of the picture.

export const PLATE = { width: 2400, height: 1500 };
const CENTER: [number, number] = [77.592085, 12.97685];
const ZOOM = 16;

const WORLD = 512 * 2 ** ZOOM;
function mercator([lng, lat]: [number, number]): [number, number] {
  const sin = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * WORLD, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * WORLD];
}
const [cx, cy] = mercator(CENTER);

export const ROUTE_POINTS: [number, number][] = (run.coordinates as [number, number][]).map((p) => {
  const [x, y] = mercator(p);
  // Rounded to 0.1 px, so the server and the browser print exactly the same numbers.
  return [Math.round((x - cx + PLATE.width / 2) * 10) / 10, Math.round((y - cy + PLATE.height / 2) * 10) / 10];
});

export const ROUTE_PATH = "M" + ROUTE_POINTS.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L");

export const ROUTE_KM = run.distanceMeters / 1000; // 3.68
export const PACE_SECONDS = 312; // 5:12 per km
export const ROUTE_SECONDS = Math.round(ROUTE_KM * PACE_SECONDS); // 19:08

// The box around the route, for close-up views of it.
const xs = ROUTE_POINTS.map((p) => p[0]);
const ys = ROUTE_POINTS.map((p) => p[1]);
export const ROUTE_BOX = {
  x: Math.min(...xs),
  y: Math.min(...ys),
  width: Math.max(...xs) - Math.min(...xs),
  height: Math.max(...ys) - Math.min(...ys),
};

// Where along the route (0..1 of its length) each kilometre is, for the split markers.
const segment = (i: number) => Math.hypot(ROUTE_POINTS[i][0] - ROUTE_POINTS[i - 1][0], ROUTE_POINTS[i][1] - ROUTE_POINTS[i - 1][1]);
const lengths = ROUTE_POINTS.map((_, i) => (i === 0 ? 0 : segment(i)));
const total = lengths.reduce((a, b) => a + b, 0);
export const KM_FRACTIONS = [1, 2, 3].map((km) => km / ROUTE_KM);

// The point at a fraction (0..1) of the way round, for runner dots without measuring an SVG.
export function pointAt(fraction: number): [number, number] {
  let target = Math.min(1, Math.max(0, fraction)) * total;
  for (let i = 1; i < ROUTE_POINTS.length; i++) {
    if (target <= lengths[i]) {
      const f = lengths[i] ? target / lengths[i] : 0;
      const [ax, ay] = ROUTE_POINTS[i - 1];
      const [bx, by] = ROUTE_POINTS[i];
      return [ax + (bx - ax) * f, ay + (by - ay) * f];
    }
    target -= lengths[i];
  }
  return ROUTE_POINTS[ROUTE_POINTS.length - 1];
}

export const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
