import { useState } from "react";
import { youtubeThumb } from "../lib/youtube";

/** A lecture's thumbnail, with a quiet fallback so a dead id never breaks a row. */
export default function VideoThumb({
  id,
  className = "",
  quality = "mq",
}: {
  id: string;
  className?: string;
  quality?: "mq" | "hq";
}) {
  const [failed, setFailed] = useState(false);
  if (failed || !id) {
    return (
      <span
        aria-hidden
        className={`grid place-items-center bg-ink-900/[0.07] text-[11px] text-ink-500 ${className}`}
      >
        ▶
      </span>
    );
  }
  return (
    <img
      src={youtubeThumb(id, quality)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`bg-ink-900/10 object-cover ${className}`}
    />
  );
}
