"use client";

import { useEffect, useRef } from "react";

// A runner drawn like a sports pictogram: a run cycle worked out from joint angles each
// frame, at a cadence (steps per minute) that follows the beat.

const rad = (d: number) => (d * Math.PI) / 180;
type Pt = [number, number];
const add = (p: Pt, angle: number, len: number): Pt => [p[0] + Math.sin(rad(angle)) * len, p[1] + Math.cos(rad(angle)) * len];

// Angles are measured from straight down; positive points forward (the runner faces right).
function leg(hip: Pt, phase: number) {
  const thigh = 8 + 34 * Math.sin(phase);
  const swing = Math.max(0, Math.cos(phase + 0.35)); // the knee folds as the leg swings through
  const knee = 16 + 98 * swing ** 1.4;
  const k = add(hip, thigh, 46);
  const f = add(k, thigh - knee, 46);
  return [hip, k, f, add(f, thigh - knee + 95, 13)];
}
function arm(shoulder: Pt, phase: number) {
  const upper = -36 * Math.sin(phase) + 4;
  const e = add(shoulder, upper, 32);
  return [shoulder, e, add(e, upper + 92, 28)];
}

export const GROUND = 226;

export function pose(phase: number) {
  const hip: Pt = [100, 0];
  const shoulder = add(hip, 169, 58);
  const head = add(shoulder, 165, 24);
  const near = leg(hip, phase);
  const far = leg(hip, phase + Math.PI);
  // Keep the lowest foot on the ground, with a little lift in the airborne moment.
  const lowest = Math.max(near[2][1], near[3][1], far[2][1], far[3][1]);
  const flight = 3 * Math.max(0, Math.sin(2 * phase + 1.2));
  const dy = GROUND - 9 - lowest - flight;
  const move = (pts: Pt[]) => pts.map(([x, y]) => [x, y + dy] as Pt);
  return {
    torso: move([hip, shoulder]),
    head: move([head])[0],
    nearLeg: move(near),
    farLeg: move(far),
    nearArm: move(arm(shoulder, phase + Math.PI)),
    farArm: move(arm(shoulder, phase)),
  };
}

const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export function Runner({ bpm, className }: { bpm: number; className?: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const cadence = useRef(bpm);
  useEffect(() => {
    cadence.current = bpm;
  }, [bpm]);

  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    const part = (k: string) => root.querySelector<SVGElement>(`[data-part="${k}"]`);
    const limbs = (["torso", "nearLeg", "farLeg", "nearArm", "farArm"] as const).map((k) => [k, part(k)] as const);
    const head = part("head");
    const ground = part("ground");
    const draw = (phase: number, travelled: number) => {
      const p = pose(phase);
      for (const [k, el] of limbs) el?.setAttribute("points", pts(p[k]));
      head?.setAttribute("cx", p.head[0].toFixed(1));
      head?.setAttribute("cy", p.head[1].toFixed(1));
      ground?.setAttribute("stroke-dashoffset", travelled.toFixed(1));
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      draw(0.9, 0);
      return;
    }
    let phase = 0.9;
    let travelled = 0;
    let last = performance.now();
    let frame = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(root);
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      // Two steps per stride; the ground slides by about one stride length each stride.
      const strides = (cadence.current / 60 / 2) * dt;
      phase = (phase + strides * Math.PI * 2) % (Math.PI * 2);
      travelled += strides * 150;
      draw(phase, travelled);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
    };
  }, []);

  const limb = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

  return (
    <svg ref={svg} viewBox="0 0 200 240" className={className} aria-hidden="true">
      <line data-part="ground" x1="-40" x2="240" y1={GROUND} y2={GROUND} stroke="rgba(238,241,232,0.28)" strokeWidth={3} strokeDasharray="18 22" />
      <polyline data-part="farArm" {...limb} stroke="#6f8714" strokeWidth={14} />
      <polyline data-part="farLeg" {...limb} stroke="#6f8714" strokeWidth={16} />
      <polyline data-part="torso" {...limb} stroke="#c8f31d" strokeWidth={21} />
      <circle data-part="head" r={13.5} fill="#c8f31d" />
      <polyline data-part="nearLeg" {...limb} stroke="#c8f31d" strokeWidth={16} />
      <polyline data-part="nearArm" {...limb} stroke="#c8f31d" strokeWidth={14} />
    </svg>
  );
}
