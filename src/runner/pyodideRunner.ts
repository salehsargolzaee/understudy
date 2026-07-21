import type { RunEvent, RunRequest, Runner } from "./types";

type WorkerOut = RunEvent | { type: "ready" };

/**
 * Runs tests in-browser in a classic Web Worker (public/pyodide.worker.js).
 *
 * The worker is the cancellation mechanism: a runaway `while True:` in Pyodide
 * cannot be interrupted cooperatively, so on abort we terminate the worker and
 * lazily spawn a fresh one on the next run. That costs a re-boot but it is the
 * only thing that genuinely kills a run.
 */
export class PyodideRunner implements Runner {
  readonly kind = "pyodide" as const;
  private worker: Worker | null = null;

  private ensureWorker(): Worker {
    if (!this.worker) this.worker = new Worker("/pyodide.worker.js");
    return this.worker;
  }

  /** Start downloading/booting the interpreter before the user hits Run. */
  warm() {
    this.ensureWorker().postMessage({ type: "warm" });
  }

  async *run(req: RunRequest, signal: AbortSignal): AsyncIterable<RunEvent> {
    const worker = this.ensureWorker();
    const queue: WorkerOut[] = [];
    let notify: (() => void) | null = null;
    let done = false;

    const push = (m: WorkerOut) => {
      queue.push(m);
      notify?.();
    };
    const onMessage = (e: MessageEvent<WorkerOut>) => push(e.data);
    const onError = (e: ErrorEvent) =>
      push({ type: "crash", message: e.message || "The Python worker crashed." });
    const onAbort = () => {
      this.worker?.terminate();
      this.worker = null;
      done = true;
      notify?.();
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    signal.addEventListener("abort", onAbort, { once: true });

    worker.postMessage({ type: "run", req });

    try {
      while (!done) {
        while (queue.length) {
          const msg = queue.shift()!;
          if (msg.type === "ready") continue;
          yield msg;
          if (msg.type === "result" || msg.type === "crash") return;
        }
        if (done) return;
        await new Promise<void>((r) => (notify = r));
        notify = null;
      }
    } finally {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      signal.removeEventListener("abort", onAbort);
    }
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
  }
}
