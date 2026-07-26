/**
 * The seam where a night sky meets the paper: the paper rises in one arc with
 * a starlight rim, and a halo crests it from behind — light about to come up
 * over a hill. Position it absolute at the bottom of a `relative` wrapper that
 * does NOT clip overflow, so the halo can bloom into the night above.
 */
export default function Horizon({ className = "h-[72px] sm:h-[96px]" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 ${className}`}>
      {/* the halo: a real bloom, rising from behind the crest into the night */}
      <div
        className="absolute bottom-[68%] left-1/2 h-[340%] w-[min(820px,92vw)] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse 50% 44% at 50% 100%, rgba(246,226,155,0.65), rgba(224,182,74,0.26) 46%, rgba(224,182,74,0) 74%)",
        }}
      />
      <svg viewBox="0 0 1440 110" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <filter id="horizon-glow" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <path
          d="M0,74 C 420,16 1020,16 1440,74"
          fill="none"
          stroke="#f6e29b"
          strokeOpacity="0.7"
          strokeWidth="6"
          filter="url(#horizon-glow)"
        />
        <path d="M0,74 C 420,16 1020,16 1440,74 L1440,110 L0,110 Z" fill="#eef0f6" />
        <path
          d="M0,74 C 420,16 1020,16 1440,74"
          fill="none"
          stroke="#c39422"
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
