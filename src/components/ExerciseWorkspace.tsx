import { useCallback, useEffect, useRef, useState } from "react";
import type { Exercise } from "../content";
import { useRun } from "../hooks/useRun";
import { clearCode, loadCode, markPassed, saveCode } from "../lib/storage";
import { useDebouncedEffect } from "../lib/useDebouncedEffect";
import { useIsDesktop } from "../lib/useMediaQuery";
import AuthorChip from "./AuthorChip";
import DataTable from "./DataTable";
import Editor from "./Editor";
import Pane from "./Pane";
import Split from "./Split";
import TestResults from "./TestResults";
import VideoEmbed from "./VideoEmbed";
import Writeup from "./Writeup";

type Tab = "watch" | "brief" | "code";

/* tiny inline icons keep the dependency surface small */
const Play = ({ c = "" }) => (
  <svg viewBox="0 0 12 14" className={c} fill="currentColor" aria-hidden>
    <path d="M0 1l11 6L0 13z" />
  </svg>
);
const Stop = ({ c = "" }) => (
  <svg viewBox="0 0 12 12" className={c} fill="currentColor" aria-hidden>
    <rect width="12" height="12" rx="1.5" />
  </svg>
);
const Spin = ({ c = "" }) => (
  <svg viewBox="0 0 24 24" className={`animate-spin ${c}`} fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity=".2" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
const tabIcon: Record<Tab, string> = { watch: "▶", brief: "❯", code: "{ }" };

export default function ExerciseWorkspace({ exercise, onPass }: { exercise: Exercise; onPass: () => void }) {
  const { meta } = exercise;
  const desktop = useIsDesktop();
  const [code, setCode] = useState(() => loadCode(meta.id) ?? exercise.starter);
  const [tab, setTab] = useState<Tab>("watch");
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();
  const codeRef = useRef(code);
  codeRef.current = code;

  const handlePass = useCallback(() => {
    markPassed(meta.id);
    onPass();
  }, [meta.id, onPass]);

  const { state, run, cancel, busy } = useRun(exercise, handlePass);

  useDebouncedEffect(() => {
    saveCode(meta.id, code);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1400);
  }, [code, meta.id]);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const doRun = useCallback(() => {
    if (busy) return;
    if (!desktop) setTab("code");
    void run(codeRef.current);
  }, [busy, run, desktop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        doRun();
      }
      if (e.key === "Escape" && busy) {
        e.preventDefault();
        cancel();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [doRun, busy, cancel]);

  const reset = () => {
    if (!confirm("Reset your code back to the starter? This cannot be undone.")) return;
    clearCode(meta.id);
    setCode(exercise.starter);
  };

  /* ── shared pane contents ─────────────────────────────────────────────── */

  const videoPane = <VideoEmbed videoId={meta.video_id} start={meta.start} playlist={meta.playlist} author={meta.author} />;

  const briefPane = (
    <Pane
      label="Brief"
      actions={
        <div className="flex items-center gap-1">
          {meta.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-ink-900/[0.05] px-2 py-0.5 font-mono text-[9.5px] text-ink-600">
              {t}
            </span>
          ))}
        </div>
      }
    >
      <article className="mx-auto max-w-2xl px-5 py-6 sm:px-7">
        <Writeup markdown={exercise.writeup} />
        <DataTable files={exercise.data} />
        <footer className="mt-10 flex flex-wrap items-center gap-3 border-t border-ink-900/[0.08] pt-4">
          <AuthorChip handle={meta.author} role="Exercise author" />
          <span className="ml-auto font-mono text-[10px] text-ink-500">
            {meta.id} · {meta.runtime}
          </span>
        </footer>
      </article>
    </Pane>
  );

  const editorActions = (
    <>
      <span className={`label mr-1 text-pass transition-opacity duration-500 ${saved ? "opacity-100" : "opacity-0"}`}>
        saved
      </span>
      <button
        onClick={reset}
        title="Reset to starter code"
        className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-950"
      >
        Reset
      </button>
      {busy ? (
        <button
          onClick={cancel}
          title="Stop (Esc)"
          className="flex h-7 items-center gap-1.5 rounded-md bg-fail px-3 text-[11px] font-semibold text-white transition hover:brightness-110 active:scale-[.97]"
        >
          <Stop c="h-2.5 w-2.5" /> Stop
        </button>
      ) : (
        <button
          onClick={doRun}
          title="Run tests (⌘/Ctrl + Enter)"
          className="flex h-7 items-center gap-1.5 rounded-md bg-ink-950 px-3 text-[11px] font-semibold text-white transition hover:bg-ink-800 active:scale-[.97]"
        >
          <Play c="h-2.5 w-2.5 text-accent" /> Run
          <kbd className="ml-0.5 hidden font-sans text-[9px] font-normal text-white/40 sm:inline">⌘↵</kbd>
        </button>
      )}
    </>
  );

  const editorPane = (
    <Pane label="submission.py" scroll={false} actions={editorActions}>
      <Editor value={code} onChange={setCode} onRun={doRun} readOnly={busy} />
    </Pane>
  );

  const resultsPane = (
    <Pane
      label="Tests"
      bodyClassName="bg-paper"
      actions={
        <>
          {busy && <Spin c="h-3 w-3 text-ink-600" />}
          {state.summary && (
            <span className={`font-mono text-[10px] font-medium tabular-nums ${state.summary.ok ? "text-pass" : "text-fail"}`}>
              {state.summary.passed}/{state.summary.total}
            </span>
          )}
          {meta.packages.length > 0 && (
            <span className="hidden font-mono text-[9.5px] text-ink-500 xl:inline">+{meta.packages.join(" +")}</span>
          )}
        </>
      }
    >
      <TestResults state={state} />
    </Pane>
  );

  /* ── Desktop: one workspace, four panes, three handles ────────────────── */
  if (desktop) {
    return (
      <div className="flex min-h-0 flex-1 bg-ink-950 p-1.5 pt-0">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
          <Split
            direction="vertical"
            id="shell"
            initial={0.46}
            minFirst={340}
            minSecond={380}
            label="Resize study column and work column"
            className="flex-1"
            first={
              <Split
                direction="horizontal"
                id="study"
                initial={0.5}
                minFirst={150}
                minSecond={160}
                label="Resize video and brief"
                className="flex-1"
                first={videoPane}
                second={briefPane}
              />
            }
            second={
              <Split
                direction="horizontal"
                id="work"
                initial={0.6}
                minFirst={150}
                minSecond={120}
                label="Resize editor and results"
                className="flex-1"
                first={editorPane}
                second={resultsPane}
              />
            }
          />
        </div>
      </div>
    );
  }

  /* ── Phone: content swaps, the tab bar is always the bottom row ───────── */
  const tabs: Tab[] = ["watch", "brief", "code"];
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ink-950">
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "watch" && <div className="flex h-full flex-col">{videoPane}</div>}
        {tab === "brief" && <div className="flex h-full flex-col">{briefPane}</div>}
        {tab === "code" && (
          <Split
            direction="horizontal"
            id="work-mobile"
            initial={0.55}
            minFirst={110}
            minSecond={90}
            label="Resize editor and results"
            className="h-full"
            first={editorPane}
            second={resultsPane}
          />
        )}
      </div>

      <nav className="flex shrink-0 items-center gap-1 border-t border-white/[0.06] p-2">
        {tabs.map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`label flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 transition-colors ${
              tab === tb ? "bg-white/[0.1] text-accent" : "text-ink-500 hover:text-zinc-300"
            }`}
          >
            <span aria-hidden className="text-[11px]">{tabIcon[tb]}</span>
            {tb}
            {tb === "code" && state.summary && (
              <span className={`h-1.5 w-1.5 rounded-full ${state.summary.ok ? "bg-pass" : "bg-fail"}`} />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
