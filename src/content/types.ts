export type Runtime = "pyodide" | "modal";
export interface Course {
  id: string;
  name: string;
  institution: string;
  creator: string;
  platform: string;
  playlist_url: string;
  field: string;
  level: string;
}
export interface ExerciseMeta {
  id: string;
  author: string;
  video_id: string;
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
