import { useMemo } from "react";
import { exercises as allExercises } from "../content";
import type { Exercise } from "../content";
import { getContributor } from "../lib/contributors";
import type { ContributorProfile, CourseContribution } from "../lib/contributors";
import { githubUrl } from "../lib/github";
import Avatar from "./Avatar";
/**
 * Contributor profile: the public record of what a handle has authored.
 * Contribution only — nothing here reads completion or practice data.
 * Same visual grammar as the workspace: dark frame, one paper surface.
 */
const PALETTE = ["#b45309", "#2f7d55", "#3d5a80", "#7b4b94", "#946b2d", "#5b564c"];
const exerciseHash = (id: string) => `#/e/${encodeURIComponent(id)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-2">
        <h2 className="label text-ink-600">{title}</h2>
        {hint && <span className="font-mono text-[10px] text-ink-500">{hint}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
function ExerciseRow({ e }: { e: Exercise }) {
  return (
    <li>
      <a
        href={exerciseHash(e.meta.id)}
        className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ink-900/[0.03]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink-950">
            {e.meta.concept || e.meta.id}
          </span>
          <span className="block truncate font-mono text-[10px] text-ink-500">{e.meta.id}</span>
        </span>
        {e.meta.demo && (
          <span className="label hidden shrink-0 rounded bg-ink-900/[0.05] px-1.5 py-0.5 text-[9px] text-ink-500 sm:inline">
            demo
          </span>
        )}
        {e.meta.concepts.slice(0, 3).map((c) => (
          <span
            key={c}
            className="hidden shrink-0 rounded-full bg-ink-900/[0.05] px-2 py-0.5 font-mono text-[9.5px] text-ink-600 md:inline"
          >
            {c}
          </span>
        ))}
        <span className="shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5" aria-hidden>
          →
        </span>
      </a>
    </li>
  );
}
function CourseCard({ cc }: { cc: CourseContribution }) {
  const name = cc.course?.name ?? (cc.courseId || "Uncatalogued exercises");
  const subtitle = cc.course
    ? [cc.course.institution, cc.course.creator].filter(Boolean).join(" · ")
    : "Exercises that predate the course catalogue";
  return (
    <article className="overflow-hidden rounded-xl border border-ink-900/[0.08] bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-ink-900/[0.06] px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-serif text-[17px] font-semibold leading-snug text-ink-950">{name}</h3>
          {subtitle && <p className="truncate text-[12px] text-ink-600">{subtitle}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {cc.course?.level && (
            <span className="label rounded bg-ink-900/[0.05] px-1.5 py-0.5 text-[9px] text-ink-600">
              {cc.course.level}
            </span>
          )}
          {cc.course?.field && (
            <span className="label hidden rounded bg-ink-900/[0.05] px-1.5 py-0.5 text-[9px] text-ink-600 sm:inline">
              {cc.course.field}
            </span>
          )}
          <span className="label rounded bg-accent-soft px-1.5 py-0.5 text-[9px] text-accent">
            {plural(cc.exercises.length, "exercise")}
          </span>
        </span>
      </header>
      <ul className="divide-y divide-ink-900/[0.05]">
        {cc.exercises.map((e) => (
          <ExerciseRow key={e.meta.id} e={e} />
        ))}
      </ul>
    </article>
  );
}
function ProfileBody({ profile }: { profile: ContributorProfile }) {
  const total = profile.exercises.length;
  const catalogued = profile.courses.filter((c) => c.courseId).length;
  const share = allExercises.length ? Math.round((total / allExercises.length) * 100) : 0;
  const fieldTotal = profile.fields.reduce((a, f) => a + f.count, 0) || 1;
  const stats = [
    { label: "Exercises", value: total, hint: "Exercises you have authored." },
    {
      label: "Courses",
      value: catalogued || profile.courses.length,
      hint: "Distinct courses you have written at least one exercise for. It does not mean the course is finished.",
    },
    { label: "Videos", value: profile.videos, hint: "Distinct lectures you have written at least one exercise for." },
    { label: "Concepts", value: profile.concepts.length, hint: "Distinct concept tags across your authored exercises." },
    { label: "Fields", value: profile.fields.length, hint: "Distinct subject fields your exercises fall under." },
  ];
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
      {/* identity */}
      <header className="flex flex-wrap items-center gap-4">
        <Avatar handle={profile.handle} px={72} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-[28px] font-semibold leading-tight tracking-[-0.01em] text-ink-950">
            @{profile.handle}
          </h1>
          <p className="mt-0.5 text-[13px] leading-5 text-ink-700">
            Contributor · {plural(total, "exercise")} across {plural(profile.videos, "video")} in {plural(catalogued || profile.courses.length, "course")}
            {allExercises.length > 0 && <span className="text-ink-500"> · {share}% of everything on this site</span>}
          </p>
        </div>
        <a
          href={githubUrl(profile.handle)}
          target="_blank"
          rel="noreferrer noopener"
          className="shrink-0 rounded-md border border-ink-900/15 px-3 py-1.5 text-[12px] font-medium text-ink-800 transition-colors hover:border-accent/60 hover:bg-accent-soft/60 hover:text-ink-950"
        >
          GitHub ↗
        </a>
      </header>
      {/* headline numbers */}
      <section className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            title={s.hint}
            className="cursor-help rounded-xl border border-ink-900/[0.08] bg-white px-4 py-3"
          >
            <p className="font-serif text-[30px] font-semibold leading-none tabular-nums text-ink-950">{s.value}</p>
            <p className="label mt-1.5 text-ink-500 underline decoration-dotted decoration-ink-900/20 underline-offset-2">
              {s.label}
            </p>
          </div>
        ))}
      </section>
      {/* spread across fields */}
      <Section title="Across fields">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-900/[0.06]">
          {profile.fields.map((f, i) => (
            <div
              key={f.name}
              title={`${f.name}: ${f.count}`}
              style={{ width: `${(f.count / fieldTotal) * 100}%`, background: PALETTE[i % PALETTE.length] }}
            />
          ))}
        </div>
        <ul className="mt-3 space-y-1.5">
          {profile.fields.map((f, i) => (
            <li key={f.name} className="flex items-center gap-2 text-[13px] text-ink-800">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: PALETTE[i % PALETTE.length] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-600">
                {f.count} · {Math.round((f.count / fieldTotal) * 100)}%
              </span>
            </li>
          ))}
        </ul>
        {profile.levels.length > 0 && (
          <p className="mt-3 font-mono text-[11px] text-ink-500">
            Levels: {profile.levels.map((l) => `${l.name} ×${l.count}`).join(" · ")}
          </p>
        )}
      </Section>
      {/* concepts */}
      <Section
        title="Concepts taught"
        hint={`${profile.concepts.length} distinct${profile.untagged ? ` · ${profile.untagged} untagged` : ""}`}
      >
        <div className="flex flex-wrap gap-1.5">
          {profile.concepts.map((c) => (
            <span
              key={c.name}
              className="rounded-full border border-ink-900/10 bg-white px-2.5 py-1 font-mono text-[11px] text-ink-800"
            >
              {c.name}
              {c.count > 1 && <span className="ml-1 text-ink-500">×{c.count}</span>}
            </span>
          ))}
        </div>
        {profile.untagged > 0 && (
          <p className="mt-3 text-[11px] text-ink-500">
            {profile.untagged} exercise{profile.untagged > 1 ? "s" : ""} not tagged with concepts yet.
          </p>
        )}
      </Section>
      {/* courses + the work itself */}
      <Section title="Courses contributed to">
        <div className="space-y-4">
          {profile.courses.map((cc) => (
            <CourseCard key={cc.courseId || "uncatalogued"} cc={cc} />
          ))}
        </div>
      </Section>
      <footer className="mt-12 border-t border-ink-900/[0.08] pt-4">
        <p className="text-[12px] text-ink-500">
          Everything above was authored and contributed by @{profile.handle}. Authoring exercises is how this record
          grows.
        </p>
      </footer>
    </div>
  );
}
function EmptyProfile({ handle }: { handle: string }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <div className="mx-auto w-fit">
          <Avatar handle={handle} px={64} />
        </div>
        <p className="mt-4 font-serif text-xl font-semibold text-ink-950">@{handle}</p>
        <p className="mt-1 text-sm text-ink-600">No exercises authored here yet.</p>
        <a
          href={githubUrl(handle)}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-block text-sm text-accent underline underline-offset-2"
        >
          View on GitHub
        </a>
      </div>
    </div>
  );
}
export default function ProfilePage({ handle, backHref }: { handle: string; backHref: string }) {
  const profile = useMemo(() => getContributor(handle), [handle]);
  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950">
      <header className="flex h-11 shrink-0 items-center gap-2.5 px-3">
        <a href={backHref} className="flex shrink-0 items-center gap-2 pr-1" title="Back to exercises">
          <span className="h-4 w-4 rounded bg-accent" aria-hidden />
          <span className="hidden font-serif text-[15px] tracking-tight text-zinc-100 sm:block">TBD</span>
        </a>
        <span className="label text-ink-600">Contributor profile</span>
        <a
          href={backHref}
          className="ml-auto rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          ← Back to exercises
        </a>
      </header>
      <div className="min-h-0 flex-1 p-1.5 pt-0">
        <div className="h-full overflow-y-auto rounded-lg bg-paper ring-1 ring-white/[0.06] scroll-slim">
          {profile ? <ProfileBody profile={profile} /> : <EmptyProfile handle={handle} />}
        </div>
      </div>
    </div>
  );
}
