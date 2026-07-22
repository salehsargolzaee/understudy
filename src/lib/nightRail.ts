/**
 * The top rail's background: a thin slice of the site's night painting,
 * rendered once to a data-URL image. Being a plain CSS background image, it
 * carries none of the live-layer compositing risk — it is just a bitmap.
 * Kept dark and quiet so the rail's text stays perfectly legible.
 */
let cached: string | null = null;

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

export function nightRailBg(): string {
  if (cached) return cached;
  const W = 1600;
  const H = 88; // 2x for a 44px rail
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const r = makeRng("understudy-rail");
  ctx.fillStyle = "#0d1330";
  ctx.fillRect(0, 0, W, H);

  // quiet horizontal dabs, barely lighter than the ground
  ctx.lineCap = "round";
  const colors = ["#131b3e", "#18234c", "#1d2b5a", "#16294a"];
  for (let i = 0; i < 420; i++) {
    const x = r() * W;
    const y = r() * H;
    const a = (r() - 0.5) * 0.35;
    const len = 24 + r() * 40;
    ctx.strokeStyle = colors[Math.floor(r() * colors.length)];
    ctx.globalAlpha = 0.35 + r() * 0.3;
    ctx.lineWidth = 5 + r() * 6;
    ctx.beginPath();
    ctx.moveTo(x - (Math.cos(a) * len) / 2, y - (Math.sin(a) * len) / 2);
    ctx.lineTo(x + (Math.cos(a) * len) / 2, y + (Math.sin(a) * len) / 2);
    ctx.stroke();
  }
  // a few faint stars
  for (let i = 0; i < 9; i++) {
    const x = r() * W;
    const y = r() * H;
    ctx.globalAlpha = 0.5 + r() * 0.4;
    ctx.fillStyle = i % 3 === 0 ? "#e0b64a" : "#9db1d8";
    ctx.beginPath();
    ctx.arc(x, y, 1 + r() * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  cached = `url(${canvas.toDataURL("image/png")})`;
  return cached;
}
