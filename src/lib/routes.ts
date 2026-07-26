/** Every hash route in one place, so links can never drift from the parser. */
export type ExploreView =
  | { type: "home" }
  | { type: "search"; q: string }
  | { type: "course"; id: string }
  | { type: "field"; name: string }
  | { type: "level"; name: string };

/** The landing page: the empty hash, and the fallback for anything unrecognised. */
export const homeHash = "#/";

export const exerciseHash = (id: string) => `#/e/${encodeURIComponent(id)}`;
export const exploreHome = "#/x";
export const searchHash = (q: string) => `#/x/q/${encodeURIComponent(q)}`;
export const courseHash = (id: string) => `#/x/c/${encodeURIComponent(id)}`;
export const fieldHash = (name: string) => `#/x/f/${encodeURIComponent(name)}`;
export const levelHash = (name: string) => `#/x/l/${encodeURIComponent(name)}`;

/** A lecture, optionally opened at a timestamp: #/v/<id> or #/v/<id>/t/<sec>. */
export const videoHash = (id: string, start?: number | null) =>
  start && start > 0 ? `#/v/${encodeURIComponent(id)}/t/${Math.floor(start)}` : `#/v/${encodeURIComponent(id)}`;

export const viewHash = (v: ExploreView): string => {
  switch (v.type) {
    case "home":
      return exploreHome;
    case "search":
      return searchHash(v.q);
    case "course":
      return courseHash(v.id);
    case "field":
      return fieldHash(v.name);
    case "level":
      return levelHash(v.name);
  }
};

export const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** `rest` is everything after "#/x". Unknown shapes fall back to home. */
export function parseExplore(rest: string): ExploreView {
  const m = /^\/(q|c|f|l)\/(.+)$/.exec(rest);
  if (!m) return { type: "home" };
  const v = safeDecode(m[2]);
  if (m[1] === "q") return { type: "search", q: v };
  if (m[1] === "c") return { type: "course", id: v };
  if (m[1] === "f") return { type: "field", name: v };
  return { type: "level", name: v };
}

/** `rest` is everything after "#/v/". */
export function parseVideoRoute(rest: string): { id: string; start: number | null } | null {
  const m = /^([^/?#]+)(?:\/t\/(\d+))?/.exec(rest);
  if (!m) return null;
  const id = safeDecode(m[1]);
  if (!id) return null;
  return { id, start: m[2] ? Number(m[2]) : null };
}

/** The in-app authoring flow: #/new, or #/new/v/<videoId>[/t/<sec>]. */
export const contributeHash = (videoId?: string, start?: number | null) =>
  videoId
    ? `#/new/v/${encodeURIComponent(videoId)}${start && start > 0 ? `/t/${Math.floor(start)}` : ""}`
    : "#/new";

/** `rest` is everything after "#/new". */
export function parseContributeRoute(rest: string): { videoId: string | null; start: number | null } {
  const m = /^\/v\/([^/?#]+)(?:\/t\/(\d+))?/.exec(rest);
  if (!m) return { videoId: null, start: null };
  return { videoId: safeDecode(m[1]), start: m[2] ? Number(m[2]) : null };
}
