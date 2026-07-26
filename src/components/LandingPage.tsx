import { useCallback, useRef, useState } from "react";
import type { Exercise } from "../content";
import { exercises } from "../content";
import type { LectureVideo } from "../lib/videos";
import { videoLabel } from "../lib/videos";
import { contributorCounts } from "../lib/catalog";
import { courseNames, featured, featuredVideo, gentle, landingStats, lecturesWithout, showcase } from "../lib/landing";
import { formatTimestamp } from "../lib/youtube";
import { nightRailBg } from "../lib/nightRail";
import { contributeHash, exerciseHash, exploreHome, homeHash, videoHash } from "../lib/routes";
import { profileHash, githubUrl } from "../lib/github";
import { checkerUrl, contributeGuideUrl, prTemplateUrl, repoUrl, reviewRubricUrl } from "../lib/contribute";
import { useRun } from "../hooks/useRun";
import { warmPyodide } from "../runner";
import { clearCode, loadCode, markPassed, saveCode } from "../lib/storage";
import { useDebouncedEffect } from "../lib/useDebouncedEffect";
import { useIsDesktop } from "../lib/useMediaQuery";
import Avatar from "./Avatar";
import Brand from "./Brand";
import CatalogSky from "./CatalogSky";
import Horizon from "./Horizon";
import Editor from "./Editor";
import Star from "./Star";
import TestResults from "./TestResults";
import VideoThumb from "./VideoThumb";
import Writeup from "./Writeup";

/**
 * The front door. Three rules, in order:
 *  1. Nothing on this page is made up. Every count, name, lecture, exercise and
 *     contributor is read from content/ at build time. Small reads small.
 *  2. Every claim falls through to the thing itself.
 *  3. Nothing loads that is not ours. Thumbnails and avatars are lazy, below
 *     the fold; the Python runtime downloads only when someone shows intent.
 */

const GOLD_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[13px] font-bold text-ink-950 shadow-sm transition hover:bg-accent-bright active:scale-[.98]";
const GHOST_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full border border-ink-900/20 bg-white px-5 py-2.5 text-[13px] font-semibold text-ink-900 transition hover:border-accent/60 hover:bg-accent-soft";
const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-ink-900/15 bg-white px-3 py-1 text-[12px] font-medium text-ink-900 transition-colors hover:border-accent/60 hover:bg-accent-soft";
const SHADE = "[text-shadow:0_2px_22px_rgba(7,11,30,0.92)]";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const nameList = (xs: string[]) =>
  xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

const Rule = () => (
  <div aria-hidden className="mt-3 h-[3px] w-16 rounded-full" style={{ background: "linear-gradient(90deg, #26418f, #c39422)" }} />
);

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="label flex items-center gap-2 text-ink-600">
      <span aria-hidden className="text-[11px] leading-none text-accent">
        <Star />
      </span>
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 max-w-2xl font-serif text-[28px] font-semibold leading-tight tracking-[-0.015em] text-ink-950 sm:text-[34px]">
      {children}
    </h2>
  );
}

/* ── the practice, running ───────────────────────────────────────────────── */

