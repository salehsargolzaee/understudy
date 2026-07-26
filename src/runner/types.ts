export type TestStatus = "passed" | "failed" | "error" | "skipped";

export interface TestResult {
  id: string;
  file: string;
  name: string;
  status: TestStatus;
  durationMs: number;
  detail?: string | null;
  output?: string | null;
}

export interface RunSummary {
  passed: number;
  failed: number;
  total: number;
  ok: boolean;
  durationMs: number;
}

export interface RunRequest {
  exerciseId: string;
  /** Learner's editor buffer, mounted as submission.py. */
  submission: string;
  /** filename -> contents */
  tests: Record<string, string>;
  /** filename -> contents */
  data: Record<string, string>;
  packages: string[];
  /** "script" executes submission.py as a plain file, no pytest. */
  mode?: "pytest" | "script";
}

export type RunEvent =
  | { type: "status"; phase: "booting" | "installing" | "running"; message: string }
  | { type: "stdout"; text: string }
  | { type: "stderr"; text: string }
  | { type: "result"; tests: TestResult[]; summary: RunSummary; output: string }
  | { type: "crash"; message: string; traceback?: string };

export interface Runner {
  readonly kind: "pyodide" | "modal";
  /**
   * Execute a run as a stream of events. Ends after a terminal 'result' or
   * 'crash' event, or silently if the signal aborts (treated as cancellation).
   */
  run(req: RunRequest, signal: AbortSignal): AsyncIterable<RunEvent>;
  dispose(): void;
}
