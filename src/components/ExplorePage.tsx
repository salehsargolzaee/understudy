import { useEffect, useMemo, useRef, useState } from "react";
import { exercises, getCourse } from "../content";
import type { Exercise } from "../content";
import {
  catalogStats,
  conceptCounts,
  contributorCounts,
  courseSummaries,
  fieldSummaries,
  getCourseSummary,
  levelOf,
  levelSummaries,
  tallyAuthors,
  tallyConcepts,
} from "../lib/catalog";
import type { CourseSummary, FacetSummary } from "../lib/catalog";
import { getVideo, lecturesForCourse, videoLabel, videosWithExercises, findCourseByPlaylistId } from "../lib/videos";
import type { LectureVideo } from "../lib/videos";
import { parseYouTubeRef, formatTimestamp, youtubePlaylistUrl } from "../lib/youtube";
import { profileHash } from "../lib/github";
import { nightRailBg } from "../lib/nightRail";
import {
  courseHash,
  exerciseHash,
  exploreHome,
  fieldHash,
  levelHash,
  searchHash,
  videoHash,
  viewHash,
  homeHash,
} from "../lib/routes";
import type { ExploreView } from "../lib/routes";
import { searchCatalog } from "../lib/search";
import Star from "./Star";
import Avatar from "./Avatar";
import Brand from "./Brand";
import ConceptChip from "./ConceptChip";
import CatalogSky from "./CatalogSky";
import Horizon from "./Horizon";
import { contributeHash } from "../lib/routes";
import VideoThumb from "./VideoThumb";

/**
 * The discovery surface and the home screen: one painted night hero over a
 * moonstone catalog. Everything here is reachable from everything else —
 * lecture → course → contributor → concept → search → exercise — and every view
 * keeps the search box within reach.
 *
 * The search box is also the paste box: a YouTube link typed or pasted into it
 * resolves immediately to the lecture (or the course, for a playlist link).
 */

const PALETTE = ["#26418f", "#2f6b52", "#3f74c0", "#c39422", "#6b5b95"];
const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-ink-900/15 bg-white px-3 py-1 text-[12px] font-medium text-ink-900 transition-colors hover:border-accent/60 hover:bg-accent-soft";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/* ── small shared pieces ─────────────────────────────────────────────────── */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="text-[11px] leading-none text-accent"><Star /></span>
        <h2 className="label text-[11px] text-ink-800">{title}</h2>
        {hint && <span className="font-mono text-[10px] text-ink-600">{hint}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SearchBox({ value, onChange, large = false }: { value: string; onChange: (v: string) => void; large?: boolean }) {
  return (
    <label
      className={`flex items-center gap-2.5 rounded-full bg-white ring-1 ring-ink-900/10 transition-shadow focus-within:ring-2 focus-within:ring-accent ${
        large ? "px-5 py-3.5 shadow-lg" : "px-4 py-2 shadow-sm"
      }`}
    >
      <span aria-hidden className="shrink-0 text-accent"><Star /></span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          // a paste is the one gesture that must resolve instantly, even if the
          // browser would otherwise batch it oddly
          const text = e.clipboardData.getData("text");
          if (parseYouTubeRef(text)) {
            e.preventDefault();
            onChange(text);
          }
        }}
        placeholder="Search lectures, courses, concepts, people… or paste a YouTube link"
        aria-label="Search the catalog or paste a YouTube link"
        className={`w-full bg-transparent text-ink-950 placeholder:text-ink-500 focus:outline-none ${
          large ? "text-[16px]" : "text-[13.5px]"
        }`}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Clear search" className="shrink-0 text-ink-500 hover:text-ink-950">
          ✕
        </button>
      )}
    </label>
  );
}

