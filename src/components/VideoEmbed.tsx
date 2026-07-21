/**
 * Inline YouTube player that starts at the exercise's timestamp.
 *
 * Uses the standard embed with a `start` param (no API key, no overlay on the
 * player surface, so it stays within YouTube's embed rules). youtube-nocookie
 * is the privacy-enhanced host.
 */
export default function VideoEmbed({ videoId, start }: { videoId: string; start: number }) {
  if (!videoId) return null;
  const t = Math.max(0, Math.floor(start));
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?start=${t}&rel=0`;
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-ink-900/10 bg-black">
      <div className="relative aspect-video w-full">
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
  );
}
