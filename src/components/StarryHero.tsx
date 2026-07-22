import { useMemo } from "react";
import type { ReactNode } from "react";

/**
 * A generated night sky, seeded from the handle, so every contributor gets a
 * different painting. The strokes and stars are locally just marks; together
 * they compose one scene, the same way scattered lectures compose one journey.
 * Deterministic per handle (no Math.random), so a person's canvas is stable.
 */
function makeRng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const W = 1200;
const H = 460;
const BLUES = ["#16264f", "#1d3568", "#264a8f", "#2f5aa0", "#3f74c0", "#5a93d6"];
const GREENS = ["#234b3b", "#2f6b52", "#3f8060"];
const GOLDS = ["#e7c14a", "#f2d879", "#fbeaa6"];

export default function StarryHero({ handle, children }: { handle: string; children: ReactNode }) {
  const { strokes, stars } = useMemo(() => {
    const r = makeRng(handle || "understudy");
    // A few swirl centres; strokes bend around them like Van Gogh's eddies.
    const vortices = Array.from({ length: 3 }, () => ({
      x: r() * W,
      y: r() * H * 0.85,
      s: (r() < 0.5 ? -1 : 1) * (0.6 + r()),
    }));
    const field = (x: number, y: number) => {
      let ang = 0.55;
      for (const v of vortices) {
        const dx = x - v.x;
        const dy = y - v.y;
        const d = Math.hypot(dx, dy) + 45;
        ang += (Math.atan2(dy, dx) + Math.PI / 2) * ((v.s * 130) / d);
      }
      return ang;
    };
    const strokes = [] as { d: string; color: string; w: number; o: number }[];
    for (let i = 0; i < 115; i++) {
      let x = r() * W;
      let y = r() * H;
      const pts: [number, number][] = [[x, y]];
      const steps = 4 + Math.floor(r() * 6);
      for (let s = 0; s < steps; s++) {
        const a = field(x, y) + (r() - 0.5) * 0.5;
        x += Math.cos(a) * 16;
        y += Math.sin(a) * 16;
        pts.push([x, y]);
      }
      const pal = r() < 0.14 ? GOLDS : r() < 0.26 ? GREENS : BLUES;
      strokes.push({
        d: "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L"),
        color: pal[Math.floor(r() * pal.length)],
        w: 1.5 + r() * 4,
        o: 0.22 + r() * 0.42,
      });
    }
    const stars = [] as { x: number; y: number; glow: number; core: number }[];
    for (let i = 0; i < 16; i++) {
      const big = r() < 0.25;
      stars.push({
        x: r() * W,
        y: r() * H * 0.72,
        glow: big ? 26 + r() * 22 : 8 + r() * 10,
        core: big ? 3 + r() * 2 : 1 + r() * 1.5,
      });
    }
    return { strokes, stars };
  }, [handle]);

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm ring-1 ring-ink-950/20">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-[320px] w-full sm:h-[400px]"
        role="img"
        aria-label="This contributor's work rendered as a night sky"
      >
        <defs>
          <linearGradient id="uy-night" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0c1633" />
            <stop offset="0.55" stopColor="#14264f" />
            <stop offset="1" stopColor="#1c3a5c" />
          </linearGradient>
          <radialGradient id="uy-star">
            <stop offset="0" stopColor="#fbeaa6" stopOpacity="0.9" />
            <stop offset="0.4" stopColor="#e7c14a" stopOpacity="0.35" />
            <stop offset="1" stopColor="#e7c14a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="uy-scrim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.4" stopColor="#0a1228" stopOpacity="0" />
            <stop offset="1" stopColor="#0a1228" stopOpacity="0.88" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#uy-night)" />
        {strokes.map((s, i) => (
          <path
            key={i}
            d={s.d}
            stroke={s.color}
            strokeWidth={s.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={s.o}
          />
        ))}
        {stars.map((st, i) => (
          <g key={i}>
            <circle cx={st.x} cy={st.y} r={st.glow} fill="url(#uy-star)" />
            <circle cx={st.x} cy={st.y} r={st.core} fill="#fff7d6" />
          </g>
        ))}
        <rect width={W} height={H} fill="url(#uy-scrim)" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">{children}</div>
    </div>
  );
}
