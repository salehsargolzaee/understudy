import { useState } from "react";
import type { RunState } from "../hooks/useRun";
import type { TestResult } from "../runner";

const dotColor: Record<TestResult["status"], string> = {
  passed: "bg-pass",
  failed: "bg-fail",
  error: "bg-accent",
  skipped: "bg-ink-900/25",
};

function Row({ t }: { t: TestResult }) {
  const [open, setOpen] = useState(t.status === "failed" || t.status === "error");
  const expandable = Boolean(t.detail || t.output);
  return (
    <li className="overflow-hidden rounded-lg border border-ink-900/[0.08] bg-paper">
      <button
        onClick={() => expandable && setOpen((o) => !o)}
        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left ${expandable ? "hover:bg-ink-900/[0.03]" : "cursor-default"}`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor[t.status]}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[13px] text-ink-950">{t.name}</span>
          <span className="block truncate font-mono text-[10px] text-ink-500">{t.file}</span>
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-500">
          {t.durationMs < 1 ? "<1" : Math.round(t.durationMs)} ms
        </span>
        <span className="label shrink-0 text-ink-600">{t.status}</span>
      </button>
      {open && expandable && (
        <div className="border-t border-ink-900/[0.08] bg-ink-950">
          {t.detail && (
            <pre className="max-h-80 overflow-auto p-3 font-mono text-[11.5px] leading-5 text-rose-200 whitespace-pre">{t.detail}</pre>
          )}
          {t.output && (
            <pre className="max-h-44 overflow-auto border-t border-white/10 p-3 font-mono text-[11.5px] leading-5 text-zinc-300 whitespace-pre-wrap">
              {t.output}
            </pre>
          )}
        </div>
      )}
    </li>
  );
}

export default function TestResults({ state }: { state: RunState }) {
  if (state.phase === "booting" || state.phase === "installing" || state.phase === "running") {
    return (
      <div className="px-4 py-8">
        <p className="text-sm font-medium text-ink-950">{state.statusMessage || "Working…"}</p>
        {state.coldStart && state.phase === "booting" && (
          <p className="mt-1 text-xs text-ink-600">
            First run downloads the Python runtime, about 10 to 20 seconds. It is cached after this.
          </p>
        )}
      </div>
    );
  }

  if (state.phase === "cancelled") {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium text-ink-950">Run stopped</p>
        <p className="mt-1 text-xs text-ink-600">The interpreter was killed, so the next run boots it again.</p>
      </div>
    );
  }

  if (state.phase === "idle") {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-medium text-ink-950">No results yet</p>
        <p className="mt-1 text-xs text-ink-600">Write your solution and hit Run. Tests execute in your browser.</p>
      </div>
    );
  }

  const { crash, tests, summary, output } = state;
  return (
    <div className="space-y-4 p-4">
      {crash && (
        <div className="overflow-hidden rounded-xl border border-accent/40 bg-accent-soft/50">
          <div className="p-3">
            <p className="text-sm font-semibold text-ink-950">Could not run your tests</p>
            <p className="mt-0.5 break-words text-xs text-ink-800">{crash.message}</p>
          </div>
          {crash.traceback && (
            <pre className="max-h-72 overflow-auto border-t border-accent/30 bg-ink-950 p-3 font-mono text-[11.5px] leading-5 text-amber-200 whitespace-pre">
              {crash.traceback}
            </pre>
          )}
        </div>
      )}

      {summary && (
        <>
          <div className={`flex items-center gap-3 rounded-xl border p-3 ${summary.ok ? "border-pass/30 bg-pass/[0.06]" : "border-fail/30 bg-fail/[0.06]"}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white ${summary.ok ? "bg-pass" : "bg-fail"}`}>
              {summary.ok ? "✓" : "✕"}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${summary.ok ? "text-pass" : "text-fail"}`}>
                {summary.ok ? "All tests passed" : `${summary.failed} of ${summary.total} failing`}
              </p>
              <p className="font-mono text-[11px] tabular-nums text-ink-600">
                {summary.passed}/{summary.total} passed · {(summary.durationMs / 1000).toFixed(2)}s
              </p>
            </div>
            <div className="hidden h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-ink-900/10 sm:block">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${summary.ok ? "bg-pass" : "bg-fail"}`}
                style={{ width: `${(summary.passed / Math.max(1, summary.total)) * 100}%` }}
              />
            </div>
          </div>
          <ul className="space-y-1.5">
            {tests.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </ul>
        </>
      )}

      {output?.trim() && (
        <details className="overflow-hidden rounded-xl border border-ink-900/10 bg-paper">
          <summary className="label cursor-pointer px-3 py-2 text-ink-600">Console output</summary>
          <pre className="max-h-72 overflow-auto border-t border-ink-900/10 bg-ink-950 p-3 font-mono text-[11.5px] leading-5 text-zinc-300 whitespace-pre-wrap">
            {output}
          </pre>
        </details>
      )}
    </div>
  );
}
