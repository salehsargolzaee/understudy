import type { Course, Exercise } from "../content";
import { courses, exercises, getCourse } from "../content";
/*
 * Catalog aggregates, computed once at module load — content is static, so
 * there is no reason to re-derive any of this per render.
 */
export interface Counted {
  name: string;
  count: number;
}
/** Field/level can live on the exercise or be inherited from its course. */
export const fieldOf = (e: Exercise): string =>
  e.meta.field || getCourse(e.meta.course)?.field || "Uncategorized";
export const levelOf = (e: Exercise): string =>
  e.meta.level || getCourse(e.meta.course)?.level || "unspecified";
function tally(items: string[]): Counted[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
export const tallyAuthors = (exs: Exercise[]): Counted[] =>
  tally(exs.map((e) => e.meta.author).filter((a) => a && a !== "unknown"));
export const tallyConcepts = (exs: Exercise[]): Counted[] => tally(exs.flatMap((e) => e.meta.concepts));
export interface CourseSummary {
  course: Course;
  exercises: Exercise[];
  contributors: Counted[];
  concepts: Counted[];
}
export const courseSummaries: CourseSummary[] = courses
  .map((course) => {
    const exs = exercises.filter((e) => e.meta.course === course.id);
    return { course, exercises: exs, contributors: tallyAuthors(exs), concepts: tallyConcepts(exs) };
  })
  .sort((a, b) => b.exercises.length - a.exercises.length || a.course.name.localeCompare(b.course.name));
export const getCourseSummary = (id: string) => courseSummaries.find((s) => s.course.id === id);
export interface FacetSummary {
  name: string;
  exercises: Exercise[];
  courses: Course[];
}
function facet(of: (e: Exercise) => string, courseKey: (c: Course) => string): FacetSummary[] {
  const m = new Map<string, Exercise[]>();
  for (const e of exercises) {
    const k = of(e);
    m.set(k, [...(m.get(k) ?? []), e]);
  }
  // a field/level that exists only on a course (no exercises yet) still browses
  const names = new Set([...m.keys(), ...courses.map(courseKey).filter(Boolean)]);
  return [...names]
    .map((name) => ({
      name,
      exercises: m.get(name) ?? [],
      courses: courses.filter((c) => courseKey(c) === name),
    }))
    .sort((a, b) => b.exercises.length - a.exercises.length || a.name.localeCompare(b.name));
}
export const fieldSummaries: FacetSummary[] = facet(fieldOf, (c) => c.field);
export const levelSummaries: FacetSummary[] = facet(levelOf, (c) => c.level);
export const conceptCounts: Counted[] = tallyConcepts(exercises);
export const contributorCounts: Counted[] = tallyAuthors(exercises);
export const catalogStats = {
  exercises: exercises.length,
  courses: courses.length,
  contributors: contributorCounts.length,
  concepts: conceptCounts.length,
};
