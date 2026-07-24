import type { Course, Exercise } from "../content";
import { courses, exercises, getCourse } from "../content";

/*
 * The video registry: the one place that knows what a lecture is called, which
 * course it belongs to, where it sits in that course, and which exercises hang
 * off it (grouped into "moments" — several exercises can share a timestamp).
 *
 * Two name sources, by design (see content/SCHEMA.md):
 *   1. the course's ordered `lectures:` list — authoritative title + number,
 *      and able to list lectures nobody has written practice for yet;
 *   2. an exercise's `video_title` — the name arrives with the exercise, so a
 *      referenced video can never be nameless.
 * Course file wins when both exist; the exercise's copy is the fallback.
 */

export interface VideoMoment {
  start: number;
  exercises: Exercise[];
}

export interface LectureVideo {
  /** YouTube id. */
  id: string;
  /** "" only for a video we have nothing on file for (a pasted link). */
  title: string;
  courseId: string;
  course: Course | null;
  /** 1-based position in the course's lecture list, else null. */
  index: number | null;
  /** Listed in the course's own table of contents. */
  inCourseList: boolean;
  exercises: Exercise[];
  moments: VideoMoment[];
}

const blank = (id: string): LectureVideo => ({
  id,
  title: "",
  courseId: "",
  course: null,
  index: null,
  inCourseList: false,
  exercises: [],
  moments: [],
});

function buildMoments(exs: Exercise[]): VideoMoment[] {
  const byStart = new Map<number, Exercise[]>();
  for (const e of exs) {
    const s = Math.max(0, Math.floor(e.meta.start || 0));
    byStart.set(s, [...(byStart.get(s) ?? []), e]);
  }
  return [...byStart.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, list]) => ({
      start,
      exercises: list.sort((a, b) => (a.meta.concept || a.meta.id).localeCompare(b.meta.concept || b.meta.id)),
    }));
}

const registry = new Map<string, LectureVideo>();

// 1. every lecture a course claims, in course order
for (const course of courses) {
  course.lectures.forEach((lecture, i) => {
    const existing = registry.get(lecture.id);
    const v: LectureVideo = existing ?? blank(lecture.id);
    v.title = lecture.title || v.title;
    v.courseId = v.courseId || course.id;
    v.course = v.course ?? course;
    if (v.courseId === course.id) {
      v.index = i + 1;
      v.inCourseList = true;
    }
    registry.set(lecture.id, v);
  });
}

// 2. every video an exercise points at — the name rides along with the pointer
const byVideo = new Map<string, Exercise[]>();
for (const e of exercises) {
  if (!e.meta.video_id) continue;
  byVideo.set(e.meta.video_id, [...(byVideo.get(e.meta.video_id) ?? []), e]);
}

for (const [id, exs] of byVideo) {
  const v = registry.get(id) ?? blank(id);
  if (!v.title) v.title = exs.map((e) => e.meta.video_title).find((t) => t) ?? "";
  if (!v.courseId) {
    v.courseId = exs.map((e) => e.meta.course).find(Boolean) ?? "";
    v.course = getCourse(v.courseId) ?? null;
  }
  v.exercises = exs.slice().sort((a, b) => (a.meta.start || 0) - (b.meta.start || 0));
  v.moments = buildMoments(exs);
  registry.set(id, v);
}

/** Course order first (by lecture index), then videos that no course lists. */
const courseRank = new Map(courses.map((c, i) => [c.id, i]));
export const videos: LectureVideo[] = [...registry.values()].sort((a, b) => {
  const ra = courseRank.get(a.courseId) ?? 999;
  const rb = courseRank.get(b.courseId) ?? 999;
  if (ra !== rb) return ra - rb;
  const ia = a.index ?? 9999;
  const ib = b.index ?? 9999;
  if (ia !== ib) return ia - ib;
  return (a.title || a.id).localeCompare(b.title || b.id);
});

export const videosWithExercises = videos.filter((v) => v.exercises.length > 0);

/** Unknown ids resolve to a playable, nameless lecture — the front door for
 *  content nobody has written yet. */
export function getVideo(id: string): LectureVideo {
  return registry.get(id) ?? blank(id);
}

export const isKnownVideo = (id: string) => registry.has(id);

/** A course's lectures: its own list first, then any extra video its exercises
 *  reference but the list has not caught up with. */
export function lecturesForCourse(courseId: string): LectureVideo[] {
  const listed = (getCourse(courseId)?.lectures ?? []).map((l) => getVideo(l.id));
  const seen = new Set(listed.map((v) => v.id));
  const extra = videos.filter((v) => v.courseId === courseId && !seen.has(v.id));
  return [...listed, ...extra];
}

export function findCourseByPlaylistId(playlistId: string): Course | undefined {
  if (!playlistId) return undefined;
  const key = playlistId.toLowerCase();
  return courses.find((c) => c.playlist_id.toLowerCase() === key);
}

/** What to render when a lecture has no name on file. */
export const videoLabel = (v: LectureVideo) => v.title || "Untitled lecture";

export const lectureCount = videos.length;

if (import.meta.env.DEV) {
  // The invariant: an exercise's video always has a name. Loud, once, in dev.
  const nameless = [...byVideo.entries()].filter(([id]) => !getVideo(id).title);
  for (const [id, exs] of nameless) {
    console.warn(
      `[content] video ${id} is referenced by ${exs
        .map((e) => e.meta.id)
        .join(", ")} but has no name. Add "video_title" to meta.yml (or list the lecture in its course file).`,
    );
  }
}
