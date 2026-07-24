/**
 * YouTube link handling.
 *
 * `parseYouTubeRef` is the front door: people paste links from the browser bar,
 * the Share sheet, a phone, an embed snippet, a consent redirect, or an ancient
 * attribution_link, and every one of them has to resolve. So the parser is
 * deliberately generous about *shape* and strict about *ids*.
 *
 * Shapes handled:
 *   youtube.com/watch?v=ID[&t=…][&list=…][&index=…]
 *   youtube.com/watch/ID              youtu.be/ID[?t=…][&list=…]
 *   youtube.com/embed/ID[?start=…]    youtube.com/embed/videoseries?list=…
 *   youtube.com/v/ID  /e/ID  /shorts/ID  /live/ID
 *   youtube.com/playlist?list=…
 *   m.youtube.com · music.youtube.com · www. · youtube-nocookie.com · googleapis
 *   scheme-less pastes ("youtu.be/ID", "//youtu.be/ID")
 *   youtube.com/attribution_link?u=%2Fwatch%3Fv%3DID
 *   consent.youtube.com/…?continue=<encoded url>
 *   a whole pasted <iframe …src="…"></iframe>
 *   bare video id (11 chars) · bare playlist id (PL…, UU…, RD…, OL…, …)
 *
 * Timestamps: t=90 · t=90s · t=1m30s · t=1h2m3s · t=1:30 · t=2:03:04 ·
 *             start=90 · time_continue=90 · #t=90s
 */

export const youtubeUrl = (videoId: string, start: number) =>
  `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&t=${Math.max(0, Math.floor(start))}s`;

