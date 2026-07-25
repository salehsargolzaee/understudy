/** The house star: five points, slightly tilted, rounded like a painted dab.
 *  Sized by font-size (1em) and colored by currentColor, so it drops in
 *  wherever a glyph used to sit. */
export default function Star({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`inline-block h-[1em] w-[1em] shrink-0 ${className}`}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        transform="rotate(-8 12 12)"
        d="M12 2.5l2.7 5.9 6.3.7-4.7 4.3 1.3 6.2-5.6-3.2-5.6 3.2 1.3-6.2-4.7-4.3 6.3-.7z"
      />
    </svg>
  );
}
