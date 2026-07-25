#!/usr/bin/env python3
"""
Mechanical gate for exercise contributions.

What it proves, per exercise:

  structure                 the five pieces exist (meta.yml, exercise.md,
                            starter.py, solution.py, tests/test_*.py)
  metadata                  every required field present and well typed, the id
                            equal to the folder name, the course resolvable
  naming                    the lecture this exercise points at has its real
                            name on file; a missing name is supplied verbatim
                            (or written in with --fix), a wrong one is flagged
                            for a human instead of guessed at
  sandbox                   no network or process APIs in contributed code
  tests_fail_on_starter     the suite FAILS as shipped
  tests_pass_on_solution    the suite PASSES against the reference solution

Declared `packages:` are honoured: each distinct package set gets its own
virtualenv (cached by hash), and both runs happen inside it.

Pedagogy is never judged here. Things that smell thin are reported as `smell`
and never fail the run; a beginner course is allowed simple exercises.

Usage
  python tools/validate_exercises.py                      # everything in content/
  python tools/validate_exercises.py content/my-exercise  # one folder
  python tools/validate_exercises.py --changed-from origin/main
  python tools/validate_exercises.py --fix                # fill in video_title
  python tools/validate_exercises.py --no-run             # metadata only, fast
  python tools/validate_exercises.py --template           # smoke the scaffold

Exit code is 1 if there is at least one error, 0 otherwise (--strict also fails
on warnings). --json writes the same result as a stable machine-readable report:
that file is the contract the in-app contribution flow should read.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import venv
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

try:
    import yaml
except ModuleNotFoundError:  # pragma: no cover
    sys.exit("PyYAML is missing. Install it with: python -m pip install pyyaml")

ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / "content"
COURSES_DIR = CONTENT_DIR / "courses"
TEMPLATE_DIR = ROOT / "templates" / "exercise"
DEFAULT_CACHE = ROOT / ".validate-cache"

ERROR, WARN, SMELL, INFO = "error", "warning", "smell", "info"

CHECKS = [
    "structure",
    "metadata",
    "naming",
    "sandbox",
    "tests_fail_on_starter",
    "tests_pass_on_solution",
]

REQUIRED_META = [
    "id",
    "author",
    "course",
    "video_id",
    "video_title",
    "start",
    "concept",
    "concepts",
    "runtime",
    "packages",
]
OPTIONAL_META = ["tags", "playlist", "field", "level", "demo"]
KNOWN_META = set(REQUIRED_META) | set(OPTIONAL_META)

REQUIRED_FILES = ["meta.yml", "exercise.md", "starter.py", "solution.py"]
ALLOWED_TOP = set(REQUIRED_FILES) | {"tests", "data", "README.md"}

ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,48}$")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
HANDLE_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$")
PACKAGE_RE = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9._-]*(\[[A-Za-z0-9,._-]+\])?([=<>!~]=?[0-9A-Za-z.*+!-]+)?$"
)
KNOWN_LEVELS = {"high-school", "undergraduate", "graduate", "professional"}

# Advisory only: packages Pyodide ships or that are known to work in the browser.
# Anything else still installs on CI, but the reviewer should be told it may not
# load for a learner.
PYODIDE_FRIENDLY = {
    "beautifulsoup4", "matplotlib", "networkx", "nltk", "numpy", "pandas",
    "pillow", "pytest", "pyyaml", "regex", "scikit-learn", "scipy", "sqlalchemy",
    "statsmodels", "sympy", "tabulate",
}

SANDBOX_RULES = [
    (
        re.compile(
            r"^\s*(?:import|from)\s+"
            r"(subprocess|socket|ctypes|multiprocessing|pty|urllib|http|ftplib|smtplib|requests|httpx|aiohttp)\b",
            re.MULTILINE,
        ),
        "network or process APIs",
        ERROR,
    ),
    (re.compile(r"\bos\.(system|popen|fork|exec[lv]\w*|spawn\w*)\s*\("), "process APIs", ERROR),
    (re.compile(r"\b__import__\s*\("), "dynamic imports", WARN),
]

PLUGIN = r'''
"""Written into a scratch workspace by tools/validate_exercises.py."""
import json
import os

_order = []
_tests = {}
_collect_errors = []


def pytest_collectreport(report):
    if report.failed:
        _collect_errors.append(
            {"nodeid": report.nodeid, "detail": str(report.longrepr)[:4000]}
        )


def pytest_runtest_logreport(report):
    entry = _tests.get(report.nodeid)
    if entry is None:
        entry = _tests[report.nodeid] = {
            "id": report.nodeid,
            "status": "passed",
            "detail": None,
        }
        _order.append(report.nodeid)
    if report.outcome == "failed":
        entry["status"] = "failed" if report.when == "call" else "error"
        entry["detail"] = str(report.longrepr)[:4000]
    elif report.outcome == "skipped" and entry["status"] == "passed":
        entry["status"] = "skipped"
        entry["detail"] = str(report.longrepr)[:1000] if report.longrepr else None


def pytest_sessionfinish(session, exitstatus):
    path = os.environ.get("UNDERSTUDY_REPORT")
    if not path:
        return
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "exitstatus": int(exitstatus),
                "tests": [_tests[nid] for nid in _order],
                "collect_errors": _collect_errors,
            },
            fh,
        )
'''


# ── reporting ────────────────────────────────────────────────────────────────


@dataclass
class Finding:
    level: str
    code: str
    message: str
    path: str = ""
    suggestion: str = ""


@dataclass
class Report:
    kind: str  # "exercise" | "template" | "courses"
    name: str
    path: str
    checks: dict = field(default_factory=dict)
    facts: dict = field(default_factory=dict)
    findings: list = field(default_factory=list)

    def add(self, level: str, code: str, message: str, path: str = "", suggestion: str = "") -> None:
        self.findings.append(Finding(level, code, message, path or self.path, suggestion))

    def mark(self, check: str, status: str) -> None:
        if self.checks.get(check) == "fail":  # a failure is never downgraded
            return
        self.checks[check] = status

    def count(self, level: str) -> int:
        return sum(1 for f in self.findings if f.level == level)

    @property
    def ok(self) -> bool:
        return self.count(ERROR) == 0


def rel(p: Any) -> str:
    path = Path(p)
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


# ── YouTube: the one thing a contributor should never hand-type ──────────────


@dataclass
class Lookup:
    title: str | None
    state: str  # "ok" | "not_found" | "unverified" | "skipped"
    detail: str = ""


_title_cache: dict[str, Lookup] = {}


def youtube_title(video_id: str, offline: bool = False, timeout: float = 10.0) -> Lookup:
    """The lecture's real name, from YouTube's key-less oEmbed endpoint."""
    if offline:
        return Lookup(None, "skipped", "--offline")
    if video_id in _title_cache:
        return _title_cache[video_id]

    url = "https://www.youtube.com/oembed?" + urllib.parse.urlencode(
        {"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"}
    )
    detail = ""
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "understudy-content-check"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            title = str(payload.get("title", "")).strip()
            if title:
                result = Lookup(title, "ok")
                _title_cache[video_id] = result
                return result
            detail = "oEmbed returned no title"
        except urllib.error.HTTPError as exc:
            detail = f"HTTP {exc.code}"
            if exc.code == 404:
                result = Lookup(None, "not_found", detail)
                _title_cache[video_id] = result
                return result
            if exc.code in (401, 403):
                break
        except Exception as exc:  # noqa: BLE001 - any network failure is the same to us
            detail = str(exc)
        time.sleep(1.5 * (attempt + 1))

    result = Lookup(None, "unverified", detail or "unreachable")
    _title_cache[video_id] = result
    return result


def same_title(a: str, b: str) -> bool:
    """Titles match if they match after the differences nobody means."""

    def norm(s: str) -> str:
        s = unicodedata.normalize("NFKC", s)
        s = s.replace("\u2014", "-").replace("\u2013", "-").replace("\u2212", "-")
        s = s.replace("\u2019", "'").replace("\u2018", "'")
        s = s.replace("\u201c", '"').replace("\u201d", '"')
        s = re.sub(r"\s+", " ", s)
        return s.strip().casefold()

    return norm(a) == norm(b)


def write_video_title(meta_path: Path, title: str) -> None:
    """Surgical edit so the file's comments and ordering survive."""
    line = f"video_title: {json.dumps(title, ensure_ascii=False)}"
    lines = meta_path.read_text(encoding="utf-8").splitlines()
    for i, existing in enumerate(lines):
        if re.match(r"^\s*video_title\s*:", existing):
            lines[i] = line
            break
    else:
        for i, existing in enumerate(lines):
            if re.match(r"^\s*video_id\s*:", existing):
                lines.insert(i + 1, line)
                break
        else:
            lines.append(line)
    meta_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# ── courses ──────────────────────────────────────────────────────────────────


