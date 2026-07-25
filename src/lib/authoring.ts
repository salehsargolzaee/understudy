import { stringify } from "yaml";
import { getExercise } from "../content";
import type { FileOut } from "./githubApi";
import { formatTimestamp } from "./youtube";

/*
 * The authoring flow's model: what a draft is, how it becomes the exact five
 * files the repo expects, and every rule of tools/validate_exercises.py that
 * is checkable without a Python interpreter. The browser proof (fail on
 * starter, pass on solution) lives in the page, next to the runner.
 */

export const ID_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const PACKAGE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*(\[[A-Za-z0-9,._-]+\])?([=<>!~]=?[0-9A-Za-z.*+!-]+)?$/;
const KNOWN_LEVELS = ["high-school", "undergraduate", "graduate", "professional"];

// the same sandbox rules the validator enforces, as JS regexes
const SANDBOX_ERRORS: [RegExp, string][] = [
  [
    /^\s*(?:import|from)\s+(subprocess|socket|ctypes|multiprocessing|pty|urllib|http|ftplib|smtplib|requests|httpx|aiohttp)\b/m,
    "network or process APIs",
  ],
  [/\bos\.(system|popen|fork|exec[lv]\w*|spawn\w*)\s*\(/, "process APIs"],
];
const DYNAMIC_IMPORT = /\b__import__\s*\(/;

export interface Finding {
  level: "error" | "warning" | "smell";
  code: string;
  message: string;
}

export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 49)
    .replace(/-+$/, "");
}

