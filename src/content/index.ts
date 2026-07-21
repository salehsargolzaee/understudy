import { parse } from "yaml";
import type { DataFile, Exercise, ExerciseMeta, Runtime } from "./types";

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

const idOf = (p: string) => p.split("/")[2];
const base = (p: string) => p.split("/").pop()!;

function coerceMeta(text: string, id: string): ExerciseMeta {
  const m = (parse(text) ?? {}) as Partial<ExerciseMeta>;
  return {
    id: m.id ?? id,
    author: m.author ?? "unknown",
    video_id: m.video_id ?? "",
    start: Number(m.start ?? 0),
    concept: m.concept ?? "",
    tags: m.tags ?? [],
    playlist: m.playlist ?? "",
    runtime: (m.runtime === "modal" ? "modal" : "pyodide") as Runtime,
    packages: m.packages ?? [],
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
export type { Exercise, ExerciseMeta, DataFile, Runtime } from "./types";
