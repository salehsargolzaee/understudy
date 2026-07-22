import type { Course, Exercise } from "../content";
import { courses, exercises, getCourse } from "../content";
import { conceptCounts, contributorCounts, fieldOf, levelOf } from "./catalog";
import type { Counted } from "./catalog";
/*
 * Client-side catalog search. Small corpus, so this is a straight scorer:
 * normalize both sides (lowercase, hyphens/slashes → spaces), require every
 * query token to land somewhere in the item, and rank by weighted match
 * quality (exact > word-prefix > substring). No index, no backend.
 */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[-_/·,()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
interface Haystack {
  text: string;
  weight: number;
  /** Match only on equality. Levels need this: "undergraduate" contains
   *  "graduate" as a substring, so a loose match returns the wrong level. */
  exactOnly?: boolean;
}
function score(tokens: string[], fields: Haystack[]): number {
  let total = 0;
  for (const t of tokens) {
    let best = 0;
    for (const f of fields) {
      if (!f.text) continue;
      let s = 0;
      if (f.text === t) s = f.weight * 3;
      else if (f.exactOnly) s = 0;
      else if (f.text.startsWith(t) || f.text.includes(" " + t)) s = f.weight * 2;
      else if (f.text.includes(t)) s = f.weight;
      if (s > best) best = s;
    }
    if (!best) return 0; // every token must match somewhere
    total += best;
  }
  return total;
}
function rank<T>(items: T[], fieldsOf: (item: T) => Haystack[], tokens: string[]): T[] {
  return items
    .map((item) => [score(tokens, fieldsOf(item)), item] as const)
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .map(([, item]) => item);
}
export interface SearchResults {
  query: string;
  courses: Course[];
  exercises: Exercise[];
  concepts: Counted[];
  people: Counted[];
  total: number;
}
export function searchCatalog(raw: string): SearchResults {
  const tokens = norm(raw).split(" ").filter(Boolean);
  if (!tokens.length) return { query: raw, courses: [], exercises: [], concepts: [], people: [], total: 0 };
  const cs = rank(
    courses,
    (c) => [
      { text: norm(c.name), weight: 3 },
      { text: norm(c.id), weight: 2 },
      { text: norm(c.creator), weight: 2 },
      { text: norm(c.institution), weight: 1.5 },
      { text: norm(c.field), weight: 1 },
      { text: norm(c.level), weight: 1, exactOnly: true },
    ],
    tokens,
  );
  const exs = rank(
    exercises,
    (e) => [
      { text: norm(e.meta.concept), weight: 3 },
      { text: norm(e.meta.concepts.join(" ")), weight: 3 },
      { text: norm(e.meta.id), weight: 2 },
      { text: norm(e.meta.tags.join(" ")), weight: 2 },
      { text: norm(e.meta.author), weight: 1.5 },
      { text: norm(getCourse(e.meta.course)?.name ?? e.meta.playlist), weight: 1 },
      { text: norm(fieldOf(e)), weight: 1 },
      { text: norm(levelOf(e)), weight: 1, exactOnly: true },
    ],
    tokens,
  );
  const cons = rank(conceptCounts, (c) => [{ text: norm(c.name), weight: 3 }], tokens);
  const ppl = rank(contributorCounts, (p) => [{ text: norm(p.name), weight: 3 }], tokens);
  return {
    query: raw,
    courses: cs,
    exercises: exs,
    concepts: cons,
    people: ppl,
    total: cs.length + exs.length + cons.length + ppl.length,
  };
}
