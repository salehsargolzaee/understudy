import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { getCourse } from "../content";
import { conceptCounts } from "../lib/catalog";
import { getVideo, videoLabel, videos } from "../lib/videos";
import { useOEmbedTitle } from "../lib/useOEmbedTitle";
import { formatTimestamp, parseTimecode, parseYouTubeRef } from "../lib/youtube";
import { useYouTubePlayer } from "../lib/useYouTubePlayer";
import { nightRailBg } from "../lib/nightRail";
import { contributeHash, exerciseHash, exploreHome, videoHash, homeHash } from "../lib/routes";
import { contributeGuideUrl, exerciseTemplateUrl, repoUrl, schemaUrl } from "../lib/contribute";
import { authConfigured, beginLogin, signOut, useAuth } from "../lib/auth";
import {
  GitHubError, commitFiles, createFork, createRef, findOpenPr, forkHeadSha,
  getAuthedUser, getRefSha, hintFor, openPr, repoOwner, syncForkWithUpstream,
} from "../lib/githubApi";
import { REPO } from "../lib/contribute";
import {
  DEFAULT_BRIEF, DEFAULT_SOLUTION, DEFAULT_STARTER, DEFAULT_TESTS, DraftInput,
  Finding, HumanChecks, buildFiles, buildPrBody, prTitle, slugify, splitList,
  testFileName, uniqueExerciseId, validateDraft,
} from "../lib/authoring";
import { pickRunner } from "../runner";
import type { RunRequest, RunSummary, TestResult } from "../runner";
import { useDebouncedEffect } from "../lib/useDebouncedEffect";
import Star from "./Star";
import TestResults from "./TestResults";
import type { RunState } from "../hooks/useRun";
import Brand from "./Brand";
import ConceptChip from "./ConceptChip";
import Editor from "./Editor";
import VideoThumb from "./VideoThumb";
import Writeup from "./Writeup";

/**
 * In-app authoring: brief, starter, solution, tests and metadata, proven in the
 * same browser runner learners use, ending in a real pull request under the
 * contributor's own GitHub identity. No git, no filesystem, no YAML typed by a
 * human. The honesty rule applies to every step: nothing is promised that was
 * not verified, and every failure shows what happened and what to do next.
 */

