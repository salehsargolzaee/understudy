import type { Exercise } from "../content";
import { makeRng } from "./rng";

/**
 * The catalog, painted.
 *
 * The one rule this file exists to enforce: **every star is one exercise, and
 * there are no other stars.** Swirls, currents and the milky band are paint —
 * thousands of short thick dabs along a flow field, meaningless individually.
 * The gold is not. If the page shows eight points of gold light, eight people
 * wrote eight exercises. A sky that flatters the catalog would be a lie told in
 * oil paint, which is still a lie.
 *
 * Layout is resolved before paint and handed back to the caller, so the
 * clickable star and the painted star can never drift apart.
 */

export interface Rect {
  /** fractions of the box, 0..1 */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface SkyStar {
  exercise: Exercise;
  /** css px within the painted box */
  x: number;
  y: number;
  /** halo radius in css px */
  r: number;
  /** seeded brightness, for depth only */
  glow: number;
}

export interface LayoutOptions {
  /** keep stars out of here — the text column */
  avoid?: Rect;
  /** fractional bounds; the default bottom clears the fade into paper */
  top?: number;
  bottom?: number;
  /** star size multiplier; phones use smaller stars in less sky */
  scale?: number;
}

export interface PaintOptions {
  seed: string;
  /** dissolve the bottom into the site's paper */
  fade?: boolean;
  /** extra night, 0..1 */
  dim?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const PAPER = "238,240,246";
const SHADOW = "#05081a";
const BASE = ["#0a1026", "#0f1a3e", "#142455", "#1b3068", "#22407f", "#0d1a3a"];
const CURRENT = ["#2a4a8c", "#3f74c0", "#5a8fd0", "#7fabdf", "#9dc0e6"];
const CYPRESS = ["#1f4a3c", "#2f6b52"];
const GOLD = ["#c39422", "#e0b64a", "#f6e29b"];

/** Every exercise is one small star: the size is the same for everyone, give or
 *  take the jitter a brush gives. Nobody's contribution is drawn larger. */
const starRadius = (w: number, h: number) => clamp(Math.min(w, h) * 0.032, 9, 24);

/**
 * Best-candidate sampling: each exercise proposes positions from its own seed,
 * and we keep the one furthest from the stars already placed, from the edges and
 * from the text. Stable for a given catalog and box, and a new exercise never
 * moves the stars that came before it.
 */
export function layoutStars(exercises: Exercise[], w: number, h: number, opts: LayoutOptions = {}): SkyStar[] {
  if (!exercises.length || w < 60 || h < 60) return [];

  const R = starRadius(w, h) * (opts.scale ?? 1);
  const mx = Math.min(R * 1.8, w * 0.12);
  const top = (opts.top ?? 0.06) * h;
  const bottom = (opts.bottom ?? 0.72) * h;
  if (bottom - top < R * 2) return [];

  const a = opts.avoid;
  const box = a
    ? { x0: a.x0 * w - R * 1.7, y0: a.y0 * h - R * 1.7, x1: a.x1 * w + R * 1.7, y1: a.y1 * h + R * 1.7 }
    : null;

  const out: SkyStar[] = [];
  for (const exercise of exercises) {
    const rng = makeRng(`star:${exercise.meta.id}`);
    let best: { x: number; y: number } | null = null;
    let bestScore = -Infinity;
    let fallback: { x: number; y: number } | null = null;

    for (let i = 0; i < 56; i++) {
      const x = mx + rng() * (w - 2 * mx);
      const y = top + rng() * (bottom - top);
      if (!fallback) fallback = { x, y };
      if (box && x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) continue;
      let score = Math.min(x, w - x, y - top + R, bottom - y + R);
      for (const s of out) score = Math.min(score, Math.hypot(s.x - x, s.y - y));
      if (score > bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }

    const p = best ?? fallback!;
    out.push({ exercise, x: p.x, y: p.y, r: R * (0.9 + rng() * 0.22), glow: 0.82 + rng() * 0.18 });
  }
  return out;
}

export function paintSky(canvas: HTMLCanvasElement, w: number, h: number, stars: SkyStar[], opts: PaintOptions): void {
  if (w < 2 || h < 2) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const rng = makeRng(opts.seed);

  // the ground
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#070b1e");
  sky.addColorStop(0.55, "#121f4a");
  sky.addColorStop(1, "#1d3566");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // a few eddies over a drift: the current every dab follows
  const vortices = Array.from({ length: 3 }, () => ({
    x: rng() * w,
    y: rng() * h * 0.9,
    s: (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 0.8),
  }));
  const field = (x: number, y: number) => {
    let angle = 0.12 + (y / h) * 0.22;
    for (const v of vortices) {
      const dx = x - v.x;
      const dy = y - v.y;
      const d = Math.hypot(dx, dy) + 110;
      angle += (Math.atan2(dy, dx) + Math.PI / 2) * ((v.s * 170) / d);
    }
    return angle;
  };

  ctx.lineCap = "round";

  /** impasto: a dark stroke under a light one, offset — paint with a height. */
  const dab = (x: number, y: number, angle: number, len: number, width: number, color: string, alpha: number) => {
    const cx = (Math.cos(angle) * len) / 2;
    const cy = (Math.sin(angle) * len) / 2;
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = SHADOW;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x - cx + 1, y - cy + 1.4);
    ctx.lineTo(x + cx + 1, y + cy + 1.4);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - cx, y - cy);
    ctx.lineTo(x + cx, y + cy);
    ctx.stroke();
  };

