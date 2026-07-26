import type { Exercise } from "../content";
import { courses, exercises } from "../content";
import { catalogStats } from "./catalog";
import { getVideo, videosWithExercises } from "./videos";
import type { LectureVideo } from "./videos";

/*
 * What the landing page is allowed to say, derived from content at build time.
 * If the catalog is small, the page is small.
 */

/** The exercise in the shop window. Curated: the front table of the shop is an
 *  editorial choice, not a byte count. The fallback is algorithmic so a fork
 *  with different content still gets a sensible page. */
const FEATURED_ID = "chain-rule-tanh";

/** A gentler first step for a visitor who wants the sixty-second win. */
const GENTLE_ID = "numeric-derivative";

const runnable = (e: Exercise) =>
  e.meta.runtime === "pyodide" &&
  e.meta.packages.length === 0 &&
  !e.meta.demo &&
  e.starter.trim().length > 0 &&
  Object.keys(e.tests).length > 0 &&
  Boolean(getVideo(e.meta.video_id).title);

function smallest(pool: Exercise[]): Exercise | null {
  const weight = (e: Exercise) =>
    e.writeup.length + e.starter.length + Object.values(e.tests).reduce((n, t) => n + t.length, 0);
  return pool.slice().sort((a, b) => weight(a) - weight(b) || a.meta.id.localeCompare(b.meta.id))[0] ?? null;
}

function pick(id: string): Exercise | null {
  const chosen = exercises.find((e) => e.meta.id === id);
  return chosen && runnable(chosen) ? chosen : smallest(exercises.filter(runnable));
}

export const featured: Exercise | null = pick(FEATURED_ID);
export const featuredVideo: LectureVideo | null = featured ? getVideo(featured.meta.video_id) : null;

const gentleCandidate = pick(GENTLE_ID);
export const gentle: Exercise | null =
  gentleCandidate && featured && gentleCandidate.meta.id !== featured.meta.id ? gentleCandidate : null;

/** The example lecture: the one with the most practice beside it. */
export const showcase: LectureVideo | null =
  videosWithExercises
    .slice()
    .sort((a, b) => b.moments.length - a.moments.length || b.exercises.length - a.exercises.length)[0] ?? null;

/** Catalogued lectures still waiting for their first exercise, named so the
 *  page can point at where the next star goes. */
import { videos } from "./videos";
export const lecturesWithout: LectureVideo[] = videos.filter((v) => v.exercises.length === 0 && v.title);

export const landingStats = {
  ...catalogStats,
  lecturesWithPractice: videosWithExercises.length,
};

export const courseNames = courses.map((c) => c.name);
