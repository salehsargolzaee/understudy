import { useMemo } from "react";
import { exercises as allExercises } from "../content";
import type { Exercise } from "../content";
import { getContributor } from "../lib/contributors";
import type { ContributorProfile, CourseContribution } from "../lib/contributors";
import { githubUrl } from "../lib/github";
import { nightRailBg } from "../lib/nightRail";
import { courseHash, exerciseHash, exploreHome, searchHash } from "../lib/routes";
import Avatar from "./Avatar";
import Brand from "./Brand";
import ConceptChip from "./ConceptChip";
import StarryHero from "./StarryHero";
/**
 * Contributor profile: the public record of what a handle has authored.
 * Contribution only — nothing here reads completion or practice data.
 * Same visual grammar as the workspace: dark frame, one paper surface.
 */
const PALETTE = ["#26418f", "#2f6b52", "#3f74c0", "#c39422", "#6b5b95"];
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline gap-2">
        {/* a starlight mark leads each section so the page scans */}
        <span aria-hidden className="text-[11px] leading-none text-accent">
          ✦
        </span>
        <h2 className="label text-[11px] text-ink-800">{title}</h2>
        {hint && <span className="font-mono text-[10px] text-ink-600">{hint}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
/** Fields as orbits: each field is an arc around a star; its sweep is its
 *  share of this contributor's work. */
function FieldOrbits({ fields, total }: { fields: { name: string; count: number }[]; total: number }) {
  const shown = fields.slice(0, 5);
  const size = 260;
  const c = size / 2;
  const arc = (i: number, pct: number) => {
    const rr = 42 + i * 26;
    const start = (140 * Math.PI) / 180;
    const sweep = Math.max(0.5, pct * 5.2); // radians, ~298° for 100%
    const end = start + sweep;
    const x1 = c + rr * Math.cos(start);
    const y1 = c + rr * Math.sin(start);
    const x2 = c + rr * Math.cos(end);
    const y2 = c + rr * Math.sin(end);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rr} ${rr} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  return (
    <div className="flex flex-wrap items-center gap-x-10 gap-y-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
        {shown.map((f, i) => (
          <circle key={`t-${f.name}`} cx={c} cy={c} r={42 + i * 26} fill="none" stroke="#10162e" strokeOpacity="0.07" strokeWidth="1" />
        ))}
        {shown.map((f, i) => (
          <path
            key={f.name}
            d={arc(i, f.count / total)}
            fill="none"
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth="13"
            strokeLinecap="round"
            opacity="0.9"
          />
        ))}
        {/* the star at the centre of the orbits */}
        <circle cx={c} cy={c} r="17" fill="#c39422" opacity="0.16" />
        <circle cx={c} cy={c} r="9" fill="#e0b64a" opacity="0.45" />
        <circle cx={c} cy={c} r="4" fill="#f6e29b" />
      </svg>
      <ul className="min-w-[220px] flex-1 space-y-3">
        {shown.map((f, i) => (
          <li key={f.name} className="flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink-900">{f.name}</span>
            <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-ink-700">
              {f.count} · {Math.round((f.count / total) * 100)}%
            </span>
          </li>
        ))}
        {fields.length > shown.length && (
          <li className="text-[11px] text-ink-600">+ {fields.length - shown.length} more fields</li>
        )}
      </ul>
    </div>
  );
}
function ExerciseRow({ e }: { e: Exercise }) {
  return (
    <li className="group relative flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-ink-900/[0.03]">
      {/* full-row underlay: the whole row opens the exercise; the concept chips
          sit above it and navigate independently */}
      <a
        href={exerciseHash(e.meta.id)}
        className="absolute inset-0 z-0"
        aria-label={e.meta.concept || e.meta.id}
      />
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
      <span className="relative z-10 hidden shrink-0 items-center gap-1.5 md:flex">
        {e.meta.concepts.slice(0, 3).map((c) => (
          <ConceptChip key={c} name={c} small />
        ))}
      </span>
      <span aria-hidden className="shrink-0 text-ink-500 transition-transform group-hover:translate-x-0.5">
        →
      </span>
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
        <h3 className="font-serif text-[20px] font-semibold leading-snug text-ink-950">
          {cc.course ? (
            <a href={courseHash(cc.course.id)} title="View this course in the catalog" className="transition-colors hover:text-verd">
              {name}
            </a>
          ) : (
            name
          )}
        </h3>
        {/* a short brushstroke instead of a card border */}
        <div
          aria-hidden
          className="mt-1.5 h-[3px] w-12 rounded-full"
          style={{ background: "linear-gradient(90deg, #26418f, #c39422)" }}
        />
        <p className="mt-2 text-[12.5px] text-ink-700">
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
              <p className="label mt-1.5 flex items-center gap-1 text-ink-700">
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
        <FieldOrbits fields={profile.fields} total={fieldTotal} />
        {profile.levels.length > 0 && (
          <p className="mt-5 font-mono text-[11px] text-ink-700">
            Levels: {profile.levels.map((l) => `${l.name} ×${l.count}`).join(" · ")}
          </p>
        )}
      </Section>
      {/* concepts */}
      <Section
        title="Concepts taught"
        hint={`${profile.concepts.length} distinct${profile.untagged ? ` · ${profile.untagged} untagged` : ""}`}
      >
        {/* still a line of thought, but every concept is now visibly a door:
            viridian link color, dotted underline, warms to gold on hover.
            Tapping one runs the catalog search for that concept. */}
        <p className="max-w-2xl font-serif text-[18px] leading-8 text-ink-950">
          {profile.concepts.map((c, i) => (
            <span key={c.name}>
              {/* the separator carries real spaces so the line can wrap */}
              {i > 0 && <span className="text-accent">{" · "}</span>}
              <a
                href={searchHash(c.name)}
                title={`Search the catalog for “${c.name.replace(/-/g, " ")}”`}
                className="whitespace-nowrap rounded-sm text-verd underline decoration-verd/40 decoration-dotted underline-offset-4 transition-colors hover:bg-accent-soft hover:text-ink-950 hover:decoration-accent/70"
              >
                {c.name.replace(/-/g, " ")}
                {c.count > 1 && <sup className="ml-0.5 font-sans text-[10px] text-ink-600">{c.count}</sup>}
              </a>
            </span>
          ))}
        </p>
        {profile.untagged > 0 && (
          <p className="mt-3 text-[11.5px] text-ink-700">
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
      <footer className="mt-14 border-t border-ink-900/10 pt-4">
        <p className="text-[12px] text-ink-700">
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
      <header
        className="flex h-11 shrink-0 items-center gap-2.5 bg-ink-950 px-3"
        style={{ backgroundImage: nightRailBg(), backgroundSize: "cover" }}
      >
        <a href={exploreHome} className="flex shrink-0 items-center gap-2 pr-1" title="Explore the catalog">
          <Brand />
        </a>
        <span className="label text-ink-600">Contributor profile</span>
        <div className="ml-auto flex items-center gap-1">
          <a
            href={exploreHome}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            <span aria-hidden className="text-[11px] text-accent-bright">✦</span>
            <span className="hidden sm:inline">Explore</span>
          </a>
          <a
            href={backHref}
            className="rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white"
          >
            ← Back
          </a>
        </div>
      </header>
      {/* The profile floats directly on the site's canvas — no framed surface. */}
      <div className="min-h-0 flex-1 overflow-y-auto scroll-slim">
        {profile ? <ProfileBody profile={profile} /> : <EmptyProfile handle={handle} />}
      </div>
    </div>
  );
}