/** The slug rule derives the id; a catalog collision gets a numeric suffix. */
export function uniqueExerciseId(base: string): string {
  if (!base) return "";
  if (!getExercise(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base.slice(0, 46)}-${i}`;
    if (!getExercise(candidate)) return candidate;
  }
  return base;
}

export const splitList = (s: string) => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
export const testFileName = (id: string) => `test_${(id || "exercise").replace(/-/g, "_")}.py`;

export interface DraftInput {
  id: string;
  concept: string;
  concepts: string[];
  tags: string[];
  packages: string[];
  start: number;
  videoId: string;
  courseId: string;
  videoTitle: string;
  brief: string;
  starter: string;
  solution: string;
  tests: string;
  level: string;
}

export function validateDraft(d: DraftInput, courseExists: boolean): Finding[] {
  const out: Finding[] = [];
  const err = (code: string, message: string) => out.push({ level: "error", code, message });
  const warn = (code: string, message: string) => out.push({ level: "warning", code, message });
  const smell = (code: string, message: string) => out.push({ level: "smell", code, message });

  if (!d.concept.trim()) err("BAD_CONCEPT", "Name the exercise — the one line shown in menus and cards.");
  else if (d.concept.length > 120) warn("LONG_CONCEPT", "The name is over 120 characters; it will be truncated everywhere it appears.");
  if (d.concept.trim() && !ID_RE.test(d.id))
    err("BAD_ID", `The derived id “${d.id || "(empty)"}” is not a valid folder name. Use a name with at least two letters or digits in it.`);

  if (!d.concepts.length) err("BAD_CONCEPTS", "Add at least one concept slug — the catalog's facets. Reuse an existing one where you can.");
  const badSlugs = d.concepts.filter((c) => !SLUG_RE.test(c));
  if (badSlugs.length) err("BAD_CONCEPTS", `Concept slugs must be lowercase-hyphenated: ${badSlugs.join(", ")}`);

  if (!Number.isInteger(d.start) || d.start < 0) err("BAD_START", "The timestamp must be whole seconds, zero or more.");
  else if (d.start === 0) warn("START_AT_ZERO", "The timestamp is 0:00. Reviewers reject timestamps that point at the start of the video rather than the moment the idea is taught.");

  if (!VIDEO_ID_RE.test(d.videoId)) err("BAD_VIDEO_ID", "No valid lecture id. Start this flow from a lecture page, or paste a YouTube link.");
  if (!d.videoTitle.trim())
    warn("NO_TITLE", "The lecture's name could not be fetched here. The PR check fetches it from YouTube and requires the exact name — paste it in the field above to avoid a round trip.");

  if (!d.courseId || !courseExists)
    err("UNKNOWN_COURSE",
      d.courseId
        ? `This lecture claims course “${d.courseId}”, but there is no content/courses/${d.courseId}.yml.`
        : "This lecture's course is not in the catalog. A course is one small YAML file — add content/courses/<id>.yml by hand first (the guide shows the shape), or pick a catalogued lecture.");

  for (const spec of d.packages) {
    if (!PACKAGE_RE.test(spec)) err("BAD_PACKAGE", `“${spec}” is not a package spec the check will install.`);
  }
  if (d.level && !KNOWN_LEVELS.includes(d.level))
    warn("UNUSUAL_LEVEL", `“${d.level}” is a new level facet (known: ${KNOWN_LEVELS.join(", ")}).`);

  if (!d.starter.trim()) err("MISSING_FILE", "starter.py is empty.");
  if (!d.solution.trim()) err("MISSING_FILE", "solution.py is empty.");
  if (!d.tests.trim()) err("MISSING_TESTS", "The test file is empty.");
  if (d.starter.trim() && d.starter.trim() === d.solution.trim())
    err("STARTER_IS_SOLUTION", "starter.py and solution.py are the same file: the exercise ships already solved.");

  if (/^\s*(?:from|import)\s+solution\b/m.test(d.tests))
    err("TESTS_IMPORT_SOLUTION", "Tests import `solution`. Tests only ever see the learner's file, mounted as `submission`. Import from `submission`.");
  if (d.tests.trim() && !/^\s*def test_/m.test(d.tests))
    err("NO_TESTS", "No `def test_…` function found — pytest would collect nothing.");
  if (d.tests.trim() && !d.tests.includes("submission"))
    warn("TESTS_IGNORE_SUBMISSION", "The tests never mention `submission`, so they may not be testing the learner's code at all.");

  const scan = (name: string, source: string) => {
    for (const [re, what] of SANDBOX_ERRORS) {
      if (re.test(source))
        err("SANDBOX", `${name} uses ${what}. Exercise code runs in the learner's browser and on CI: pure computation only — no network, no subprocesses, no host access.`);
    }
    if (DYNAMIC_IMPORT.test(source)) warn("SANDBOX", `${name} uses __import__; the reviewer will ask why.`);
  };
  scan("starter.py", d.starter);
  scan("solution.py", d.solution);
  scan("the tests", d.tests);

  const prose = d.brief.replace(/```[\s\S]*?```/g, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  if (prose.length < 400)
    smell("THIN_BRIEF", `The brief is ${prose.length} characters of prose. The check won't block it, but a human will look closer: does it state the task, the input shapes, and what counts as correct?`);

  const testFns = (d.tests.match(/^\s*def test_/gm) ?? []).length;
  if (testFns > 0 && testFns < 3)
    smell("FEW_TESTS", `${testFns} test function${testFns === 1 ? "" : "s"}. Thin suites tend to accept wrong solutions; an edge case or an empty input usually earns its keep.`);

  return out;
}

export function buildFiles(d: DraftInput, author: string): FileOut[] {
  const dir = `content/${d.id}`;
  const nl = (s: string) => (s.endsWith("\n") ? s : s + "\n");
  const meta: Record<string, unknown> = {
    id: d.id,
    author,
    course: d.courseId,
    video_id: d.videoId,
    video_title: d.videoTitle,
    start: d.start,
    concept: d.concept,
    concepts: d.concepts,
  };
  if (d.tags.length) meta.tags = d.tags;
  meta.runtime = "pyodide";
  meta.packages = d.packages;
  if (d.level) meta.level = d.level;
  return [
    { path: `${dir}/meta.yml`, contents: stringify(meta) },
    { path: `${dir}/exercise.md`, contents: nl(d.brief) },
    { path: `${dir}/starter.py`, contents: nl(d.starter) },
    { path: `${dir}/solution.py`, contents: nl(d.solution) },
    { path: `${dir}/tests/${testFileName(d.id)}`, contents: nl(d.tests) },
  ];
}

