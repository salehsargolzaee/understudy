import { formatTimestamp, youtubeUrl } from "../lib/youtube";
import { useElementSize } from "../lib/useElementSize";
import AuthorChip from "./AuthorChip";

/**
 * Lecture player pane.
 *
 * Nothing is drawn on top of the player surface (YouTube forbids overlays); the
 * chrome is compact horizontal strips above and below it, so there is no empty
 * rail. The player box is measured and letterboxed to a true 16:9 at any pane
 * size, and playsinline keeps mobile fullscreen well-behaved.
 */
const RATIO = 16 / 9;

export default function VideoEmbed({
  videoId,
  start,
  playlist,
  author,
}: {
  videoId: string;
  start: number;
  playlist: string;
  author: string;
}) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();

  if (!videoId) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center bg-ink-950">
        <p className="label text-ink-600">No video for this exercise</p>
      </div>
    );
  }

  const t = Math.max(0, Math.floor(start));
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?start=${t}&rel=0&modestbranding=1&playsinline=1`;

  const boxW = Math.max(0, Math.min(width, height * RATIO));
  const boxH = boxW / RATIO;
  const ready = boxW > 16;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-ink-950">
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-white/[0.06] px-3">
        <span className="label shrink-0 text-ink-600">Lecture</span>
        <span className="min-w-0 truncate font-mono text-[11px] text-zinc-400" title={playlist}>
          {playlist}
        </span>
        <a
          href={youtubeUrl(videoId, t)}
          target="_blank"
          rel="noreferrer noopener"
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 transition-colors hover:border-accent/60 hover:bg-accent/10"
        >
          <span className="font-mono text-[11px] font-medium tabular-nums text-accent">{formatTimestamp(t)}</span>
          <span className="label hidden text-ink-500 sm:inline">on YouTube</span>
        </a>
      </div>

      <div ref={ref} className="grid min-h-0 flex-1 place-items-center overflow-hidden p-3">
        <div
          className="relative overflow-hidden rounded-lg bg-black ring-1 ring-white/10"
          style={{ width: ready ? boxW : "100%", height: ready ? boxH : undefined, aspectRatio: ready ? undefined : "16 / 9" }}
        >
          <iframe
            className="absolute inset-0 h-full w-full"
            src={src}
            title="Lecture video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>

      <div className="flex h-12 shrink-0 items-center border-t border-white/[0.06] px-2">
        <AuthorChip handle={author} tone="dark" role="Exercise author" />
      </div>
    </div>
  );
}
