/** Every hash route in one place, so links can never drift from the parser. */
export type ExploreView =
  | { type: "home" }
  | { type: "search"; q: string }
  | { type: "course"; id: string }
  | { type: "field"; name: string }
  | { type: "level"; name: string };
export const exerciseHash = (id: string) => `#/e/${encodeURIComponent(id)}`;
export const exploreHome = "#/x";
export const searchHash = (q: string) => `#/x/q/${encodeURIComponent(q)}`;
export const courseHash = (id: string) => `#/x/c/${encodeURIComponent(id)}`;
export const fieldHash = (name: string) => `#/x/f/${encodeURIComponent(name)}`;
export const levelHash = (name: string) => `#/x/l/${encodeURIComponent(name)}`;
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
