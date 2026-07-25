import { useEffect, useRef, useState } from "react";
import type { Exercise } from "../content";
import { nightRailBg } from "../lib/nightRail";
import { exploreHome } from "../lib/routes";
import Star from "./Star";
import Brand from "./Brand";
interface Props {
  exercises: Exercise[];
  currentId: string | null;
  passed: Record<string, { at: number }>;
  onSelect: (id: string) => void;
}
/**
 * The top rail. Dark, so the paper workspace below reads as the lit work
 * surface, and short so vertical space belongs to the panes.
 */
export default function ExercisePicker({ exercises, currentId, passed, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = exercises.find((e) => e.meta.id === currentId);
  const done = exercises.filter((e) => passed[e.meta.id]).length;
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <header
      className="relative z-30 flex h-11 shrink-0 items-center gap-2.5 bg-ink-950 px-3"
      style={{ backgroundImage: nightRailBg(), backgroundSize: "cover" }}
    >
      <a href={exploreHome} className="flex shrink-0 items-center gap-2 pr-1" title="Explore the catalog">
        <Brand />
      </a>
      <a
        href={exploreHome}
        title="Search and browse the whole catalog"
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
      >
        <span aria-hidden className="text-[11px] text-accent-bright"><Star /></span>
        <span className="hidden md:inline">Explore</span>
      </a>
      <div className="relative min-w-0 flex-1 sm:max-w-sm" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="group flex w-full items-center gap-2 rounded-lg bg-white/[0.08] py-1.5 pl-3 pr-2 text-left shadow-sm ring-1 ring-white/[0.16] transition-colors hover:bg-white/[0.13] hover:ring-white/[0.26]"
        >
          {current && passed[current.meta.id] && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pass" />}
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-100">
            {current?.meta.concept || current?.meta.id || "Pick an exercise"}
          </span>
          <svg
            className={`h-3.5 w-3.5 shrink-0 text-accent-bright transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.2 8.2a.75.75 0 011.1 0L10 11.9l3.7-3.7a.75.75 0 111.1 1.1l-4.3 4.2a.75.75 0 01-1 0L5.2 9.3a.75.75 0 010-1.1z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        {open && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-lg bg-ink-900 p-1 shadow-xl ring-1 ring-white/10 scroll-slim"
          >
            {exercises.map((e) => {
              const active = e.meta.id === currentId;
              return (
                <li key={e.meta.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onSelect(e.meta.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors ${
                      active ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"
                    }`}
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${
                        passed[e.meta.id] ? "bg-pass text-white" : "ring-1 ring-white/15 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-zinc-100">{e.meta.concept || e.meta.id}</span>
                      <span className="block truncate font-mono text-[9.5px] text-ink-600">{e.meta.id}</span>
                    </span>
                    {e.meta.runtime !== "pyodide" && (
                      <span className="label shrink-0 rounded bg-accent/20 px-1.5 py-0.5 text-[9px] text-accent">
                        {e.meta.runtime}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        <span className="font-mono text-[10px] tabular-nums text-ink-500">
          {done}
          <span className="text-ink-600">/{exercises.length}</span>
        </span>
        <div className="h-[3px] w-14 overflow-hidden rounded-full bg-white/10 sm:w-20">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700"
            style={{ width: `${(done / Math.max(1, exercises.length)) * 100}%` }}
          />
        </div>
      </div>
    </header>
  );
}
