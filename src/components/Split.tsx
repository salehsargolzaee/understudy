import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { loadRatio, saveRatio } from "../lib/layout";

interface Props {
  /** 'vertical' = side-by-side panes with a vertical divider. */
  direction: "vertical" | "horizontal";
  /** Stable id; the ratio is remembered under it. */
  id: string;
  initial?: number;
  /** Minimum px for each side; re-clamped against the live container size. */
  minFirst?: number;
  minSecond?: number;
  first: ReactNode;
  second: ReactNode;
  label?: string;
  className?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Two panes and a draggable divider.
 *
 * Sizing is a fraction of the container (survives window resizes) but the
 * minimums are px and re-clamped on every move, so a pane can't collapse into a
 * sliver. Pointer capture on the handle keeps the drag tracking even over the
 * iframe or editor. Keyboard: arrows nudge, Home/End jump, Enter resets. The
 * ratio persists per id.
 */
export default function Split({
  direction,
  id,
  initial = 0.5,
  minFirst = 120,
  minSecond = 120,
  first,
  second,
  label,
  className = "",
}: Props) {
  const isVertical = direction === "vertical";
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(() => loadRatio(id) ?? initial);
  const [active, setActive] = useState(false);

  useEffect(() => setRatio(loadRatio(id) ?? initial), [id, initial]);

  const commit = useCallback(
    (next: number) => {
      const el = containerRef.current;
      const total = el ? (isVertical ? el.clientWidth : el.clientHeight) : 0;
      const lo = total > 0 ? minFirst / total : 0.05;
      const hi = total > 0 ? 1 - minSecond / total : 0.95;
      const safe = lo < hi ? clamp(next, lo, hi) : 0.5;
      setRatio(safe);
      return safe;
    },
    [isVertical, minFirst, minSecond],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActive(true);
    document.body.dataset.dragging = direction;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const pos = isVertical ? e.clientX - box.left : e.clientY - box.top;
    const total = isVertical ? box.width : box.height;
    if (total > 0) commit(pos / total);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    setActive(false);
    delete document.body.dataset.dragging;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    saveRatio(id, ratio);
  };

  // Safety net: if a pointerup is lost (tab switch, devtools), unstick the body.
  useEffect(() => {
    if (!active) return;
    const bail = () => {
      setActive(false);
      delete document.body.dataset.dragging;
      saveRatio(id, ratio);
    };
    window.addEventListener("blur", bail);
    return () => window.removeEventListener("blur", bail);
  }, [active, id, ratio]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.08 : 0.02;
    const back = isVertical ? "ArrowLeft" : "ArrowUp";
    const fwd = isVertical ? "ArrowRight" : "ArrowDown";
    let next: number | null = null;
    if (e.key === back) next = ratio - step;
    else if (e.key === fwd) next = ratio + step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    else if (e.key === "Enter" || e.key === " ") next = initial;
    if (next === null) return;
    e.preventDefault();
    saveRatio(id, commit(next));
  };

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 ${isVertical ? "flex-row" : "flex-col"} ${className}`}
    >
      <div
        className="flex min-h-0 min-w-0 overflow-hidden"
        style={isVertical ? { width: `${ratio * 100}%` } : { height: `${ratio * 100}%` }}
      >
        {first}
      </div>

      <div
        role="separator"
        tabIndex={0}
        aria-orientation={isVertical ? "vertical" : "horizontal"}
        aria-label={label ?? "Resize panes"}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        data-active={active}
        className={`handle ${isVertical ? "handle-v" : "handle-h"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => saveRatio(id, commit(initial))}
        onKeyDown={onKeyDown}
      >
        <span className="grip" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{second}</div>
    </div>
  );
}