  // 1 — the sky is made of paint, not of gradient
  const n = clamp(Math.round((w * h) / 430), 600, 5200);
  for (let i = 0; i < n; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const t = y / h;
    const shade = BASE[clamp(Math.floor(t * 5 + (rng() - 0.5) * 1.8), 0, BASE.length - 1)];
    dab(x, y, field(x, y) + (rng() - 0.5) * 0.3, 14 + rng() * 22, 6 + rng() * 8, shade, 0.2 + rng() * 0.26);
  }

  // 2 — one lighter swathe across the composition, so the eye has a path
  const bandAngle = -0.38 + rng() * 0.22;
  const bx = w * (0.2 + rng() * 0.6);
  const by = h * (0.25 + rng() * 0.4);
  for (let i = 0; i < Math.round(n * 0.16); i++) {
    const along = (rng() - 0.5) * 1.7;
    const across = (rng() - 0.5 + (rng() - 0.5)) * 0.5;
    const x = bx + Math.cos(bandAngle) * along * w;
    const y = by + Math.sin(bandAngle) * along * w + across * h * 0.22;
    if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
    dab(x, y, field(x, y), 16 + rng() * 18, 5 + rng() * 6, CURRENT[Math.floor(rng() * 3)], 0.09 + rng() * 0.17);
  }

  // 3 — currents: walk the streamlines, so the swirls read as rivers of light
  const streams = clamp(Math.round(w / 52), 10, 34);
  for (let s = 0; s < streams; s++) {
    let x = rng() * w;
    let y = rng() * h * 0.92;
    const color = rng() < 0.16 ? CYPRESS[Math.floor(rng() * 2)] : CURRENT[Math.floor(rng() * CURRENT.length)];
    const steps = 20 + Math.floor(rng() * 28);
    for (let k = 0; k < steps; k++) {
      const angle = field(x, y);
      dab(x, y, angle, 16 + rng() * 14, 5 + rng() * 5, color, (0.2 + rng() * 0.3) * (1 - (k / steps) * 0.35));
      x += Math.cos(angle) * 12;
      y += Math.sin(angle) * 12;
      if (x < -30 || x > w + 30 || y < -30 || y > h + 30) break;
    }
  }

  // 4 — a cold glow along the bottom, so the empty sky still has a horizon
  ctx.globalAlpha = 1;
  const horizon = ctx.createLinearGradient(0, h * 0.7, 0, h);
  horizon.addColorStop(0, "rgba(63,116,192,0)");
  horizon.addColorStop(1, "rgba(90,143,208,0.15)");
  ctx.fillStyle = horizon;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);

  // 5 — the stars. One per exercise. Haloes of tangential gold, a white core.
  for (const star of stars) {
    const srng = makeRng(`paint:${star.exercise.meta.id}`);
    const R = star.r;

    const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, R * 2.9);
    glow.addColorStop(0, `rgba(253,246,218,${0.7 * star.glow})`);
    glow.addColorStop(0.3, `rgba(224,182,74,${0.3 * star.glow})`);
    glow.addColorStop(1, "rgba(224,182,74,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(star.x, star.y, R * 2.9, 0, Math.PI * 2);
    ctx.fill();

    for (let ring = 0; ring < 3; ring++) {
      const rr = R * (0.5 + ring * 0.42);
      const count = 8 + ring * 5;
      for (let j = 0; j < count; j++) {
        const t = (j / count) * Math.PI * 2 + srng() * 0.45 + ring;
        dab(
          star.x + Math.cos(t) * rr,
          star.y + Math.sin(t) * rr,
          t + Math.PI / 2,
          7 + srng() * 8,
          3 + srng() * 2.6,
          GOLD[Math.floor(srng() * GOLD.length)],
          (0.42 + srng() * 0.4) * star.glow,
        );
      }
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fdf6da";
    ctx.beginPath();
    ctx.arc(star.x, star.y, Math.max(2, R * 0.13), 0, Math.PI * 2);
    ctx.fill();
  }

  // 6 — vignette, night, and the dissolve into paper
  ctx.globalAlpha = 1;
  const vignette = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.26, w / 2, h * 0.45, Math.max(w, h) * 0.8);
  vignette.addColorStop(0, "rgba(5,8,20,0)");
  vignette.addColorStop(1, "rgba(5,8,20,0.5)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  if (opts.dim) {
    ctx.fillStyle = `rgba(6,9,24,${opts.dim})`;
    ctx.fillRect(0, 0, w, h);
  }

  if (opts.fade) {
    // eased, and later: the night holds longer, then lets go quickly, so
    // there is no wide milky band between the painting and the paper
    const fade = ctx.createLinearGradient(0, h * 0.84, 0, h);
    fade.addColorStop(0, `rgba(${PAPER},0)`);
    fade.addColorStop(0.45, `rgba(${PAPER},0.18)`);
    fade.addColorStop(0.75, `rgba(${PAPER},0.6)`);
    fade.addColorStop(1, `rgba(${PAPER},1)`);
    ctx.fillStyle = fade;
    ctx.fillRect(0, h * 0.84, w, h * 0.16);
  }
}