export const youtubePlaylistUrl = (playlistId: string) =>
  `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;

export const youtubeThumb = (videoId: string, quality: "mq" | "hq" = "mq") =>
  `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${quality}default.jpg`;

export function formatTimestamp(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/* ── ids ─────────────────────────────────────────────────────────────────── */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_CHARS = /^[A-Za-z0-9_-]{12,64}$/;
/** A *bare* paste must look like a playlist id to be treated as one; inside a
 *  `list=` param we trust the param and only check the charset. */
const LIST_PREFIX = /^(PL|UU|LL|FL|RD|OL|UL|PU|TL|SP|ML|EC|WL|LP|RDCLAK)/;

export const isVideoId = (s: string) => VIDEO_ID.test(s);
export const isPlaylistId = (s: string) => LIST_CHARS.test(s);

/* ── timecodes ───────────────────────────────────────────────────────────── */

export function parseTimecode(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;

  if (/^\d+(\.\d+)?$/.test(s)) return Math.floor(parseFloat(s));
  if (/^\d+(\.\d+)?s$/.test(s)) return Math.floor(parseFloat(s));

  const colon = /^(?:(\d+):)?(\d{1,3}):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (colon) {
    const h = Number(colon[1] ?? 0);
    const m = Number(colon[2]);
    const sec = Math.floor(Number(colon[3]));
    return h * 3600 + m * 60 + sec;
  }

  const hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s?)?$/.exec(s);
  if (hms && (hms[1] || hms[2] || hms[3])) {
    const h = Number(hms[1] ?? 0);
    const m = Number(hms[2] ?? 0);
    const sec = Math.floor(Number(hms[3] ?? 0));
    return h * 3600 + m * 60 + sec;
  }
  return null;
}

/* ── the ref ─────────────────────────────────────────────────────────────── */

export type YouTubeRef =
  | { kind: "video"; videoId: string; start: number | null; playlistId: string | null }
  | { kind: "playlist"; playlistId: string };

const HOSTS = new Set([
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "youtube.googleapis.com",
  "youtubekids.com",
]);

/** www./m./music./gaming./consent. prefixes are all the same site to us. */
function normalizeHost(host: string) {
  const h = host.toLowerCase().replace(/^(www|m|music|gaming|consent)\./, "");
  return h;
}

const timeFrom = (url: URL): number | null => {
  for (const key of ["t", "start", "time_continue", "begin"]) {
    const v = parseTimecode(url.searchParams.get(key));
    if (v != null) return v;
  }
  const hash = /^#(?:t|start)=(.+)$/.exec(url.hash);
  return hash ? parseTimecode(hash[1]) : null;
};

const listFrom = (url: URL): string | null => {
  const v = url.searchParams.get("list");
  return v && LIST_CHARS.test(v) ? v : null;
};

/** Pull the first URL-ish token out of free-form pasted text (incl. an iframe). */
function extractCandidate(raw: string): string {
  let s = raw.trim().replace(/^[<"'(\s]+/, "").replace(/[>"')\s]+$/, "");
  const iframe = /src\s*=\s*["']([^"']+)["']/i.exec(raw);
  if (iframe) s = iframe[1].trim();
  // a paste that is a sentence with a link in it
  if (/\s/.test(s)) {
    const hit = /((?:https?:)?\/\/[^\s]+|(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+)/i.exec(s);
    if (hit) s = hit[1];
  }
  return s.replace(/[.,;!]+$/, "");
}

export function parseYouTubeRef(raw: string, depth = 0): YouTubeRef | null {
  if (!raw || depth > 3) return null;
  const candidate = extractCandidate(raw);
  if (!candidate) return null;

  // bare ids
  if (VIDEO_ID.test(candidate)) return { kind: "video", videoId: candidate, start: null, playlistId: null };
  if (LIST_CHARS.test(candidate) && LIST_PREFIX.test(candidate)) {
    return { kind: "playlist", playlistId: candidate };
  }

  // must at least smell like a youtube URL before we start guessing
  if (!/youtu\.?be|youtube/i.test(candidate)) return null;

  const withScheme = /^https?:\/\//i.test(candidate)
    ? candidate
    : candidate.startsWith("//")
      ? `https:${candidate}`
      : `https://${candidate}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  const host = normalizeHost(url.hostname);
  if (!HOSTS.has(host)) return null;

  // consent / redirect wrappers carry the real link in a param
  for (const key of ["continue", "next", "u", "url", "q"]) {
    const inner = url.searchParams.get(key);
    if (!inner) continue;
    const absolute = inner.startsWith("/") ? `https://www.youtube.com${inner}` : inner;
    const nested = parseYouTubeRef(absolute, depth + 1);
    if (nested) return nested;
  }

  const segs = url.pathname.split("/").filter(Boolean);
  const start = timeFrom(url);
  const list = listFrom(url);

  const asVideo = (id: string | null | undefined): YouTubeRef | null =>
    id && VIDEO_ID.test(id) ? { kind: "video", videoId: id, start, playlistId: list } : null;

  if (host === "youtu.be") {
    return asVideo(segs[0]) ?? (list ? { kind: "playlist", playlistId: list } : null);
  }

  const head = (segs[0] ?? "").toLowerCase();

  if (head === "watch") {
    // /watch?v=ID and the rarer /watch/ID
    return asVideo(url.searchParams.get("v") ?? segs[1]) ?? (list ? { kind: "playlist", playlistId: list } : null);
  }

  if (["embed", "v", "e", "shorts", "live", "video"].includes(head)) {
    if (head === "embed" && (segs[1] ?? "").toLowerCase() === "videoseries") {
      return list ? { kind: "playlist", playlistId: list } : null;
    }
    return asVideo(segs[1]) ?? (list ? { kind: "playlist", playlistId: list } : null);
  }

  if (head === "playlist") return list ? { kind: "playlist", playlistId: list } : null;

  // /oembed?url=…, /attribution_link handled above via params; last chances:
  const v = url.searchParams.get("v");
  if (v) return asVideo(v);
  if (list) return { kind: "playlist", playlistId: list };

  // youtube.com/<11-char>?  (not a real shape, but harmless to accept)
  return asVideo(segs[0]);
}

/** Used by the course loader so a course file need only carry playlist_url. */
export function playlistIdFromUrl(url: string): string {
  const ref = parseYouTubeRef(url);
  if (!ref) return "";
  return ref.kind === "playlist" ? ref.playlistId : (ref.playlistId ?? "");
}
