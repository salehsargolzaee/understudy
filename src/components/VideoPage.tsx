import { useEffect, useMemo, useRef, useState } from "react";
import type { Exercise } from "../content";
import { getVideo, lecturesForCourse, videoLabel } from "../lib/videos";
import type { LectureVideo, VideoMoment } from "../lib/videos";
import { tallyAuthors, tallyConcepts } from "../lib/catalog";
import { loadPassed } from "../lib/storage";
import { nightRailBg } from "../lib/nightRail";
import { contributeHash, courseHash, exerciseHash, exploreHome, videoHash, homeHash } from "../lib/routes";
import { formatTimestamp, youtubeUrl } from "../lib/youtube";
import { useYouTubePlayer } from "../lib/useYouTubePlayer";
import { useOEmbedTitle } from "../lib/useOEmbedTitle";
import { contributeGuideUrl, exerciseTemplateUrl, schemaUrl } from "../lib/contribute";
import { useIsDesktop } from "../lib/useMediaQuery";
import Star from "./Star";
import Avatar from "./Avatar";
import Brand from "./Brand";
import ConceptChip from "./ConceptChip";
import VideoThumb from "./VideoThumb";

/**
 * Watching + practising, one page.
 *
 * Rule obeyed everywhere below: **nothing is ever drawn over the player.**
 *  · the practice rail sits under the player inside the dark theatre band;
 *  · the "now" card lives in the paper below the band and, on desktop, sticks
 *    to the top of its own column — a sticky element cannot leave its
 *    container, so it can never climb into the player;
 *  · the phone dock is only mounted while the theatre is scrolled out of view
 *    (IntersectionObserver), so there is no moment where it could cover it.
 *
 * Following is driven by the IFrame API's currentTime, so as the lecture plays
 * the moment you are in becomes the card at the top of the page.
 */

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-ink-900/15 bg-white px-3 py-1 text-[12px] font-medium text-ink-900 transition-colors hover:border-accent/60 hover:bg-accent-soft";

const GOLD_BTN =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[12px] font-bold text-ink-950 shadow-sm transition hover:bg-accent-bright active:scale-[.97]";

/* ── the rail of practice marks, under the player ───────────────────────── */