function TryIt({ exercise, video }: { exercise: Exercise; video: LectureVideo }) {
  const id = exercise.meta.id;
  const [code, setCode] = useState(() => loadCode(id) ?? exercise.starter);
  const codeRef = useRef(code);
  codeRef.current = code;

  // the same storage key the workspace reads: pass it here and it is already
  // waiting in the workspace, because it is the same exercise
  useDebouncedEffect(() => saveCode(id, code), [code, id], 600);

  const onPass = useCallback(() => markPassed(id), [id]);
  const { state, run, cancel, busy } = useRun(exercise, onPass);
  const doRun = useCallback(() => {
    if (!busy) void run(codeRef.current);
  }, [busy, run]);

  // ~10 MB of runtime downloads when someone shows intent, never on arrival
  const warmed = useRef(false);
  const warm = () => {
    if (!warmed.current) {
      warmed.current = true;
      warmPyodide();
    }
  };

  const passed = Boolean(state.summary?.ok);

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-ink-900/[0.08]">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-900/[0.07] bg-accent-soft/60 px-4 py-2.5">
        <span aria-hidden className="text-[11px] leading-none text-accent">
          <Star />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-950">{exercise.meta.concept}</span>
        <a
          href={videoHash(video.id, exercise.meta.start)}
          className="shrink-0 rounded-full border border-ink-900/15 bg-white px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-verd transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-ink-950"
          title={videoLabel(video)}
        >
          ▶ {formatTimestamp(exercise.meta.start)}
        </a>
        <a
          href={profileHash(exercise.meta.author)}
          className="shrink-0 font-mono text-[11px] text-ink-600 underline decoration-dotted underline-offset-4 hover:text-ink-950"
        >
          @{exercise.meta.author}
        </a>
      </header>

      <div className="grid lg:grid-cols-2">
        <div className="max-h-[460px] overflow-y-auto border-b border-ink-900/[0.07] px-5 py-6 scroll-slim sm:px-7 lg:border-b-0 lg:border-r">
          <Writeup markdown={exercise.writeup} />
        </div>

        <div className="flex min-w-0 flex-col" onFocusCapture={warm} onPointerEnter={warm}>
          <div className="flex h-10 shrink-0 items-center gap-2 border-b border-ink-900/[0.08] px-3">
            <span className="label truncate text-ink-600">submission.py</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => {
                  clearCode(id);
                  setCode(exercise.starter);
                }}
                title="Back to the starter"
                className="rounded-md px-2 py-1 text-[11px] font-medium text-ink-600 transition-colors hover:bg-ink-900/[0.06] hover:text-ink-950"
              >
                Reset
              </button>
              {busy ? (
                <button
                  onClick={cancel}
                  className="flex h-7 items-center gap-1.5 rounded-full bg-fail px-3.5 text-[11px] font-semibold text-white transition hover:brightness-110 active:scale-[.97]"
                >
                  ■ Stop
                </button>
              ) : (
                <button
                  onClick={doRun}
                  title="Run the tests (⌘/Ctrl + Enter)"
                  className="flex h-7 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[11px] font-bold text-ink-950 shadow-sm transition hover:bg-accent-bright active:scale-[.97]"
                >
                  ▶ Run
                </button>
              )}
            </div>
          </div>
          <div className="h-[300px] shrink-0">
            <Editor value={code} onChange={setCode} onRun={doRun} readOnly={busy} />
          </div>
          <div className="max-h-[280px] min-h-[128px] overflow-y-auto border-t border-ink-900/[0.08] bg-paper scroll-slim">
            <TestResults state={state} />
          </div>
        </div>
      </div>

      {passed && state.summary && (
        <div className="border-t border-pass/25 bg-pass/[0.06] px-5 py-4 sm:px-7">
          <p className="text-[14px] font-semibold text-pass">All {state.summary.total} tests pass.</p>
          <p className="mt-1 max-w-prose text-[13.5px] leading-6 text-ink-800">
            That is the loop: watch the minute, write the thing, have it checked. Nothing was uploaded, and your
            code is saved in this browser — it is already in the workspace.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={exerciseHash(id)} className={GOLD_BTN}>
              Open it in the workspace →
            </a>
            <a href={videoHash(video.id, exercise.meta.start)} className={GHOST_BTN}>
              Watch the lecture from {formatTimestamp(exercise.meta.start)}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── the page ────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const desktop = useIsDesktop();
  const lecture = showcase;
  const n = landingStats.exercises;

  // desktop: stars keep out of the text column. Phone: the whole star field
  // lives below the text, in the sky the hero reserves under it.
  const heroAvoid = desktop ? { x0: 0.14, y0: 0.0, x1: 0.86, y1: 0.47 } : undefined;
  const heroBounds = desktop ? { top: 0.05, bottom: 0.68 } : { top: 0.7, bottom: 0.86 };

  const nextStar = lecturesWithout[0] ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="relative z-30 flex h-11 shrink-0 items-center gap-2.5 bg-ink-950 px-3"
        style={{ backgroundImage: nightRailBg(), backgroundSize: "cover" }}
      >
        <a href={homeHash} className="flex shrink-0 items-center gap-2 pr-1" title="understudy">
          <Brand />
        </a>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <a href={exploreHome} className="rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white">
            Explore
          </a>
          <a href={contributeHash()} className="rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white">
            Write an exercise
          </a>
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white sm:block"
          >
            Source ↗
          </a>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-slim">
        {/* ── the sky, and the claim ──────────────────────────────────────── */}
        <div className="relative">
        <CatalogSky
          exercises={exercises}
          className="min-h-[64vh] sm:min-h-[560px]"
          label={
            n
              ? `The Understudy catalog as a night sky: ${plural(n, "star")}, one for each exercise`
              : "An empty night sky: no exercises have been written yet"
          }
          avoid={heroAvoid}
          bounds={heroBounds}
          interactive
          scrim="radial-gradient(ellipse 80% 58% at 50% 26%, rgba(7,11,30,0.72), rgba(7,11,30,0.36) 58%, transparent 80%)"
        >
          <div className="flex flex-col items-center px-5 pb-44 pt-10 text-center sm:pb-52 sm:pt-16">
            <p className={`label text-zinc-300 ${SHADE}`}>Understudy</p>
            <h1 className={`mt-3 max-w-4xl font-serif text-[30px] font-semibold leading-[1.14] tracking-[-0.02em] text-white sm:text-[46px] ${SHADE}`}>
              The lectures are free on YouTube.
              <br />
              The practice belongs beside them.
            </h1>
            <p className="mt-4 max-w-xl font-mono text-[11px] leading-5 text-zinc-100 [text-shadow:0_1px_6px_rgba(7,11,30,1),0_2px_26px_rgba(7,11,30,0.95)] sm:text-[12.5px]">
              the best universities and teachers give whole courses away. The practice is ours to
              build: real exercises beside the lecture, at the minute each idea is taught, by whoever
              just learned it.
            </p>
          </div>
        </CatalogSky>
          <Horizon />
        </div>

        {/* ── what the sky is, cradled in the curve ───────────────────────── */}
        <div className="relative z-10 mx-auto -mt-7 max-w-3xl px-5 text-center sm:-mt-9 sm:px-8">
          <p className="mx-auto max-w-[58ch] text-[14px] leading-7 text-ink-700">
            {n > 0 ? (
              <>
                Understudy is a catalog of great lectures with practice beside them. So far its contributors have
                written <span className="font-semibold tabular-nums text-ink-950">{n}</span>{" "}
                {n === 1 ? "exercise" : "exercises"} — and each one is a star in the sky above, at its own place,
                linking to itself. Tap one. There are no other stars.
              </>
            ) : (
              <>Understudy is a catalog of great lectures with practice beside them. There are no stars yet: the
              first exercise anybody writes puts one in this sky.</>
            )}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={exploreHome} className={GOLD_BTN}>
              Browse the catalog →
            </a>
            <a href={contributeHash()} className={GHOST_BTN}>
              Write practice for a lecture →
            </a>
          </div>

          <p className="mt-5 font-mono text-[11px] tabular-nums text-ink-600">
            {plural(landingStats.exercises, "exercise")} · {landingStats.lecturesWithPractice} of{" "}
            {plural(landingStats.lectures, "lecture")} with practice · {plural(landingStats.courses, "course")} ·{" "}
            {plural(landingStats.contributors, "contributor")}
          </p>
          <p className="mt-1 text-[12px] text-ink-600">Small, because it is new.</p>
        </div>

        {/* ── I. the missing half ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-4xl px-5 pt-24 sm:px-8">
          <Kicker>The missing half</Kicker>
          <H2>A lecture explains. Nothing asks you to do it.</H2>
          <Rule />
          <div className="mt-6 max-w-[62ch] space-y-5 text-[15.5px] leading-[1.75] text-ink-800">
            <p>
              The courses in this catalog — {nameList(courseNames)} — sit on YouTube in full, free, taught by the
              people who teach them best. You can watch every minute of them tonight. What no video can do is ask
              you to try the thing it just explained, and check whether you actually can.
            </p>
            <p>
              Even the courses that ship exercises ship them at the end, in a repository, written once by one
              instructor guessing at what will confuse people. Practice here lives at the second where the idea
              lands, in the tab you are watching in, and it is written by everyone who has just learned the thing
              and still remembers what was hard about it. No install, no sign-in, no account.
            </p>
          </div>

          {lecture && (
            <div className="mt-8 overflow-hidden rounded-2xl bg-white ring-1 ring-ink-900/[0.08] shadow-sm">
              <a href={videoHash(lecture.id)} className="group flex gap-4 p-4">
                <span className="relative shrink-0 overflow-hidden rounded-xl">
                  <VideoThumb id={lecture.id} className="h-[72px] w-[128px]" />
                  <span
                    aria-hidden
                    className="absolute inset-0 grid place-items-center text-[15px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ background: "rgba(13,19,48,0.35)" }}
                  >
                    ▶
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="clamp-2 block font-serif text-[17px] font-semibold leading-snug text-ink-950">
                    {videoLabel(lecture)}
                  </span>
                  <span className="mt-1 block truncate font-mono text-[10.5px] text-ink-600">
                    {[lecture.course?.name, plural(lecture.moments.length, "practice point")].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </a>
              <ul className="divide-y divide-ink-900/[0.06] border-t border-ink-900/[0.07]">
                {lecture.moments.map((m) => (
                  <li key={m.start} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                    <a
                      href={videoHash(lecture.id, m.start)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink-900/15 bg-white px-2.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-verd transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-ink-950"
                    >
                      <span aria-hidden className="text-[9px]">▶</span>
                      {formatTimestamp(m.start)}
                    </a>
                    <span className="min-w-0 flex-1 text-[13.5px] text-ink-950">
                      {m.exercises.map((e, i) => (
                        <span key={e.meta.id}>
                          {i > 0 && <span className="text-ink-500"> · </span>}
                          <a href={exerciseHash(e.meta.id)} className="text-verd underline underline-offset-2">
                            {e.meta.concept || e.meta.id}
                          </a>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-ink-900/[0.07] px-4 py-3">
                <a href={videoHash(lecture.id)} className={PILL}>
                  Open the lecture and follow along →
                </a>
              </div>
            </div>
          )}

          {featured && featuredVideo && (
            <>
              <p className="mt-10 max-w-[62ch] text-[14px] leading-7 text-ink-700">
                And this is one of the {plural(n, "exercise")} — not a screenshot of one. The brief its author wrote,
                their tests, and the same Python every learner here runs, in your tab. Pressing Run fetches the
                runtime once, ten to twenty seconds, and then the tests run on your machine and go nowhere.
              </p>
              <div className="mt-6">
                <TryIt exercise={featured} video={featuredVideo} />
              </div>
              {gentle && (
                <p className="mt-3 text-[13px] text-ink-700">
                  Rusty on the calculus?{" "}
                  <a href={exerciseHash(gentle.meta.id)} className="text-verd underline underline-offset-2">
                    Start with something gentler: {gentle.meta.concept}
                  </a>
                </p>
              )}
            </>
          )}
        </section>

        {/* ── II. the record ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-4xl px-5 pt-24 sm:px-8">
          <Kicker>What you have to show for it</Kicker>
          <H2>Watching is invisible work.</H2>
          <Rule />
          <div className="mt-6 max-w-[62ch] space-y-5 text-[15.5px] leading-[1.75] text-ink-800">
            <p>
              Nobody can see a course you watched. The usual remedy is a certificate: a receipt for attendance, sold
              by a platform. A merged exercise here proves something different — that you understood one minute of
              one lecture well enough to set a problem about it, with tests, and a reference answer a reviewer
              accepted. Attendance can be bought. That cannot.
            </p>
            <p>
              Nothing here writes the exercise for you. The app removes the plumbing — git, folders, the pull
              request dance — and none of the thinking, because the thinking is what the record certifies.
            </p>
            <p>
              And the record lands where it already counts: every merged exercise is a commit under your own GitHub
              name, on the profile and the contribution graph people already look at.
            </p>
            <p>
              It also becomes a page of its own here. Your profile paints every exercise you have written as a star
              in your own sky — a learning resume at one link, ready to put in a bio, a CV, an application.{" "}
              <a href={profileHash("salehsargolzaee")} className="text-verd underline underline-offset-2">
                This is what one looks like.
              </a>
            </p>
            <p className="text-[13.5px] leading-7 text-ink-700">
              Before a person reads a word, a check proves your tests fail on your starter and pass on your answer.{" "}
              <a href={checkerUrl} target="_blank" rel="noreferrer noopener" className="text-verd underline underline-offset-2">
                The check
              </a>
              ,{" "}
              <a href={reviewRubricUrl} target="_blank" rel="noreferrer noopener" className="text-verd underline underline-offset-2">
                the reviewer&rsquo;s rubric
              </a>{" "}
              and{" "}
              <a href={prTemplateUrl} target="_blank" rel="noreferrer noopener" className="text-verd underline underline-offset-2">
                the pull request template
              </a>{" "}
              are public.
            </p>
          </div>

          {contributorCounts.length > 0 && (
            <div className="mt-10">
              <Kicker>Who has written practice so far</Kicker>
              <ul className="mt-4 divide-y divide-ink-900/[0.07] overflow-hidden rounded-2xl bg-white ring-1 ring-ink-900/[0.08]">
                {contributorCounts.map((p) => (
                  <li key={p.name}>
                    <a href={profileHash(p.name)} className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent-soft/40">
                      <Avatar handle={p.name} px={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[13px] font-medium text-ink-950">@{p.name}</span>
                        <span className="block truncate font-mono text-[10.5px] tabular-nums text-ink-600">
                          {plural(p.count, "exercise")}
                        </span>
                      </span>
                      <span className="hidden text-[12px] text-ink-600 sm:block">their learning resume</span>
                      <span aria-hidden className="text-ink-500 transition-transform group-hover:translate-x-0.5">→</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[13px] leading-6 text-ink-700">
                {contributorCounts.length === 1
                  ? "One person, so far. That is the state of this place on the day you arrived."
                  : `${contributorCounts.length} people, so far. Each page is painted from nothing but their own work.`}
              </p>
              <div className="mt-5">
                <a href={contributeHash()} className={GOLD_BTN}>
                  Open the composer →
                </a>
              </div>
            </div>
          )}
        </section>

        {/* ── III. why a night sky ────────────────────────────────────────── */}
        <section className="mx-auto max-w-4xl px-5 pt-24 sm:px-8">
          <Kicker>Why a night sky</Kicker>
          <H2>One person can place one star.</H2>
          <Rule />
          <div className="mt-6 max-w-[62ch] space-y-5 text-[15.5px] leading-[1.75] text-ink-800">
            <p>
              An exercise is a small thing. One folder, five files, maybe an evening — written by somebody who has
              just understood the idea and can still remember what was confusing about it. That is the whole unit
              this place is made of, and there is no larger one.
            </p>
            <p>
              Nobody paints a sky. Enough people set enough stars and there is one anyway, and it is better than
              anything any of them would have made alone. The sky at the top of this page is the catalog itself: it
              has grown {n === 1 ? "once" : `${n} times`}, once per exercise, and it has never grown any other way.
            </p>
          </div>
        </section>

        {/* ── the empty sky, and the two ways in ──────────────────────────── */}
        <div className="mt-24">
          <CatalogSky
            exercises={[]}
            className="min-h-[460px]"
            label="An empty night sky: the lectures nobody has written practice for"
            dim={0.16}
            scrim="radial-gradient(ellipse 88% 72% at 50% 50%, rgba(7,11,30,0.7), rgba(7,11,30,0.3) 62%, transparent 86%)"
          >
            <div className="pointer-events-auto mx-auto max-w-4xl px-5 py-16 sm:px-8">
              <p className={`label text-zinc-300 ${SHADE}`}>No stars here</p>
              <h2 className={`mt-3 max-w-2xl font-serif text-[28px] font-semibold leading-tight tracking-[-0.015em] text-white sm:text-[36px] ${SHADE}`}>
                Most of the sky is empty.
              </h2>
              <p className={`mt-3 max-w-[56ch] text-[15px] leading-7 text-zinc-200 ${SHADE}`}>
                This is what a lecture without practice looks like: night, no stars. Every exercise anyone writes
                puts one star in the sky, permanently — that is the only way any sky here fills.
                {nextStar ? (
                  <>
                    {" "}The nearest empty one is{" "}
                    <a href={videoHash(nextStar.id)} className="text-accent-bright underline underline-offset-2">
                      {videoLabel(nextStar)}
                    </a>
                    , already in this catalog, waiting for its first.
                  </>
                ) : null}{" "}
                And beyond this catalog, YouTube holds thousands of course lectures with no practice at all. The
                person best placed to write the first exercise for any of them is whoever just finished watching.
              </p>

              <div className="mt-9 grid gap-4 sm:grid-cols-2">
                <a
                  href={lecture ? videoHash(lecture.id) : exploreHome}
                  className="group rounded-2xl border border-white/15 bg-white/[0.06] p-5 transition hover:border-accent/60 hover:bg-white/[0.11]"
                >
                  <p className="label text-accent-bright">Watch</p>
                  <p className="mt-2 font-serif text-[19px] font-semibold leading-snug text-white">
                    A lecture with practice beside it
                  </p>
                  <p className="mt-3 text-[13px] leading-6 text-zinc-300">
                    The lecture plays here. When it reaches a minute somebody has written practice for, the exercise
                    is already beside it.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-accent-bright">
                    Start watching <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </a>

                <a
                  href={contributeHash()}
                  className="group rounded-2xl border border-white/15 bg-white/[0.06] p-5 transition hover:border-accent/60 hover:bg-white/[0.11]"
                >
                  <p className="label text-accent-bright">Write</p>
                  <p className="mt-2 font-serif text-[19px] font-semibold leading-snug text-white">
                    Practice for a lecture you already love
                  </p>
                  <p className="mt-3 text-[13px] leading-6 text-zinc-300">
                    Pause where the idea lands and write the exercise you wish had been there. The app proves it in
                    your browser before it will let you submit.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-accent-bright">
                    Write an exercise <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                </a>
              </div>

              <p className="mt-6 text-[12px] leading-6 text-zinc-400">
                Reading, watching and running the exercises need no account. Opening the pull request signs you in to
                GitHub, because the pull request has to be yours.
              </p>
            </div>
          </CatalogSky>
        </div>

        {/* ── colophon ────────────────────────────────────────────────────── */}
        <footer className="bg-ink-950 px-5 pb-12 pt-2 sm:px-8">
          <div className="mx-auto max-w-4xl border-t border-white/[0.08] pt-8">
            <p className="max-w-[64ch] text-[13px] leading-7 text-zinc-400">
              Understudy is open source and static: a folder of plain files and a page that renders them. The tests
              run in your browser, so there is no compute to meter. The only server-side code in the whole
              repository is one short function that completes a GitHub sign-in. Free to read, free to run, free to
              contribute, and it stays that way.
            </p>
            <p className="mt-4 max-w-[64ch] text-[13px] leading-7 text-zinc-400">
              Made by{" "}
              <a href={profileHash("salehsargolzaee")} className="font-medium text-zinc-200 hover:text-accent-bright">
                Saleh Sargolzaei
              </a>{" "}
              —{" "}
              <a href={githubUrl("salehsargolzaee")} target="_blank" rel="noreferrer noopener" className="hover:text-accent-bright">
                GitHub ↗
              </a>{" "}
              ·{" "}
              <a
                href="https://www.linkedin.com/in/saleh-sargolzaee/"
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-accent-bright"
              >
                LinkedIn ↗
              </a>
              . A course you want practice for, an idea, a problem: open an issue or reach out.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11.5px] text-zinc-400">
              <a href={repoUrl} target="_blank" rel="noreferrer noopener" className="hover:text-accent-bright">
                Source ↗
              </a>
              <a href={contributeGuideUrl} target="_blank" rel="noreferrer noopener" className="hover:text-accent-bright">
                How to contribute ↗
              </a>
              <a href={reviewRubricUrl} target="_blank" rel="noreferrer noopener" className="hover:text-accent-bright">
                How exercises are reviewed ↗
              </a>
              <a href={exploreHome} className="hover:text-accent-bright">
                Explore the catalog
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