export const prTitle = (d: DraftInput, lectureLabel: string) =>
  `Add ${d.id} exercise for ${lectureLabel || d.videoId}`;

export interface ProofFacts {
  starterFailed: number;
  starterTotal: number;
  solutionTotal: number;
}
export interface HumanChecks {
  timestamp: boolean;
  brief: boolean;
  tests: boolean;
  solution: boolean;
}

/** The PR body, built on the repo's template. Only boxes the flow actually
 *  verified — or the human explicitly ticked — are checked. */
export function buildPrBody(
  d: DraftInput,
  author: string,
  lectureLabel: string,
  proof: ProofFacts,
  human: HumanChecks,
  notes: string,
): string {
  const box = (on: boolean) => (on ? "x" : " ");
  const ts = formatTimestamp(d.start);
  return `## What this adds

“${d.concept}” — ${lectureLabel || d.videoId} at ${ts}. Authored in the in-app flow.

- exercise: \`content/${d.id}/\`
- lecture: \`${d.videoId}\` at \`${ts}\`
- course: \`content/courses/${d.courseId}.yml\`

## Contributor checklist

- [${box(human.timestamp)}] The timestamp in \`start\` is the minute where the lecture actually teaches this, not the start of the video.
- [${box(human.brief)}] The brief says what to implement, what the inputs look like, and what counts as correct — without giving away the answer.
- [${box(human.tests)}] The tests check more than the example in the brief: an edge case, an empty input, a different shape.
- [${box(human.solution)}] \`solution.py\` is how you would want a learner to write it, not a golfed version.
- [x] \`author\` is my own GitHub handle. (Filled from the GitHub identity that opened this PR: @${author}.)
- [x] In-app check, in the browser runner learners use: the suite failed on \`starter.py\` (${proof.starterFailed}/${proof.starterTotal} failing) and passed on \`solution.py\` (${proof.solutionTotal}/${proof.solutionTotal}). CI re-verifies this independently.

## Anything the reviewer should know

${notes.trim() || "<!-- nothing noted -->"}

---

<!-- Reviewer section: leave it in place. The full rubric is docs/REVIEWING.md. -->

## Reviewer pass

Pedagogy is a human call: the check surfaces hints but never rejects on them.
A simple exercise in a beginner course is correct, not deficient.

- [ ] **Fit** — I watched ~60 seconds from \`start\`. The exercise practises what is being taught there.
- [ ] **Difficulty** — honest for the course's level. Simple is fine in a beginner course; unexplained leaps are not.
- [ ] **Tests teach** — the suite would catch a plausible wrong solution, not just reproduce the worked example.
- [ ] **Statement** — I could do this exercise from the brief alone, without reading the tests or the solution.
- [ ] **Solution** — readable, and it is the answer the brief implies.
- [ ] **Catalog** — \`concept\` reads well in a list; \`concepts\` reuse existing slugs where they exist.
- [ ] Smells reported by the check were looked at and either accepted or raised.
`;
}

export const DEFAULT_BRIEF = `# Your exercise title

Say what to implement, what the inputs look like, what to return, and the edge
cases. The lecture explains the idea — don't re-derive it here.

Inline math works: $f'(x)$. Display math too:

$$f'(x) \\approx \\frac{f(x+h) - f(x-h)}{2h}$$
`;

export const DEFAULT_STARTER = `def solve(x):
    """Describe what to return. Keep every name the tests import, and keep
    the body unimplemented."""
    raise NotImplementedError
`;

export const DEFAULT_SOLUTION = `def solve(x):
    """The reference answer. Never shipped to the browser. Write it the way
    you would want a learner to write it."""
    raise NotImplementedError  # replace with your answer
`;

export const DEFAULT_TESTS = `# Tests import the learner's code as \`submission\` — never as \`solution\`.
# Cover more than the example in the brief: an edge case, an empty input.
from submission import solve


def test_example():
    assert solve(2) == 4


def test_edge_case():
    assert solve(0) == 0
`;
