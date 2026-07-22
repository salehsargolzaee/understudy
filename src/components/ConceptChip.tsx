import { searchHash } from "../lib/routes";
/**
 * A concept, anywhere it appears, is this chip: a viridian capsule with a gold
 * mark that warms on hover. Tapping it runs the catalog search for that
 * concept. One component, so "concepts are tappable" is true by construction.
 */
export default function ConceptChip({ name, count, small = false }: { name: string; count?: number; small?: boolean }) {
  const pretty = name.replace(/-/g, " ");
  return (
    <a
      href={searchHash(name)}
      title={`Search the catalog for “${pretty}”`}
      className={`group inline-flex items-center gap-1 rounded-full border border-verd/30 bg-verd-soft/70 font-mono text-verd transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-ink-950 ${
        small ? "px-2 py-0.5 text-[9.5px]" : "px-2.5 py-1 text-[11px]"
      }`}
    >
      <span aria-hidden className="text-accent opacity-80 group-hover:opacity-100">
        ✦
      </span>
      {pretty}
      {count != null && count > 1 && (
        <span className="tabular-nums text-verd/60 transition-colors group-hover:text-ink-600">×{count}</span>
      )}
    </a>
  );
}
