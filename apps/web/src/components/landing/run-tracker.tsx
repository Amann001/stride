"use client";

import { useEffect, useRef, useState } from "react";

import { PACE_SECONDS, ROUTE_BOX, ROUTE_KM, ROUTE_PATH, formatClock, pointAt } from "@/lib/landing-route";

import { StopIcon, useSoundtrack } from "./soundtrack";
import { soundtrack } from "./soundtrack-engine";
import s from "./landing.module.css";

// What the voice says at each kilometre, like the app's voice updates.
function splitUpdate(km: number) {
  const t = Math.round(km * PACE_SECONDS);
  return `${km} ${km === 1 ? "kilometre" : "kilometres"}. Time ${Math.floor(t / 60)} minutes ${t % 60} seconds.`;
}

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
  const music = useSoundtrack();

  useEffect(() => {
    let frame = 0;
    // The highest kilometre already called out, so each one is spoken once.
    let spoken = 0;
    let savedSpoken = false;
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
      // Out of the way at the end: the run card takes over from here, then the footer.
      const footer = document.querySelector("footer");
      const card = document.querySelector("[data-hide-tracker]");
      const atEnd =
        (footer ? footer.getBoundingClientRect().top < window.innerHeight : false) ||
        (card ? card.getBoundingClientRect().top < window.innerHeight * 0.85 : false);
      setShown(y >= anchors[0].top && !atEnd);
      setSaved(d >= ROUTE_KM);
      // With the beat playing, the voice calls out each kilometre as you reach it.
      const whole = Math.floor(d + 1e-6);
      if (whole > spoken && whole < 4) {
        spoken = whole;
        if (soundtrack.state.playing) soundtrack.say(splitUpdate(whole));
      }
      if (d >= ROUTE_KM && !savedSpoken) {
        savedSpoken = true;
        if (soundtrack.state.playing) soundtrack.say("Run saved. 3.68 kilometres. Nice work.");
      }
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
    <aside className={`${s.tracker} ${shown ? "" : s.trackerHidden}`} aria-label="Run tracker">
      <div className={s.trackerTop} aria-hidden="true">
        <span>
          <i className={saved ? s.savedDot : s.recDot} />
          {saved ? "Run saved" : "Recording a run"}
        </span>
      </div>
      <div className={s.trackerKm} aria-hidden="true">
        <span ref={km}>0.00</span>
        <small>km</small>
      </div>
      <div className={s.trackerRow} aria-hidden="true">
        <span>
          <span ref={time}>0:00</span>
          <span>time</span>
        </span>
        <span>
          {formatClock(PACE_SECONDS)}
          <span>/km</span>
        </span>
      </div>
      <svg className={s.trackerMap} viewBox={VIEW} preserveAspectRatio="xMinYMid meet" aria-hidden="true">
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
      {music.playing && (
        <div className={s.trackerMusic}>
          <span>
            <span className={s.note} aria-hidden="true">♪</span> {music.vibe.name}, {music.vibe.bpm} bpm
          </span>
          <button type="button" onClick={() => soundtrack.stop()} tabIndex={shown ? 0 : -1}>
            <StopIcon />
            Stop
          </button>
        </div>
      )}
    </aside>
  );
}
