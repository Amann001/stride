"use client";

import { useEffect, useRef, useState } from "react";

import { PLATE, ROUTE_BOX, ROUTE_KM, ROUTE_PATH, ROUTE_POINTS, formatClock } from "@/lib/landing-route";

import s from "./landing.module.css";

const W = 1080;
const H = 1350;
const MARATHON_RECORD_PACE = 172; // seconds per km, a little under 2:52

// The share card for "your run": the real route, and how long you actually spent on the
// page, turned into a pace. Drawn on a canvas, so it can be saved as a picture.
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function verdict(pacePerKm: number) {
  if (pacePerKm < MARATHON_RECORD_PACE) return "Faster than the marathon world record. Try reading slower?";
  if (pacePerKm < 300) return "Quicker than most Sunday morning runners.";
  if (pacePerKm < 480) return "A steady pace. You took it all in.";
  return "Slow and thorough. Every stride counts.";
}

// Shrinks a line until it fits the card.
function fit(ctx: CanvasRenderingContext2D, text: string, style: (size: number) => string, size: number, width: number) {
  ctx.font = style(size);
  while (size > 20 && ctx.measureText(text).width > width) ctx.font = style((size -= 2));
}

// Breaks a sentence into lines that fit the card.
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const lines = [""];
  for (const word of text.split(" ")) {
    const next = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
    if (ctx.measureText(next).width > width && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
}

async function drawCard(canvas: HTMLCanvasElement, seconds: number) {
  const ctx = canvas.getContext("2d")!;
  const font = getComputedStyle(document.body).fontFamily;
  const [map, logo] = await Promise.all([loadImage("/landing/cubbon-park-map.webp"), loadImage("/stride-logo-on-dark.svg")]);
  await document.fonts.ready;
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, W, H);

  // The map around the route, top 64% of the card.
  const mapH = 860;
  const pad = 190;
  const scale = Math.max(W / (ROUTE_BOX.width + pad * 2), mapH / (ROUTE_BOX.height + pad * 2));
  const cx = ROUTE_BOX.x + ROUTE_BOX.width / 2;
  const cy = ROUTE_BOX.y + ROUTE_BOX.height / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, mapH);
  ctx.clip();
  ctx.translate(W / 2, mapH / 2 + 20);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(map, 0, 0, PLATE.width, PLATE.height);
  ctx.globalAlpha = 1;
  const route = new Path2D(ROUTE_PATH);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(200,243,29,0.45)";
  ctx.lineWidth = 34 / scale;
  ctx.filter = "blur(10px)";
  ctx.stroke(route);
  ctx.filter = "none";
  ctx.strokeStyle = "#c8f31d";
  ctx.lineWidth = 12 / scale;
  ctx.stroke(route);
  const [sx, sy] = ROUTE_POINTS[0];
  ctx.fillStyle = "#22c55e";
  ctx.strokeStyle = "#121212";
  ctx.lineWidth = 6 / scale;
  ctx.beginPath();
  ctx.arc(sx, sy, 16 / scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  const fade = ctx.createLinearGradient(0, mapH - 260, 0, mapH);
  fade.addColorStop(0, "rgba(18,18,18,0)");
  fade.addColorStop(1, "#121212");
  ctx.fillStyle = fade;
  ctx.fillRect(0, mapH - 260, W, 260);
  const top = ctx.createLinearGradient(0, 0, 0, 200);
  top.addColorStop(0, "rgba(18,18,18,0.85)");
  top.addColorStop(1, "rgba(18,18,18,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 200);
  ctx.drawImage(logo, 72, 64, (logo.width / logo.height) * 52, 52);

  // Title and stats.
  const pace = seconds / ROUTE_KM;
  ctx.fillStyle = "#eef1e8";
  const c = ctx as CanvasRenderingContext2D & { fontStretch?: string };
  c.fontStretch = "expanded";
  fit(ctx, "My run through Stride", (n) => `italic 800 ${n}px ${font}`, 84, W - 144);
  ctx.fillText("My run through Stride", 72, mapH + 30);
  c.fontStretch = "normal";
  ctx.font = `500 34px ${font}`;
  ctx.fillStyle = "#8e958b";
  ctx.fillText("Cubbon Park, Bengaluru", 72, mapH + 88);

  const stats = [
    ["Distance", `${ROUTE_KM.toFixed(2)} km`],
    ["Time", formatClock(seconds)],
    ["Pace", `${formatClock(pace)} /km`],
  ];
  stats.forEach(([label, value], i) => {
    const x = 72 + i * 330;
    ctx.fillStyle = "#8e958b";
    ctx.font = `500 30px ${font}`;
    ctx.fillText(label, x, mapH + 180);
    ctx.fillStyle = "#eef1e8";
    ctx.font = `800 64px ${font}`;
    ctx.fillText(value, x, mapH + 250);
  });

  ctx.fillStyle = "#c8f31d";
  ctx.font = `600 34px ${font}`;
  wrap(ctx, verdict(pace), W - 144).forEach((line, i) => ctx.fillText(line, 72, mapH + 330 + i * 44));
  ctx.fillStyle = "#8e958b";
  ctx.font = `500 28px ${font}`;
  ctx.fillText("stride-amanswamy.vercel.app", 72, H - 60);
}

export function RunCard() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Draw the card when you reach the finish, with the time you spent so far.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        const t = Math.max(1, Math.round(performance.now() / 1000));
        setSeconds(t);
        drawCard(el, t).then(() => setReady(true), () => {});
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const save = () => {
    canvas.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-stride-run.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, "image/png");
  };

  return (
    <figure className={s.runCard} data-hide-tracker>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        role="img"
        aria-label={`A run card: 3.68 km around Cubbon Park in ${formatClock(seconds)}, the time you spent on this page`}
      />
      <figcaption>
        <span>Your time on this page, as a run.</span>
        <button type="button" className={s.secondary} onClick={save} disabled={!ready}>
          Save my run card
        </button>
      </figcaption>
    </figure>
  );
}
