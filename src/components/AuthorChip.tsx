import { useState } from "react";

/**
 * Author identity. github.com/<handle>.png serves the avatar with no API and no
 * key; on failure we fall back to initials rather than a broken image. The whole
 * chip is the link, so pointing it at an internal profile route later is a
 * one-line change.
 */
interface Props {
  handle: string;
  role?: string;
  tone?: "light" | "dark";
}

const avatarUrl = (handle: string, px: number) =>
  `https://github.com/${encodeURIComponent(handle)}.png?size=${px}`;

const initials = (handle: string) =>
  handle
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export default function AuthorChip({ handle, role = "Author", tone = "light" }: Props) {
  const [failed, setFailed] = useState(false);
  const dark = tone === "dark";
  const px = 32;

  if (!handle || handle === "unknown") return null;

  return (
    <a
      href={`https://github.com/${encodeURIComponent(handle)}`}
      target="_blank"
      rel="noreferrer noopener"
      title={`@${handle} on GitHub`}
      className={`flex min-w-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors ${
        dark ? "hover:bg-white/[0.08]" : "hover:bg-ink-900/[0.05]"
      }`}
    >
      {failed ? (
        <span
          style={{ width: px, height: px }}
          className={`grid shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold ${
            dark ? "bg-ink-800 text-ink-500" : "bg-ink-900/[0.08] text-ink-600"
          }`}
        >
          {initials(handle)}
        </span>
      ) : (
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
      )}
      <span className="min-w-0 leading-tight">
        <span className={`block truncate font-mono text-[11px] font-medium ${dark ? "text-zinc-200" : "text-ink-950"}`}>
          @{handle}
        </span>
        <span className={`label block truncate text-[9px] ${dark ? "text-ink-600" : "text-ink-500"}`}>{role}</span>
      </span>
    </a>
  );
}
