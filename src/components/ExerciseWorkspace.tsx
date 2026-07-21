import { useCallback, useEffect, useRef, useState } from "react";
import type { Exercise } from "../content";
import { useRun } from "../hooks/useRun";
import { clearCode, loadCode, markPassed, saveCode } from "../lib/storage";
import { useDebouncedEffect } from "../lib/useDebouncedEffect";
import { formatTimestamp, youtubeUrl } from "../lib/youtube";
import DataTable from "./DataTable";
import Editor from "./Editor";
import TestResults from "./TestResults";
import VideoEmbed from "./VideoEmbed";
import Writeup from "./Writeup";

type Pane = "brief" | "code";

export default function ExerciseWorkspace({ exercise, onPass }: { exercise: Exercise; onPass: () => void }) {
  const { meta } = exercise;
  const [code, setCode] = useState(() => loadCode(meta.id) ?? exercise.starter);
  const [pane, setPane] = useState<Pane>("brief");
  const codeRef = useRef(code);
  codeRef.current = code;

  const handlePass = useCallback(() => {
    markPassed(meta.id);
    onPass();
  }, [meta.id, onPass]);

  const { state, run, cancel, busy } = useRun(exercise, handlePass);

  useDebouncedEffect(() => saveCode(meta.id, code), [code, meta.id]);

  const doRun = useCallback(() => {
    if (busy) return;
    setPane("code");
    void run(codeRef.current);
  }, [busy, run]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && busy) {
        e.preventDefault();
        cancel();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [busy, cancel]);

  const reset = () => {
    if (!confirm("Reset your code back to the starter? This cannot be undone.")) return;
    clearCode(meta.id);
    setCode(exercise.starter);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mobile pane switcher */}
      <div className="flex shrink-0 gap-1 border-b border-ink-900/10 bg-white px-3 py-2 lg:hidden">
        {(["brief", "code"] as Pane[]).map((p) => (
          <button
            key={p}
            onClick={() => setPane(p)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium ${
              pane === p ? "bg-ink-950 text-white" : "text-ink-700"
            }`}
          >
            {p === "brief" ? "Brief" : "Code & results"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Brief */}
        <section
          className={`min-h-0 overflow-y-auto bg-white lg:block lg:border-r lg:border-ink-900/10 ${
            pane === "brief" ? "block" : "hidden"
          }`}
        >
          <div className="mx-auto max-w-2xl px-5 py-6 sm:px-8">
            <VideoEmbed videoId={meta.video_id} start={meta.start} />
            <div className="flex flex-wrap gap-1.5">
              {meta.tags.map((t) => (
                <span key={t} className="rounded-full bg-ink-900/[0.06] px-2 py-0.5 font-mono text-[10px] text-ink-700">
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-4">
              <Writeup markdown={exercise.writeup} />
            </div>

            {meta.video_id && (
              <a
                href={youtubeUrl(meta.video_id, meta.start)}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-8 flex items-center gap-3 rounded-xl border border-ink-900/10 p-3 transition hover:border-rose-300 hover:bg-rose-50/60"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FF0000] text-xs font-bold text-white">
                  ▶
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink-950">Watch the lecture moment</span>
                  <span className="block truncate text-xs text-ink-700">
                    {meta.playlist} · jumps to {formatTimestamp(meta.start)}
                  </span>
                </span>
              </a>
            )}

            <DataTable files={exercise.data} />

            <p className="mt-8 border-t border-ink-900/10 pt-4 text-[11px] text-ink-700/70">
              Exercise <code className="font-mono">{meta.id}</code> by{" "}
              <a
                className="underline decoration-dotted underline-offset-2"
                href={`https://github.com/${meta.author}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                @{meta.author}
              </a>
            </p>
          </div>
        </section>

        {/* Code + results */}
        <section
          className={`min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-paper lg:grid ${
            pane === "code" ? "grid" : "hidden"
          }`}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-ink-900/10 bg-white px-3 py-2">
            <span className="font-mono text-[11px] text-ink-700">submission.py</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={reset}
                className="rounded-lg px-2 py-1 text-xs text-ink-700 transition hover:bg-ink-900/[0.06]"
              >
                Reset
              </button>
              {busy ? (
                <button
                  onClick={cancel}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={doRun}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-ink-950 px-3 text-xs font-semibold text-white transition hover:bg-ink-800"
                >
                  Run
                  <kbd className="ml-0.5 hidden font-sans text-[10px] font-normal text-white/50 sm:inline">⌘↵</kbd>
                </button>
              )}
            </div>
          </div>

          <div className="grid min-h-0 grid-rows-[minmax(160px,1fr)_minmax(0,1fr)]">
            <div className="min-h-0 overflow-hidden border-b border-ink-900/10 bg-white">
              <Editor value={code} onChange={setCode} onRun={doRun} readOnly={busy} />
            </div>
            <div className="min-h-0 overflow-y-auto bg-paper">
              <TestResults state={state} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
