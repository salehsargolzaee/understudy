/*
 * Pyodide runner, classic Web Worker.
 *
 * Loaded with `new Worker('/pyodide.worker.js')` (no { type: 'module' }), so it
 * is a classic worker and `importScripts` is available. Do not convert this to
 * an ES module worker: importScripts throws in module workers.
 *
 * Responsibilities: boot Pyodide + pytest once, then per run reset the imported
 * modules, mount the submission/tests/data, run pytest via a result-collector
 * plugin, and post structured events back to the main thread.
 */

const PYODIDE_VERSION = "0.26.4";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

importScripts(`${INDEX_URL}pyodide.js`);

let pyodidePromise = null;
const installed = new Set();

const post = (msg) => self.postMessage(msg);

// pytest plugin: collect per-test outcome + longrepr into structured JSON,
// so the UI gets a real test list instead of a wall of stdout.
const HARNESS = String.raw`
import io, json, os, sys, time

def _run(test_dir):
    import pytest

    class Collector:
        def __init__(self):
            self.results = {}
            self.order = []

        def pytest_runtest_logreport(self, report):
            nid = report.nodeid
            if nid not in self.results:
                self.order.append(nid)
                self.results[nid] = {
                    "id": nid, "status": "passed", "durationMs": 0.0,
                    "detail": None, "output": "",
                }
            entry = self.results[nid]
            entry["durationMs"] += report.duration * 1000.0

            captured = "".join(section[1] for section in report.sections if section[1])
            if captured:
                entry["output"] = (entry["output"] + captured)[-8000:]

            if report.outcome == "failed":
                entry["status"] = "error" if report.when != "call" else "failed"
                entry["detail"] = str(report.longrepr)[:20000]
            elif report.outcome == "skipped" and entry["status"] == "passed":
                entry["status"] = "skipped"
                if report.longrepr:
                    entry["detail"] = str(report.longrepr)[:4000]

    collector = Collector()
    buf = io.StringIO()
    started = time.time()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = buf
    try:
        pytest.main(["-p", "no:cacheprovider", "-q", "--no-header", "-rN", test_dir],
                    plugins=[collector])
    finally:
        sys.stdout, sys.stderr = old_out, old_err

    tests = []
    for nid in collector.order:
        entry = collector.results[nid]
        rel = nid.split("::")[0]
        tests.append({
            "id": nid,
            "file": os.path.basename(rel),
            "name": nid.split("::", 1)[1] if "::" in nid else nid,
            "status": entry["status"],
            "durationMs": round(entry["durationMs"], 1),
            "detail": entry["detail"],
            "output": entry["output"] or None,
        })

    passed = sum(1 for t in tests if t["status"] == "passed")
    failed = sum(1 for t in tests if t["status"] in ("failed", "error"))
    return json.dumps({
        "tests": tests,
        "summary": {
            "passed": passed, "failed": failed, "total": len(tests),
            "ok": failed == 0 and len(tests) > 0,
            "durationMs": round((time.time() - started) * 1000.0, 1),
        },
        "output": buf.getvalue()[-20000:],
    })
`;

// Run the submission as a plain file — the author's "just run it" loop.
const SCRIPT = String.raw`
import io, json, sys, time, traceback, runpy

def _run_script():
    buf = io.StringIO()
    started = time.time()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = buf
    err = None
    try:
        runpy.run_path("submission.py", run_name="__main__")
    except SystemExit:
        pass
    except BaseException:
        err = traceback.format_exc()
    finally:
        sys.stdout, sys.stderr = old_out, old_err
    return json.dumps({
        "output": buf.getvalue()[-20000:],
        "error": err,
        "durationMs": round((time.time() - started) * 1000.0, 1),
    })
`;

// Reset + mount. Runs before every test run so an edit is actually picked up:
// pop the submission and test_* modules, then rewrite the workspace on disk.
const MOUNT = String.raw`
import os, json, shutil, sys, importlib
shutil.rmtree(_root, ignore_errors=True)
for _m in [m for m in list(sys.modules) if m == "submission" or m.startswith("test_")]:
    sys.modules.pop(_m, None)
importlib.invalidate_caches()
os.makedirs(_root + "/tests", exist_ok=True)
os.makedirs(_root + "/data", exist_ok=True)
open(_root + "/submission.py", "w").write(_sub)
for _n, _c in json.loads(_tests_json).items():
    open(_root + "/tests/" + _n, "w").write(_c)
for _n, _c in json.loads(_data_json).items():
    open(_root + "/data/" + _n, "w").write(_c)
os.chdir(_root)
if _root not in sys.path:
    sys.path.insert(0, _root)
`;

async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const py = await loadPyodide({
        indexURL: INDEX_URL,
        stdout: (text) => post({ type: "stdout", text }),
        stderr: (text) => post({ type: "stderr", text }),
      });
      await py.loadPackage("micropip");
      const micropip = py.pyimport("micropip");
      await micropip.install("pytest");
      installed.add("pytest");
      py.runPython(HARNESS);
      py.runPython(SCRIPT);
      return py;
    })();
  }
  return pyodidePromise;
}

async function ensurePackages(py, packages) {
  const wanted = (packages || []).filter((p) => !installed.has(p));
  if (!wanted.length) return;
  post({ type: "status", phase: "installing", message: `Installing ${wanted.join(", ")}…` });
  await py.loadPackage(wanted);
  wanted.forEach((p) => installed.add(p));
}

function mount(py, req) {
  py.globals.set("_root", `/work/${req.exerciseId}`);
  py.globals.set("_sub", req.submission);
  py.globals.set("_tests_json", JSON.stringify(req.tests || {}));
  py.globals.set("_data_json", JSON.stringify(req.data || {}));
  py.runPython(MOUNT);
}

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === "warm") {
    try {
      await getPyodide();
      post({ type: "ready" });
    } catch (err) {
      post({ type: "crash", message: String((err && err.message) || err) });
    }
    return;
  }

  if (msg.type !== "run") return;
  const req = msg.req;
  try {
    post({ type: "status", phase: "booting", message: "Starting Python…" });
    const py = await getPyodide();
    await ensurePackages(py, req.packages);

    if (req.mode === "script") {
      post({ type: "status", phase: "running", message: "Running your file…" });
      mount(py, req);
      const parsed = JSON.parse(py.runPython("_run_script()"));
      if (parsed.error) {
        post({
          type: "crash",
          message: "The file raised an exception.",
          traceback: (parsed.output ? parsed.output + "\n" : "") + parsed.error,
        });
        return;
      }
      post({
        type: "result",
        tests: [],
        summary: { passed: 0, failed: 0, total: 0, ok: true, durationMs: parsed.durationMs },
        output: parsed.output,
      });
      return;
    }

    post({ type: "status", phase: "running", message: "Running tests…" });
    mount(py, req);
    const parsed = JSON.parse(py.runPython('_run("tests")'));

    if (parsed.summary.total === 0) {
      post({
        type: "crash",
        message: "No tests ran. Your code probably failed to import.",
        traceback: parsed.output,
      });
      return;
    }
    post({ type: "result", tests: parsed.tests, summary: parsed.summary, output: parsed.output });
  } catch (err) {
    const message = (err && err.message ? String(err.message) : String(err)).split("\n")[0];
    post({ type: "crash", message, traceback: String((err && err.message) || err) });
  }
};
