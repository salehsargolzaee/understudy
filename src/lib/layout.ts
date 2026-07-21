/**
 * Persisted split ratios, under a separate key from practice.v1 so layout prefs
 * can never collide with saved code/progress.
 */
const KEY = "practice.layout.v1";

type Layout = Record<string, number>;

function read(): Layout {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Layout) ?? {};
  } catch {
    return {};
  }
}

export function loadRatio(id: string): number | null {
  const v = read()[id];
  return typeof v === "number" && v > 0 && v < 1 ? v : null;
}

export function saveRatio(id: string, ratio: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [id]: ratio }));
  } catch {
    /* quota or private mode: layout just won't persist */
  }
}
