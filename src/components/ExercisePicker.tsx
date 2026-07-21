import type { Exercise } from "../content";

interface Props {
  exercises: Exercise[];
  currentId: string | null;
  passed: Record<string, { at: number }>;
  onSelect: (id: string) => void;
}

export default function ExercisePicker({ exercises, currentId, passed, onSelect }: Props) {
  const done = exercises.filter((e) => passed[e.meta.id]).length;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-900/10 bg-white px-3 sm:px-5">
      <span className="text-sm font-semibold tracking-tight text-ink-950">Practice</span>

      <select
        value={currentId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Choose exercise"
        className="min-w-0 flex-1 rounded-lg border border-ink-900/15 bg-white px-3 py-1.5 text-sm text-ink-950 sm:w-80 sm:flex-none"
      >
        {exercises.map((e) => (
          <option key={e.meta.id} value={e.meta.id}>
            {(passed[e.meta.id] ? "✓ " : "") + (e.meta.concept || e.meta.id)}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-2 text-xs text-ink-700">
        <span className="tabular-nums">
          {done}/{exercises.length} passing
        </span>
        <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-ink-900/10 sm:block">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(done / exercises.length) * 100}%` }}
          />
        </div>
      </div>
    </header>
  );
}