function PersonCard({ handle, count }: { handle: string; count: number }) {
  return (
    <a
      href={profileHash(handle)}
      className="group flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-ink-900/[0.08] transition hover:shadow-sm hover:ring-accent/50"
    >
      <Avatar handle={handle} px={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[12px] font-medium text-ink-950">@{handle}</span>
        <span className="label block text-[9px] text-ink-600">{plural(count, "exercise")}</span>
      </span>
      <span className="shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5" aria-hidden>
        →
      </span>
    </a>
  );
}

/** A lecture, as a card. The front door: tapping it goes to watching. */
function LectureCard({ v }: { v: LectureVideo }) {
  const sub = [
    v.course?.name,
    v.index ? `Lecture ${v.index}` : "",
    v.exercises.length ? plural(v.exercises.length, "exercise") : "no practice yet",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <a
      href={videoHash(v.id)}
      className="group flex min-w-0 gap-3 rounded-2xl bg-white p-3 ring-1 ring-ink-900/[0.08] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:ring-accent/50"
    >
      <span className="relative shrink-0 overflow-hidden rounded-xl">
        <VideoThumb id={v.id} className="h-[58px] w-[104px]" />
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center text-[13px] text-white opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "rgba(13,19,48,0.35)" }}
        >
          ▶
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="clamp-2 block font-serif text-[15px] font-semibold leading-snug text-ink-950">
          {videoLabel(v)}
        </span>
        <span className="mt-1 block truncate font-mono text-[10px] text-ink-600">{sub}</span>
      </span>
      <span className="shrink-0 self-center text-ink-500 transition-transform group-hover:translate-x-0.5" aria-hidden>
        →
      </span>
    </a>
  );
}

/** A lecture, as a row in a course's table of contents. */
function LectureRow({ v, n }: { v: LectureVideo; n: number }) {
  return (
    <li className="group">
      <a
        href={videoHash(v.id)}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white"
      >
        <span className="w-5 shrink-0 font-mono text-[11px] tabular-nums text-ink-500">{v.index ?? n}</span>
        <VideoThumb id={v.id} className="h-[36px] w-[64px] shrink-0 rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium text-ink-950">{videoLabel(v)}</span>
          <span className="block truncate font-mono text-[10px] text-ink-500">
            {v.exercises.length
              ? `${plural(v.exercises.length, "exercise")} · ${v.moments
                  .slice(0, 3)
                  .map((m) => formatTimestamp(m.start))
                  .join(", ")}${v.moments.length > 3 ? "…" : ""}`
              : "no practice yet — be the first"}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 lg:flex">
          {[...new Set(v.exercises.flatMap((e) => e.meta.concepts))].slice(0, 2).map((c) => (
            <ConceptChip key={c} name={c} small />
          ))}
        </span>
        <span className="shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5" aria-hidden>
          →
        </span>
      </a>
    </li>
  );
}

function ExerciseLine({ e, showCourse = true }: { e: Exercise; showCourse?: boolean }) {
  const course = getCourse(e.meta.course);
  const level = levelOf(e);
  const sub = [e.meta.id, showCourse && course ? course.name : "", level !== "unspecified" ? level : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white">
      {/* full-row underlay: the whole row opens the exercise; the chips, the
          lecture link and the avatar sit above it and navigate independently */}
      <a
        href={exerciseHash(e.meta.id)}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={e.meta.concept || e.meta.id}
      />
      <span
        aria-hidden
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-900/[0.05] text-[10px] text-ink-600 transition-colors group-hover:bg-accent-soft group-hover:text-ink-950"
      >
        ▶
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-ink-950">{e.meta.concept || e.meta.id}</span>
        <span className="block truncate font-mono text-[10px] text-ink-500">{sub}</span>
      </span>
      {e.meta.video_id && (
        <a
          href={videoHash(e.meta.video_id, e.meta.start)}
          title={`Watch: ${e.meta.video_title || e.meta.video_id}`}
          className="relative z-10 hidden shrink-0 items-center gap-1 rounded-full border border-ink-900/15 bg-white px-2 py-0.5 font-mono text-[10px] tabular-nums text-verd transition-colors hover:border-accent/60 hover:bg-accent-soft hover:text-ink-950 sm:flex"
        >
          <span aria-hidden className="text-[8px]">▶</span>
          {formatTimestamp(e.meta.start)}
        </a>
      )}
      <span className="relative z-10 hidden shrink-0 items-center gap-1.5 lg:flex">
        {e.meta.concepts.slice(0, 3).map((c) => (
          <ConceptChip key={c} name={c} small />
        ))}
      </span>
      {e.meta.author && e.meta.author !== "unknown" && (
        <a
          href={profileHash(e.meta.author)}
          title={`@${e.meta.author}'s profile`}
          className="relative z-10 shrink-0 rounded-full transition hover:ring-2 hover:ring-accent"
        >
          <Avatar handle={e.meta.author} px={26} />
        </a>
      )}
    </li>
  );
}

