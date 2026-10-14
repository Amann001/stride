"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { KM_FRACTIONS, PLATE, ROUTE_PATH, ROUTE_POINTS, pointAt } from "@/lib/landing-route";

import s from "./landing.module.css";

const DRAW_MS = 3600; // the route drawing itself on load
const LAP_MS = 26000; // then the runner keeps jogging laps
const COMET = 0.035; // the bright trail behind the runner, as a share of the route

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// The first screen: the real Cubbon Park map, a real 3.68 km loop drawing itself on it like a
// run being recorded, then a runner dot that keeps going round. One moment, on load.
export function Hero() {
  const hero = useRef<HTMLElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const line = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const comet = useRef<SVGPathElement>(null);
  const runner = useRef<SVGGElement>(null);
  const marks = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const place = (drawn: number, at: number) => {
      for (const el of [line.current, glow.current]) el?.setAttribute("stroke-dashoffset", String(1 - drawn));
      comet.current?.setAttribute("stroke-dashoffset", String(-Math.max(0, at - COMET)));
      comet.current?.setAttribute("stroke-dasharray", `${Math.min(COMET, at)} 2`);
      const [x, y] = pointAt(at);
      runner.current?.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      marks.current.forEach((m, i) => {
        if (!m) return;
        const on = drawn >= KM_FRACTIONS[i];
        m.style.opacity = on ? "1" : "0";
        m.style.transform = on ? "scale(1)" : "scale(0.4)";
      });
    };

    if (reduced) {
      place(1, 0);
      return;
    }

    // Only animate while the hero is on screen.
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (plate.current) io.observe(plate.current);

    let start = 0;
    let lapClock = 0;
    let last = 0;
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!start) start = last = now + 500; // a short beat while the map fades in
      const dt = Math.max(0, now - last);
      last = now;
      const t = (now - start) / DRAW_MS;
      if (t < 0) return place(0, 0);
      if (t < 1) {
        const p = ease(t);
        return place(p, p);
      }
      if (!visible) return;
      lapClock = (lapClock + dt) % LAP_MS;
      place(1, lapClock / LAP_MS);
    };
    frame = requestAnimationFrame(tick);

    // The map tilts a little toward the pointer, on devices that have one.
    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      const el = plate.current;
      if (!el) return;
      el.style.setProperty("--mx", (e.clientX / window.innerWidth - 0.5).toFixed(3));
      el.style.setProperty("--my", (e.clientY / window.innerHeight - 0.5).toFixed(3));
    };
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });

    // Scrolling past the hero flies the camera down into the map.
    let flyFrame = 0;
    const onScroll = () => {
      if (flyFrame) return;
      flyFrame = requestAnimationFrame(() => {
        flyFrame = 0;
        const f = Math.min(1, Math.max(0, window.scrollY / window.innerHeight));
        hero.current?.style.setProperty("--fly", f.toFixed(3));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      cancelAnimationFrame(flyFrame);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  const [sx, sy] = ROUTE_POINTS[0];

  return (
    <section ref={hero} className={s.hero} aria-labelledby="hero-title">
      <div className={s.plateWrap} aria-hidden="true">
        <div ref={plate} className={s.plate}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size map plate the SVG is laid on */}
          <img src="/landing/cubbon-park-map.webp" alt="" width={PLATE.width} height={PLATE.height} fetchPriority="high" />
          <svg viewBox={`0 0 ${PLATE.width} ${PLATE.height}`}>
            <path className={s.routeFaint} d={ROUTE_PATH} />
            <path ref={glow} className={s.routeGlow} d={ROUTE_PATH} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
            <path ref={line} className={s.routeLine} d={ROUTE_PATH} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
            <path ref={comet} className={s.routeComet} d={ROUTE_PATH} pathLength={1} strokeDasharray="0 2" />
            <circle cx={sx} cy={sy} r={15} fill="#22c55e" stroke="#121212" strokeWidth={6} />
            {KM_FRACTIONS.map((f, i) => {
              const [x, y] = pointAt(f);
              return (
                <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                  <g
                    ref={(el) => {
                      marks.current[i] = el;
                    }}
                    className={s.kmMark}
                    style={{ opacity: 0 }}
                  >
                    <circle r={24} fill="#121212" stroke="#c8f31d" strokeWidth={4} />
                    <text>{i + 1}</text>
                  </g>
                </g>
              );
            })}
            <g ref={runner} transform={`translate(${sx} ${sy})`}>
              <circle r={44} fill="#c8f31d" opacity={0.18}>
                <animate attributeName="r" values="22;58;22" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.35;0;0.35" dur="2.2s" repeatCount="indefinite" />
              </circle>
              <circle r={17} fill="#c8f31d" stroke="#121212" strokeWidth={6} />
            </g>
          </svg>
        </div>
      </div>
      <div className={s.heroShade} aria-hidden="true" />

      <div className={s.heroInner}>
        <h1 id="hero-title" className={s.headline}>
          <span>
            <span>Every stride</span>
          </span>
          <span>
            <span>counts.</span>
          </span>
        </h1>
        <p className={s.heroLead}>
          Stride records your runs, rides, walks and hikes with GPS, puts them on a map, and lets you share them with
          friends, challenges and clubs. Free and private, on Android, iPhone and the web.
        </p>
        <div className={s.heroActions}>
          {/* A plain link: /app is the web app itself, not a page of this site. */}
          <a href="/app" className={s.primary}>
            Open the web app
          </a>
          <Link href="/download" className={s.secondary}>
            Get the Android app
          </Link>
        </div>
      </div>

      <p className={s.heroPlace}>A real 3.68 km loop around Cubbon Park, Bengaluru</p>
      <p className={s.heroCredit}>Map data © OpenStreetMap contributors, OpenFreeMap</p>
    </section>
  );
}
