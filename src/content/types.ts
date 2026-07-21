export type Runtime = "pyodide" | "modal";

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
