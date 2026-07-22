import { parse } from "yaml";
import type { Course, DataFile, Exercise, ExerciseMeta, Runtime } from "./types";
/*
 * Content is baked in at build time from the sibling content/ folder.
 * There is deliberately NO glob for solution.py, so the reference solution
 * never reaches the client bundle.
 */
// Vite requires the options to be an inline object literal (it is analyzed
// statically at build time), so it is repeated per call rather than shared.
const metas = import.meta.glob("/content/*/meta.yml", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const writeups = import.meta.glob("/content/*/exercise.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const starters = import.meta.glob("/content/*/starter.py", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const testFiles = import.meta.glob("/content/*/tests/**/*.py", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const dataFiles = import.meta.glob("/content/*/data/**/*", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const courseFiles = import.meta.glob("/content/courses/*.yml", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const idOf = (p: string) => p.split("/")[2];
const base = (p: string) => p.split("/").pop()!;
function coerceCourse(text: string, fileId: string): Course {
  const c = (parse(text) ?? {}) as Partial<Course>;
  return {
    id: typeof c.id === "string" ? c.id : fileId,
    name: typeof c.name === "string" ? c.name : fileId,
    institution: typeof c.institution === "string" ? c.institution : "",
    creator: typeof c.creator === "string" ? c.creator : "",
    platform: typeof c.platform === "string" ? c.platform : "",
    playlist_url: typeof c.playlist_url === "string" ? c.playlist_url : "",
    field: typeof c.field === "string" ? c.field : "",
    level: typeof c.level === "string" ? c.level : "",
  };
}
export const courses: Course[] = Object.entries(courseFiles)
  .map(([path, text]) => coerceCourse(text, base(path).replace(/\.ya?ml$/, "")))
  .sort((a, b) => a.id.localeCompare(b.id));
export const getCourse = (id: string) => (id ? courses.find((c) => c.id === id) : undefined);
function coerceMeta(text: string, id: string): ExerciseMeta {
  const m = (parse(text) ?? {}) as Partial<ExerciseMeta>;
  return {
    id: m.id ?? id,
    author: m.author ?? "unknown",
    video_id: m.video_id ?? "",
    start: Number(m.start ?? 0),
    concept: m.concept ?? "",
    tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
    playlist: m.playlist ?? "",
    runtime: (m.runtime === "modal" ? "modal" : "pyodide") as Runtime,
    packages: Array.isArray(m.packages) ? m.packages.map(String) : [],
    // Newer structured fields. Older exercises may lack any of these, so every
    // one of them degrades to an explicit empty value instead of undefined.
    course: typeof m.course === "string" ? m.course : "",
    concepts: Array.isArray(m.concepts) ? m.concepts.map(String) : [],
    field: typeof m.field === "string" ? m.field : "",
    level: typeof m.level === "string" ? m.level : "",
    demo: Boolean(m.demo),
  };
}
export const exercises: Exercise[] = Object.entries(metas)
  .map(([path, text]): Exercise => {
    const id = idOf(path);
    const dir = `/content/${id}`;
    const tests: Record<string, string> = {};
    for (const [p, c] of Object.entries(testFiles)) if (idOf(p) === id) tests[base(p)] = c;
    const data: DataFile[] = [];
    for (const [p, c] of Object.entries(dataFiles)) if (idOf(p) === id) data.push({ name: base(p), contents: c });
    return {
      meta: coerceMeta(text, id),
      writeup: writeups[`${dir}/exercise.md`] ?? "",
      starter: starters[`${dir}/starter.py`] ?? "",
      tests,
      data,
    };
  })
  .sort((a, b) => a.meta.id.localeCompare(b.meta.id));
export const getExercise = (id: string) => exercises.find((e) => e.meta.id === id);
export type { Course, Exercise, ExerciseMeta, DataFile, Runtime } from "./types";
