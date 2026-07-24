export type Runtime = "pyodide" | "modal";

/** One lecture in a course's ordered table of contents. */
export interface Lecture {
  /** YouTube video id. */
  id: string;
  /** Human lecture name. Required in the file; the loader keeps it non-null. */
  title: string;
}

export interface Course {
  id: string;
  name: string;
  institution: string;
  creator: string;
  platform: string;
  playlist_url: string;
  /** Parsed from playlist_url when not given, so pasted playlist links resolve. */
  playlist_id: string;
  field: string;
  level: string;
  /** Ordered lectures. May be empty: then names come from the exercises. */
  lectures: Lecture[];
}

export interface ExerciseMeta {
  id: string;
  author: string;
  video_id: string;
  /** The lecture's name. Required whenever video_id is set (see content/SCHEMA.md). */
  video_title: string;
  start: number;
  concept: string;
  tags: string[];
  playlist: string;
  runtime: Runtime;
  packages: string[];
  /** Course id, resolved against content/courses/. "" on older exercises. */
  course: string;
  /** Concept slugs this exercise teaches. May be empty on older exercises. */
  concepts: string[];
  field: string;
  level: string;
  demo: boolean;
}

export interface DataFile {
  name: string;
  contents: string;
}

export interface Exercise {
  meta: ExerciseMeta;
  writeup: string;
  starter: string;
  /** filename -> contents, passed straight to the runner. */
  tests: Record<string, string>;
  data: DataFile[];
}
