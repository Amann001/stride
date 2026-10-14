"use client";

import { useEffect, useRef, useState } from "react";

import { PACE_SECONDS, ROUTE_BOX, ROUTE_KM, ROUTE_PATH, formatClock, pointAt } from "@/lib/landing-route";

import s from "./landing.module.css";

const PAD = 70;
const VIEW = `${ROUTE_BOX.x - PAD} ${ROUTE_BOX.y - PAD} ${ROUTE_BOX.width + PAD * 2} ${ROUTE_BOX.height + PAD * 2}`;

// Reading the page is the run: this card records it. Sections carry data-km (0, 1, 2, 3 and
// the finish), so the distance reaches each kilometre exactly as its section comes into view.
export function RunTracker() {
  const [shown, setShown] = useState(false);
  const [saved, setSaved] = useState(false);
  const km = useRef<HTMLSpanElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const line = useRef<SVGPathElement>(null);
  const dot = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const anchors = [...document.querySelectorAll<HTMLElement>("[data-km]")].map((el) => ({
        top: el.getBoundingClientRect().top + window.scrollY,
        km: Number(el.dataset.km),
      }));
      if (!anchors.length) return;
      // The reading line sits 40% down the screen.
      const y = window.scrollY + window.innerHeight * 0.4;
      let d = 0;
      if (y >= anchors[anchors.length - 1].top) d = ROUTE_KM;
      else {
        for (let i = 1; i < anchors.length; i++) {
          const a = anchors[i - 1];
          const b = anchors[i];
          if (y < b.top) {
            d = y < a.top ? 0 : a.km + ((y - a.top) / (b.top - a.top)) * (b.km - a.km);
            break;
          }
        }
      }
      const f = d / ROUTE_KM;
      if (km.current) km.current.textContent = d.toFixed(2);
      if (time.current) time.current.textContent = formatClock(d * PACE_SECONDS);
      line.current?.setAttribute("stroke-dashoffset", String(1 - f));
      const [x, yy] = pointAt(f);
      dot.current?.setAttribute("cx", x.toFixed(1));
      dot.current?.setAttribute("cy", yy.toFixed(1));
      const footer = document.querySelector("footer");
      const atEnd = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;
      setShown(y >= anchors[0].top && !atEnd);
      setSaved(d >= ROUTE_KM);
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };
  }, []);

  return (
    <aside className={`${s.tracker} ${shown ? "" : s.trackerHidden}`} aria-hidden="true">
      <div className={s.trackerTop}>
        <span>
          <i className={saved ? s.savedDot : s.recDot} />
          {saved ? "Run saved" : "Recording a run"}
        </span>
      </div>
      <div className={s.trackerKm}>
        <span ref={km}>0.00</span>
        <small>km</small>
      </div>
      <div className={s.trackerRow}>
        <span>
          <span ref={time}>0:00</span>
          <span>time</span>
        </span>
        <span>
          {formatClock(PACE_SECONDS)}
          <span>/km</span>
        </span>
      </div>
      <svg className={s.trackerMap} viewBox={VIEW} preserveAspectRatio="xMinYMid meet">
        <path d={ROUTE_PATH} fill="none" stroke="rgba(238,241,232,0.16)" strokeWidth={26} strokeLinejoin="round" />
        <path
          ref={line}
          d={ROUTE_PATH}
          fill="none"
          stroke="#c8f31d"
          strokeWidth={30}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1}
        />
        <circle ref={dot} r={44} fill="#c8f31d" stroke="#191a19" strokeWidth={14} />
      </svg>
    </aside>
  );
}
