# Exercise content format

Each exercise is a folder under `content/<id>/`:

```
content/<id>/
  meta.yml          # metadata (see below)
  exercise.md       # the problem statement (markdown; may include LaTeX + tables)
  starter.py        # the code the editor is pre-filled with
  solution.py       # reference solution (NOT shown to the learner)
  tests/            # pytest files; they import the learner's code as `submission`
    test_*.py
  data/             # optional datasets (e.g. .csv) the exercise ships with
```

## `meta.yml`

```yaml
id: warmup                     # stable slug = identity
author: salehsargolzaee        # GitHub handle
video_id: dQw4w9WgXcQ          # YouTube id (a replaceable pointer)
start: 0                       # seconds into the video the concept appears
concept: "Short human label"
tags: [python, placeholder]
playlist: "ORIE 5355 — People, Data, and Systems"
runtime: pyodide               # pyodide (in-browser) | modal (server, later)
packages: []                   # extra Python packages the tests need, e.g. [pandas]
```

## Conventions

- The learner's editor starts from `starter.py`. When they run, their current
  editor code is made importable as the module **`submission`**, and pytest runs
  everything under `tests/`.
- Invariant (checked in CI, not in the app): `starter.py` must make the tests
  **fail**, and `solution.py` must make them **pass**.
- `id` is identity. `video_id`/`start` are pointers — if the video moves, they
  change but the exercise keeps its id and history.
