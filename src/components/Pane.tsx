import type { ReactNode } from "react";

/**
 * Shared pane shell: a fixed header strip over a scrolling (or clipped) body.
 * Keeping it in one place is what makes the panes read as one tool.
 */
export default function Pane({
  label,
  actions,
  scroll = true,
  bodyClassName = "",
  children,
}: {
  label: ReactNode;
  actions?: ReactNode;
  scroll?: boolean;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-900/[0.08] px-3 text-ink-600">
        <span className="label truncate">{label}</span>
        <div className="ml-auto flex min-w-0 items-center gap-1.5">{actions}</div>
      </header>
      <div className={`min-h-0 flex-1 ${scroll ? "overflow-y-auto scroll-slim" : "overflow-hidden"} ${bodyClassName}`}>
        {children}
      </div>
    </section>
  );
}