function CourseCard({ s, stroke = 0 }: { s: CourseSummary; stroke?: number }) {
  const c = s.course;
  return (
    <a
      href={courseHash(c.id)}
      className="group flex flex-col rounded-2xl bg-white p-5 ring-1 ring-ink-900/[0.08] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:ring-accent/50"
    >
      {/* a brushstroke instead of a border accent */}
      <div
        aria-hidden
        className="h-[3px] w-12 rounded-full"
        style={{ background: `linear-gradient(90deg, ${PALETTE[stroke % PALETTE.length]}, #c39422)` }}
      />
      <h3 className="mt-3 font-serif text-[19px] font-semibold leading-snug text-ink-950">{c.name}</h3>
      <p className="mt-1 text-[12.5px] text-ink-700">{[c.institution, c.creator].filter(Boolean).join(" · ")}</p>
      <p className="mt-0.5 font-mono text-[10.5px] text-ink-600">{[c.field, c.level].filter(Boolean).join(" · ")}</p>
      <div className="mt-4 flex items-center gap-2.5 pt-1">
        <span className="flex -space-x-2">
          {s.contributors.slice(0, 4).map((p) => (
            <span key={p.name} className="rounded-full ring-2 ring-white">
              <Avatar handle={p.name} px={22} />
            </span>
          ))}
        </span>
        <span className="font-mono text-[10.5px] tabular-nums text-ink-600">
          {plural(s.lectures, "lecture")} · {plural(s.exercises.length, "exercise")}
        </span>
        <span className="ml-auto text-ink-500 transition-transform group-hover:translate-x-0.5" aria-hidden>
          →
        </span>
      </div>
    </a>
  );
}

function FieldCard({ f, i }: { f: FacetSummary; i: number }) {
  return (
    <a
      href={fieldHash(f.name)}
      className="group flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-ink-900/[0.08] transition hover:shadow-sm hover:ring-accent/50"
    >
      <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-serif text-[16px] font-semibold text-ink-950">{f.name}</span>
        <span className="block font-mono text-[10.5px] tabular-nums text-ink-600">
          {plural(f.exercises.length, "exercise")} · {plural(f.courses.length, "course")}
        </span>
      </span>
      <span className="shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5" aria-hidden>
        →
      </span>
    </a>
  );
}

function Missing({ label }: { label: string }) {
  return (
    <div className="mt-20 text-center">
      <span aria-hidden className="text-2xl text-accent"><Star /></span>
      <p className="mt-3 font-serif text-xl font-semibold text-ink-950">{label}</p>
      <a href={exploreHome} className="mt-2 inline-block text-[13px] text-verd underline underline-offset-2">
        Back to the catalog
      </a>
    </div>
  );
}

/* ── pasted links ────────────────────────────────────────────────────────── */

/**
 * What a pasted link looks like when it lands here as text rather than as a
 * navigation (a shared #/x/q/<url>, or a playlist we do not have). Typing or
 * pasting in the box navigates straight through; this is the safety net.
 */
