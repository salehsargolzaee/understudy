import { useEffect, useRef } from "react";

/**
 * The contributor's night sky, painted in impasto: thousands of short, thick,
 * saturated dabs following flow currents, so color arrives as masses — locally
 * each dab is a meaningless mark, together they compose one scene. Seeded from
 * the handle, so every contributor owns a different painting, stable over time.
 * Painted once to an in-flow <canvas>; the bottom dissolves into the paper.
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

// Starry-night pigments, dark base to pale highlight, plus golds for the stars.
const BASE = ["#101f45", "#16295b", "#1d3568", "#24417c", "#2c4e91"];
const CURRENT = ["#3f74c0", "#5a8fd0", "#7fabdf", "#a8c6e8", "#2f6b52", "#4b8a6e"];
const GOLD = ["#e0b64a", "#eccb6f", "#f6e29b"];

function paint(canvas: HTMLCanvasElement, seed: string) {
  const cssW = canvas.clientWidth || 1200;
  const cssH = canvas.clientHeight || 340;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const W = cssW;
  const H = cssH;
  const r = makeRng(seed);

  // night base
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0c1838");
  sky.addColorStop(0.7, "#16295b");
  sky.addColorStop(1, "#24406f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // flow: a couple of eddies over a horizontal drift
  const vortices = Array.from({ length: 2 + Math.floor(r() * 2) }, () => ({
    x: r() * W,
    y: r() * H * 0.75,
    s: (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.6),
  }));
  const field = (x: number, y: number) => {
    let a = 0.1;
    for (const v of vortices) {
      const dx = x - v.x;
      const dy = y - v.y;
      const d = Math.hypot(dx, dy) + 90;
      a += (Math.atan2(dy, dx) + Math.PI / 2) * ((v.s * 150) / d);
    }
    return a;
  };

  ctx.lineCap = "round";
  const dab = (x: number, y: number, a: number, len: number, w: number, color: string, alpha: number) => {
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x - (Math.cos(a) * len) / 2, y - (Math.sin(a) * len) / 2);
    ctx.lineTo(x + (Math.cos(a) * len) / 2, y + (Math.sin(a) * len) / 2);
    ctx.stroke();
  };

  // layer 1: base masses — the sky is made of paint, not gradient
  for (let i = 0; i < 1600; i++) {
    const x = r() * W;
    const y = r() * H;
    const a = field(x, y) + (r() - 0.5) * 0.3;
    const shade = Math.min(BASE.length - 1, Math.floor((y / H) * BASE.length + (r() - 0.5) * 1.6));
    dab(x, y, a, 16 + r() * 20, 7 + r() * 7, BASE[Math.max(0, shade)], 0.3 + r() * 0.3);
  }

  // layer 2: currents — walk streamlines, dropping bright dabs, so the swirls
  // read as continuous rivers of light
  const streams = 26;
  for (let s = 0; s < streams; s++) {
    let x = r() * W;
    let y = r() * H * 0.85;
    const color = CURRENT[Math.floor(r() * CURRENT.length)];
    const steps = 24 + Math.floor(r() * 30);
    for (let k = 0; k < steps; k++) {
      const a = field(x, y);
      dab(x, y, a, 18 + r() * 14, 6 + r() * 5, color, 0.35 + r() * 0.35);
      x += Math.cos(a) * 13;
      y += Math.sin(a) * 13;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) break;
    }
  }

  // layer 3: stars with Van Gogh halos — a glow, then rings of gold dabs
  const starCount = 7 + Math.floor(r() * 5);
  for (let i = 0; i < starCount; i++) {
    const sx = r() * W;
    const sy = r() * H * 0.6;
    const big = r() < 0.3;
    const R = big ? 26 + r() * 18 : 10 + r() * 10;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 2.4);
    glow.addColorStop(0, "rgba(246,226,155,0.85)");
    glow.addColorStop(0.35, "rgba(224,182,74,0.32)");
    glow.addColorStop(1, "rgba(224,182,74,0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, R * 2.4, 0, Math.PI * 2);
    ctx.fill();
    // halo rings of tangential dabs
    const rings = big ? 3 : 2;
    for (let q = 0; q < rings; q++) {
      const rr = R * (0.55 + q * 0.45);
      const n = 7 + q * 4;
      for (let j = 0; j < n; j++) {
        const t = (j / n) * Math.PI * 2 + r() * 0.5;
        dab(
          sx + Math.cos(t) * rr,
          sy + Math.sin(t) * rr,
          t + Math.PI / 2,
          8 + r() * 9,
          3.5 + r() * 3,
          GOLD[Math.floor(r() * GOLD.length)],
          0.5 + r() * 0.35,
        );
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fdf6da";
    ctx.beginPath();
    ctx.arc(sx, sy, big ? 3.4 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // the night dissolves into the site's paper
  ctx.globalAlpha = 1;
  const fade = ctx.createLinearGradient(0, H * 0.45, 0, H);
  fade.addColorStop(0, "rgba(238,240,246,0)");
  fade.addColorStop(0.75, "rgba(238,240,246,0.55)");
  fade.addColorStop(1, "rgba(238,240,246,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);
}

export default function StarryHero({ handle, label }: { handle: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    paint(canvas, handle || "understudy");
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => paint(canvas, handle || "understudy"), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [handle]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label ?? "This contributor's work rendered as a painted night sky"}
      className="block h-[280px] w-full sm:h-[340px]"
    />
  );
}
