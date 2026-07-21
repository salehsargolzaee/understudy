import { useCallback, useEffect, useRef, useState } from "react";
import type { Exercise } from "../content";
import { pickRunner, type RunEvent, type RunSummary, type TestResult } from "../runner";

export type Phase = "idle" | "booting" | "installing" | "running" | "done" | "cancelled";

export interface RunState {
  phase: Phase;
  statusMessage: string;
  tests: TestResult[];
  summary: RunSummary | null;
  output: string;
  crash: { message: string; traceback?: string } | null;
  coldStart: boolean;
}

const initial: RunState = {
  phase: "idle",
  statusMessage: "",
  tests: [],
  summary: null,
  output: "",
  crash: null,
  coldStart: true,
};

export function useRun(exercise: Exercise, onPass: () => void) {
  const [state, setState] = useState<RunState>(initial);
  const abortRef = useRef<AbortController | null>(null);
  const bootedRef = useRef(false);

  useEffect(() => {
    setState(initial);
    abortRef.current?.abort();
  }, [exercise.meta.id]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    bootedRef.current = false;
    setState((s) =>
      s.phase === "idle" || s.phase === "done"
        ? s
        : { ...s, phase: "cancelled", statusMessage: "Run stopped.", coldStart: true },
    );
  }, []);

  const run = useCallback(
    async (code: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setState({
        ...initial,
        phase: "booting",
        statusMessage: "Starting Python…",
        coldStart: !bootedRef.current,
      });

      const data: Record<string, string> = {};
      for (const d of exercise.data) data[d.name] = d.contents;

      const runner = pickRunner(exercise.meta.runtime);
      const stream = runner.run(
        {
          exerciseId: exercise.meta.id,
          submission: code,
          tests: exercise.tests,
          data,
          packages: exercise.meta.packages,
        },
        ctrl.signal,
      );

      try {
        for await (const ev of stream as AsyncIterable<RunEvent>) {
          if (ctrl.signal.aborted) return;
          switch (ev.type) {
            case "status":
              bootedRef.current = bootedRef.current || ev.phase !== "booting";
              setState((s) => ({ ...s, phase: ev.phase, statusMessage: ev.message }));
              break;
            case "stdout":
            case "stderr":
              setState((s) => ({ ...s, output: (s.output + ev.text + "\n").slice(-40000) }));
              break;
            case "result":
              bootedRef.current = true;
              setState((s) => ({
                ...s,
                phase: "done",
                statusMessage: "",
                tests: ev.tests,
                summary: ev.summary,
                output: ev.output || s.output,
                coldStart: false,
              }));
              if (ev.summary.ok) onPass();
              break;
            case "crash":
              bootedRef.current = true;
              setState((s) => ({
                ...s,
                phase: "done",
                statusMessage: "",
                crash: { message: ev.message, traceback: ev.traceback },
                coldStart: false,
              }));
              break;
          }
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setState((s) => ({
          ...s,
          phase: "done",
          crash: { message: String((err as Error)?.message ?? err) },
        }));
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
      }
    },
    [exercise, onPass],
  );

  const busy = state.phase === "booting" || state.phase === "installing" || state.phase === "running";
  return { state, run, cancel, busy };
}
