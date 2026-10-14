"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { PACE_SECONDS, PLATE, ROUTE_BOX, ROUTE_KM, ROUTE_PATH, ROUTE_POINTS, formatClock, pointAt } from "@/lib/landing-route";

import s from "./landing.module.css";

export const GITHUB_URL = "https://github.com/Amann001/stride";

// Calls back once, the first time an element is well into view.
function useFirstView<T extends Element>(onView: () => void, threshold = 0.45) {
  const ref = useRef<T>(null);
  const cb = useRef(onView);
  useEffect(() => {
    cb.current = onView;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        cb.current();
        io.disconnect();
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

function SplitLabel({ children }: { children: React.ReactNode }) {
  return <p className={s.splitLabel}>{children}</p>;
}

function Toggle<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={s.toggle} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PAD = 120;
const box = (aspect: number) => {
  // A view of the route with some map around it, at the given width/height.
  let h = ROUTE_BOX.height + PAD * 2;
  let w = h * aspect;
  if (w < ROUTE_BOX.width + PAD * 2) {
    w = ROUTE_BOX.width + PAD * 2;
    h = w / aspect;
  }
  const cx = ROUTE_BOX.x + ROUTE_BOX.width / 2;
  const cy = ROUTE_BOX.y + ROUTE_BOX.height / 2;
  return `${(cx - w / 2).toFixed(0)} ${(cy - h / 2).toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`;
};
const MapImage = () => <image href="/landing/cubbon-park-map.webp" width={PLATE.width} height={PLATE.height} opacity={0.75} />;

/* ---------- The film ---------- */

export function Film() {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // With reduced motion the film waits for the button instead of playing by itself.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const sound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !muted;
    if (muted) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    setMuted(!muted);
  };

  return (
    <section className={s.film} data-km="0" aria-label="Stride in 20 seconds">
      <div className={s.filmFrame}>
        <video
          ref={video}
          src="/landing/stride-film.mp4"
          poster="/landing/stride-film-poster.webp"
          muted
          loop
          playsInline
          preload="metadata"
        />
        <button type="button" className={s.soundButton} onClick={sound}>
          <SoundIcon on={!muted} />
          {muted ? "Play with sound" : "Mute"}
        </button>
      </div>
      <p className={s.filmCaption}>Stride in 20 seconds, on the same Cubbon Park loop. The film is made in code with Remotion.</p>
    </section>
  );
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" />
      {on ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="m16 9 6 6m0-6-6 6" />}
    </svg>
  );
}

/* ---------- 1 km: clean GPS ---------- */

// Raw readings along the real route: wobbly, and a few that leap away (what phones really do
// under trees and between buildings). Fixed numbers, so server and browser draw the same thing.
// Rounded, so the server and the browser print exactly the same numbers.
const round = (n: number) => Math.round(n * 10) / 10;
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const RAW = Array.from({ length: 72 }, (_, i) => {
  const [x, y] = pointAt(i / 71);
  const a = rand() * Math.PI * 2;
  const r = 6 + rand() * 20;
  return { x: round(x + Math.cos(a) * r), y: round(y + Math.sin(a) * r), jump: false };
});
for (const i of [12, 29, 45, 60]) {
  const a = rand() * Math.PI * 2;
  RAW.splice(i, 0, { x: round(RAW[i].x + Math.cos(a) * 190), y: round(RAW[i].y + Math.sin(a) * 190), jump: true });
}
const RAW_PATH = "M" + RAW.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L");

export function CleanGps() {
  const [mode, setMode] = useState<"raw" | "clean">("raw");
  const touched = useRef(false);
  const ref = useFirstView<HTMLDivElement>(() => {
    setTimeout(() => !touched.current && setMode("clean"), 700);
  });
  const clean = mode === "clean";
  const choose = (m: "raw" | "clean") => {
    touched.current = true;
    setMode(m);
  };

  return (
    <section className={s.split} data-km="1" aria-labelledby="gps-title">
      <div className={s.splitGrid}>
        <div className={s.splitText}>
          <SplitLabel>1 km</SplitLabel>
          <h2 id="gps-title" className={s.h2}>
            Messy GPS in, a clean route out.
          </h2>
          <p className={s.lead}>
            Phones guess. Under trees or between buildings a reading can drift 30 m, or leap across a road. Stride skips
            any reading worse than 20 m and drops any point that would need an impossible speed for your sport, first on
            the phone and again on the server.
          </p>
          <Toggle
            label="GPS view"
            value={mode}
            onChange={choose}
            options={[
              { value: "raw", label: "Raw GPS" },
              { value: "clean", label: "Cleaned by Stride" },
            ]}
          />
        </div>
        <div ref={ref} className={s.gpsCard}>
          <svg viewBox={box(5 / 4)} role="img" aria-label={clean ? "The cleaned route along the park paths" : "Raw GPS readings, with a few far off the route"}>
            <MapImage />
            <path d={RAW_PATH} fill="none" stroke="rgba(238,241,232,0.45)" strokeWidth={4} strokeLinejoin="round" style={{ opacity: clean ? 0 : 1, transition: "opacity 0.6s" }} />
            <path
              className={s.cleanLine}
              d={ROUTE_PATH}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={clean ? 0 : 1}
            />
            {RAW.map((p, i) =>
              p.jump ? (
                <circle key={i} className={s.jumpDot} cx={p.x} cy={p.y} r={clean ? 0 : 15} style={{ opacity: clean ? 0 : 1 }} />
              ) : (
                <circle key={i} className={s.rawDot} cx={p.x} cy={p.y} r={clean ? 5 : 9} style={{ opacity: clean ? 0.35 : 1 }} />
              ),
            )}
          </svg>
          <div className={s.gpsLegend}>
            <span>
              <i style={{ background: "rgba(238,241,232,0.7)" }} />
              GPS readings
            </span>
            <span style={{ opacity: clean ? 0.4 : 1, transition: "opacity 0.5s" }}>
              <i style={{ background: "#ef4444" }} />
              Impossible jumps, dropped
            </span>
            <span style={{ opacity: clean ? 1 : 0.4, transition: "opacity 0.5s" }}>
              <i style={{ background: "#c8f31d" }} />
              Your route
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 2 km: real screens, swapped as you scroll ---------- */

const SCREENS = [
  {
    src: "/showcase/progress.webp",
    title: "Your weeks, at a glance",
    text: "Weekly totals, a 12-week chart and your streak, for every sport together or one at a time.",
  },
  {
    src: "/showcase/challenges.webp",
    title: "Challenges every month",
    text: "Join the month's challenges, or set your own goal and dates and invite your friends. Free, always.",
  },
  {
    src: "/showcase/leaderboard.webp",
    title: "A leaderboard with your friends",
    text: "See who is ahead in each challenge, and how far you have left to go.",
  },
  {
    src: "/showcase/notifications.webp",
    title: "Kudos, comments and invites",
    text: "Follow people, cheer their activities and chat. Find friends by name or with a QR code.",
  },
  {
    src: "/showcase/club.webp",
    title: "Clubs for your sport and your city",
    text: "Run or ride with a group, with a weekly distance leaderboard for its members.",
  },
];

export function Screens() {
  const [active, setActive] = useState(0);
  const steps = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className={s.split} data-km="2" aria-labelledby="screens-title">
      <div className={s.splitText}>
        <SplitLabel>2 km</SplitLabel>
        <h2 id="screens-title" className={s.h2}>
          Run alone. Train together.
        </h2>
        <p className={s.lead}>Real screens from the app, with sample people and activities.</p>
      </div>
      <div className={s.screens}>
        <div className={s.phoneSticky}>
          <div className={s.phone}>
            <div className={s.phoneScreen}>
              {SCREENS.map((sc, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- stacked screens that cross-fade
                <img key={sc.src} src={sc.src} alt={i === active ? sc.title : ""} className={i === active ? s.on : ""} loading="lazy" width={560} height={1212} />
              ))}
            </div>
          </div>
        </div>
        <ol className={s.steps}>
          {SCREENS.map((sc, i) => (
            <li
              key={sc.src}
              data-i={i}
              ref={(el) => {
                steps.current[i] = el;
              }}
              className={`${s.step} ${i === active ? s.stepOn : ""}`}
            >
              <h3>{sc.title}</h3>
              <p className={s.lead}>{sc.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- 3 km: privacy ---------- */

const ZONE = 200 / (ROUTE_KM * 1000); // the share of the route that is 200 m
const ZONE_PX = 200 / 1.1638; // 200 m in map pixels at this zoom and latitude

export function Privacy() {
  const [mode, setMode] = useState<"you" | "others">("you");
  const touched = useRef(false);
  const ref = useFirstView<HTMLDivElement>(() => {
    setTimeout(() => !touched.current && setMode("others"), 900);
  });
  const others = mode === "others";
  const [sx, sy] = ROUTE_POINTS[0];
  const [ax, ay] = pointAt(ZONE).map(round);
  const [bx, by] = pointAt(1 - ZONE).map(round);

  return (
    <section className={s.split} data-km="3" aria-labelledby="privacy-title">
      <div className={s.splitGrid}>
        <div ref={ref} className={s.privacyMap}>
          <svg viewBox={box(1)} role="img" aria-label={others ? "The route as others see it, without its first and last 200 metres" : "The full route, as you see it"}>
            <MapImage />
            <circle className={s.zone} cx={sx} cy={sy} r={ZONE_PX} style={{ opacity: others ? 1 : 0 }} />
            <path d={ROUTE_PATH} fill="none" stroke="rgba(200,243,29,0.35)" strokeWidth={6} strokeDasharray="3 15" strokeLinecap="round" />
            <path
              d={ROUTE_PATH}
              fill="none"
              stroke="#c8f31d"
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={others ? `0 ${ZONE} ${1 - 2 * ZONE} 1` : "0 0 1 1"}
              style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
            />
            <g style={{ opacity: others ? 0 : 1, transition: "opacity 0.6s" }}>
              <circle cx={sx} cy={sy} r={20} fill="#22c55e" stroke="#121212" strokeWidth={7} />
            </g>
            <g style={{ opacity: others ? 1 : 0, transition: "opacity 0.6s 0.6s" }}>
              <circle cx={ax} cy={ay} r={14} fill="#c8f31d" stroke="#121212" strokeWidth={6} />
              <circle cx={bx} cy={by} r={14} fill="#c8f31d" stroke="#121212" strokeWidth={6} />
            </g>
          </svg>
          <p className={s.mapNote}>{others ? "What everyone else sees: the route starts and ends 200 m from your door" : "What you see: your whole route"}</p>
        </div>
        <div className={s.splitText}>
          <SplitLabel>3 km</SplitLabel>
          <h2 id="privacy-title" className={s.h2}>
            Your front door stays off the map.
          </h2>
          <p className={s.lead}>
            You always see your whole route. Everyone else gets it without the first and last 200 m, so the place you start
            from stays yours. The server trims it before it leaves, on activities and on the shared heatmap.
          </p>
          <Toggle
            label="Who is looking"
            value={mode}
            onChange={(m) => {
              touched.current = true;
              setMode(m);
            }}
            options={[
              { value: "you", label: "You see" },
              { value: "others", label: "Others see" },
            ]}
          />
          <ul className={s.facts}>
            <li>
              <strong>Followers only, to start with</strong>
              <span>New activities are shared with your followers. You choose if one goes public.</span>
            </li>
            <li>
              <strong>No ads, no trackers</strong>
              <span>Nothing in the app or this site sells or shares what you do.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- Finish: run saved, and how it is built ---------- */

const BUILD = [
  { value: "147", label: "automated tests on every change" },
  { value: "~75", label: "API endpoints" },
  { value: "22", label: "database tables" },
  { value: "₹0", label: "a month to run, all on free tiers" },
];

const HIGHLIGHTS = [
  {
    title: "One codebase, three platforms",
    text: "The Android app, the iPhone web app and the browser version are the same React Native and Expo code. The web build installs from the Home Screen and works like an app.",
  },
  {
    title: "Shared GPS rules",
    text: "The accuracy limit, the jump filter and the elevation smoothing live in one shared package, so the phone and the server agree on every metre.",
  },
  {
    title: "Privacy in the queries",
    text: "The 200 m privacy zone is applied by the API, for every response and the heatmap, so no screen can forget it.",
  },
  {
    title: "Checked on every change",
    text: "GitHub Actions type-checks, tests and lints each pull request. Merging deploys the API to Render and this site to Vercel.",
  },
];

const STACK = ["React Native", "Expo", "TypeScript", "Node.js", "Fastify", "PostgreSQL", "Next.js", "Tailwind CSS", "MapLibre", "Vitest", "GitHub Actions"];

export function Finish() {
  return (
    <section className={s.finish} data-km={ROUTE_KM} aria-labelledby="finish-title">
      <SplitLabel>3.68 km, finish</SplitLabel>
      <h2 id="finish-title" className={s.finishHead}>
        Run saved.
      </h2>

      <div className={s.summary}>
        <div className={s.summaryTitle}>
          <i aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#121212" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 5 5L20 7" />
            </svg>
          </i>
          <div>
            Morning run in Cubbon Park
            <small>Built by one student, from the database to this page</small>
          </div>
        </div>
        <dl className={s.stats}>
          <div>
            <dt>Distance</dt>
            <dd>{ROUTE_KM.toFixed(2)} km</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{formatClock(ROUTE_KM * PACE_SECONDS)}</dd>
          </div>
          <div>
            <dt>Pace</dt>
            <dd>{formatClock(PACE_SECONDS)} /km</dd>
          </div>
        </dl>
        <div className={s.awards}>
          {BUILD.map((b) => (
            <div key={b.label} className={s.award}>
              <b>{b.value}</b>
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={s.lineMap}>
        <h3 className={s.h3}>How it&apos;s built</h3>
        <p className={s.lead}>Three apps and a database, joined like stops on a route.</p>
        <LineMap />
        <div className={s.highlights}>
          {HIGHLIGHTS.map((h) => (
            <div key={h.title}>
              <h4>{h.title}</h4>
              <p>{h.text}</p>
            </div>
          ))}
        </div>
        <ul className={s.stack} aria-label="Built with">
          {STACK.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div className={s.finalActions}>
        <a href="/app" className={s.primary}>
          Open the web app
        </a>
        <Link href="/download" className={s.secondary}>
          Get the Android app
        </Link>
        <a href={GITHUB_URL} className={s.textLink} target="_blank" rel="noreferrer">
          Read the code on GitHub
        </a>
      </div>
    </section>
  );
}

// Phone app and website both talk to one API, which talks to one database.
const WIDE = {
  view: "0 -40 1000 340",
  tracks: ["M60 60 C 260 60 300 140 520 140 L 940 140", "M60 220 C 260 220 300 140 520 140"],
  stops: [
    { x: 60, y: 60, name: "Android and iPhone app", sub: "React Native, Expo", tx: 0, ty: -56, anchor: "start" },
    { x: 60, y: 220, name: "Website and web app", sub: "Next.js on Vercel", tx: 0, ty: 40, anchor: "start" },
    { x: 520, y: 140, name: "API", sub: "Fastify on Render", tx: 0, ty: -60, anchor: "middle" },
    { x: 940, y: 140, name: "Database", sub: "PostgreSQL on Neon", tx: 0, ty: 40, anchor: "end" },
  ],
} as const;
const TALL = {
  view: "0 -40 360 540",
  tracks: ["M40 50 C 40 170 180 170 180 300 L 180 460", "M320 50 C 320 170 180 170 180 300"],
  stops: [
    { x: 40, y: 50, name: "Android and iPhone app", sub: "React Native, Expo", tx: -30, ty: -60, anchor: "start" },
    { x: 320, y: 50, name: "Website and web app", sub: "Next.js on Vercel", tx: 30, ty: -60, anchor: "end" },
    { x: 180, y: 300, name: "API", sub: "Fastify on Render", tx: 26, ty: -10, anchor: "start" },
    { x: 180, y: 460, name: "Database", sub: "PostgreSQL on Neon", tx: 26, ty: -10, anchor: "start" },
  ],
} as const;

function LineMap() {
  return (
    <>
      {[WIDE, TALL].map((m) => (
        <svg key={m.view} viewBox={m.view} className={m === WIDE ? s.lineWide : s.lineTall} role="img" aria-label="The phone app and the website both use one API, which stores everything in one database">
          {m.tracks.map((d) => (
            <g key={d}>
              <path className={s.track} d={d} />
              <path className={s.pulse} d={d} pathLength={1} />
            </g>
          ))}
          {m.stops.map((st) => (
            <g key={st.name}>
              <circle className={s.stop} cx={st.x} cy={st.y} r={11} />
              <text x={st.x + st.tx} y={st.y + st.ty} textAnchor={st.anchor} dominantBaseline="middle">
                {st.name}
              </text>
              <text className={s.sub} x={st.x + st.tx} y={st.y + st.ty + 20} textAnchor={st.anchor} dominantBaseline="middle">
                {st.sub}
              </text>
            </g>
          ))}
        </svg>
      ))}
    </>
  );
}

export function Footer() {
  return (
    <footer className={s.footer}>
      <span>Stride. Every stride counts.</span>
      <nav aria-label="Footer">
        <a href="/app">Web app</a>
        <Link href="/download">Android app</Link>
        <Link href="/login">Log in</Link>
        <a href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </nav>
    </footer>
  );
}