function PastedLink({ q }: { q: string }) {
  const ref = parseYouTubeRef(q);
  if (!ref) return null;

  if (ref.kind === "video") {
    const v = getVideo(ref.videoId);
    return (
      <section className="mt-8 overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-accent/45 shadow-sm">
        <p className="label text-ink-600">YouTube link recognised</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <a href={videoHash(ref.videoId, ref.start)} className="shrink-0 overflow-hidden rounded-xl">
            <VideoThumb id={ref.videoId} className="h-[72px] w-[128px]" />
          </a>
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[19px] font-semibold leading-snug text-ink-950">{videoLabel(v)}</h2>
            <p className="mt-1 font-mono text-[10.5px] text-ink-600">
              {[
                v.course?.name,
                v.exercises.length ? plural(v.exercises.length, "exercise") : "no practice yet",
                ref.start ? `from ${formatTimestamp(ref.start)}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <a
            href={videoHash(ref.videoId, ref.start)}
            className="shrink-0 rounded-full bg-accent px-4 py-2 text-[12.5px] font-bold text-ink-950 shadow-sm transition hover:bg-accent-bright active:scale-[.97]"
          >
            Watch here →
          </a>
        </div>
      </section>
    );
  }

  const course = findCourseByPlaylistId(ref.playlistId);
  const summary = course ? getCourseSummary(course.id) : undefined;
  return (
    <section className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-accent/45 shadow-sm">
      <p className="label text-ink-600">Playlist link recognised</p>
      {summary ? (
        <div className="mt-4">
          <CourseCard s={summary} />
        </div>
      ) : (
        <>
          <h2 className="mt-2 font-serif text-[20px] font-semibold text-ink-950">
            That playlist is not in the catalog yet
          </h2>
          <p className="mt-2 max-w-prose text-[14px] leading-6 text-ink-700">
            Paste a link to one of its <em>lectures</em> instead and you can start watching here immediately — the
            lecture page is where the first exercise for it gets written.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={youtubePlaylistUrl(ref.playlistId)} target="_blank" rel="noreferrer noopener" className={PILL}>
              Open the playlist on YouTube ↗
            </a>
            <a href={exploreHome} className={PILL}>
              Browse the courses we have
            </a>
          </div>
          <p className="mt-3 font-mono text-[10px] text-ink-500">list: {ref.playlistId}</p>
        </>
      )}
    </section>
  );
}

/* ── views ───────────────────────────────────────────────────────────────── */

function HomeSections() {
  return (
    <>
      <Section title="Lectures" hint={`${videosWithExercises.length} with practice`}>
        <div className="grid gap-3 sm:grid-cols-2">
          {videosWithExercises.map((v) => (
            <LectureCard key={v.id} v={v} />
          ))}
        </div>
      </Section>
      <Section title="Courses" hint={`${courseSummaries.length} in the catalog`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {courseSummaries.map((s, i) => (
            <CourseCard key={s.course.id} s={s} stroke={i} />
          ))}
        </div>
      </Section>
      <Section title="Fields" hint="browse by subject">
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldSummaries.map((f, i) => (
            <FieldCard key={f.name} f={f} i={i} />
          ))}
        </div>
      </Section>
      <Section title="Levels">
        <div className="flex flex-wrap gap-2">
          {levelSummaries.map((l) => (
            <a key={l.name} href={levelHash(l.name)} className={PILL}>
              {l.name}
              <span className="font-mono text-[10px] tabular-nums text-ink-600">{l.exercises.length}</span>
            </a>
          ))}
        </div>
      </Section>
      <Section title="Concepts" hint={`${conceptCounts.length} across all exercises`}>
        <div className="flex flex-wrap gap-1.5">
          {conceptCounts.map((c) => (
            <ConceptChip key={c.name} name={c.name} count={c.count} />
          ))}
        </div>
      </Section>
      <Section title="Contributors" hint={`${contributorCounts.length}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contributorCounts.map((p) => (
            <PersonCard key={p.name} handle={p.name} count={p.count} />
          ))}
        </div>
      </Section>
    </>
  );
}

function SearchResults({ q }: { q: string }) {
  const link = useMemo(() => parseYouTubeRef(q), [q]);
  const res = useMemo(() => searchCatalog(q), [q]);

  // a pasted link is an address, not a query: resolve it, don't rank it
  if (link) return <PastedLink q={q} />;

  if (!res.total) {
    return (
      <div className="mt-16 text-center">
        <span aria-hidden className="text-2xl text-accent"><Star /></span>
        <p className="mt-3 font-serif text-xl font-semibold text-ink-950">Nothing matches “{q.trim()}”</p>
        <p className="mt-1 text-[13px] text-ink-700">
          Try a lecture title, a concept, a course name, a field, a contributor's handle — or paste a YouTube link.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-1.5">
          {conceptCounts.slice(0, 8).map((c) => (
            <ConceptChip key={c.name} name={c.name} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="mt-6 text-[13px] text-ink-700">
        <span className="font-semibold tabular-nums text-ink-950">{res.total}</span> result{res.total === 1 ? "" : "s"} for{" "}
        <span className="font-serif italic">“{q.trim()}”</span>
      </p>
      {res.videos.length > 0 && (
        <Section title="Lectures" hint={`${res.videos.length}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {res.videos.map((v) => (
              <LectureCard key={v.id} v={v} />
            ))}
          </div>
        </Section>
      )}
      {res.courses.length > 0 && (
        <Section title="Courses & playlists" hint={`${res.courses.length}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            {res.courses.map((c, i) => {
              const s = getCourseSummary(c.id);
              return s ? <CourseCard key={c.id} s={s} stroke={i} /> : null;
            })}
          </div>
        </Section>
      )}
      {res.concepts.length > 0 && (
        <Section title="Concepts" hint={`${res.concepts.length}`}>
          <div className="flex flex-wrap gap-1.5">
            {res.concepts.map((c) => (
              <ConceptChip key={c.name} name={c.name} count={c.count} />
            ))}
          </div>
        </Section>
      )}
      {res.people.length > 0 && (
        <Section title="Contributors" hint={`${res.people.length}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {res.people.map((p) => (
              <PersonCard key={p.name} handle={p.name} count={p.count} />
            ))}
          </div>
        </Section>
      )}
      {res.exercises.length > 0 && (
        <Section title="Exercises" hint={`${res.exercises.length}`}>
          <ul className="space-y-1">
            {res.exercises.map((e) => (
              <ExerciseLine key={e.meta.id} e={e} />
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function CourseView({ id }: { id: string }) {
  const s = getCourseSummary(id);
  const fallback = useMemo(() => exercises.filter((e) => e.meta.course === id), [id]);
  const exs = s?.exercises ?? fallback;
  const lectures = useMemo(() => lecturesForCourse(id), [id]);
  if (!s && !exs.length) return <Missing label={`No course “${id}” in the catalog.`} />;
  const c = s?.course ?? null;
  const people = s?.contributors ?? tallyAuthors(exs);
  const concepts = s?.concepts ?? tallyConcepts(exs);

  return (
    <article className="mt-8">
      <p className="label text-ink-600">Course</p>
      <h1 className="mt-1 font-serif text-[30px] font-semibold leading-tight tracking-[-0.015em] text-ink-950 sm:text-[36px]">
        {c?.name ?? id}
      </h1>
      <div
        aria-hidden
        className="mt-2.5 h-[3px] w-16 rounded-full"
        style={{ background: "linear-gradient(90deg, #26418f, #c39422)" }}
      />
      {(c?.institution || c?.creator) && (
        <p className="mt-3 text-[14px] text-ink-700">{[c?.institution, c?.creator].filter(Boolean).join(" · ")}</p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {c?.field && (
          <a href={fieldHash(c.field)} className={PILL}>
            {c.field}
          </a>
        )}
        {c?.level && (
          <a href={levelHash(c.level)} className={PILL}>
            {c.level}
          </a>
        )}
        {c?.playlist_url && (
          <a href={c.playlist_url} target="_blank" rel="noreferrer noopener" className={PILL}>
            {c.platform === "youtube" ? "YouTube playlist" : "Playlist"} ↗
          </a>
        )}
        <span className="font-mono text-[11px] tabular-nums text-ink-600">
          {plural(lectures.length, "lecture")} · {plural(exs.length, "exercise")}
        </span>
      </div>

      {lectures.length > 0 && (
        <Section title="Lectures" hint={`${lectures.length} · tap to watch with its practice`}>
          <ul className="space-y-1">
            {lectures.map((v, i) => (
              <LectureRow key={v.id} v={v} n={i + 1} />
            ))}
          </ul>
        </Section>
      )}

      {people.length > 0 && (
        <Section title="Contributors" hint={`${people.length}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((p) => (
              <PersonCard key={p.name} handle={p.name} count={p.count} />
            ))}
          </div>
        </Section>
      )}
      {concepts.length > 0 && (
        <Section title="Concepts covered" hint={`${concepts.length}`}>
          <div className="flex flex-wrap gap-1.5">
            {concepts.map((cn) => (
              <ConceptChip key={cn.name} name={cn.name} count={cn.count} />
            ))}
          </div>
        </Section>
      )}
      <Section title="Exercises" hint={`${exs.length}`}>
        <ul className="space-y-1">
          {exs.map((e) => (
            <ExerciseLine key={e.meta.id} e={e} showCourse={false} />
          ))}
        </ul>
      </Section>
    </article>
  );
}

function FacetView({ kind, name }: { kind: "field" | "level"; name: string }) {
  const f = (kind === "field" ? fieldSummaries : levelSummaries).find((x) => x.name === name);
  if (!f || (!f.exercises.length && !f.courses.length)) {
    return <Missing label={`Nothing catalogued under “${name}” yet.`} />;
  }
  const people = tallyAuthors(f.exercises);
  const lectures = useMemo(
    () => [...new Set(f.exercises.map((e) => e.meta.video_id).filter(Boolean))].map(getVideo),
    [f],
  );
  return (
    <article className="mt-8">
      <p className="label text-ink-600">{kind === "field" ? "Field" : "Level"}</p>
      <h1 className="mt-1 font-serif text-[30px] font-semibold leading-tight tracking-[-0.015em] text-ink-950 sm:text-[36px]">
        {name}
      </h1>
      <div
        aria-hidden
        className="mt-2.5 h-[3px] w-16 rounded-full"
        style={{ background: "linear-gradient(90deg, #2f6b52, #c39422)" }}
      />
      <p className="mt-3 font-mono text-[11px] tabular-nums text-ink-600">
        {plural(f.exercises.length, "exercise")} · {plural(f.courses.length, "course")} ·{" "}
        {plural(people.length, "contributor")}
      </p>
      {lectures.length > 0 && (
        <Section title="Lectures" hint={`${lectures.length}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {lectures.map((v) => (
              <LectureCard key={v.id} v={v} />
            ))}
          </div>
        </Section>
      )}
      {f.courses.length > 0 && (
        <Section title="Courses" hint={`${f.courses.length}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            {f.courses.map((c, i) => {
              const s = getCourseSummary(c.id);
              return s ? <CourseCard key={c.id} s={s} stroke={i} /> : null;
            })}
          </div>
        </Section>
      )}
      {people.length > 0 && (
        <Section title="Contributors" hint={`${people.length}`}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((p) => (
              <PersonCard key={p.name} handle={p.name} count={p.count} />
            ))}
          </div>
        </Section>
      )}
      {f.exercises.length > 0 && (
        <Section title="Exercises" hint={`${f.exercises.length}`}>
          <ul className="space-y-1">
            {f.exercises.map((e) => (
              <ExerciseLine key={e.meta.id} e={e} />
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}

/* ── the page ────────────────────────────────────────────────────────────── */

export default function ExplorePage({ view, workspaceHref }: { view: ExploreView; workspaceHref: string | null }) {
  const viewKey = viewHash(view);
  const [q, setQ] = useState(view.type === "search" ? view.q : "");
  const scrollRef = useRef<HTMLDivElement>(null);

  // external navigation (chip taps, back/forward) resyncs the box; typing does
  // not re-trigger this because typing only replaceState()s the URL.
  useEffect(() => {
    setQ(view.type === "search" ? view.q : "");
    scrollRef.current?.scrollTo({ top: 0 });
  }, [viewKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onQuery = (next: string) => {
    // A YouTube link in the search box is an address. Resolve it the moment it
    // becomes valid: lectures go to the lecture, playlists we own go to the
    // course, anything else falls through to the search view's PastedLink card.
    const link = parseYouTubeRef(next);
    if (link) {
      if (link.kind === "video") {
        setQ("");
        location.hash = videoHash(link.videoId, link.start);
        return;
      }
      const course = findCourseByPlaylistId(link.playlistId);
      if (course) {
        setQ("");
        location.hash = courseHash(course.id);
        return;
      }
    }
    setQ(next);
    // keep the URL shareable without flooding history while typing
    const target = next.trim() ? searchHash(next) : view.type === "search" ? exploreHome : viewKey;
    history.replaceState(null, "", target);
  };

  const showing: ExploreView = q.trim()
    ? { type: "search", q }
    : view.type === "search"
      ? { type: "home" }
      : view;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className="relative z-30 flex h-11 shrink-0 items-center gap-2.5 bg-ink-950 px-3"
        style={{ backgroundImage: nightRailBg(), backgroundSize: "cover" }}
      >
        <a href={homeHash} className="flex shrink-0 items-center gap-2 pr-1" title="understudy">
          <Brand />
        </a>
        <a href={exploreHome} className="label rounded px-1 py-0.5 text-ink-500 transition-colors hover:text-zinc-300">
          Explore
        </a>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <a
            href={contributeHash()}
            title="Write an exercise, in the app"
            className="rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            Contribute
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

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-slim">
        {view.type === "home" ? (
          /* The home hero stays mounted while typing — `showing` only swaps the
             content BELOW it — so the search input never loses focus on the
             first keystroke. */
          <>
            {/* the catalog's own night sky; the search floats where it meets the paper */}
            <div className="relative">
              <CatalogSky
                exercises={exercises}
                seed="understudy · explore"
                className="min-h-[280px] sm:min-h-[340px]"
                label="The Understudy catalog, painted as a night sky: one star per exercise"
                bounds={{ top: 0.06, bottom: 0.82 }}
                avoid={{ x0: 0.16, y0: 0.1, x1: 0.84, y1: 1.0 }}
                interactive
              />
              <Horizon className="h-[44px] sm:h-[56px]" />
              {/* a feathered pool of night under the words — the painting keeps
                  its edges, the text gets a quiet patch of sky to sit on */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(ellipse 78% 68% at 50% 32%, rgba(10,14,30,0.66), rgba(10,14,30,0.32) 55%, transparent 78%)",
                }}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start px-5 pt-8 text-center sm:pt-12">
                <h1 className="font-serif text-[30px] font-semibold leading-tight tracking-[-0.015em] text-white [text-shadow:0_2px_18px_rgba(13,19,48,0.9)] sm:text-[40px]">
                  Practice what you watch.
                </h1>
                <p className="mt-2 font-mono text-[11px] tabular-nums text-zinc-100 [text-shadow:0_1px_10px_rgba(13,19,48,0.9)] sm:text-[12px]">
                  {catalogStats.lectures} lecture{catalogStats.lectures === 1 ? "" : "s"} ·{" "}
                  {catalogStats.exercises} exercise{catalogStats.exercises === 1 ? "" : "s"} ·{" "}
                  {catalogStats.courses} course{catalogStats.courses === 1 ? "" : "s"} ·{" "}
                  {catalogStats.contributors} contributor{catalogStats.contributors === 1 ? "" : "s"}
                </p>
                <div className="pointer-events-auto mt-6 w-full max-w-xl sm:mt-8">
                  <SearchBox value={q} onChange={onQuery} large />
                </div>
                <p className="mt-2 font-mono text-[10px] text-zinc-300 [text-shadow:0_1px_10px_rgba(13,19,48,0.9)]">
                  already watching something? paste the link
                </p>
              </div>
            </div>
            <div className="mx-auto max-w-5xl px-5 pb-20 sm:px-8">
              {showing.type === "search" ? <SearchResults q={showing.q} /> : <HomeSections />}
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-5xl px-5 pb-20 pt-6 sm:px-8">
            <div className="max-w-xl">
              <SearchBox value={q} onChange={onQuery} />
            </div>
            {/* clearing a navigated search lands back on the browsable catalog */}
            {showing.type === "home" && <HomeSections />}
            {showing.type === "search" && <SearchResults q={showing.q} />}
            {showing.type === "course" && <CourseView id={showing.id} />}
            {showing.type === "field" && <FacetView kind="field" name={showing.name} />}
            {showing.type === "level" && <FacetView kind="level" name={showing.name} />}
          </div>
        )}
      </div>
    </div>
  );
}
