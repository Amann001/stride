import Link from "next/link";

import { ROUTE_BOX, ROUTE_PATH, pointAt } from "@/lib/landing-route";

// 404: the route on the map, and a dotted line where you wandered off it.
const [ax, ay] = pointAt(0.42);
const wander = `M${ax.toFixed(0)} ${ay.toFixed(0)} q 120 -40 160 40 t 180 30 t 140 -90 t 170 60`;
const PAD = 120;
const VIEW = `${ROUTE_BOX.x - PAD} ${ROUTE_BOX.y - PAD} ${ROUTE_BOX.width + PAD * 2 + 520} ${ROUTE_BOX.height + PAD * 2}`;

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center bg-brand-ink px-5 py-16 text-zinc-100">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 md:grid-cols-2">
        <div>
          <p className="font-semibold text-brand">Page not found</p>
          <h1 className="mt-3 text-5xl font-extrabold italic leading-none tracking-tight [font-stretch:125%] sm:text-6xl">
            You went off route.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-zinc-400">
            This page isn&apos;t on the map. It may have moved, or the link has a typo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="rounded-full bg-brand px-6 py-3 font-bold text-brand-ink">
              Back to the start
            </Link>
            <a href="/app" className="rounded-full border border-zinc-600 px-6 py-3 font-bold hover:border-zinc-300">
              Open the web app
            </a>
          </div>
        </div>
        <svg viewBox={VIEW} className="w-full" role="img" aria-label="A route with a dotted line wandering away from it">
          <path d={ROUTE_PATH} fill="none" stroke="#c8f31d" strokeWidth={12} strokeLinejoin="round" opacity={0.9} />
          <path d={wander} fill="none" stroke="#ef4444" strokeWidth={9} strokeDasharray="4 20" strokeLinecap="round" />
          <circle cx={ax} cy={ay} r={20} fill="#c8f31d" stroke="#121212" strokeWidth={8} />
          <g transform={`translate(${(ax + 650).toFixed(0)} ${(ay + 40).toFixed(0)})`}>
            <circle r={34} fill="#ef4444" />
            <text textAnchor="middle" dominantBaseline="central" fontSize={44} fontWeight={800} fill="#121212">
              ?
            </text>
          </g>
        </svg>
      </div>
    </main>
  );
}