const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-ink-900/15 bg-white px-3 py-1 text-[12px] font-medium text-ink-900 transition-colors hover:border-accent/60 hover:bg-accent-soft";
const GOLD_BTN =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-bold text-ink-950 shadow-sm transition hover:bg-accent-bright active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40";
const INPUT =
  "w-full rounded-lg border border-ink-900/15 bg-white px-3 py-2 text-[13.5px] text-ink-950 placeholder:text-ink-500 focus:outline-none focus:ring-2 focus:ring-accent";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="text-[11px] leading-none text-accent"><Star /></span>
        <h2 className="label text-[11px] text-ink-800">{title}</h2>
        {hint && <span className="font-mono text-[10px] text-ink-600">{hint}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* ── drafts survive a reload ─────────────────────────────────────────────── */
const DRAFT_NS = "contrib.draft.v1:";
interface SavedDraft {
  start: number; concept: string; titleOverride: string; brief: string;
  starter: string; solution: string; tests: string;
  conceptsIn: string; tagsIn: string; packagesIn: string; level: string; notes: string;
}
function loadDraft(videoId: string): Partial<SavedDraft> | null {
  try { return JSON.parse(localStorage.getItem(DRAFT_NS + videoId) ?? "null"); } catch { return null; }
}
function saveDraft(videoId: string, d: SavedDraft) {
  try { localStorage.setItem(DRAFT_NS + videoId, JSON.stringify(d)); } catch { /* quota */ }
}
function clearDraft(videoId: string) {
  try { localStorage.removeItem(DRAFT_NS + videoId); } catch { /* ignore */ }
}

/* the fact that a PR was opened must survive a reload */
const SUBMIT_NS = "contrib.submitted.v1:";
interface SubmittedRecord { prUrl: string; prNumber?: number; id: string; concept: string; at: number }
function loadSubmitted(videoId: string): SubmittedRecord | null {
  try { return JSON.parse(localStorage.getItem(SUBMIT_NS + videoId) ?? "null"); } catch { return null; }
}
function saveSubmitted(videoId: string, r: SubmittedRecord) {
  try { localStorage.setItem(SUBMIT_NS + videoId, JSON.stringify(r)); } catch { /* ignore */ }
}
function clearSubmitted(videoId: string) {
  try { localStorage.removeItem(SUBMIT_NS + videoId); } catch { /* ignore */ }
}

/* ── math palette: nobody remembers matrices ─────────────────────────────── */
const MATH_SNIPPETS: { label: string; insert: string }[] = [
  { label: "x²", insert: "x^{2}" },
  { label: "xᵢ", insert: "x_{i}" },
  { label: "a/b", insert: "\\frac{a}{b}" },
  { label: "√", insert: "\\sqrt{x}" },
  { label: "Σ", insert: "\\sum_{i=1}^{n} x_i" },
  { label: "d/dx", insert: "\\frac{d}{dx} f(x)" },
  { label: "∂", insert: "\\frac{\\partial L}{\\partial w}" },
  { label: "matrix", insert: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
  { label: "cases", insert: "\\begin{cases} a & x > 0 \\\\ b & \\text{otherwise} \\end{cases}" },
  { label: "≈", insert: "\\approx" },
  { label: "·", insert: "\\cdot" },
  { label: "→", insert: "\\to" },
  { label: "∞", insert: "\\infty" },
  { label: "O(n log n)", insert: "\\mathcal{O}(n \\log n)" },
];

/* ── one run through the learners' runner ────────────────────────────────── */
type OnceResult =
  | { kind: "result"; summary: RunSummary; tests: TestResult[] }
  | { kind: "crash"; message: string; traceback?: string };

async function runSuiteOnce(req: RunRequest, onStatus: (m: string) => void, signal: AbortSignal): Promise<OnceResult> {
  const runner = pickRunner("pyodide");
  for await (const ev of runner.run(req, signal)) {
    if (ev.type === "status") onStatus(ev.message);
    if (ev.type === "result") return { kind: "result", summary: ev.summary, tests: ev.tests };
    if (ev.type === "crash") return { kind: "crash", message: ev.message, traceback: ev.traceback };
  }
  return { kind: "crash", message: "The run was stopped." };
}

/* ── lecture picker: the flow needs a moment to point at ─────────────────── */
function LecturePicker() {
  const [q, setQ] = useState("");
  const onChange = (v: string) => {
    const ref = parseYouTubeRef(v);
    if (ref?.kind === "video") {
      location.hash = contributeHash(ref.videoId, ref.start ?? 0);
      return;
    }
    setQ(v);
  };
  const shown = videos.filter((v) => !q.trim() || videoLabel(v).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-10 sm:px-8">
      <h1 className="font-serif text-[30px] font-semibold leading-tight text-ink-950">Write an exercise</h1>
      <p className="mt-2 max-w-prose text-[14px] leading-6 text-ink-700">
        An exercise points at a lecture at a specific second. Pick the lecture first — or paste a YouTube
        link, with a timestamp if you have one.
      </p>
      <input
        type="text"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter lectures, or paste a YouTube link"
        className={`${INPUT} mt-5`}
        aria-label="Filter lectures or paste a YouTube link"
      />
      <ul className="mt-5 space-y-1.5">
        {shown.map((v) => (
          <li key={v.id}>
            <a href={contributeHash(v.id, 0)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white">
              <VideoThumb id={v.id} className="h-[36px] w-[64px] shrink-0 rounded-md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink-950">{videoLabel(v)}</span>
                <span className="block truncate font-mono text-[10px] text-ink-500">
                  {v.course?.name ?? "no course on file"} · {v.exercises.length ? `${v.exercises.length} exercise${v.exercises.length === 1 ? "" : "s"}` : "no practice yet"}
                </span>
              </span>
              <span aria-hidden className="shrink-0 text-ink-500">→</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── the lecture, watchable while you write ─────────────────────────────── */

function ComposerPlayer({ videoId, start, onAdopt }: { videoId: string; start: number; onAdopt: (s: number) => void }) {
  const { hostRef, currentTime, failed } = useYouTubePlayer(videoId, start);
  return (
    <div className="overflow-hidden rounded-xl border border-ink-900/15 bg-ink-950">
      <div className="aspect-video w-full">
        <div ref={hostRef} className="h-full w-full" />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="font-mono text-[11px] tabular-nums text-zinc-300">{formatTimestamp(Math.floor(currentTime))}</span>
        <button
          onClick={() => onAdopt(Math.floor(currentTime))}
          className="rounded-full border border-white/20 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10.5px] text-zinc-200 transition-colors hover:border-accent/60 hover:text-white"
        >
          Use this as start
        </button>
        <span className="ml-auto text-[10.5px] text-zinc-500">pause where the idea lands</span>
        {failed && <span className="text-[10.5px] text-zinc-400">player blocked here — open the lecture page instead</span>}
      </div>
    </div>
  );
}

/* ── proof / submit state ────────────────────────────────────────────────── */
type ProofPhase = "idle" | "starter" | "solution" | "proven" | "failed";
interface ProofState {
  phase: ProofPhase;
  key?: string;
  message?: string;
  traceback?: string;
  starter?: { failed: number; total: number };
  solution?: { passed: number; total: number };
  failing?: TestResult[];
}

const STEP_ORDER = ["auth", "fork", "branch", "commit", "pr"] as const;
type StepId = (typeof STEP_ORDER)[number];
const STEP_LABEL: Record<StepId, string> = {
  auth: "Confirm your GitHub identity",
  fork: "Your fork of the repository",
  branch: "The branch",
  commit: "Commit the files",
  pr: "Open the pull request",
};
type StepStatus = "idle" | "doing" | "ok" | "fail";
type Steps = Record<StepId, { status: StepStatus; note?: string }>;
const freshSteps = (): Steps =>
  Object.fromEntries(STEP_ORDER.map((s) => [s, { status: "idle" as StepStatus }])) as Steps;

function download(name: string, contents: string) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(new Blob([contents], { type: "text/plain" }));
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ── the page ────────────────────────────────────────────────────────────── */
export default function ContributePage({ videoId, start }: { videoId: string | null; start: number | null }) {
  const rail = (
    <header
      className="relative z-30 flex h-11 shrink-0 items-center gap-2.5 bg-ink-950 px-3"
      style={{ backgroundImage: nightRailBg(), backgroundSize: "cover" }}
    >
      <a href={homeHash} className="flex shrink-0 items-center gap-2 pr-1" title="understudy">
        <Brand />
      </a>
      <span className="label text-ink-500">Write an exercise</span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {videoId && (
          <a href={videoHash(videoId)} className="rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white">
            ← Lecture
          </a>
        )}
        <a href={exploreHome} className="rounded-md px-2 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.07] hover:text-white">
          Explore
        </a>
      </div>
    </header>
  );

  if (!videoId) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {rail}
        <div className="min-h-0 flex-1 overflow-y-auto scroll-slim">
          <LecturePicker />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      {rail}
      <div className="min-h-0 flex-1 overflow-y-auto scroll-slim">
        <Authoring videoId={videoId} routeStart={start} />
      </div>
    </div>
  );
}

function Authoring({ videoId, routeStart }: { videoId: string; routeStart: number | null }) {
  const video = useMemo(() => getVideo(videoId), [videoId]);
  const fetchedTitle = useOEmbedTitle(videoId, Boolean(video.title));
  const courseId = video.courseId;
  const courseExists = Boolean(getCourse(courseId));

  const saved = useMemo(() => loadDraft(videoId), [videoId]);
  // the second in the URL is explicit intent (a paused player, a tapped moment):
  // it beats whatever second a saved draft remembers
  const initialStart = routeStart != null ? Math.max(0, Math.floor(routeStart)) : saved?.start ?? 0;
  const [startSec, setStartSecState] = useState(initialStart);
  // authors think in 31:00 or 1:02:40, not seconds — the field accepts both
  const [startText, setStartText] = useState(() => formatTimestamp(initialStart));
  const setStartSec = (s: number) => {
    setStartSecState(s);
    setStartText(formatTimestamp(s));
  };
  const [concept, setConcept] = useState(saved?.concept ?? "");
  const [titleOverride, setTitleOverride] = useState(saved?.titleOverride ?? "");
  const [brief, setBrief] = useState(saved?.brief ?? DEFAULT_BRIEF);
  const [starter, setStarter] = useState(saved?.starter ?? DEFAULT_STARTER);
  const [solution, setSolution] = useState(saved?.solution ?? DEFAULT_SOLUTION);
  const [tests, setTests] = useState(saved?.tests ?? DEFAULT_TESTS);
  const [conceptsIn, setConceptsIn] = useState(saved?.conceptsIn ?? "");
  const [tagsIn, setTagsIn] = useState(saved?.tagsIn ?? "");
  const [packagesIn, setPackagesIn] = useState(saved?.packagesIn ?? "");
  const [level, setLevel] = useState(saved?.level ?? "");
  const [notes, setNotes] = useState(saved?.notes ?? "");
  const [human, setHuman] = useState<HumanChecks>({ timestamp: false, brief: false, tests: false, solution: false });
  const [watchOpen, setWatchOpen] = useState(false);

  useDebouncedEffect(() => {
    saveDraft(videoId, { start: startSec, concept, titleOverride, brief, starter, solution, tests, conceptsIn, tagsIn, packagesIn, level, notes });
  }, [videoId, startSec, concept, titleOverride, brief, starter, solution, tests, conceptsIn, tagsIn, packagesIn, level, notes], 600);

  const lectureTitle = video.title || fetchedTitle || titleOverride.trim();
  const id = useMemo(() => uniqueExerciseId(slugify(concept)), [concept]);
  const draft: DraftInput = {
    id,
    concept: concept.trim(),
    concepts: splitList(conceptsIn),
    tags: splitList(tagsIn),
    packages: splitList(packagesIn),
    start: startSec,
    videoId,
    courseId,
    videoTitle: lectureTitle,
    brief, starter, solution, tests, level,
  };
  const findings = validateDraft(draft, courseExists);
  const errors = findings.filter((f) => f.level === "error");

  /* ── the proof gate ─────────────────────────────────────────────────── */
  const proofKey = JSON.stringify([starter, solution, tests, packagesIn]);
  const [proof, setProof] = useState<ProofState>({ phase: "idle" });
  const proofAbort = useRef<AbortController | null>(null);
  const proofBusy = proof.phase === "starter" || proof.phase === "solution";
  const proven = proof.phase === "proven" && proof.key === proofKey;
  const proofStale = (proof.phase === "proven" || proof.phase === "failed") && proof.key !== proofKey;

  useEffect(() => () => proofAbort.current?.abort(), []);

  /* ── scratch runs: the author's dev loop, separate from the formal check ── */
  const [tryState, setTryState] = useState<RunState>({
    phase: "idle", statusMessage: "", tests: [], summary: null, output: "", crash: null, coldStart: true,
  });
  const [tryTarget, setTryTarget] = useState<"solution" | "starter">("solution");
  const [tryKind, setTryKind] = useState<"tests" | "script">("tests");
  const [activeFile, setActiveFile] = useState<"starter" | "solution" | "tests">("starter");
  const [editorLayout, setEditorLayoutState] = useState<"tabs" | "stack">(() => {
    try { return localStorage.getItem("contrib.layout.v1") === "stack" ? "stack" : "tabs"; } catch { return "tabs"; }
  });
  const setEditorLayout = (l: "tabs" | "stack") => {
    setEditorLayoutState(l);
    try { localStorage.setItem("contrib.layout.v1", l); } catch { /* ignore */ }
  };
  const tryAbort = useRef<AbortController | null>(null);
  useEffect(() => () => tryAbort.current?.abort(), []);
  const tryBusy = tryState.phase === "booting" || tryState.phase === "installing" || tryState.phase === "running";

  const runTests = useCallback(async (target: "solution" | "starter", packagesOverride?: string) => {
    tryAbort.current?.abort();
    const ctrl = new AbortController();
    tryAbort.current = ctrl;
    setTryKind("tests");
    setTryTarget(target);
    lastRun.current = { kind: "tests", target };
    setTryState((s) => ({ ...s, phase: "booting", statusMessage: "Starting Python…", crash: null }));
    const req: RunRequest = {
      exerciseId: `try-${id || "exercise"}`,
      submission: target === "solution" ? solution : starter,
      tests: { [testFileName(id)]: tests },
      data: {},
      packages: splitList(packagesOverride ?? packagesIn),
    };
    try {
      const runner = pickRunner("pyodide");
      let out = "";
      for await (const ev of runner.run(req, ctrl.signal)) {
        if (ctrl.signal.aborted) return;
        if (ev.type === "status") setTryState((s) => ({ ...s, phase: ev.phase, statusMessage: ev.message }));
        if (ev.type === "stdout" || ev.type === "stderr") out += ev.text;
        if (ev.type === "result")
          setTryState({ phase: "done", statusMessage: "", tests: ev.tests, summary: ev.summary, output: ev.output || out, crash: null, coldStart: false });
        if (ev.type === "crash")
          setTryState({ phase: "done", statusMessage: "", tests: [], summary: null, output: out, crash: { message: ev.message, traceback: ev.traceback }, coldStart: false });
      }
    } catch { /* aborted */ }
  }, [id, solution, starter, tests, packagesIn]);

  const runFile = useCallback(async (target: "starter" | "solution", packagesOverride?: string) => {
    tryAbort.current?.abort();
    const ctrl = new AbortController();
    tryAbort.current = ctrl;
    setTryKind("script");
    setTryTarget(target);
    lastRun.current = { kind: "script", target };
    setTryState((s) => ({ ...s, phase: "booting", statusMessage: "Starting Python…", crash: null, output: "" }));
    const req: RunRequest = {
      exerciseId: `try-${id || "exercise"}`,
      submission: target === "solution" ? solution : starter,
      tests: {},
      data: {},
      packages: splitList(packagesOverride ?? packagesIn),
      mode: "script",
    };
    try {
      const runner = pickRunner("pyodide");
      let out = "";
      for await (const ev of runner.run(req, ctrl.signal)) {
        if (ctrl.signal.aborted) return;
        if (ev.type === "status") setTryState((s) => ({ ...s, phase: ev.phase, statusMessage: ev.message }));
        if (ev.type === "stdout" || ev.type === "stderr") out += ev.text;
        if (ev.type === "result")
          setTryState({ phase: "done", statusMessage: "", tests: [], summary: ev.summary, output: ev.output || out, crash: null, coldStart: false });
        if (ev.type === "crash")
          setTryState({ phase: "done", statusMessage: "", tests: [], summary: null, output: out, crash: { message: ev.message, traceback: ev.traceback }, coldStart: false });
      }
    } catch { /* aborted */ }
  }, [id, solution, starter, packagesIn]);

  const missingModule = (txt?: string | null) =>
    txt?.match(/ModuleNotFoundError: No module named '([^']+)'/)?.[1] ?? null;
  const lastRun = useRef<{ kind: "script" | "tests"; target: "starter" | "solution" } | null>(null);

  const stopTry = () => {
    tryAbort.current?.abort();
    setTryState((s) => ({ ...s, phase: "cancelled", statusMessage: "" }));
  };

  const runProof = useCallback(async () => {
    proofAbort.current?.abort();
    const ctrl = new AbortController();
    proofAbort.current = ctrl;
    const key = proofKey;
    const req = (submission: string): RunRequest => ({
      exerciseId: `draft-${id || "exercise"}`,
      submission,
      tests: { [testFileName(id)]: tests },
      data: {},
      packages: splitList(packagesIn),
    });
    setProof({ phase: "starter", key, message: "Starting Python…" });
    const st = await runSuiteOnce(req(starter), (m) => setProof((p) => ({ ...p, message: m })), ctrl.signal);
    if (ctrl.signal.aborted) return;
    if (st.kind === "crash") {
      setProof({ phase: "failed", key, message: `The tests could not run against your starter: ${st.message} The starter must import cleanly and define every name the tests import.`, traceback: st.traceback });
      return;
    }
    if (st.summary.failed === 0) {
      setProof({ phase: "failed", key, message: `All ${st.summary.total} tests pass on the starter. The exercise would ship solved — either the starter gives the answer away, or the tests don't test it.` });
      return;
    }
    const starterFacts = { failed: st.summary.failed, total: st.summary.total };
    setProof({ phase: "solution", key, starter: starterFacts, message: "Starter fails, as it must. Now your solution…" });
    const so = await runSuiteOnce(req(solution), (m) => setProof((p) => ({ ...p, message: m })), ctrl.signal);
    if (ctrl.signal.aborted) return;
    if (so.kind === "crash") {
      setProof({ phase: "failed", key, starter: starterFacts, message: `The tests could not run against your solution: ${so.message}`, traceback: so.traceback });
      return;
    }
    if (!so.summary.ok) {
      const failing = so.tests.filter((t) => t.status === "failed" || t.status === "error");
      setProof({ phase: "failed", key, starter: starterFacts, message: `${failing.length} of ${so.summary.total} tests fail against your own solution. Whatever the tests demand, the reference answer does not deliver it.`, failing });
      return;
    }
    setProof({ phase: "proven", key, starter: starterFacts, solution: { passed: so.summary.passed, total: so.summary.total } });
  }, [proofKey, id, starter, solution, tests, packagesIn]);

  /* ── auth + submit ──────────────────────────────────────────────────── */
  const auth = useAuth();
  const [login, setLogin] = useState<string | null>(null);
  useEffect(() => {
    if (!auth.token) { setLogin(null); return; }
    let cancelled = false;
    getAuthedUser(auth.token)
      .then((u) => { if (!cancelled) setLogin(u.login); })
      .catch((e) => { if (e instanceof GitHubError && e.status === 401) signOut(); });
    return () => { cancelled = true; };
  }, [auth.token]);

  const [steps, setSteps] = useState<Steps>(freshSteps);
  const [submitted, setSubmitted] = useState<SubmittedRecord | null>(() => loadSubmitted(videoId));
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const submitting = STEP_ORDER.some((s) => steps[s].status === "doing");
  const submitFailed = STEP_ORDER.some((s) => steps[s].status === "fail");

  const blockers: string[] = [];
  if (!concept.trim()) blockers.push("Name the exercise.");
  if (errors.length) blockers.push(`${errors.length} problem${errors.length === 1 ? "" : "s"} listed under Review must be fixed.`);
  if (!proven) blockers.push(proofStale ? "You edited the code since the last proof — run the check again." : "Run the check: the tests must fail on your starter and pass on your solution, here, before anything can be submitted.");
  if (!auth.token) blockers.push("Sign in with GitHub — the pull request opens under your own name.");

  const submit = useCallback(async () => {
    const token = auth.token;
    if (!token || blockers.length) return;
    setPrUrl(null);
    setSteps(freshSteps());
    const mark = (step: StepId, status: StepStatus, note?: string) =>
      setSteps((s) => ({ ...s, [step]: { status, note } }));
    try {
      mark("auth", "doing");
      const user = await getAuthedUser(token);
      mark("auth", "ok", `@${user.login}`);

      const files = buildFiles(draft, user.login);
      const body = buildPrBody(draft, user.login, lectureTitle, {
        starterFailed: proof.starter!.failed,
        starterTotal: proof.starter!.total,
        solutionTotal: proof.solution!.total,
      }, human, notes);

      // The repository owner cannot fork their own repo — their branch lives
      // on the repository itself. Everyone else works from a fork.
      const isOwner = user.login.toLowerCase() === repoOwner();
      let workRepo = REPO;
      if (isOwner) {
        mark("fork", "ok", "you own the repository — no fork needed");
      } else {
        mark("fork", "doing", "asking GitHub for your fork…");
        const fork = await createFork(token); // idempotent: returns the existing fork too
        mark("fork", "doing", `waiting for ${fork.full_name} to be ready…`);
        const defaultBranch = fork.default_branch || "main";
        await forkHeadSha(token, fork.full_name, defaultBranch);
        await syncForkWithUpstream(token, fork.full_name, defaultBranch);
        workRepo = fork.full_name;
        mark("fork", "ok", fork.full_name);
      }

      mark("branch", "doing");
      const branch = `exercise/${draft.id}`;
      let parentSha: string;
      const upstreamSha = await getRefSha(token, REPO, "main");
      try {
        await createRef(token, workRepo, branch, upstreamSha);
        parentSha = upstreamSha;
      } catch (e) {
        if (e instanceof GitHubError && e.status === 422 && /already exists/i.test(e.message)) {
          parentSha = await getRefSha(token, workRepo, branch); // retry: reuse, commit on top
        } else if (e instanceof GitHubError && e.status === 422) {
          // a brand-new fork can briefly lag upstream; branch from its own head instead
          parentSha = await getRefSha(token, workRepo, "main");
          await createRef(token, workRepo, branch, parentSha);
        } else throw e;
      }
      mark("branch", "ok", branch);

      mark("commit", "doing", `${files.length} files → ${workRepo} @ ${branch}`);
      await commitFiles(token, workRepo, branch, parentSha, files, `Add ${draft.id} exercise for ${lectureTitle || videoId}`);
      mark("commit", "ok", `${files.length} files committed`);

      mark("pr", "doing");
      try {
        const pr = await openPr(token, `${user.login}:${branch}`, prTitle(draft, lectureTitle), body);
        setPrUrl(pr.html_url);
        const rec = { prUrl: pr.html_url, prNumber: pr.number, id: draft.id, concept: draft.concept, at: Date.now() };
        saveSubmitted(videoId, rec);
        setSubmitted(rec);
        mark("pr", "ok", `#${pr.number}`);
      } catch (e) {
        if (e instanceof GitHubError && e.status === 422 && /already exists/i.test(e.message)) {
          const existing = await findOpenPr(token, user.login, branch);
          if (!existing) throw e;
          setPrUrl(existing.html_url);
          const rec = { prUrl: existing.html_url, prNumber: existing.number, id: draft.id, concept: draft.concept, at: Date.now() };
          saveSubmitted(videoId, rec);
          setSubmitted(rec);
          mark("pr", "ok", `#${existing.number} — already open; the branch was updated instead`);
        } else throw e;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setSteps((s) => {
        const out = { ...s };
        for (const k of STEP_ORDER) if (out[k].status === "doing") out[k] = { status: "fail", note: `${message} — ${hintFor(e)}` };
        return out;
      });
      if (e instanceof GitHubError && e.status === 401) signOut();
    }
  }, [auth.token, blockers.length, draft, lectureTitle, proof, human, notes, videoId]);

  /* ── pieces ─────────────────────────────────────────────────────────── */
  const nearby = useMemo(
    () => video.moments.filter((m) => Math.abs(m.start - startSec) <= 120),
    [video, startSec],
  );
  const files = buildFiles(draft, login ?? "your-github-handle");
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const insertMath = (snippet: string) => {
    const ta = briefRef.current;
    if (!ta) { setBrief((b) => b + snippet); return; }
    const { selectionStart: a, selectionEnd: b } = ta;
    const selected = brief.slice(a, b);
    const text = snippet === "$" ? `$${selected || "x"}$` : snippet === "$$" ? `\n$$\n${selected || "…"}\n$$\n` : snippet;
    const next = brief.slice(0, a) + text + brief.slice(b);
    setBrief(next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = a + text.length; });
  };

  const dot = (s: StepStatus) =>
    s === "ok" ? "bg-pass" : s === "fail" ? "bg-fail" : s === "doing" ? "bg-accent animate-pulse" : "bg-ink-900/20";

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-7 sm:px-8">
      {/* ── the moment ─────────────────────────────────────────────────── */}
      <p className="label text-ink-600">New exercise</p>
      <h1 className="mt-1 font-serif text-[28px] font-semibold leading-tight tracking-[-0.015em] text-ink-950 sm:text-[34px]">
        {lectureTitle || <span className="font-mono text-[22px]">{videoId}</span>}
      </h1>
      <div aria-hidden className="mt-2.5 h-[3px] w-16 rounded-full" style={{ background: "linear-gradient(90deg, #26418f, #c39422)" }} />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a href={videoHash(videoId, startSec)} className="shrink-0 overflow-hidden rounded-lg" title="Watch this moment">
          <VideoThumb id={videoId} className="h-[54px] w-[96px]" />
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-ink-900/15 bg-white px-3 py-1 font-mono text-[11px] text-ink-900">
            start
            <input
              type="text"
              value={startText}
              onChange={(e) => {
                setStartText(e.target.value);
                const parsed = parseTimecode(e.target.value);
                if (parsed != null) setStartSecState(Math.max(0, parsed));
              }}
              onBlur={() => setStartText(formatTimestamp(startSec))}
              placeholder="31:00"
              className="w-20 bg-transparent text-right tabular-nums focus:outline-none"
              aria-label="Timestamp — minutes and seconds, hours if you need them, or plain seconds"
            />
            · {startSec}s
          </label>
          <span className="font-mono text-[11px] text-ink-600">
            video <code>{videoId}</code> · course{" "}
            {courseExists ? <code>{courseId}</code> : <span className="text-fail">not in the catalog</span>}
          </span>
        </div>
      </div>
      <details
        className="mt-4 max-w-2xl"
        onToggle={(e) => setWatchOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer select-none text-[13px] font-medium text-verd underline decoration-dotted underline-offset-4">
          Watch the lecture here while you write
        </summary>
        {watchOpen && (
          <div className="mt-3">
            <ComposerPlayer videoId={videoId} start={startSec} onAdopt={setStartSec} />
          </div>
        )}
      </details>

      {!video.title && !fetchedTitle && (
        <div className="mt-3 max-w-xl">
          <label className="label block text-ink-700">Lecture title — we could not fetch it from here</label>
          <input type="text" value={titleOverride} onChange={(e) => setTitleOverride(e.target.value)}
            placeholder="Paste the video's exact title from YouTube" className={`${INPUT} mt-1.5`} />
          <p className="mt-1 text-[11.5px] text-ink-600">
            The PR check verifies the name against YouTube. If you leave this empty, the check will hand you the exact line to paste — one extra round trip.
          </p>
        </div>
      )}

      {submitted && (
        <div className="mt-5 rounded-2xl border border-pass/30 bg-pass/[0.06] p-4">
          <p className="text-[13.5px] font-semibold text-pass">
            Pull request {submitted.prNumber ? `#${submitted.prNumber} ` : ""}is open for this lecture.
          </p>
          <p className="mt-1 text-[13px] leading-6 text-ink-800">
            “{submitted.concept}” was submitted{" "}
            <a href={submitted.prUrl} target="_blank" rel="noreferrer noopener" className="text-verd underline underline-offset-2">
              view it on GitHub ↗
            </a>
            . CI re-runs the checks there, then a human reviews it. Your draft below is untouched —
            editing it and submitting again <strong>updates the same pull request</strong>, it does not
            open a second one.
          </p>
          <button
            onClick={() => {
              clearDraft(videoId);
              clearSubmitted(videoId);
              location.reload();
            }}
            className={`${PILL} mt-2`}
          >
            Start a fresh exercise for this lecture
          </button>
        </div>
      )}

      {nearby.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-accent/45">
          <p className="text-[13px] font-medium text-ink-950">Practice already exists near this moment.</p>
          <ul className="mt-2 space-y-1">
            {nearby.flatMap((m) =>
              m.exercises.map((e) => (
                <li key={e.meta.id} className="flex items-center gap-2 text-[12.5px] text-ink-800">
                  <span className="font-mono tabular-nums text-verd">{formatTimestamp(m.start)}</span>
                  <a href={exerciseHash(e.meta.id)} className="text-verd underline underline-offset-2">{e.meta.concept || e.meta.id}</a>
                </li>
              )),
            )}
          </ul>
          <p className="mt-2 text-[12.5px] leading-5 text-ink-700">
            A different angle at the same timestamp is welcome — same-moment exercises surface together as one
            card. A duplicate of the same idea is not.
            {nearby[0].start !== startSec && (
              <button onClick={() => setStartSec(nearby[0].start)} className="ml-2 rounded-full border border-verd/40 bg-white px-2 py-0.5 font-mono text-[10.5px] text-verd hover:border-accent/60 hover:bg-accent-soft hover:text-ink-950">
                snap to {formatTimestamp(nearby[0].start)}
              </button>
            )}
          </p>
        </div>
      )}

      {/* ── name ───────────────────────────────────────────────────────── */}
      <Section title="Name it" hint="the id is derived — you never type it">
        <input type="text" value={concept} onChange={(e) => setConcept(e.target.value)}
          placeholder="One line, as it will read in menus and cards — e.g. “Moving average over a list”"
          className={INPUT} aria-label="Exercise name" />
        <p className="mt-2 font-mono text-[11px] text-ink-600">
          folder: <code className="text-ink-900">content/{id || "…"}/</code>
          {id && id !== slugify(concept) && <span className="ml-2 text-ink-500">(“{slugify(concept)}” is taken — suffixed)</span>}
        </p>
      </Section>

      {/* ── brief ──────────────────────────────────────────────────────── */}
      <Section title="Brief" hint="what you type on the left renders on the right, math included">
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => insertMath("$")} className={PILL} title="Wrap the selection in inline math">$…$</button>
          <button onClick={() => insertMath("$$")} className={PILL} title="Insert a display-math block">$$…$$</button>
          {MATH_SNIPPETS.map((s) => (
            <button key={s.label} onClick={() => insertMath(s.insert)} className={PILL} title={s.insert}>{s.label}</button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <textarea
            ref={briefRef} value={brief} onChange={(e) => setBrief(e.target.value)}
            spellCheck={false}
            className="h-[360px] w-full resize-y rounded-xl border border-ink-900/15 bg-white p-4 font-mono text-[13px] leading-6 text-ink-950 focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Exercise brief, markdown"
          />
          <div className="h-[360px] overflow-y-auto rounded-xl bg-white p-5 ring-1 ring-ink-900/[0.08] scroll-slim">
            <Writeup markdown={brief} />
          </div>
        </div>
      </Section>

      {/* ── code ───────────────────────────────────────────────────────── */}
      <Section title="Code" hint="tests import the learner's file as `submission`">
        <p className="mb-4 max-w-prose text-[13px] leading-6 text-ink-700">
          Three files make the exercise. Write <strong>solution.py</strong> first — your answer, the way
          you would want a learner to write it — and run it as a file until it behaves. Then write{" "}
          <strong>tests</strong> that import the learner's code as <code>submission</code>, and run them
          against your solution until they pass. Last, copy the solution into <strong>starter.py</strong>{" "}
          and strip the work back out, keeping every name the tests import and raising{" "}
          <code>NotImplementedError</code> where the answer was: the tests failing on the starter and
          passing on the solution is exactly the gap the learner crosses.
        </p>
        <div className="mb-2 flex items-center justify-end gap-1">
          {(["tabs", "stack"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setEditorLayout(l)}
              className={`rounded-full px-2.5 py-0.5 font-mono text-[10.5px] transition-colors ${
                editorLayout === l ? "bg-ink-950 text-zinc-100" : "text-ink-600 hover:text-ink-950"
              }`}
              title={l === "tabs" ? "One editor, three tabs" : "All three files stacked"}
            >
              {l === "tabs" ? "tabs" : "stacked"}
            </button>
          ))}
        </div>

        {editorLayout === "tabs" ? (
          <div className="overflow-hidden rounded-xl border border-ink-900/15 bg-white">
            <div className="flex flex-wrap items-end gap-1 border-b border-ink-900/[0.08] bg-ink-900/[0.03] px-2 pt-1.5">
              {([
                ["starter", "starter.py"],
                ["solution", "solution.py"],
                ["tests", `tests/${testFileName(id)}`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveFile(key)}
                  className={`rounded-t-lg px-3 py-1.5 font-mono text-[12px] transition-colors ${
                    activeFile === key
                      ? "border border-b-0 border-ink-900/15 bg-white text-ink-950"
                      : "text-ink-600 hover:text-ink-950"
                  }`}
                >
                  {label}
                </button>
              ))}
              <span className="ml-auto hidden pb-1.5 pr-1 font-mono text-[10px] text-ink-500 md:block">
                {activeFile === "starter" && "what the learner opens — imports cleanly, work left undone"}
                {activeFile === "solution" && "the reference answer — never shipped to the browser"}
                {activeFile === "tests" && "must fail on the starter, pass on the solution"}
              </span>
            </div>
            <div className="h-[380px]">
              {activeFile === "starter" && (
                <Editor value={starter} onChange={setStarter} onRun={() => runFile("starter")} readOnly={proofBusy} />
              )}
              {activeFile === "solution" && (
                <Editor value={solution} onChange={setSolution} onRun={() => runFile("solution")} readOnly={proofBusy} />
              )}
              {activeFile === "tests" && (
                <Editor value={tests} onChange={setTests} onRun={() => runTests("solution")} readOnly={proofBusy} />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {([
              ["solution.py — the reference answer; never shipped to the browser", solution, setSolution, () => runFile("solution")],
              [`tests/${testFileName(id)} — must fail on the starter, pass on the solution`, tests, setTests, () => runTests("solution")],
              ["starter.py — what the learner opens; imports cleanly, work left undone", starter, setStarter, () => runFile("starter")],
            ] as const).map(([label, value, set, onRun]) => (
              <div key={label} className="overflow-hidden rounded-xl border border-ink-900/15 bg-white">
                <div className="border-b border-ink-900/[0.08] px-3 py-2">
                  <span className="label text-ink-700">{label}</span>
                </div>
                <div className="h-[220px]">
                  <Editor value={value} onChange={set} onRun={onRun} readOnly={proofBusy} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {editorLayout === "tabs" ? (
            <button
              onClick={() => runFile(activeFile === "starter" ? "starter" : "solution")}
              disabled={tryBusy || proofBusy}
              className={GOLD_BTN}
              title="Execute the file on its own and show everything it prints"
            >
              ▶ Run {activeFile === "starter" ? "starter.py" : "solution.py"} as a file
            </button>
          ) : (
            <>
              <button onClick={() => runFile("solution")} disabled={tryBusy || proofBusy} className={GOLD_BTN}>
                ▶ Run solution.py as a file
              </button>
              <button onClick={() => runFile("starter")} disabled={tryBusy || proofBusy} className={PILL}>
                ▶ Run starter.py
              </button>
            </>
          )}
          <button onClick={() => runTests("solution")} disabled={tryBusy || proofBusy} className={PILL}>
            Run tests · solution
          </button>
          <button onClick={() => runTests("starter")} disabled={tryBusy || proofBusy} className={PILL}>
            Run tests · starter
          </button>
          {tryBusy && (
            <>
              <span className="text-[12px] text-ink-600">{tryState.statusMessage}</span>
              <button onClick={stopTry} className={PILL}>
                Stop
              </button>
            </>
          )}
          <span className="ml-auto hidden text-[11.5px] text-ink-600 lg:block">
            ⌘/Ctrl + Enter runs the file you are in — in the tests file it runs the suite
          </span>
        </div>
        {tryState.phase !== "idle" && (
          <div className="mt-3 overflow-hidden rounded-xl border border-ink-900/[0.08] bg-white">
            <div className="border-b border-ink-900/[0.08] bg-ink-900/[0.03] px-3 py-1.5">
              <span className="label text-ink-600">
                {tryKind === "script"
                  ? `output · ${tryTarget}.py run on its own`
                  : `tests vs ${tryTarget} — a scratch run while you build; the check below unlocks submission`}
              </span>
            </div>
            {tryKind === "script" ? (
              tryBusy ? (
                <div className="px-4 py-6 text-sm text-ink-700">{tryState.statusMessage || "Working…"}</div>
              ) : tryState.crash ? (
                <pre className="max-h-72 overflow-auto bg-ink-950 p-4 font-mono text-[11.5px] leading-5 text-rose-200 whitespace-pre-wrap">
                  {tryState.crash.traceback || tryState.crash.message}
                </pre>
              ) : (
                <pre className="max-h-72 overflow-auto bg-ink-950 p-4 font-mono text-[11.5px] leading-5 text-zinc-200 whitespace-pre-wrap">
                  {tryState.phase === "cancelled" ? "(run stopped)" : tryState.output.trim() || "(the file ran and printed nothing)"}
                </pre>
              )
            ) : (
              <TestResults state={tryState} />
            )}
            {(() => {
              const missing = missingModule(tryState.crash?.traceback || tryState.crash?.message);
              if (!missing || tryBusy) return null;
              const next = splitList(packagesIn).includes(missing)
                ? packagesIn
                : packagesIn.trim()
                  ? `${packagesIn.trim().replace(/,\s*$/, "")}, ${missing}`
                  : missing;
              return (
                <div className="border-t border-ink-900/[0.08] bg-accent-soft/60 px-4 py-3">
                  <p className="text-[13px] leading-6 text-ink-800">
                    <code>{missing}</code> is not declared. This runner loads only what the exercise
                    declares in <strong>Packages</strong> — the same list CI installs and every learner's
                    browser downloads.
                  </p>
                  <button
                    onClick={() => {
                      setPackagesIn(next);
                      const lr = lastRun.current;
                      if (!lr) return;
                      if (lr.kind === "script") void runFile(lr.target, next);
                      else void runTests(lr.target, next);
                    }}
                    className={`${PILL} mt-2`}
                  >
                    Add “{missing}” to Packages and run again
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </Section>

      {/* ── facets ─────────────────────────────────────────────────────── */}
      <Section title="Catalog facets">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label block text-ink-700">Concepts — at least one slug</label>
            <input type="text" value={conceptsIn} onChange={(e) => setConceptsIn(e.target.value)}
              placeholder="sliding-window, lists" className={`${INPUT} mt-1.5`} />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {conceptCounts.slice(0, 12).map((c) => (
                <button key={c.name} onClick={() => setConceptsIn((v) => (splitList(v).includes(c.name) ? v : [...splitList(v), c.name].join(", ")))}
                  className="rounded-full border border-verd/30 bg-verd-soft/70 px-2 py-0.5 font-mono text-[10px] text-verd hover:border-accent/60 hover:bg-accent-soft hover:text-ink-950">
                  + {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label block text-ink-700">Tags — optional</label>
            <input type="text" value={tagsIn} onChange={(e) => setTagsIn(e.target.value)} placeholder="python, arrays" className={`${INPUT} mt-1.5`} />
            <label className="label mt-4 block text-ink-700">Packages — only if your code imports beyond the stdlib</label>
            <input type="text" value={packagesIn} onChange={(e) => setPackagesIn(e.target.value)} placeholder="numpy" className={`${INPUT} mt-1.5`} />
            <label className="label mt-4 block text-ink-700">Level — inherited from the course when blank</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className={`${INPUT} mt-1.5`}>
              <option value="">inherit from course</option>
              {["high-school", "undergraduate", "graduate", "professional"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* ── the proof gate ─────────────────────────────────────────────── */}
      <Section title="Prove it works" hint="the same runner learners use; the same invariant CI enforces">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-ink-900/[0.08]">
          <p className="max-w-prose text-[13.5px] leading-6 text-ink-700">
            Two runs, right here: the tests must <strong>fail</strong> against your starter and{" "}
            <strong>pass</strong> against your solution. Submission stays locked until both are demonstrated
            with the code exactly as it is now.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={runProof} disabled={proofBusy || tryBusy} className={GOLD_BTN}>
              {proofBusy ? "Running…" : proven ? "Run again" : "Run the check"}
            </button>
            {proofBusy && (
              <>
                <span className="text-[12.5px] text-ink-700">{proof.message}</span>
                <button onClick={() => proofAbort.current?.abort()} className={PILL}>Stop</button>
              </>
            )}
            {proofStale && <span className="font-mono text-[11px] text-fail">edited since the last run — the proof no longer holds</span>}
          </div>
          {proof.starter && (
            <p className="mt-3 font-mono text-[12px] text-pass">✓ starter fails — {proof.starter.failed}/{proof.starter.total} failing, as required</p>
          )}
          {proof.phase === "proven" && proof.solution && (
            <p className="mt-1 font-mono text-[12px] text-pass">✓ solution passes — {proof.solution.passed}/{proof.solution.total}</p>
          )}
          {proof.phase === "failed" && proof.key === proofKey && (
            <div className="mt-3 rounded-xl border border-fail/30 bg-fail/[0.06] p-3">
              <p className="text-[13px] font-medium text-fail">Not proven</p>
              <p className="mt-1 text-[12.5px] leading-5 text-ink-800">{proof.message}</p>
              {missingModule(proof.traceback || proof.message) && (
                <p className="mt-1 text-[12.5px] leading-5 text-ink-800">
                  <code>{missingModule(proof.traceback || proof.message)}</code> is not declared in{" "}
                  <strong>Packages</strong> — declare it there, then run the check again.
                </p>
              )}
              {proof.failing && (
                <ul className="mt-2 space-y-1 font-mono text-[11.5px] text-ink-800">
                  {proof.failing.slice(0, 5).map((t) => <li key={t.id}>✕ {t.name}</li>)}
                </ul>
              )}
              {proof.traceback && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-ink-950 p-3 font-mono text-[11px] leading-5 text-amber-200">{proof.traceback}</pre>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* ── review ─────────────────────────────────────────────────────── */}
      <Section title="Review — exactly what will be sent" hint={`5 files → ${REPO}, branch exercise/${id || "…"}`}>
        {findings.length > 0 && (
          <ul className="mb-4 space-y-1.5">
            {findings.map((f, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-5">
                <span className={`label mt-0.5 shrink-0 ${f.level === "error" ? "text-fail" : f.level === "warning" ? "text-accent" : "text-ink-600"}`}>
                  {f.level}
                </span>
                <span className="text-ink-800">{f.message}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mb-3 max-w-prose text-[13px] leading-6 text-ink-700">
          These five files are generated from everything above — the folder exactly as it will appear in
          the pull request. Open any of them to inspect it; nothing is sent until the last step.
        </p>
        <div className="space-y-3">
          {files.map((f) => (
            <details key={f.path} className="overflow-hidden rounded-xl border border-ink-900/10 bg-white">
              <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5">
                <code className="font-mono text-[12px] text-ink-950">{f.path}</code>
                <span className="ml-auto flex items-center gap-1.5">
                  <button onClick={(e) => { e.preventDefault(); navigator.clipboard?.writeText(f.contents); }} className={PILL}>copy</button>
                  <button onClick={(e) => { e.preventDefault(); download(f.path.split("/").pop()!, f.contents); }} className={PILL}>download</button>
                </span>
              </summary>
              <pre className="max-h-72 overflow-auto border-t border-ink-900/[0.08] bg-ink-950 p-4 font-mono text-[11.5px] leading-5 text-zinc-200">{f.contents}</pre>
            </details>
          ))}
        </div>
        {!login && (
          <p className="mt-2 font-mono text-[11px] text-ink-600">
            `author` reads “your-github-handle” until you sign in — it is filled from the GitHub identity that opens the PR.
          </p>
        )}

        <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink-900/[0.08]">
          <p className="label text-ink-700">Only you can vouch for these — tick what is true</p>
          <div className="mt-3 space-y-2">
            {([
              ["timestamp", "`start` is where the lecture actually teaches this, not the start of the video."],
              ["brief", "The brief says what to implement, the input shapes, and what counts as correct — without giving the answer away."],
              ["tests", "The tests check more than the example in the brief: an edge case, an empty input, a different shape."],
              ["solution", "solution.py is how I'd want a learner to write it, not a golfed version."],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2.5 text-[13px] leading-5 text-ink-800">
                <input type="checkbox" checked={human[key]} onChange={(e) => setHuman((h) => ({ ...h, [key]: e.target.checked }))} className="mt-0.5 accent-[#c39422]" />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-ink-600">Unticked boxes go into the PR unticked. Nothing here is asserted on your behalf.</p>
          <label className="label mt-4 block text-ink-700">Anything the reviewer should know — optional</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${INPUT} mt-1.5 resize-y font-mono text-[12.5px]`} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-700">
          <span>Rather do it by hand? Take the files above and follow</span>
          <a href={contributeGuideUrl} target="_blank" rel="noreferrer noopener" className={PILL}>the guide ↗</a>
          <a href={exerciseTemplateUrl} target="_blank" rel="noreferrer noopener" className={PILL}>the template ↗</a>
          <a href={schemaUrl} target="_blank" rel="noreferrer noopener" className={PILL}>the schema ↗</a>
        </div>
      </Section>

      {/* ── submit ─────────────────────────────────────────────────────── */}
      <Section title="Open the pull request" hint={`against ${repoUrl.replace("https://", "")}`}>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-ink-900/[0.08]">
          {!authConfigured ? (
            <p className="text-[13.5px] leading-6 text-ink-800">
              GitHub sign-in is not configured in this build (<code>VITE_GITHUB_CLIENT_ID</code> is unset), so the
              app cannot open the PR for you. The files above are complete — copy them out and follow the guide.
            </p>
          ) : auth.token ? (
            <p className="text-[13.5px] text-ink-800">
              Signed in{login ? <> as <span className="font-mono font-medium">@{login}</span></> : "…"} — the PR will carry your name.{" "}
              <button onClick={signOut} className="text-verd underline underline-offset-2">Sign out</button>
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => beginLogin(contributeHash(videoId, startSec))} className={GOLD_BTN} disabled={auth.exchanging}>
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                {auth.exchanging ? "Completing sign-in…" : "Sign in with GitHub"}
              </button>
              <span className="text-[12.5px] text-ink-700">
                Asks for <code>public_repo</code> — enough to fork, push to your fork, and open the PR. The token
                stays in this tab and is gone when you close it.
              </span>
            </div>
          )}
          {auth.error && <p className="mt-2 text-[12.5px] text-fail">{auth.error}</p>}

          {blockers.length > 0 && (
            <ul className="mt-4 space-y-1">
              {blockers.map((b, i) => (
                <li key={i} className="flex gap-2 text-[12.5px] text-ink-800">
                  <span aria-hidden className="text-ink-500">·</span>{b}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={submit} disabled={blockers.length > 0 || submitting} className={GOLD_BTN}>
              {submitting ? "Submitting…" : submitFailed ? "Retry" : "Open the pull request"}
            </button>
            {submitFailed && <span className="text-[12px] text-ink-700">Every step is safe to repeat — nothing is duplicated on retry.</span>}
          </div>

          <ol className="mt-4 space-y-2">
            {STEP_ORDER.map((s) => (
              <li key={s} className="flex items-start gap-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot(steps[s].status)}`} />
                <span className="min-w-0">
                  <span className="block text-[13px] text-ink-950">{STEP_LABEL[s]}</span>
                  {steps[s].note && (
                    <span className={`block break-words font-mono text-[11px] ${steps[s].status === "fail" ? "text-fail" : "text-ink-600"}`}>
                      {steps[s].note}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>

          {prUrl && (
            <div className="mt-5 rounded-xl border border-pass/30 bg-pass/[0.06] p-4">
              <p className="text-[14px] font-semibold text-pass">Pull request open.</p>
              <p className="mt-1 text-[13px] leading-6 text-ink-800">
                CI now re-runs your tests against your starter and your solution, and checks the lecture's name
                against YouTube. Then a human reads it against the public rubric. Expect either a merge or one
                concrete list of changes.
              </p>
              <a href={prUrl} target="_blank" rel="noreferrer noopener" className={`${GOLD_BTN} mt-3`}>View your pull request ↗</a>
            </div>
          )}
        </div>
        <p className="mt-3 text-[11.5px] text-ink-600">
          <button onClick={() => { clearDraft(videoId); location.reload(); }} className="text-verd underline underline-offset-2">Discard this draft</button>
          {" "}— drafts are saved in this browser only, per lecture.
        </p>
      </Section>
    </div>
  );
}
