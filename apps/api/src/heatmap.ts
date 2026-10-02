import { decodePolyline, type HeatmapKind } from '@repo/shared';
import { deflateSync } from 'node:zlib';

// Draws heatmap map tiles: transparent PNG images, 512 x 512 pixels (sharp on iPhone
// screens), in the usual web map grid (z/x/y). Routes are drawn as lines; where more
// activities overlap, the line gets brighter, like Strava's heatmap.

export const TILE_PX = 512;

// ---------- PNG encoding ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Encodes RGBA pixels (width * height * 4 bytes) as a PNG file.
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // RGBA
  // Each row starts with a filter byte (0 = none).
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const EMPTY_TILE = encodePng(1, 1, new Uint8Array(4));

// ---------- Map maths ----------

// Longitude/latitude to pixels on the whole-world map at zoom z (Web Mercator).
function project(lat: number, lng: number, z: number): [number, number] {
  const size = TILE_PX * 2 ** z;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lng + 180) / 360) * size, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size];
}

// The lat/lng box covered by tile z/x/y, widened a little so lines at the edges join up.
export function tileBounds(z: number, x: number, y: number) {
  const n = 2 ** z;
  const lngOf = (tx: number) => (tx / n) * 360 - 180;
  const latOf = (ty: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
  const pad = 0.05; // 5% of a tile
  return {
    minLng: lngOf(x - pad),
    maxLng: lngOf(x + 1 + pad),
    minLat: latOf(y + 1 + pad),
    maxLat: latOf(y - pad),
  };
}

// ---------- Colours ----------

type Rgb = [number, number, number];
const PALETTES: Record<HeatmapKind, [number, Rgb][]> = {
  // Blue to white, like Strava's global heatmap.
  global: [[0, [0, 60, 255]], [0.5, [80, 170, 255]], [1, [255, 255, 255]]],
  weekly: [[0, [140, 40, 255]], [0.5, [255, 70, 200]], [1, [255, 235, 250]]],
  night: [[0, [255, 130, 0]], [0.5, [255, 210, 40]], [1, [255, 255, 220]]],
  // Stride lime for your own heatmap.
  personal: [[0, [110, 150, 0]], [0.5, [200, 243, 29]], [1, [250, 255, 215]]],
};

function colorAt(kind: HeatmapKind, t: number): Rgb {
  const stops = PALETTES[kind];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return stops[stops.length - 1][1];
}

// ---------- Drawing ----------

// Renders one tile from encoded route lines. Each activity adds 1 to every pixel it
// passes through (once, even if it loops back), so brightness = how many activities.
export function renderTile(kind: HeatmapKind, z: number, x: number, y: number, polylines: string[]): Buffer {
  if (polylines.length === 0) return EMPTY_TILE;
  const N = TILE_PX;
  const counts = new Float32Array(N * N);
  const stamp = new Int32Array(N * N);
  const ox = x * N;
  const oy = y * N;
  // Thicker lines when zoomed in.
  const brush = z >= 16 ? 2 : z >= 13 ? 1 : 0;

  polylines.forEach((poly, index) => {
    const id = index + 1;
    const pts = decodePolyline(poly).map((p) => {
      const [px, py] = project(p.lat, p.lng, z);
      return [px - ox, py - oy] as const;
    });
    const plot = (cx: number, cy: number) => {
      for (let dy = -brush; dy <= brush; dy++) {
        for (let dx = -brush; dx <= brush; dx++) {
          if (brush > 1 && Math.abs(dx) + Math.abs(dy) > brush + 1) continue; // round the corners
          const px = Math.round(cx) + dx;
          const py = Math.round(cy) + dy;
          if (px < 0 || py < 0 || px >= N || py >= N) continue;
          const i = py * N + px;
          if (stamp[i] !== id) {
            stamp[i] = id;
            counts[i] += 1;
          }
        }
      }
    };
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      // Skip segments nowhere near this tile.
      if ((x0 < -8 && x1 < -8) || (y0 < -8 && y1 < -8) || (x0 > N + 8 && x1 > N + 8) || (y0 > N + 8 && y1 > N + 8)) continue;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let s = 0; s <= steps; s++) plot(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps);
    }
  });

  // A soft glow: blend in a blurred copy so lines have a halo, like light.
  const glow = new Float32Array(N * N);
  for (let py = 1; py < N - 1; py++) {
    for (let px = 1; px < N - 1; px++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += counts[(py + dy) * N + px + dx];
      glow[py * N + px] = sum / 9;
    }
  }

  // Brightness is on a log scale, so a street used 50 times still stands out from one used 5.
  const reference = kind === 'personal' ? 6 : 12;
  const rgba = new Uint8Array(N * N * 4);
  let any = false;
  for (let i = 0; i < N * N; i++) {
    const v = Math.max(counts[i], glow[i] * 0.7);
    if (v <= 0.02) continue;
    any = true;
    const t = Math.min(1, Math.log2(1 + v) / Math.log2(1 + reference));
    const [r, g, b] = colorAt(kind, t);
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = Math.round(255 * Math.min(1, counts[i] > 0 ? 0.55 + 0.45 * t : v * 0.5));
  }
  return any ? encodePng(N, N, rgba) : EMPTY_TILE;
}
