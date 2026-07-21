import type { RunEvent, RunRequest, Runner } from "./types";

/**
 * Placeholder for server-side execution (real PyTorch, multiprocessing, etc.).
 *
 * Implementing this later means: POST `req` to the server endpoint, stream the
 * response, and translate each frame into a RunEvent. Nothing else in the app
 * changes, because `pickRunner` already routes `runtime: modal` exercises here
 * and the UI only depends on the RunEvent stream.
 */
export class ModalRunner implements Runner {
  readonly kind = "modal" as const;

  async *run(_req: RunRequest, _signal: AbortSignal): AsyncIterable<RunEvent> {
    yield {
      type: "crash",
      message: "This exercise is runtime: modal, which needs the server runner (not built yet).",
    };
  }

  dispose() {}
}
