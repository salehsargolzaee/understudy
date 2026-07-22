import { useState } from "react";
import { avatarUrl, initials } from "../lib/github";
/** GitHub avatar with an initials fallback, shared by the chip and profile. */
export default function Avatar({ handle, px, dark = false }: { handle: string; px: number; dark?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        style={{ width: px, height: px, fontSize: Math.max(10, Math.round(px * 0.3)) }}
        className={`grid shrink-0 place-items-center rounded-full font-mono font-bold ${
          dark ? "bg-ink-800 text-ink-500" : "bg-ink-900/[0.08] text-ink-600"
        }`}
      >
        {initials(handle)}
      </span>
    );
  }
  return (
    <img
      src={avatarUrl(handle, px * 2)}
      width={px}
      height={px}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: px, height: px }}
      className={`shrink-0 rounded-full object-cover ring-1 ${dark ? "ring-white/10" : "ring-ink-900/10"}`}
    />
  );
}
