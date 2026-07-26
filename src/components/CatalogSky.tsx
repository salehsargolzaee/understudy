import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Exercise } from "../content";
import { layoutStars, paintSky } from "../lib/sky";
import type { Rect, SkyStar } from "../lib/sky";
import { exerciseHash } from "../lib/routes";
import { getVideo, videoLabel } from "../lib/videos";
import { formatTimestamp } from "../lib/youtube";

/**
 * The catalog as a night sky: painted once to a canvas, with one clickable star
 * per exercise laid over the exact pixels it was painted at.
 *
 * Nothing is fetched. No images, no fonts, no third party — a stranger who reads
 * this page and leaves has downloaded our bundle and nothing else.
 *
 * The painting is deferred until the band is near the viewport, so the closing
 * sky costs nothing until someone scrolls to it.
 */
interface Props {
  /** one star each; an empty list paints an empty sky, which is the honest one */
  exercises: Exercise[];
  className?: string;
  label: string;
  avoid?: Rect;
  bounds?: { top?: number; bottom?: number };
  /** pixel bounds beat fractional ones: same strip on every device */
  boundsPx?: { top?: number; bottom?: number };
  /** several strips of sky; negative pixels measure from the bottom */
  zonesPx?: { top: number; bottom: number }[];
  starScale?: number;
  natural?: boolean;
  fade?: boolean;
  dim?: number;
  interactive?: boolean;
  /** override the paint seed (profiles pass their handle so the nebula stays theirs) */
  seed?: string;
  /** a pool of deeper night under the words; the painting keeps its edges */
  scrim?: string;
  children?: ReactNode;
}

function StarLink({ star, boxW, boxH, index }: { star: SkyStar; boxW: number; boxH: number; index: number }) {
  const { meta } = star.exercise;
  const video = getVideo(meta.video_id);
  const title = videoLabel(video);
  const stamp = formatTimestamp(meta.start);
  const hit = Math.max(36, star.r * 1.7);

  // the card flips rather than leaves the sky
  const below = star.y < boxH * 0.42;
  const nearLeft = star.x < 140;
  const nearRight = star.x > boxW - 140;

  return (
    <a
      href={exerciseHash(meta.id)}
      aria-label={`${meta.concept || meta.id} — an exercise by @${meta.author}, at ${stamp} of ${title}`}
      style={{ left: star.x, top: star.y, width: hit, height: hit }}
      className="group absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none"
    >
      <span
        aria-hidden
        className="star-breathe absolute inset-2 rounded-full"
        style={{ boxShadow: "0 0 16px 5px rgba(246,226,155,0.5)", animationDelay: `${(index % 9) * 0.55}s` }}
      />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full bg-accent/0 ring-0 ring-accent-bright/0 transition-all duration-200 group-hover:bg-accent/10 group-hover:ring-2 group-hover:ring-accent-bright/70 group-focus-visible:ring-2 group-focus-visible:ring-accent-bright"
      />
      <span
        className={`pointer-events-none absolute z-50 w-60 rounded-xl bg-ink-950/95 p-3 text-left opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 ${
          below ? "top-full mt-3" : "bottom-full mb-3"
        } ${nearLeft ? "left-0" : nearRight ? "right-0" : "left-1/2 -translate-x-1/2"}`}
      >
        <span className="block font-serif text-[14.5px] font-semibold leading-snug text-zinc-50">
          {meta.concept || meta.id}
        </span>
        <span className="mt-1 block font-mono text-[10px] text-accent-bright">
          @{meta.author} · {stamp}
        </span>
        <span className="clamp-2 mt-1 block text-[11.5px] leading-snug text-ink-500">{title}</span>
      </span>
    </a>
  );
}

export default function CatalogSky({
  exercises,
  className = "",
  label,
  avoid,
  bounds,
  boundsPx,
  zonesPx,
  starScale,
  natural,
  fade = false,
  dim = 0,
  interactive = false,
  seed,
  scrim,
  children,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      clearTimeout(t);
      // first size lands immediately; later ones are a resize, so settle first
      const apply = () => setBox((b) => (Math.abs(b.w - width) < 1 && Math.abs(b.h - height) < 1 ? b : { w: width, h: height }));
      if (!box.w) apply();
      else t = setTimeout(apply, 160);
    });
    ro.observe(el);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [box.w]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "500px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const avoidKey = avoid ? `${avoid.x0},${avoid.y0},${avoid.x1},${avoid.y1}` : "";
  const stars = useMemo(
    () => {
      if (!box.w) return [];
      const px = boundsPx
        ? { top: boundsPx.top != null ? boundsPx.top / box.h : undefined, bottom: boundsPx.bottom != null ? boundsPx.bottom / box.h : undefined }
        : {};
      return layoutStars(exercises, box.w, box.h, { avoid, scale: starScale, natural, zonesPx, ...bounds, ...px });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercises, box.w, box.h, avoidKey, bounds?.top, bounds?.bottom, boundsPx?.top, boundsPx?.bottom, starScale, natural, zonesPx],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !near || !box.w) return;
    const paintSeed = seed ?? `understudy-sky:${exercises.map((e) => e.meta.id).join("|")}`;
    const frame = requestAnimationFrame(() => paintSky(canvas, box.w, box.h, stars, { seed: paintSeed, fade, dim }));
    return () => cancelAnimationFrame(frame);
  }, [stars, box.w, box.h, near, fade, dim, exercises, seed]);

  return (
    <div
      ref={wrapRef}
      className={`relative isolate overflow-hidden ${className}`}
      // a plain gradient holds the space until the paint lands: no white flash
      style={{ background: "linear-gradient(#070b1e, #121f4a 55%, #1d3566)" }}
    >
      <canvas ref={canvasRef} role="img" aria-label={label} className="absolute inset-0 block h-full w-full" />
      {scrim && <div aria-hidden className="pointer-events-none absolute inset-0 z-10" style={{ background: scrim }} />}
      {/* children flow IN the band: content taller than the minimum grows the
          band instead of clipping. Anything clickable opts back into pointer events. */}
      <div className="pointer-events-none relative z-20">{children}</div>
      {interactive &&
        stars.map((s, i) => <StarLink key={s.exercise.meta.id} star={s} boxW={box.w} boxH={box.h} index={i} />)}
    </div>
  );
}