def validate_courses() -> tuple[dict[str, dict], Report]:
    rep = Report("courses", "courses", rel(COURSES_DIR))
    courses: dict[str, dict] = {}
    if not COURSES_DIR.is_dir():
        rep.add(ERROR, "NO_COURSES", "content/courses/ does not exist.")
        return courses, rep

    for path in sorted(COURSES_DIR.glob("*.y*ml")):
        where = rel(path)
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as exc:
            rep.add(ERROR, "BAD_YAML", f"not valid YAML: {exc}", where)
            continue
        if not isinstance(data, dict):
            rep.add(ERROR, "BAD_COURSE", "a course file must be a YAML mapping.", where)
            continue

        stem = path.stem
        if data.get("id") != stem:
            rep.add(
                ERROR,
                "COURSE_ID_MISMATCH",
                f"`id: {data.get('id')!r}` must equal the file name `{stem}`.",
                where,
                f"id: {stem}",
            )
        for key in ("name", "platform", "playlist_url", "field", "level"):
            if not data.get(key):
                rep.add(ERROR, "COURSE_MISSING_FIELD", f"course has no `{key}`.", where)
        for key in ("institution", "creator"):
            if not data.get(key):
                rep.add(WARN, "COURSE_THIN", f"course has no `{key}`; cards will look bare.", where)

        lectures = data.get("lectures")
        if lectures is not None:
            if not isinstance(lectures, list):
                rep.add(ERROR, "BAD_LECTURES", "`lectures:` must be a list.", where)
                lectures = []
            seen: set[str] = set()
            for i, item in enumerate(lectures):
                if not isinstance(item, dict):
                    rep.add(ERROR, "BAD_LECTURE", f"lectures[{i}] is not a mapping.", where)
                    continue
                vid = item.get("id") or item.get("video_id") or ""
                title = item.get("title") or item.get("name") or ""
                if not VIDEO_ID_RE.match(str(vid)):
                    rep.add(ERROR, "BAD_LECTURE_ID", f"lectures[{i}] has no valid YouTube id.", where)
                if not str(title).strip():
                    rep.add(
                        ERROR,
                        "LECTURE_UNNAMED",
                        f"lectures[{i}] ({vid}) has no `title`. Every listed lecture carries its name.",
                        where,
                    )
                if vid in seen:
                    rep.add(ERROR, "LECTURE_DUPLICATE", f"lecture {vid} is listed twice.", where)
                seen.add(str(vid))

        courses[stem] = data

    rep.mark("metadata", "fail" if rep.count(ERROR) else "pass")
    return courses, rep


def lecture_entry(course: dict | None, video_id: str) -> dict | None:
    if not course:
        return None
    for item in course.get("lectures") or []:
        if not isinstance(item, dict):
            continue
        if (item.get("id") or item.get("video_id")) == video_id:
            return item
    return None


# ── environments and test runs ───────────────────────────────────────────────


