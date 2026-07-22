import { useMemo } from "react";
import { exercises as allExercises } from "../content";
import type { Exercise } from "../content";
import { getContributor } from "../lib/contributors";
import type { ContributorProfile, CourseContribution } from "../lib/contributors";
import { githubUrl } from "../lib/github";
import Avatar from "./Avatar";
import Brand from "./Brand";
import StarryHero from "./StarryHero";
/**
 * Contributor profile: the public record of what a handle has authored.
 * Contribution only — nothing here reads completion or practice data.
 * Same visual grammar as the workspace: dark frame, one paper surface.
 */
const PALETTE = ["#26418f", "#2f6b52", "#3f74c0", "#c79a3e", "#6b5b95", "#8a5a3c"];
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
    <article>
      <header>
        <h3 className="font-serif text-[20px] font-semibold leading-snug text-ink-950">{name}</h3>
        {/* a short brushstroke instead of a card border */}
        <div
          aria-hidden
          className="mt-1.5 h-[3px] w-12 rounded-full"
          style={{ background: "linear-gradient(90deg, #26418f, #2f6b52)" }}
        />
        <p className="mt-2 text-[12.5px] text-ink-600">
          {[subtitle, cc.course?.level, cc.course?.field, plural(cc.exercises.length, "exercise")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      <ul className="mt-2 divide-y divide-ink-900/[0.06]">
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
    { label: "Exercises", value: total, hint: "Exercises this contributor has authored." },
    {
      label: "Courses",
      value: catalogued || profile.courses.length,
      hint: "Distinct courses this contributor has written at least one exercise for. It does not mean the course is finished.",
    },
    {
      label: "Videos",
      value: profile.videos,
      hint: "Distinct lectures this contributor has written at least one exercise for.",
    },
    { label: "Concepts", value: profile.concepts.length, hint: "Distinct concept tags across their exercises." },
    { label: "Fields", value: profile.fields.length, hint: "Distinct subject fields their exercises fall under." },
  ];
  return (
    <div>
      {/* The contributor's work as a night sky, dissolving into the site's canvas */}
      <StarryHero handle={profile.handle} />
      <div className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        {/* identity emerges where the night meets the paper */}
        <header className="relative -mt-24 sm:-mt-28">
          <span className="inline-block rounded-full shadow-md ring-4 ring-paper">
            <Avatar handle={profile.handle} px={72} />
          </span>
          <h1 className="mt-3 font-serif text-[36px] font-semibold leading-tight tracking-[-0.015em] text-ink-950 sm:text-[44px]">
            @{profile.handle}
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-6 text-ink-700">
            Turned {plural(profile.videos, "lecture")} into {plural(total, "exercise")}, across{" "}
            {plural(catalogued || profile.courses.length, "course")} and {plural(profile.fields.length, "field")}.
            {allExercises.length > 0 && <span className="text-ink-500"> {share}% of everything here.</span>}{" "}
            <a
              href={githubUrl(profile.handle)}
              target="_blank"
              rel="noreferrer noopener"
              className="whitespace-nowrap font-medium text-accent underline underline-offset-2"
            >
              GitHub ↗
            </a>
          </p>
        </header>
        {/* headline numbers: no tiles, just the numbers in the flow of the page */}
        <section className="mt-10 flex flex-wrap gap-x-10 gap-y-5">
          {stats.map((s) => (
            <div key={s.label} className="group relative">
              <p className="font-serif text-[34px] font-semibold leading-none tabular-nums text-ink-950">{s.value}</p>
              <p className="label mt-1.5 flex items-center gap-1 text-ink-500">
                {s.label}
                <span
                  aria-hidden
                  className="grid h-3 w-3 place-items-center rounded-full border border-ink-900/25 font-sans text-[8px] font-bold leading-none text-ink-500/80"
                >
                  i
                </span>
              </p>
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-ink-950 px-3 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-zinc-100 shadow-lg group-hover:block"
              >
                {s.hint}
                <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink-950" />
              </span>
            </div>
          ))}
        </section>
      {/* spread across fields */}
      <Section title="Across fields">
        {/* each field is a brushstroke; its length is its share of the work */}
        <div className="max-w-xl space-y-3.5">
          {profile.fields.map((f, i) => {
            const pct = Math.round((f.count / fieldTotal) * 100);
            return (
              <div key={f.name}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate text-ink-800">{f.name}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-500">
                    {f.count} · {pct}%
                  </span>
                </div>
                <div
                  className="mt-1.5 h-[7px] rounded-full"
                  style={{
                    width: `${pct}%`,
                    minWidth: "3rem",
                    background: `linear-gradient(90deg, ${PALETTE[i % PALETTE.length]}, ${PALETTE[(i + 2) % PALETTE.length]})`,
                    opacity: 0.85,
                  }}
                />
              </div>
            );
          })}
        </div>
        {profile.levels.length > 0 && (
          <p className="mt-4 font-mono text-[11px] text-ink-500">
            Levels: {profile.levels.map((l) => `${l.name} ×${l.count}`).join(" · ")}
          </p>
        )}
      </Section>
      {/* concepts */}
      <Section
        title="Concepts taught"
        hint={`${profile.concepts.length} distinct${profile.untagged ? ` · ${profile.untagged} untagged` : ""}`}
      >
        {/* concepts read as a line of thought, not a wall of capsules */}
        <p className="max-w-2xl font-serif text-[17px] leading-8 text-ink-800">
          {profile.concepts.map((c, i) => (
            <span key={c.name}>
              {/* the separator carries real spaces so the line can wrap */}
              {i > 0 && <span className="text-ink-900/25">{" · "}</span>}
              <span className="whitespace-nowrap">
                {c.name.replace(/-/g, " ")}
                {c.count > 1 && <sup className="ml-0.5 font-sans text-[10px] text-ink-500">{c.count}</sup>}
              </span>
            </span>
          ))}
        </p>
        {profile.untagged > 0 && (
          <p className="mt-3 text-[11px] text-ink-500">
            {profile.untagged} exercise{profile.untagged > 1 ? "s" : ""} not tagged with concepts yet.
          </p>
        )}
      </Section>
      {/* courses + the work itself */}
      <Section title="Courses contributed to">
        <div className="space-y-10">
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
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center gap-2.5 bg-ink-950 px-3">
        <a href={backHref} className="flex shrink-0 items-center gap-2 pr-1" title="Back to exercises">
          <Brand />
        </a>
        <span className="label text-ink-600">Contributor profile</span>
        <a
          href={backHref}
          className="ml-auto rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          ← Back to exercises
        </a>
      </header>
      {/* The profile floats directly on the site's canvas — no framed surface. */}
      <div className="min-h-0 flex-1 overflow-y-auto scroll-slim">
        {profile ? <ProfileBody profile={profile} /> : <EmptyProfile handle={handle} />}
      </div>
    </div>
  );
}
