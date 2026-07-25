# Exercise content format

Content is plain files on disk. The site is built statically from this folder;
there is no database and no admin interface. Everything here is the contract the
pull-request check enforces (`tools/validate_exercises.py`) and the contract any
future in-app authoring flow has to produce.

```
content/
  SCHEMA.md                 this file
  courses/<course-id>.yml    one file per course
  <exercise-id>/             one folder per exercise
    meta.yml
    exercise.md
    starter.py
    solution.py
    tests/test_*.py
    data/                    optional
```

Anything else directly under `content/` is ignored by the app and flagged by the
check. The copy-me scaffold lives outside this folder, in
`templates/exercise/`, so it never appears in the catalog and is never validated
as an exercise.

## Exercise folder

### Naming

The folder name **is** the exercise id, and `meta.yml`'s `id` must repeat it
exactly. Lowercase letters, digits and hyphens, 2–49 characters. The id appears
in URLs (`#/e/<id>`) and in saved progress, so renaming it later breaks links and
loses a learner's work.

### `meta.yml`

Required:

| field | type | meaning |
| --- | --- | --- |
| `id` | string | equal to the folder name |
| `author` | string | the author's GitHub handle; drives the avatar and the contributor profile |
| `course` | string | a file under `content/courses/`, without the extension |
| `video_id` | string | the 11-character YouTube id, not a URL |
| `video_title` | string | the lecture's exact name — see *The naming rule* |
| `start` | integer | whole seconds into the lecture where this is taught |
| `concept` | string | one line; the display name in menus, cards and lists |
| `concepts` | list of slugs | the catalog's facets; lowercase-hyphenated, at least one |
| `runtime` | `pyodide` \| `modal` | where the tests run |
| `packages` | list of strings | extra PyPI packages; `[]` when none |

Optional:

| field | type | meaning |
| --- | --- | --- |
| `tags` | list of strings | free-form labels, shown beside the brief |
| `field` | string | overrides the course's field for this exercise |
| `level` | string | overrides the course's level; usually `high-school`, `undergraduate`, `graduate`, `professional` |
| `demo` | boolean | marks a placeholder or demonstration exercise |
| `playlist` | string | legacy human-readable playlist name; `course` replaces it |

Example:

```yaml
id: moving-average
author: your-github-handle
course: nn-zero-to-hero
video_id: V Mj-3S1tku0      # no spaces; 11 characters
video_title: "The spelled-out intro to neural networks and backpropagation: building micrograd"
start: 1387
concept: "Moving average over a list"
concepts: [sliding-window, lists]
tags: [python, arrays]
runtime: pyodide
packages: []
level: undergraduate
```

### The naming rule

Any video an exercise references must end up with the lecture's name on file.
Nameless ids make the catalog unreadable and unsearchable, so the name travels
with the pointer:

- `video_title` in `meta.yml` carries it, and
- the course's `lectures:` entry carries it too when the course lists that
  lecture. The course file wins where both exist.

You are not expected to type it. The name of a video is knowable from the video:

- if `video_title` is missing, the check fetches the real title and hands you the
  exact line to paste. `python tools/validate_exercises.py --fix` writes it in.
- if `video_title` is present but differs from the real title, the check flags
  the difference for the reviewer and changes nothing. One of the two is right
  and that is a judgement, not a guess.
- if YouTube does not know the id at all, that is an error: the exercise points
  at something a learner cannot watch.

### `exercise.md`

The brief. Markdown, with GitHub tables, fenced code, and `$…$` / `$$…$$` maths.
The first heading is the exercise's title in the reading pane.

State what to implement, the shape of the inputs, what to return, and the edge
cases. Do not narrate the algorithm — the lecture does that. A learner should be
able to finish from the brief alone, without opening the tests.

### `starter.py`

What the learner opens. It must import cleanly and define every name the tests
import, with the work left undone:

```python
def moving_average(xs, window):
    """Return the list of averages of each `window`-length slice of xs."""
    raise NotImplementedError
```

A starter that cannot be imported means pytest collects nothing and the learner
sees "No tests ran" instead of a failing suite. The check rejects that.

### `solution.py`

The reference answer, and the thing the check runs the suite against. It is
**never** bundled for the browser: `src/content/index.ts` deliberately has no
glob for `solution.py`. Write it the way you would want a learner to write it.

### `tests/`

`pytest` files named `test_*.py`. They import the learner's code as
`submission`:

```python
from submission import moving_average
```

At run time the workspace looks like this, in the browser and on CI alike:

```
submission.py      the learner's editor buffer (or starter.py / solution.py)
tests/…            your test files
data/…             your data files
```

The working directory is the workspace root, so read data as `data/points.csv`.

Tests must never import `solution`. Keep them deterministic: no wall-clock
timing, no unseeded randomness, no reliance on dict ordering, `pytest.approx`
for floats. Keep them quick — Pyodide is several times slower than CPython.

### `data/` (optional)

Files handed to the learner. CSVs are rendered as a table beside the brief;
every file in the folder is mounted for the tests. Keep them small: they are
bundled into the site and into every test run.

## Two invariants the check enforces

1. The suite **fails** against `starter.py`. An exercise that ships solved has
   nothing for a learner to do.
2. The suite **passes** against `solution.py`. A suite its own author's answer
   cannot satisfy is broken.

Both runs happen inside a virtualenv built from the exercise's declared
`packages`.

Exercise code does pure computation: no network, no subprocesses, no host
access. Pyodide cannot do any of it, and CI runs contributed code, so the check
refuses it.

## Runtimes

`runtime: pyodide` runs the tests in the learner's browser. This is the default
and what everything is tuned for.

`runtime: modal` is reserved for exercises that need a real server (heavy
frameworks, multiple processes). The server runner is not built yet: such an
exercise loads but cannot run, so it will not be merged without prior
discussion.

## Course files

`content/courses/<id>.yml`, where the file name is the course id.

| field | required | meaning |
| --- | --- | --- |
| `id` | yes | equal to the file name |
| `name` | yes | display name |
| `platform` | yes | `youtube` today |
| `playlist_url` | yes | the playlist; `playlist_id` is derived from it when omitted |
| `playlist_id` | no | set it explicitly to make pasted playlist links resolve faster |
| `field` | yes | subject facet, e.g. `CS / Algorithms` |
| `level` | yes | `high-school`, `undergraduate`, `graduate`, `professional` |
| `institution`, `creator` | recommended | shown on cards |
| `lectures` | no | ordered table of contents |

```yaml
lectures:
  - id: VMj-3S1tku0
    title: "The spelled-out intro to neural networks and backpropagation: building micrograd"
```

Every listed lecture needs both an `id` and a `title`. Listing a lecture is how
it appears in the catalog, numbered, before anybody has written practice for it.
A course without a `lectures:` list is also valid — then lecture names arrive
with the exercises.
```

---

## 7. `templates/exercise/`