def ensure_env(packages: list[str], cache: Path, timeout: int) -> tuple[Path, str | None]:
    """A virtualenv per distinct package set, reused across exercises."""
    key = hashlib.sha256("\n".join(sorted(packages)).encode("utf-8")).hexdigest()[:12]
    env_dir = cache / f"venv-{key}"
    python = env_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    stamp = env_dir / ".ready"
    if stamp.is_file() and python.is_file():
        return python, None

    shutil.rmtree(env_dir, ignore_errors=True)
    env_dir.parent.mkdir(parents=True, exist_ok=True)
    venv.create(env_dir, with_pip=True, clear=True)
    proc = subprocess.run(
        [str(python), "-m", "pip", "install", "--disable-pip-version-check", "-q", "pytest", *packages],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if proc.returncode != 0:
        return python, ((proc.stdout or "") + (proc.stderr or ""))[-3000:]
    stamp.write_text("ok", encoding="utf-8")
    return python, None


def run_suite(ex_dir: Path, impl: Path, python: Path, timeout: int) -> dict:
    """Mount the exercise the way the browser runner does, then run pytest."""
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        shutil.copy(impl, work / "submission.py")
        shutil.copytree(ex_dir / "tests", work / "tests")
        if (ex_dir / "data").is_dir():
            shutil.copytree(ex_dir / "data", work / "data")
        (work / "_us_report.py").write_text(PLUGIN, encoding="utf-8")
        out = work / "report.json"

        env = {
            **os.environ,
            "PYTHONPATH": str(work),
            "PYTHONDONTWRITEBYTECODE": "1",
            "UNDERSTUDY_REPORT": str(out),
            "MPLBACKEND": "Agg",
        }
        started = time.time()
        timed_out = False
        try:
            proc = subprocess.run(
                [
                    str(python), "-m", "pytest",
                    "-p", "no:cacheprovider",
                    "-p", "_us_report",
                    "-q", "--no-header", "-rN",
                    "tests",
                ],
                cwd=work,
                env=env,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            output = ((proc.stdout or "")[-8000:]) + ((proc.stderr or "")[-4000:])
            status = proc.returncode
        except subprocess.TimeoutExpired as exc:
            timed_out = True
            status = -1
            output = ((exc.stdout or "") if isinstance(exc.stdout, str) else "")[-8000:]
        seconds = round(time.time() - started, 2)
        report = None
        if out.is_file():
            try:
                report = json.loads(out.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                report = None

    return {
        "report": report,
        "exitstatus": status,
        "output": output,
        "seconds": seconds,
        "timed_out": timed_out,
    }


# ── per-exercise checks ──────────────────────────────────────────────────────


def check_structure(rep: Report, ex_dir: Path, fpath) -> list[Path]:
    missing = [name for name in REQUIRED_FILES if not (ex_dir / name).is_file()]
    if missing:
        rep.add(
            ERROR,
            "MISSING_FILE",
            "missing required file(s): "
            + ", ".join(missing)
            + ". Copy templates/exercise/ and fill it in; every exercise ships all four.",
        )

    tests_dir = ex_dir / "tests"
    test_files: list[Path] = []
    if not tests_dir.is_dir():
        rep.add(ERROR, "MISSING_TESTS", "no tests/ directory. Tests live in tests/test_*.py.")
    else:
        test_files = sorted(tests_dir.glob("test_*.py"))
        if not test_files:
            rep.add(
                ERROR,
                "MISSING_TESTS",
                "tests/ contains no test_*.py. pytest only collects files named test_*.py.",
            )

    for entry in sorted(ex_dir.iterdir()):
        if entry.name.startswith("."):
            continue
        if entry.name not in ALLOWED_TOP:
            rep.add(
                WARN,
                "STRAY_FILE",
                f"`{entry.name}` is not part of the exercise format and will be ignored by the app.",
                fpath(entry.name),
            )

    rep.mark("structure", "fail" if rep.count(ERROR) else "pass")
    return test_files


def check_metadata(rep: Report, meta: dict, ex_dir: Path, courses: dict, fpath) -> None:
    where = fpath("meta.yml")

    def err(code: str, message: str, suggestion: str = "") -> None:
        rep.add(ERROR, code, message, where, suggestion)

    def warn(code: str, message: str, suggestion: str = "") -> None:
        rep.add(WARN, code, message, where, suggestion)

    for key in REQUIRED_META:
        if key not in meta:
            err(
                "MISSING_FIELD",
                f"meta.yml has no `{key}`. Required: {', '.join(REQUIRED_META)}. "
                "content/SCHEMA.md says what each one is for.",
            )

    unknown = sorted(k for k in meta if k not in KNOWN_META)
    if unknown:
        warn(
            "UNKNOWN_FIELD",
            "meta.yml has field(s) the app does not read: " + ", ".join(unknown) + ". Typo, or delete them.",
        )

    ident = meta.get("id")
    if not isinstance(ident, str) or not ID_RE.match(ident):
        err("BAD_ID", "`id` must be lowercase letters, digits and hyphens.")
    elif ident != ex_dir.name:
        err(
            "ID_FOLDER_MISMATCH",
            f"`id: {ident}` does not match the folder name `{ex_dir.name}`. "
            "The folder name is the id the app routes on; they have to be the same string.",
            f"id: {ex_dir.name}",
        )

    author = meta.get("author")
    if not isinstance(author, str) or not HANDLE_RE.match(author or "") or author == "unknown":
        err("BAD_AUTHOR", "`author` must be your GitHub handle; it becomes your contributor profile.")

    concept = meta.get("concept")
    if not isinstance(concept, str) or not concept.strip():
        err("BAD_CONCEPT", "`concept` is the one-line name shown in menus and cards. It cannot be empty.")
    elif len(concept) > 120:
        warn("LONG_CONCEPT", "`concept` is over 120 characters; it will be truncated everywhere it appears.")

    concepts = meta.get("concepts")
    if not isinstance(concepts, list) or not concepts:
        err(
            "BAD_CONCEPTS",
            "`concepts` must list at least one slug. These are the catalog's facets — "
            "lowercase, hyphenated, reuse an existing one where you can.",
        )
    else:
        bad = [c for c in concepts if not isinstance(c, str) or not SLUG_RE.match(c)]
        if bad:
            err("BAD_CONCEPTS", f"concept slugs must be lowercase-hyphenated: {bad!r}")

    tags = meta.get("tags", [])
    if tags is not None and not isinstance(tags, list):
        err("BAD_TAGS", "`tags` must be a list (or omitted).")

    start = meta.get("start")
    if isinstance(start, bool) or not isinstance(start, int) or start < 0:
        err("BAD_START", "`start` is whole seconds into the lecture, an integer ≥ 0.")

    runtime = meta.get("runtime")
    if runtime not in ("pyodide", "modal"):
        err("BAD_RUNTIME", "`runtime` is `pyodide` (runs in the browser) or `modal` (server, not built yet).")
    elif runtime == "modal":
        warn(
            "MODAL_RUNTIME",
            "`runtime: modal` exercises cannot run in the app yet; learners will see a crash message. "
            "Open an issue before shipping one.",
        )

    packages = meta.get("packages")
    if packages is None or not isinstance(packages, list):
        err("BAD_PACKAGES", "`packages` must be a list, `[]` when you need nothing beyond the standard library.")
    else:
        for spec in packages:
            if not isinstance(spec, str) or not PACKAGE_RE.match(spec):
                err("BAD_PACKAGE", f"{spec!r} is not a package name this check will install.")
            elif runtime == "pyodide" and spec.split("[")[0].split("=")[0].lower() not in PYODIDE_FRIENDLY:
                warn(
                    "PACKAGE_UNVERIFIED",
                    f"`{spec}` is not on the list of packages known to load in Pyodide. It installs on CI, "
                    "but open the exercise in the app and confirm the run does not fail for a learner.",
                )

    course_id = meta.get("course")
    if not isinstance(course_id, str) or not course_id:
        err("BAD_COURSE", "`course` must name a file under content/courses/ (without the extension).")
    elif course_id not in courses:
        err(
            "UNKNOWN_COURSE",
            f"`course: {course_id}` has no file at content/courses/{course_id}.yml. "
            "Add the course in the same pull request, or point at an existing one.",
        )

    level = meta.get("level")
    if level is not None:
        if not isinstance(level, str):
            err("BAD_LEVEL", "`level` must be a string.")
        elif level not in KNOWN_LEVELS:
            warn(
                "UNUSUAL_LEVEL",
                f"`level: {level}` is a new level facet (known: {', '.join(sorted(KNOWN_LEVELS))}). "
                "Fine if deliberate; it creates a new page.",
            )
    if "demo" in meta and not isinstance(meta["demo"], bool):
        err("BAD_DEMO", "`demo` is true or false.")
    if "playlist" in meta:
        rep.add(
            INFO,
            "LEGACY_PLAYLIST",
            "`playlist` is legacy; `course` is what the app uses now. Harmless to keep.",
            where,
        )

    rep.mark("metadata", "fail" if any(f.level == ERROR and f.path == where for f in rep.findings) else "pass")


def check_naming(rep: Report, meta: dict, courses: dict, args, display: Path, fpath, allow_fix: bool) -> None:
    """The naming rule: a referenced video ends up with the lecture's name on file."""
    where = fpath("meta.yml")
    video_id = meta.get("video_id")
    if not isinstance(video_id, str) or not VIDEO_ID_RE.match(video_id):
        rep.add(
            ERROR,
            "BAD_VIDEO_ID",
            "`video_id` must be the 11-character YouTube id (the `v=` part of the link), not a URL.",
            where,
        )
        rep.mark("naming", "fail")
        return

    on_file = meta.get("video_title")
    on_file = on_file.strip() if isinstance(on_file, str) else ""
    lookup = youtube_title(video_id, offline=args.offline)
    rep.facts["youtube_title"] = lookup.title
    rep.facts["youtube_lookup"] = lookup.state

    course = courses.get(meta.get("course")) if isinstance(meta.get("course"), str) else None
    listed = lecture_entry(course, video_id)
    listed_title = str((listed or {}).get("title") or (listed or {}).get("name") or "").strip()

    if lookup.state == "not_found":
        rep.add(
            ERROR,
            "VIDEO_NOT_FOUND",
            f"YouTube has no public video `{video_id}`. The exercise points at something a learner cannot watch.",
            where,
        )
        rep.mark("naming", "fail")
        return

    if not on_file:
        fill = lookup.title or listed_title
        if fill and allow_fix and args.fix:
            write_video_title(display / "meta.yml", fill)
            rep.add(INFO, "VIDEO_TITLE_FILLED", f"wrote video_title: {fill!r} into meta.yml.", where)
            on_file = fill
            rep.mark("naming", "pass")
        elif fill:
            rep.add(
                ERROR,
                "MISSING_VIDEO_TITLE",
                "`video_title` is empty. The name of the video is knowable from the video, so here it is — "
                "paste the line below into meta.yml, or run "
                "`python tools/validate_exercises.py --fix` and commit the result.",
                where,
                f"video_title: {json.dumps(fill, ensure_ascii=False)}",
            )
            rep.mark("naming", "fail")
            return
        else:
            rep.add(
                ERROR,
                "MISSING_VIDEO_TITLE",
                "`video_title` is empty and the name could not be fetched from YouTube "
                f"({lookup.detail or lookup.state}). Add the lecture's exact title by hand, "
                "or re-run when the network is available.",
                where,
            )
            rep.mark("naming", "fail")
            return
    else:
        rep.mark("naming", "pass")

    if lookup.state == "ok" and lookup.title and not same_title(on_file, lookup.title):
        rep.add(
            WARN,
            "TITLE_MISMATCH",
            "`video_title` is not what YouTube calls this video. Nothing was changed — one of these two is "
            "right and that is a judgement call.\n"
            f"  on file : {on_file}\n"
            f"  youtube : {lookup.title}",
            where,
        )
        rep.mark("naming", "warn")
    elif lookup.state == "unverified":
        rep.add(
            WARN,
            "TITLE_UNVERIFIED",
            f"could not reach YouTube to verify `video_title` ({lookup.detail}). The name on file was accepted as is.",
            where,
        )
        rep.mark("naming", "warn")

    if course is not None and (course.get("lectures") or []) and listed is None:
        entry = f"  - id: {video_id}\n    title: {json.dumps(on_file, ensure_ascii=False)}"
        rep.add(
            WARN,
            "LECTURE_NOT_LISTED",
            f"course `{meta.get('course')}` keeps an ordered `lectures:` list and this lecture is not in it, "
            "so it will show without a number. Add it where it belongs in the course's order.",
            rel(COURSES_DIR / f"{meta.get('course')}.yml"),
            entry,
        )
        rep.mark("naming", "warn")
    elif listed is not None and listed_title and not same_title(listed_title, on_file):
        rep.add(
            WARN,
            "LECTURE_TITLE_MISMATCH",
            "this lecture's name differs between the course file and the exercise. The course file wins in the app.\n"
            f"  course   : {listed_title}\n"
            f"  exercise : {on_file}",
            where,
        )
        rep.mark("naming", "warn")


def check_sandbox(rep: Report, ex_dir: Path, meta: dict, test_files: list[Path], fpath) -> None:
    runtime = meta.get("runtime")
    files = [ex_dir / "starter.py", ex_dir / "solution.py", *test_files]
    for path in files:
        if not path.is_file():
            continue
        source = path.read_text(encoding="utf-8", errors="replace")
        where = fpath(path.relative_to(ex_dir).as_posix())
        for pattern, what, level in SANDBOX_RULES:
            if pattern.search(source):
                if level == ERROR and runtime == "modal":
                    level = WARN
                rep.add(
                    level,
                    "SANDBOX",
                    f"uses {what}. Exercise code runs in the learner's browser and on CI; "
                    "it must be pure computation with no network, no subprocesses and no host access.",
                    where,
                )
        if path.name.startswith("test_") and re.search(r"^\s*(from|import)\s+solution\b", source, re.MULTILINE):
            rep.add(
                ERROR,
                "TESTS_IMPORT_SOLUTION",
                "tests import `solution`. Tests only ever see the learner's file, which is mounted as "
                "`submission`. Import from `submission`.",
                where,
            )
        if path.name.startswith("test_") and "submission" not in source:
            rep.add(
                WARN,
                "TESTS_IGNORE_SUBMISSION",
                "this test file never mentions `submission`, so it may not be testing the learner's code at all.",
                where,
            )

    starter = (ex_dir / "starter.py").read_text(encoding="utf-8", errors="replace") if (ex_dir / "starter.py").is_file() else ""
    solution = (ex_dir / "solution.py").read_text(encoding="utf-8", errors="replace") if (ex_dir / "solution.py").is_file() else ""
    if starter.strip() and starter.strip() == solution.strip():
        rep.add(
            ERROR,
            "STARTER_IS_SOLUTION",
            "starter.py and solution.py are the same file: the exercise ships already solved.",
            fpath("starter.py"),
        )

    rep.mark("sandbox", "fail" if any(f.code in ("SANDBOX", "TESTS_IMPORT_SOLUTION", "STARTER_IS_SOLUTION") and f.level == ERROR for f in rep.findings) else "pass")


def check_mechanics(rep: Report, ex_dir: Path, meta: dict, args, fpath) -> None:
    packages = [p for p in (meta.get("packages") or []) if isinstance(p, str)]
    rep.facts["packages"] = packages

    python, pip_log = ensure_env(packages, Path(args.cache), args.install_timeout)
    if pip_log is not None:
        rep.add(
            ERROR,
            "PACKAGES_NOT_INSTALLABLE",
            "the declared packages (" + (", ".join(packages) or "none") + ") do not install:\n" + pip_log,
            fpath("meta.yml"),
        )
        rep.mark("tests_fail_on_starter", "fail")
        rep.mark("tests_pass_on_solution", "fail")
        return

    starter = run_suite(ex_dir, ex_dir / "starter.py", python, args.timeout)
    solution = run_suite(ex_dir, ex_dir / "solution.py", python, args.timeout)
    rep.facts["starter_seconds"] = starter["seconds"]
    rep.facts["solution_seconds"] = solution["seconds"]

    # ── the suite must fail as shipped
    if starter["timed_out"]:
        rep.add(
            ERROR,
            "STARTER_TIMEOUT",
            f"the suite did not finish within {args.timeout}s against starter.py.",
            fpath("starter.py"),
        )
        rep.mark("tests_fail_on_starter", "fail")
    elif starter["report"] is None:
        rep.add(
            ERROR,
            "PYTEST_CRASHED",
            "pytest produced no report against starter.py:\n" + (starter["output"] or "(no output)"),
            fpath("starter.py"),
        )
        rep.mark("tests_fail_on_starter", "fail")
    else:
        data = starter["report"]
        if data["collect_errors"]:
            detail = data["collect_errors"][0]["detail"]
            rep.add(
                ERROR,
                "STARTER_NOT_COLLECTABLE",
                "pytest could not even collect the tests against starter.py, so a learner opening this "
                "exercise sees a crash rather than failing tests. The starter must import cleanly and define "
                "every name the tests import; leave the bodies unimplemented.\n" + detail,
                fpath("starter.py"),
            )
            rep.mark("tests_fail_on_starter", "fail")
        elif not data["tests"]:
            rep.add(ERROR, "NO_TESTS_RAN", "no tests ran against starter.py.", fpath("tests"))
            rep.mark("tests_fail_on_starter", "fail")
        else:
            failing = [t for t in data["tests"] if t["status"] in ("failed", "error")]
            passing = [t for t in data["tests"] if t["status"] == "passed"]
            rep.facts["starter_total"] = len(data["tests"])
            rep.facts["starter_failing"] = len(failing)
            if not failing:
                rep.add(
                    ERROR,
                    "ALREADY_SOLVED",
                    "the whole suite PASSES against starter.py. The exercise ships solved — there is nothing "
                    "for a learner to do. Either the starter gives the answer away, or the tests do not test it.",
                    fpath("starter.py"),
                )
                rep.mark("tests_fail_on_starter", "fail")
            else:
                rep.mark("tests_fail_on_starter", "pass")
                if passing:
                    rep.add(
                        INFO,
                        "STARTER_PARTIAL",
                        f"{len(passing)} of {len(data['tests'])} tests already pass against the starter "
                        f"({', '.join(t['id'].split('::')[-1] for t in passing[:5])}). Fine if intended.",
                        fpath("tests"),
                    )

    # ── and pass against the author's own solution
    if solution["timed_out"]:
        rep.add(
            ERROR,
            "SOLUTION_TIMEOUT",
            f"the suite did not finish within {args.timeout}s against solution.py.",
            fpath("solution.py"),
        )
        rep.mark("tests_pass_on_solution", "fail")
    elif solution["report"] is None:
        rep.add(
            ERROR,
            "PYTEST_CRASHED",
            "pytest produced no report against solution.py:\n" + (solution["output"] or "(no output)"),
            fpath("solution.py"),
        )
        rep.mark("tests_pass_on_solution", "fail")
    else:
        data = solution["report"]
        if data["collect_errors"]:
            rep.add(
                ERROR,
                "SOLUTION_NOT_COLLECTABLE",
                "pytest could not collect the tests against solution.py:\n" + data["collect_errors"][0]["detail"],
                fpath("solution.py"),
            )
            rep.mark("tests_pass_on_solution", "fail")
        elif not data["tests"]:
            rep.add(ERROR, "NO_TESTS_RAN", "no tests ran against solution.py.", fpath("tests"))
            rep.mark("tests_pass_on_solution", "fail")
        else:
            broken = [t for t in data["tests"] if t["status"] in ("failed", "error")]
            skipped = [t for t in data["tests"] if t["status"] == "skipped"]
            rep.facts["solution_total"] = len(data["tests"])
            rep.facts["solution_failing"] = len(broken)
            if broken:
                first = broken[0]
                rep.add(
                    ERROR,
                    "SOLUTION_FAILS",
                    f"{len(broken)} of {len(data['tests'])} tests FAIL against the exercise's own solution.py. "
                    "Whatever the tests demand, the reference answer does not deliver it.\n"
                    f"first failure: {first['id']}\n{first['detail']}",
                    fpath("solution.py"),
                )
                rep.mark("tests_pass_on_solution", "fail")
            else:
                rep.mark("tests_pass_on_solution", "pass")
            if skipped:
                rep.add(
                    WARN,
                    "SOLUTION_SKIPS",
                    "skipped against the reference solution: "
                    + ", ".join(t["id"].split("::")[-1] for t in skipped)
                    + ". A skipped test proves nothing.",
                    fpath("tests"),
                )
            if solution["seconds"] > 20:
                rep.add(
                    SMELL,
                    "SLOW_SUITE",
                    f"the suite takes {solution['seconds']}s on CPython. Pyodide is several times slower, "
                    "so a learner will wait. Consider smaller inputs.",
                    fpath("tests"),
                )

    starter_total = rep.facts.get("starter_total")
    solution_total = rep.facts.get("solution_total")
    if starter_total and solution_total and starter_total != solution_total:
        rep.add(
            WARN,
            "TEST_COUNT_DIFFERS",
            f"{starter_total} tests ran against the starter but {solution_total} against the solution. "
            "Collection is depending on the implementation, which makes results hard to trust.",
            fpath("tests"),
        )


def literals(node: ast.AST) -> set[str]:
    found: set[str] = set()
    for sub in ast.walk(node):
        if isinstance(sub, ast.Constant) and isinstance(sub.value, (int, float, str)) and not isinstance(sub.value, bool):
            found.add(str(sub.value).strip())
    return {v for v in found if v and len(v) < 40}


def check_smells(rep: Report, ex_dir: Path, test_files: list[Path], fpath) -> None:
    """Never fails the run. Only tells a human where to look harder."""
    test_count = 0
    assertions = 0
    test_literals: set[str] = set()
    for path in test_files:
        try:
            tree = ast.parse(path.read_text(encoding="utf-8", errors="replace"))
        except SyntaxError as exc:
            rep.add(ERROR, "TEST_SYNTAX", f"{path.name} does not parse: {exc}", fpath(f"tests/{path.name}"))
            continue
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_"):
                test_count += 1
            if isinstance(node, ast.Assert):
                assertions += 1
            if isinstance(node, ast.With):
                for item in node.items:
                    if "raises" in ast.dump(item.context_expr):
                        assertions += 1
        test_literals |= literals(tree)

    rep.facts["test_functions"] = test_count
    rep.facts["assertions"] = assertions

    if test_count and test_count < 3:
        rep.add(
            SMELL,
            "FEW_TESTS",
            f"{test_count} test function(s). Thin suites tend to accept the wrong solution; "
            "a human should decide whether the coverage is honest for this exercise.",
            fpath("tests"),
        )
    if assertions and assertions < 2:
        rep.add(SMELL, "ONE_ASSERT", "the suite makes a single assertion.", fpath("tests"))

    brief = (ex_dir / "exercise.md").read_text(encoding="utf-8", errors="replace") if (ex_dir / "exercise.md").is_file() else ""
    prose = re.sub(r"```.*?```", "", brief, flags=re.S)
    prose = re.sub(r"<!--.*?-->", "", prose, flags=re.S).strip()
    rep.facts["brief_chars"] = len(prose)
    if len(prose) < 400:
        rep.add(
            SMELL,
            "THIN_BRIEF",
            f"the brief is {len(prose)} characters of prose. Check that it states the task, "
            "the shapes of the inputs and what counts as correct.",
            fpath("exercise.md"),
        )

    if test_count and test_count <= 3 and test_literals:
        fenced = " ".join(re.findall(r"```(?:python)?(.*?)```", brief, flags=re.S))
        brief_tokens = set(re.findall(r"[-\w.]+|\"[^\"]*\"|'[^']*'", fenced))
        brief_tokens = {t.strip("\"'") for t in brief_tokens}
        if test_literals and test_literals <= brief_tokens:
            rep.add(
                SMELL,
                "ECHOES_EXAMPLE",
                "every literal in the tests also appears in the brief's worked example, so the suite may only "
                "re-run the example. Edge cases are what make a suite teach.",
                fpath("tests"),
            )


# ── drivers ──────────────────────────────────────────────────────────────────


def validate_exercise(
    ex_dir: Path,
    courses: dict,
    args,
    display: Path | None = None,
    allow_fix: bool = True,
    kind: str = "exercise",
) -> Report:
    display = display or ex_dir
    rep = Report(kind=kind, name=ex_dir.name, path=rel(display))
    for name in CHECKS:
        rep.checks[name] = "skip"

    def fpath(*parts: str) -> str:
        return rel(display.joinpath(*parts))

    test_files = check_structure(rep, ex_dir, fpath)
    if not rep.ok:
        return rep  # nothing below can be trusted

    try:
        meta = yaml.safe_load((ex_dir / "meta.yml").read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        rep.add(ERROR, "BAD_YAML", f"meta.yml is not valid YAML: {exc}", fpath("meta.yml"))
        rep.mark("metadata", "fail")
        return rep
    if not isinstance(meta, dict):
        rep.add(ERROR, "BAD_YAML", "meta.yml must be a YAML mapping of fields.", fpath("meta.yml"))
        rep.mark("metadata", "fail")
        return rep

    rep.name = str(meta.get("id") or ex_dir.name)
    check_metadata(rep, meta, ex_dir, courses, fpath)
    check_naming(rep, meta, courses, args, display, fpath, allow_fix)
    check_sandbox(rep, ex_dir, meta, test_files, fpath)
    check_smells(rep, ex_dir, test_files, fpath)
    if args.no_run:
        rep.add(INFO, "RUN_SKIPPED", "--no-run: the starter/solution runs were skipped.")
    else:
        check_mechanics(rep, ex_dir, meta, args, fpath)
    return rep


def validate_template(path: Path, courses: dict, args) -> Report:
    """The scaffold is not catalog content; it is copied out and smoke-run."""
    meta_file = path / "meta.yml"
    ident = "template"
    if meta_file.is_file():
        try:
            ident = str((yaml.safe_load(meta_file.read_text(encoding="utf-8")) or {}).get("id") or ident)
        except yaml.YAMLError:
            pass
    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / ident
        shutil.copytree(path, dest)
        rep = validate_exercise(dest, courses, args, display=path, allow_fix=False, kind="template")
    rep.name = f"template ({ident})"
    return rep


def all_exercise_dirs() -> list[Path]:
    if not CONTENT_DIR.is_dir():
        return []
    return sorted(
        p
        for p in CONTENT_DIR.iterdir()
        if p.is_dir() and p.name != "courses" and not p.name.startswith((".", "_"))
    )


def git_changed(ref: str) -> list[str]:
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", f"{ref}...HEAD"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError) as exc:
        sys.exit(f"could not diff against {ref}: {exc}")
    return [line.strip() for line in out.splitlines() if line.strip()]


def select_exercises(args, courses: dict) -> tuple[list[Path], str]:
    if args.paths:
        return [Path(p).resolve() for p in args.paths], "paths given on the command line"
    if args.changed_from and not args.all:
        changed = git_changed(args.changed_from)
        dirs: list[Path] = []
        everything = False
        touched_courses: set[str] = set()
        for name in changed:
            parts = Path(name).parts
            if parts[:1] == ("content",) and len(parts) > 1 and parts[1] != "courses":
                candidate = CONTENT_DIR / parts[1]
                if candidate.is_dir() and candidate not in dirs:
                    dirs.append(candidate)
            if parts[:2] == ("content", "courses"):
                touched_courses.add(Path(name).stem)
            if name in ("tools/validate_exercises.py",) or parts[:1] == ("templates",):
                everything = True
        if everything:
            return all_exercise_dirs(), "the checker or the template changed, so everything was re-checked"
        if touched_courses:
            for ex_dir in all_exercise_dirs():
                meta_file = ex_dir / "meta.yml"
                if not meta_file.is_file() or ex_dir in dirs:
                    continue
                try:
                    meta = yaml.safe_load(meta_file.read_text(encoding="utf-8")) or {}
                except yaml.YAMLError:
                    continue
                if str(meta.get("course") or "") in touched_courses:
                    dirs.append(ex_dir)
        return dirs, f"changed since {args.changed_from}"
    return all_exercise_dirs(), "every exercise in content/"


# ── output ───────────────────────────────────────────────────────────────────

SYMBOL = {ERROR: "error  ", WARN: "warning", SMELL: "smell  ", INFO: "note   "}


def print_text(reports: list[Report], counts: dict, selection: str) -> None:
    print(f"understudy content check — {selection}\n")
    for rep in reports:
        if not rep.findings and rep.kind == "courses":
            print(f"{rep.path}  ok")
            continue
        head = f"{rep.path}" + (f"  ({rep.name})" if rep.name != rep.path else "")
        print(head)
        if rep.checks:
            print("  " + " · ".join(f"{k}:{v}" for k, v in rep.checks.items()))
        for f in rep.findings:
            print(f"  {SYMBOL.get(f.level, f.level)}  {f.code}  {f.path}")
            for line in f.message.splitlines():
                print(f"      {line}")
            if f.suggestion:
                print("      ---- paste this ----")
                for line in f.suggestion.splitlines():
                    print(f"      {line}")
                print("      --------------------")
        print()
    verdict = "FAILED" if counts["errors"] else "passed"
    print(
        f"{verdict}: {counts['errors']} error(s), {counts['warnings']} warning(s), "
        f"{counts['smells']} smell(s) across {counts['targets']} target(s)."
    )
    if not counts["errors"]:
        print("Mechanics are sound. Quality is a human call — docs/REVIEWING.md.")


def annotate(reports: list[Report]) -> None:
    if not os.environ.get("GITHUB_ACTIONS"):
        return
    for rep in reports:
        for f in rep.findings:
            kind = {ERROR: "error", WARN: "warning"}.get(f.level, "notice")
            body = f.message + (f"\n\nPaste this:\n{f.suggestion}" if f.suggestion else "")
            body = body.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
            print(f"::{kind} file={f.path},title={f.code}::{body}")


def doc_link(path: str, label: str) -> str:
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        return f"`{path}`"
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    sha = os.environ.get("GITHUB_SHA", "main")
    return f"[{label}]({server}/{repo}/blob/{sha}/{path})"


def markdown(reports: list[Report], counts: dict, selection: str) -> str:
    out: list[str] = ["## Content check", ""]
    verdict = "**Something must change before this merges.**" if counts["errors"] else "**Mechanically sound.**"
    out += [
        verdict,
        "",
        f"{counts['targets']} target(s) · {counts['errors']} error(s) · {counts['warnings']} warning(s) · "
        f"{counts['smells']} smell(s) — {selection}",
        "",
    ]
    for rep in reports:
        if rep.kind == "courses" and not rep.findings:
            continue
        out.append(f"### `{rep.path}`" + (f" — `{rep.name}`" if rep.name != rep.path else ""))
        if rep.checks:
            rows = [
                "| check | result |",
                "| --- | --- |",
                *(f"| {k} | {v} |" for k, v in rep.checks.items()),
            ]
            out += ["", *rows, ""]
        if rep.facts:
            facts = " · ".join(f"{k}: {v}" for k, v in rep.facts.items() if v not in (None, "", []))
            if facts:
                out += [f"<sub>{facts}</sub>", ""]
        for f in rep.findings:
            label = {ERROR: "**error**", WARN: "warning", SMELL: "smell", INFO: "note"}[f.level]
            out.append(f"- {label} `{f.code}` in `{f.path}`")
            out.append("")
            out += ["  " + line for line in f.message.splitlines()]
            if f.suggestion:
                out += ["", "  ```yaml", *("  " + line for line in f.suggestion.splitlines()), "  ```"]
            out.append("")
    out += [
        "---",
        "",
        "### The human pass",
        "",
        "Everything above is mechanical. It says nothing about whether the exercise is worth doing.",
        f"The rubric is {doc_link('docs/REVIEWING.md', 'docs/REVIEWING.md')} and as a checklist in the pull request body:",
        "fit at the timestamp, honest difficulty for the course level, tests that teach rather than echo the example,",
        "a statement a learner can act on. A `smell` is a hint about where to look, not a verdict. Simple is not a",
        "defect in a beginner course.",
        "",
    ]
    return "\n".join(out)


# ── entry point ──────────────────────────────────────────────────────────────


def parse_args(argv=None):
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("paths", nargs="*", help="exercise folders (default: all of content/)")
    ap.add_argument("--all", action="store_true", help="check every exercise")
    ap.add_argument("--changed-from", metavar="REF", help="only exercises touched since REF")
    ap.add_argument(
        "--template",
        nargs="?",
        const=str(TEMPLATE_DIR),
        metavar="DIR",
        help="smoke-check the scaffold instead of catalog content",
    )
    ap.add_argument("--fix", action="store_true", help="write a missing video_title into meta.yml")
    ap.add_argument("--offline", action="store_true", help="do not call YouTube")
    ap.add_argument("--no-run", action="store_true", help="skip the starter/solution runs")
    ap.add_argument("--strict", action="store_true", help="treat warnings as failures")
    ap.add_argument("--timeout", type=int, default=300, help="seconds per test run")
    ap.add_argument("--install-timeout", type=int, default=900, help="seconds per pip install")
    ap.add_argument("--cache", default=str(DEFAULT_CACHE), help="where virtualenvs are cached")
    ap.add_argument("--json", dest="json_out", metavar="FILE", help="write the machine-readable report")
    ap.add_argument("--summary", metavar="FILE", help="append a markdown summary (use $GITHUB_STEP_SUMMARY)")
    return ap.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    courses, courses_report = validate_courses()
    reports = [courses_report]

    if args.template:
        path = Path(args.template).resolve()
        if not path.is_dir():
            sys.exit(f"no template at {rel(path)}")
        reports.append(validate_template(path, courses, args))
        selection = f"template smoke check ({rel(path)})"
    else:
        targets, selection = select_exercises(args, courses)
        if not targets:
            selection += " — nothing to check"
        for ex_dir in targets:
            if not ex_dir.is_dir():
                continue
            reports.append(validate_exercise(ex_dir, courses, args))

    counts = {
        "targets": len([r for r in reports if r.kind != "courses"]),
        "errors": sum(r.count(ERROR) for r in reports),
        "warnings": sum(r.count(WARN) for r in reports),
        "smells": sum(r.count(SMELL) for r in reports),
    }

    print_text(reports, counts, selection)
    annotate(reports)

    if args.summary:
        with open(args.summary, "a", encoding="utf-8") as fh:
            fh.write(markdown(reports, counts, selection) + "\n")
    if args.json_out:
        payload = {
            "version": 1,
            "ok": counts["errors"] == 0,
            "selection": selection,
            "counts": counts,
            "targets": [asdict(r) for r in reports],
        }
        Path(args.json_out).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    if counts["errors"]:
        return 1
    if args.strict and counts["warnings"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