function PracticeRail({
  moments,
  duration,
  currentTime,
  activeStart,
  onJump,
}: {
  moments: VideoMoment[];
  duration: number;
  currentTime: number;
  activeStart: number | null;
  onJump: (s: number) => void;
}) {
  if (!moments.length) return null;
  const latest = moments[moments.length - 1].start;
  const span = duration > 0 ? duration : Math.max(latest * 1.2, currentTime * 1.1, 60);
  const pct = (s: number) => Math.min(100, Math.max(0, (s / span) * 100));

  return (
    <div className="mt-3">
      <div className="relative h-10">
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-white/[0.14]" />
        <div
          className="absolute left-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-accent/80"
          style={{ width: `${pct(currentTime)}%` }}
        />
        {/* playhead */}
        <div
          className="pointer-events-none absolute top-1/2 h-5 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70"
          style={{ left: `${pct(currentTime)}%` }}
          aria-hidden
        />
        {moments.map((m) => {
          const active = activeStart === m.start;
          const label = m.exercises.map((e) => e.meta.concept || e.meta.id).join(" · ");
          return (
            <button
              key={m.start}
              onClick={() => onJump(m.start)}
              title={`${formatTimestamp(m.start)} — ${label}`}
              aria-label={`Jump to ${formatTimestamp(m.start)}: ${label}`}
              style={{ left: `${pct(m.start)}%` }}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 p-1.5"
            >
              <span
                className={`block rounded-full transition-all ${
                  active
                    ? "h-3.5 w-3.5 bg-accent-bright ring-4 ring-accent/25"
                    : "h-2.5 w-2.5 bg-accent/70 ring-2 ring-ink-950 group-hover:bg-accent-bright group-hover:ring-accent/30"
                }`}
              />
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-ink-500">
        <span className="text-zinc-400">{formatTimestamp(currentTime)}</span>
        <span>{plural(moments.length, "practice point")} on this lecture</span>
        <span>{duration > 0 ? formatTimestamp(duration) : "—"}</span>
      </div>
    </div>
  );
}

/* ── one exercise, as a row inside a card or the timeline ───────────────── */

function ExerciseRow({ e, passed }: { e: Exercise; passed: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {passed && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pass" aria-label="passed" />}
          <span className="truncate font-serif text-[16px] font-semibold leading-snug text-ink-950">
            {e.meta.concept || e.meta.id}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {e.meta.concepts.slice(0, 3).map((c) => (
            <ConceptChip key={c} name={c} small />
          ))}
          {e.meta.packages.length > 0 && (
            <span className="font-mono text-[9.5px] text-ink-500">+{e.meta.packages.join(" +")}</span>
          )}
        </span>
      </span>
      {e.meta.author && e.meta.author !== "unknown" && <Avatar handle={e.meta.author} px={26} />}
      <a href={exerciseHash(e.meta.id)} className={GOLD_BTN}>
        Practice <span aria-hidden>→</span>
      </a>
    </div>
  );
}

/* ── the follow-along card ──────────────────────────────────────────────── */

function NowCard({
  moment,
  kind,
  nextMoment,
  currentTime,
  pinned,
  onResume,
  passedMap,
}: {
  moment: VideoMoment | null;
  kind: "now" | "upcoming";
  nextMoment: VideoMoment | null;
  currentTime: number;
  pinned: boolean;
  onResume: () => void;
  passedMap: Record<string, { at: number }>;
}) {
  if (!moment) return null;
  const head =
    kind === "now"
      ? `Right now · ${formatTimestamp(moment.start)}`
      : `Coming up · ${formatTimestamp(moment.start)}`;

  const gap = nextMoment ? nextMoment.start - moment.start : 0;
  const progress = nextMoment && gap > 0 ? Math.min(1, Math.max(0, (currentTime - moment.start) / gap)) : 0;

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-accent/45">
      <header className="flex items-center gap-2 border-b border-ink-900/[0.07] bg-accent-soft/70 px-4 py-2">
        <span aria-hidden className="relative flex h-2 w-2 shrink-0">
          {kind === "now" && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/60" />
          )}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        <span className="label truncate text-ink-800">{head}</span>
        {pinned && (
          <button
            onClick={onResume}
            className="ml-auto shrink-0 rounded-full border border-verd/40 bg-white px-2.5 py-0.5 font-mono text-[10px] text-verd transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-ink-950"
          >
            following paused · resume
          </button>
        )}
      </header>
      <div className="divide-y divide-ink-900/[0.07] px-4">
        {moment.exercises.map((e) => (
          <div key={e.meta.id} className="py-3">
            <ExerciseRow e={e} passed={Boolean(passedMap[e.meta.id])} />
          </div>
        ))}
      </div>
      {nextMoment && kind === "now" && (
        <div className="border-t border-ink-900/[0.07] px-4 py-2.5">
          <div className="h-1 overflow-hidden rounded-full bg-ink-900/10">
            <div
              className="h-full rounded-full bg-accent/70 transition-[width] duration-700"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[10px] tabular-nums text-ink-600">
            next practice at {formatTimestamp(nextMoment.start)} ·{" "}
            {nextMoment.exercises.map((e) => e.meta.concept || e.meta.id).join(" · ")}
          </p>
        </div>
      )}
    </section>
  );
}

/* ── timeline of every moment ──────────────────────────────────────────── */

function Timeline({
  moments,
  activeStart,
  onJump,
  passedMap,
}: {
  moments: VideoMoment[];
  activeStart: number | null;
  onJump: (s: number) => void;
  passedMap: Record<string, { at: number }>;
}) {
  return (
    <ol className="relative space-y-2 border-l border-ink-900/[0.12] pl-4">
      {moments.map((m) => {
        const active = m.start === activeStart;
        return (
          <li key={m.start} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full ring-2 ring-paper ${
                active ? "bg-accent-bright" : "bg-ink-900/25"
              }`}
            />
            <div
              className={`rounded-xl px-3 py-2.5 transition-colors ${
                active ? "bg-white ring-1 ring-accent/40" : "hover:bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onJump(m.start)}
                  title="Play the lecture from here"
                  className="flex items-center gap-1.5 rounded-full border border-ink-900/15 bg-white px-2.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-verd transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-ink-950"
                >
                  <span aria-hidden className="text-[9px]">▶</span>
                  {formatTimestamp(m.start)}
                </button>
                {m.exercises.length > 1 && (
                  <span className="label text-ink-500">{plural(m.exercises.length, "exercise")} here</span>
                )}
              </div>
              <div className="mt-2 divide-y divide-ink-900/[0.06]">
                {m.exercises.map((e) => (
                  <div key={e.meta.id} className="py-2 first:pt-0 last:pb-0">
                    <ExerciseRow e={e} passed={Boolean(passedMap[e.meta.id])} />
                  </div>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── the page ──────────────────────────────────────────────────────────── */

export default function VideoPage({
  videoId,
  start,
  workspaceHref,
}: {
  videoId: string;
  start: number | null;
  workspaceHref: string | null;
}) {
  const video: LectureVideo = useMemo(() => getVideo(videoId), [videoId]);
  const moments = video.moments;
  // a pasted link to something uncatalogued still deserves a real name on
  // screen; display only, the repo's naming rule is untouched
  const fetchedTitle = useOEmbedTitle(videoId, Boolean(video.title));
  const desktop = useIsDesktop();
  const passedMap = useMemo(() => loadPassed(), []);
  const { hostRef, currentTime, duration, failed, seekTo } = useYouTubePlayer(videoId, start ?? 0);

  const [pinnedStart, setPinnedStart] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const theatreRef = useRef<HTMLDivElement>(null);
  const [theatreVisible, setTheatreVisible] = useState(true);

  // the phone dock only exists while the player is off-screen
  useEffect(() => {
    const el = theatreRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setTheatreVisible(entry.isIntersecting), {
      root: scrollRef.current,
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [videoId]);

  const liveIndex = useMemo(() => {
    let idx = -1;
    moments.forEach((m, i) => {
      if (m.start <= currentTime + 0.4) idx = i;
    });
    return idx;
  }, [moments, currentTime]);

  const pinnedIndex = pinnedStart == null ? -1 : moments.findIndex((m) => m.start === pinnedStart);
  const activeIndex = pinnedIndex >= 0 ? pinnedIndex : liveIndex;
  const cardKind: "now" | "upcoming" = activeIndex >= 0 ? "now" : "upcoming";
  const cardIndex = activeIndex >= 0 ? activeIndex : moments.length ? 0 : -1;
  const cardMoment = cardIndex >= 0 ? moments[cardIndex] : null;
  const nextMoment = cardIndex >= 0 ? moments[cardIndex + 1] ?? null : null;
  const activeStart = cardMoment?.start ?? null;

  const jump = (s: number) => {
    setPinnedStart(null);
    if (failed) window.open(youtubeUrl(videoId, s), "_blank", "noopener");
    else seekTo(s);
  };

  const people = useMemo(() => tallyAuthors(video.exercises), [video]);
  const concepts = useMemo(() => tallyConcepts(video.exercises), [video]);
  const siblings = useMemo(() => (video.courseId ? lecturesForCourse(video.courseId) : []), [video.courseId]);
  const myPos = siblings.findIndex((v) => v.id === video.id);
  const prev = myPos > 0 ? siblings[myPos - 1] : null;
  const next = myPos >= 0 && myPos + 1 < siblings.length ? siblings[myPos + 1] : null;

  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?start=${Math.max(

    0,
    Math.floor(start ?? 0),
  )}&rel=0&modestbranding=1&playsinline=1`;

  // Everything a contributor would otherwise have to look up by hand: the id,
  // the lecture's real name, the second they are paused at, the course.
  const [copied, setCopied] = useState(false);
  const pasteTitle = video.title || fetchedTitle;
  const metaSnippet = [
    `video_id: ${videoId}`,
    pasteTitle
      ? `video_title: ${JSON.stringify(pasteTitle)}`
      : `video_title: ""   # leave empty — the PR check fills in the exact name`,
    `start: ${Math.max(0, Math.floor(currentTime || start || 0))}`,
    video.courseId
      ? `course: ${video.courseId}`
      : `course: ""   # add the course under content/courses/ first`,
  ].join("\n");

  const copyMeta = async () => {
    try {
      await navigator.clipboard.writeText(metaSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the block is selectable */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="relative z-30 flex h-11 shrink-0 items-center gap-2.5 bg-ink-950 px-3"
        style={{ backgroundImage: nightRailBg(), backgroundSize: "cover" }}
      >
        <a href={homeHash} className="flex shrink-0 items-center gap-2 pr-1" title="understudy">
          <Brand />
        </a>
        <span className="label truncate text-ink-500">Lecture</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <a
            href={exploreHome}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <span aria-hidden className="text-[11px] text-accent-bright"><Star /></span>
            <span className="hidden sm:inline">Explore</span>
          </a>
          {workspaceHref && (
            <a
              href={workspaceHref}
              className="rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
            >
              Workspace →
            </a>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-slim">
        {/* ── theatre: the player, and under it the practice rail ─────────── */}
        <div
          ref={theatreRef}
          className="bg-ink-950 px-3 pb-4 pt-3 sm:px-6"
          style={{ backgroundImage: nightRailBg(), backgroundSize: "cover" }}
        >
          <div className="mx-auto w-full max-w-[1060px]">
            <div
              className="relative mx-auto w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10"
              style={{ aspectRatio: "16 / 9" }}
            >
              {failed ? (
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={src}
                  title={videoLabel(video)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                /* the API replaces a throwaway child of this div; React never
                   renders anything inside it, and nothing is layered over it */
                <div ref={hostRef} className="absolute inset-0" />
              )}
            </div>
            <PracticeRail
              moments={moments}
              duration={duration}
              currentTime={currentTime}
              activeStart={activeStart}
              onJump={jump}
            />
            {failed && moments.length > 0 && (
              <p className="mt-1 font-mono text-[10px] text-ink-500">
                Live follow-along needs YouTube's player API (blocked here) — timestamps open on YouTube instead.
              </p>
            )}
          </div>
        </div>

        {/* ── paper ──────────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-[1060px] px-5 pb-28 pt-7 sm:px-6">
          <p className="label text-ink-600">
            {video.index ? `Lecture ${video.index}` : video.title || fetchedTitle ? "Lecture" : "Unnamed lecture"}
          </p>
          <h1 className="mt-1 max-w-3xl font-serif text-[27px] font-semibold leading-tight tracking-[-0.015em] text-ink-950 sm:text-[34px]">
            {video.title || fetchedTitle || <span className="font-mono text-[22px] sm:text-[26px]">{videoId}</span>}
          </h1>
          <div
            aria-hidden
            className="mt-2.5 h-[3px] w-16 rounded-full"
            style={{ background: "linear-gradient(90deg, #26418f, #c39422)" }}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {video.course && (
              <a href={courseHash(video.course.id)} className={PILL}>
                {video.course.name}
              </a>
            )}
            <a href={youtubeUrl(videoId, Math.floor(currentTime))} target="_blank" rel="noreferrer noopener" className={PILL}>
              Watch on YouTube ↗
            </a>
            <span className="font-mono text-[11px] tabular-nums text-ink-600">
              {video.exercises.length
                ? `${plural(video.exercises.length, "exercise")} · ${plural(moments.length, "practice point")}`
                : "no practice yet"}
            </span>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              {moments.length > 0 ? (
                <>
                  {/* sticky inside this column only: it can never reach the player */}
                  <div className="lg:sticky lg:top-3 lg:z-10">
                    <NowCard
                      moment={cardMoment}
                      kind={cardKind}
                      nextMoment={nextMoment}
                      currentTime={currentTime}
                      pinned={pinnedIndex >= 0 && pinnedIndex !== liveIndex}
                      onResume={() => setPinnedStart(null)}
                      passedMap={passedMap}
                    />
                  </div>

                  <section className="mt-10">
                    <div className="flex items-baseline gap-2">
                      <span aria-hidden className="text-[11px] leading-none text-accent"><Star /></span>
                      <h2 className="label text-[11px] text-ink-800">Practice, in lecture order</h2>
                      <span className="font-mono text-[10px] text-ink-600">{moments.length}</span>
                    </div>
                    <div className="mt-4">
                      <Timeline
                        moments={moments}
                        activeStart={activeStart}
                        onJump={(s) => {
                          setPinnedStart(s);
                          if (failed) window.open(youtubeUrl(videoId, s), "_blank", "noopener");
                          else seekTo(s);
                        }}
                        passedMap={passedMap}
                      />
                    </div>
                  </section>

                  {/* a lecture with practice can always take more — at a new
                      minute, or joining an existing moment with a different
                      problem */}
                  <details className="group mt-8 rounded-2xl bg-white ring-1 ring-ink-900/[0.08] open:shadow-sm">
                    <summary className="flex cursor-pointer select-none items-center gap-2 px-5 py-3.5">
                      <span aria-hidden className="text-[13px] text-accent"><Star /></span>
                      <span className="text-[13.5px] font-medium text-ink-950">Write practice for this lecture</span>
                      <span className="font-mono text-[10px] text-ink-500">pause where the idea lands, then write</span>
                      <span aria-hidden className="ml-auto text-ink-500 transition-transform group-open:rotate-90">›</span>
                    </summary>
                    <div className="border-t border-ink-900/[0.07] px-5 pb-5 pt-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <a href={contributeHash(videoId, Math.floor(currentTime || start || 0))} className={GOLD_BTN}>
                          Write it here <span aria-hidden>→</span>
                        </a>
                        <span className="text-[12.5px] text-ink-700">
                          brief, code, tests, proof and the pull request — all in the app, under your GitHub name
                        </span>
                      </div>
                      <p className="mt-4 max-w-prose text-[13px] leading-6 text-ink-700">
                        Doing it by hand instead? The timestamp below is wherever you are paused. If a moment already
                        exists near it, prefer the same timestamp — same-moment exercises surface together as one card.
                      </p>
                      <div className="mt-3 overflow-hidden rounded-xl bg-ink-950">
                        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
                          <span className="label text-ink-500">paste into content/&lt;your-id&gt;/meta.yml</span>
                          <button
                            onClick={copyMeta}
                            className="ml-auto rounded-md border border-white/15 px-2 py-0.5 font-mono text-[10px] text-zinc-300 transition-colors hover:border-accent/60 hover:text-white"
                          >
                            {copied ? "copied" : "copy"}
                          </button>
                        </div>
                        <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-5 text-zinc-300">
                          {metaSnippet}
                        </pre>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a href={contributeGuideUrl} target="_blank" rel="noreferrer noopener" className={PILL}>
                          The whole path ↗
                        </a>
                        <a href={exerciseTemplateUrl} target="_blank" rel="noreferrer noopener" className={PILL}>
                          Exercise template ↗
                        </a>
                        <a href={schemaUrl} target="_blank" rel="noreferrer noopener" className={PILL}>
                          Metadata reference ↗
                        </a>
                      </div>
                    </div>
                  </details>
                </>
              ) : (
                /* the front door for new content */
                <section className="rounded-2xl bg-white p-6 ring-1 ring-ink-900/[0.08]">
                  <span aria-hidden className="text-2xl text-accent"><Star /></span>
                  <h2 className="mt-2 font-serif text-[21px] font-semibold text-ink-950">
                    No practice for this lecture yet
                  </h2>
                  <p className="mt-2 max-w-prose text-[14px] leading-6 text-ink-700">
                    {video.title
                      ? "The lecture is catalogued, but nobody has written exercises against it."
                      : "This lecture is not in the catalog at all — we only know the link you pasted."}{" "}
                    An exercise is a folder of plain files: a brief, starter code, a reference solution, pytest
                    tests and a short metadata file. Copy the template, fill it in, open a pull request. A check
                    runs your tests against your starter and against your solution before a person reads anything.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <a href={contributeHash(videoId, Math.floor(currentTime || start || 0))} className={GOLD_BTN}>
                      Write the first exercise →
                    </a>
                    <a href={contributeGuideUrl} target="_blank" rel="noreferrer noopener" className={PILL}>
                      Or do it by hand ↗
                    </a>
                    <a href={exerciseTemplateUrl} target="_blank" rel="noreferrer noopener" className={PILL}>
                      Exercise template ↗
                    </a>
                    <a href={schemaUrl} target="_blank" rel="noreferrer noopener" className={PILL}>
                      Metadata reference ↗
                    </a>
                    <a href={exploreHome} className={PILL}>
                      Browse what does have practice
                    </a>
                  </div>
                  <div className="mt-5 overflow-hidden rounded-xl bg-ink-950">
                    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
                      <span className="label text-ink-500">
                        paste into content/&lt;your-id&gt;/meta.yml
                      </span>
                      <button
                        onClick={copyMeta}
                        className="ml-auto rounded-md border border-white/15 px-2 py-0.5 font-mono text-[10px] text-zinc-300 transition-colors hover:border-accent/60 hover:text-white"
                      >
                        {copied ? "copied" : "copy"}
                      </button>
                    </div>
                    <pre className="overflow-x-auto px-4 py-3 font-mono text-[11.5px] leading-5 text-zinc-300">
                      {metaSnippet}
                    </pre>
                  </div>
                  <p className="mt-3 font-mono text-[10.5px] text-ink-500">
                    the timestamp above is wherever you are paused
                    {!video.title && !fetchedTitle && " · video_title: (none on file yet)"}
                  </p>
                </section>
              )}
            </div>

            {/* ── aside: where this lecture sits ───────────────────────── */}
            <aside className="min-w-0 space-y-8">
              {people.length > 0 && (
                <div>
                  <h2 className="label text-ink-800">Who wrote this practice</h2>
                  <ul className="mt-3 space-y-2">
                    {people.map((p) => (
                      <li key={p.name}>
                        <a
                          href={`#/u/${encodeURIComponent(p.name)}`}
                          className="group flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 ring-1 ring-ink-900/[0.08] transition hover:ring-accent/50"
                        >
                          <Avatar handle={p.name} px={28} />
                          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-950">
                            @{p.name}
                          </span>
                          <span className="font-mono text-[10px] tabular-nums text-ink-600">{p.count}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {concepts.length > 0 && (
                <div>
                  <h2 className="label text-ink-800">Concepts in this lecture</h2>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {concepts.map((c) => (
                      <ConceptChip key={c.name} name={c.name} count={c.count} />
                    ))}
                  </div>
                </div>
              )}

              {siblings.length > 1 && (
                <div>
                  <h2 className="label text-ink-800">
                    {video.course ? video.course.name : "Other lectures"}
                  </h2>
                  <ul className="mt-3 space-y-1.5">
                    {siblings.map((s, i) => {
                      const here = s.id === video.id;
                      return (
                        <li key={s.id}>
                          <a
                            href={videoHash(s.id)}
                            className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
                              here ? "bg-white ring-1 ring-accent/40" : "hover:bg-white"
                            }`}
                          >
                            <span className="mt-0.5 w-4 shrink-0 font-mono text-[10px] tabular-nums text-ink-500">
                              {s.index ?? i + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="clamp-2 block text-[12.5px] font-medium leading-snug text-ink-950">
                                {videoLabel(s)}
                              </span>
                              <span className="mt-0.5 block font-mono text-[9.5px] text-ink-600">
                                {s.exercises.length ? plural(s.exercises.length, "exercise") : "no practice yet"}
                              </span>
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {prev ? (
                      <a href={videoHash(prev.id)} className="text-[12px] text-verd underline underline-offset-2">
                        ← previous
                      </a>
                    ) : (
                      <span />
                    )}
                    {next && (
                      <a href={videoHash(next.id)} className="text-[12px] text-verd underline underline-offset-2">
                        next →
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h2 className="label text-ink-800">This lecture</h2>
                <a
                  href={youtubeUrl(videoId, 0)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 block overflow-hidden rounded-xl ring-1 ring-ink-900/[0.08]"
                >
                  <VideoThumb id={videoId} className="h-[108px] w-full" quality="hq" />
                </a>
                <p className="mt-2 font-mono text-[10px] text-ink-500">{videoId}</p>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* ── phone dock: mounted only while the player is off-screen ─────── */}
      {!desktop && !theatreVisible && cardMoment && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/95 px-3 py-2 shadow-[0_-8px_24px_rgba(13,19,48,0.45)] backdrop-blur">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Back to the player"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.1] text-[11px] text-accent-bright"
            >
              ▲
            </button>
            <span className="min-w-0 flex-1">
              <span className="label block text-ink-500">
                {cardKind === "now" ? "now" : "next"} · {formatTimestamp(cardMoment.start)}
              </span>
              <span className="block truncate text-[13px] font-medium text-zinc-100">
                {cardMoment.exercises.map((e) => e.meta.concept || e.meta.id).join(" · ")}
              </span>
            </span>
            <a href={exerciseHash(cardMoment.exercises[0].meta.id)} className={GOLD_BTN}>
              Practice <span aria-hidden>→</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
