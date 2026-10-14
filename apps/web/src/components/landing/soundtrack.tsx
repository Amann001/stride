"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { Runner } from "./runner";
import { VIBES, soundtrack } from "./soundtrack-engine";
import s from "./landing.module.css";

const SERVER_STATE = soundtrack.getState();
export const useSoundtrack = () => useSyncExternalStore(soundtrack.subscribe, soundtrack.getState, () => SERVER_STATE);

export const SAMPLE_UPDATE = "1 kilometre. Time 5 minutes 12 seconds. Pace 5 12 per kilometre.";

// Warm-up: pick a beat, watch the runner match it, and hear a voice update dip the music,
// which is what the app does with your own Spotify or YouTube Music.
export function Soundtrack() {
  const { playing, vibe, speaking } = useSoundtrack();
  return (
    <section className={s.split} data-km="0" aria-labelledby="soundtrack-title">
      <div className={s.splitGrid}>
        <div className={s.splitText}>
          <p className={s.splitLabel}>Warm-up</p>
          <h2 id="soundtrack-title" className={s.h2}>
            Bring your own soundtrack.
          </h2>
          <p className={s.lead}>
            The music button on the Record screen opens Spotify, YouTube Music, JioSaavn or Apple Music. Pick a song, come
            back, run. When the voice reads out your kilometre, your music dips so you can hear it, then comes back up.
          </p>
          <p className={s.lead}>Try it here: pick a pace, press play, then ask for a voice update.</p>

          <div className={s.toggle} role="group" aria-label="Pace">
            {VIBES.map((v) => (
              <button key={v.id} type="button" aria-pressed={vibe.id === v.id} onClick={() => soundtrack.setVibe(v)}>
                {v.name}
              </button>
            ))}
          </div>

          <div className={s.actions}>
            <button
              type="button"
              className={s.primary}
              onClick={() => (playing ? soundtrack.stop() : soundtrack.start())}
              aria-pressed={playing}
            >
              {playing ? <StopIcon /> : <PlayIcon />}
              {playing ? "Stop the beat" : "Play a running beat"}
            </button>
            <button type="button" className={s.secondary} onClick={() => soundtrack.say(SAMPLE_UPDATE)} disabled={!!speaking}>
              Hear a voice update
            </button>
          </div>
          <p className={s.small}>
            Sound on. The beat is made live in your browser from code, so no two plays are the same. Leave it playing as
            you scroll and the voice calls out each kilometre.
          </p>
        </div>

        <div
          className={`${s.stage} ${playing ? s.stagePlaying : ""}`}
          style={{ "--beat": `${(60 / vibe.bpm).toFixed(3)}s` } as React.CSSProperties}
        >
          <div className={s.streaks} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <i key={i} />
            ))}
          </div>
          <div className={s.stageTop}>
            <div>
              <span className={s.stageBpm}>{vibe.bpm}</span>
              <span className={s.stageUnit}>steps a minute</span>
            </div>
            <div className={s.stageVibe}>
              <b>{vibe.name}</b>
              <span>{vibe.feel}</span>
            </div>
          </div>
          <Runner bpm={vibe.bpm} className={s.stageRunner} />
          <Meter />
          <p className={`${s.caption} ${speaking ? s.captionOn : ""}`} aria-live="polite">
            {speaking ? (
              <>
                <span className={s.duckBadge}>Music lowered</span>
                {speaking}
              </>
            ) : playing ? (
              "Music at full volume"
            ) : (
              "Press play to hear the beat"
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

// A small level meter, so you can see the music dip while the voice speaks.
function Meter() {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    let frame = 0;
    const data = new Uint8Array(128);
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const a = soundtrack.analyser;
      const playing = soundtrack.state.playing;
      // The analyser reads in decibels, which flattens the dip; show it as you hear it.
      const dip = soundtrack.state.speaking ? 0.35 : 1;
      if (a && playing) a.getByteFrequencyData(data);
      bars.current.forEach((el, i) => {
        if (!el) return;
        const v = a && playing ? (data[2 + i * 3] / 255) * dip : 0;
        el.style.transform = `scaleY(${Math.max(0.06, v).toFixed(3)})`;
      });
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div className={s.meter} aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
        />
      ))}
    </div>
  );
}

export function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
    </svg>
  );
}
export function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}
