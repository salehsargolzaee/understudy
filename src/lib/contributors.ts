import type { Course, Exercise } from "../content";
import { exercises, getCourse } from "../content";
export interface Counted {
  name: string;
  count: number;
}
export interface CourseContribution {
  /** "" for exercises that predate the course field. */
  courseId: string;
  /** null when the id doesn't resolve to a file under content/courses/. */
  course: Course | null;
  exercises: Exercise[];
}
export interface ContributorProfile {
  handle: string;
  exercises: Exercise[];
  concepts: Counted[];
  fields: Counted[];
  levels: Counted[];
  courses: CourseContribution[];
  /** Authored exercises that carry no concept tags yet. */
  untagged: number;
}
/** Field can live on the exercise or be inherited from its course. */
const fieldOf = (e: Exercise) =>
  e.meta.field || getCourse(e.meta.course)?.field || "Uncategorized";
const levelOf = (e: Exercise) => e.meta.level || getCourse(e.meta.course)?.level || "";
/** Only real concept slugs count toward the taxonomy. An untagged exercise
 *  still counts as a contribution (it appears in the totals and its course
 *  card); it just does not inject its display title into the concept list. */
const conceptsOf = (e: Exercise) => e.meta.concepts;
function tally(items: string[]): Counted[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
/** Aggregate everything a handle has authored. Returns null if they have
 *  authored nothing — completion/practice data is deliberately not consulted. */
export function getContributor(handle: string): ContributorProfile | null {
  const key = handle.toLowerCase();
  const mine = exercises.filter((e) => e.meta.author.toLowerCase() === key);
  if (!mine.length) return null;
  const byCourse = new Map<string, Exercise[]>();
  for (const e of mine) {
    const k = e.meta.course;
    byCourse.set(k, [...(byCourse.get(k) ?? []), e]);
  }
  const courseContribs: CourseContribution[] = [...byCourse.entries()]
    .map(([courseId, exs]) => ({
      courseId,
      course: getCourse(courseId) ?? null,
      exercises: exs,
    }))
    .sort((a, b) => b.exercises.length - a.exercises.length || a.courseId.localeCompare(b.courseId));
  return {
    handle: mine[0].meta.author,
    exercises: mine,
    concepts: tally(mine.flatMap(conceptsOf)),
    fields: tally(mine.map(fieldOf)),
    levels: tally(mine.map(levelOf).filter(Boolean)),
    courses: courseContribs,
    untagged: mine.filter((e) => !e.meta.concepts.length).length,
  };
}
