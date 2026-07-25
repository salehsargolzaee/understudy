# Contributing an exercise

understudy turns lectures into practice. A lecture explains something; an
exercise asks you to write it, at the minute it was explained, and checks your
answer in the browser.

One exercise is one folder of plain files. There is no database, no CMS and no
build step for content: if your folder is correct, the site picks it up. This
page walks the whole path from nothing to a merged pull request. It assumes you
know Python and git, and nothing about this project.

## What you will produce

```
content/<your-exercise-id>/
  meta.yml        which lecture, which second, who wrote it, what it teaches
  exercise.md     the brief the learner reads
  starter.py      what the learner starts from — unimplemented
  solution.py     the reference answer; never shipped to the browser
  tests/
    test_*.py     pytest tests, importing the learner's code as `submission`
  data/           optional CSVs the brief hands the learner
```

`content/SCHEMA.md` is the field-by-field reference. `templates/exercise/` is a
working copy of all of the above with the conventions explained in place.

## 1. Pick a lecture and a minute

Open the app, find the lecture, and note two things: the video id and the second
where the idea you want to drill is taught.

On a lecture page with no practice yet, the page prints the exact metadata lines
for you — the video id, the lecture's real name, the second you are paused at,
and the course id. Copy them; that is half of `meta.yml` done.

Lectures that already have practice are still fair game: a second exercise at a
different minute, or a harder one at the same minute, is welcome.

If the course itself is not in the catalog, see *Adding a course* below.

## 2. Fork, clone, branch

```sh
git clone https://github.com/<you>/understudy
cd understudy
git checkout -b exercise/<short-name>
```

To run the app while you work:

```sh
npm install
npm run dev
```

The dev server reads `content/` from disk, so your exercise appears as you write
it. The first test run in the browser downloads the Python runtime — 10 to 20
seconds, once.

## 3. Copy the template

```sh
cp -r templates/exercise content/moving-average
```

The folder name is the exercise's id. Lowercase letters, digits and hyphens;
short and descriptive (`moving-average`, `softmax-from-scratch`). It appears in
URLs, so it is awkward to change later. `meta.yml`'s `id` must be the same
string as the folder name.

`templates/` is not part of the catalog: the app never loads it and the content
check never validates it as an exercise. Copy from it, do not edit in place.

## 4. Fill in `meta.yml`

Full reference in `content/SCHEMA.md`. The parts people get wrong:

- **`start`** is whole seconds, and should be where the idea is *taught*, not
  where the lecture begins.
- **`video_title`** is the lecture's name. If you do not know it, leave it empty
  or delete the line: the check supplies the exact value, and
  `python tools/validate_exercises.py --fix` writes it in for you. Never invent
  one — the name has to match the video.
- **`concepts`** are the catalog's facets. Look at what other exercises use and
  reuse a slug rather than coining a near-duplicate.
- **`packages`** is any extra PyPI package your tests or solution import. The
  check installs exactly what you declare, and the browser installs the same
  list at run time. Leave it `[]` if you only need the standard library. Pure
  Python and the scientific stack (numpy, pandas, scipy, sympy, matplotlib,
  scikit-learn) work in the browser; exotic or compiled packages may not, so
  test your exercise in the app before opening the pull request.

## 5. Write the brief

`exercise.md` is markdown. Tables, fenced code and `$…$` / `$$…$$` maths all
render.

Match the brief to what the lecture already did. When the lecture taught the
idea thoroughly, keep the brief lean — restating a half-hour derivation is
noise. When the lecture only *mentions* the idea in passing, the brief is
where the learner actually meets it: open with the idea in plain words, a
small worked example with real numbers, the formula in maths if there is one.
Then pose the implementation as the way to make the idea concrete.

Either way, say what to implement, what the inputs look like, what to return,
and what the edge cases are. Do not describe your solution step by step —
deriving it is the learner's work. A learner should be able to finish the
exercise from the brief alone, without reading your tests.

If you ship CSVs in `data/`, describe the columns. The app shows the data as a
table next to the brief, and the files are mounted at `data/<name>` when the
tests run.

## 6. Starter, solution, tests

**`starter.py`** must import cleanly and define every name the tests import,
with the work left undone:

```python
def moving_average(xs, window):
    """Return the list of averages of each `window`-length slice of xs."""
    raise NotImplementedError
```

If a name the tests import is missing, pytest cannot even collect, and the
learner sees a crash instead of failing tests. The check rejects that.

**`solution.py`** is the reference answer. It is never sent to the browser —
there is deliberately no bundler glob for it. Write it the way you would want a
learner to write it.

**`tests/test_*.py`** import the learner's code as `submission`:

```python
from submission import moving_average
```

Inside the runner, the learner's editor buffer is mounted as `submission.py`,
your test files sit in `tests/`, and the working directory contains `data/`. Use
relative paths like `data/points.csv`.

Write tests that teach. The check enforces that your suite fails on the starter
and passes on your solution; it cannot tell whether your suite would catch a
wrong answer. Cover an edge case, an empty input, a shape that is not the one in
the brief. Avoid anything that makes a test flaky: no wall-clock timing, no
unseeded randomness, no dependence on dict ordering, no bare float equality —
use `pytest.approx`.

Exercise code is pure computation. No network, no subprocesses, no host access.
That is not a style preference: the browser cannot do it and our CI refuses it.

## 7. Run the check locally

```sh
python -m pip install pyyaml
python tools/validate_exercises.py content/moving-average
```

It builds a virtualenv with your declared packages, then runs your tests twice —
once against `starter.py`, expecting failure, once against `solution.py`,
expecting success — and reads your metadata.

Useful flags:

```sh
python tools/validate_exercises.py --fix      # write in a missing video_title
python tools/validate_exercises.py --no-run   # metadata only, instant
python tools/validate_exercises.py --offline  # skip the YouTube lookup
python tools/validate_exercises.py            # everything in content/
```

Three kinds of output:

- **error** — must be fixed; the pull request cannot merge.
- **warning** — something for the reviewer to judge, usually a name that does not
  match the video. Nothing is changed on your behalf.
- **smell** — a hint that something looks thin (two tests, a short brief, tests
  that only re-run the example). Never blocks anything. Simple exercises are
  legitimate; a smell just means a human will look a little closer.

Also run `npm run build` once if you touched anything outside `content/`.

## 8. Open the pull request

```sh
git add content/moving-average
git commit -m "Add moving-average exercise for <lecture>"
git push -u origin exercise/<short-name>
```

Open the pull request and fill in the template. Keep it to one exercise per pull
request unless a set genuinely belongs together.

The same check runs automatically, including on pull requests from forks. It
posts its findings in the run summary and as annotations on your files. The job
has no secrets and a read-only token — it is running your code, so there is
nothing there to take.

## 9. Review

Green checks mean your exercise is mechanically sound. A human then reads it
against the rubric in `docs/REVIEWING.md`: does it fit the lecture at that
timestamp, is the difficulty honest for the course's level, do the tests teach
something, is the statement clear. The rubric is public on purpose — read it
before you write, and you will usually pass it first time.

Expect either a merge or one concrete list of changes. Being asked for an extra
test case is normal and not a judgement on the exercise.

Your handle ends up on the exercise, on a contributor profile page, and on the
lecture and course pages it touches. That is the only reward on offer.

## Adding a course

A course is one file, `content/courses/<id>.yml`:

```yaml
id: nn-zero-to-hero
name: "Neural Networks: Zero to Hero"
institution: "Eureka Labs"
creator: "Andrej Karpathy"
platform: youtube
playlist_url: "https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ"
playlist_id: "PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ"
field: "Deep Learning"
level: undergraduate
lectures:
  - id: VMj-3S1tku0
    title: "The spelled-out intro to neural networks and backpropagation: building micrograd"
```

The `lectures:` list is optional but preferred: it gives the course a table of
contents and lecture numbers, and it lets a lecture appear before anybody has
written practice for it. Every entry needs both an `id` and the lecture's exact
`title`. A course may be added in the same pull request as its first exercise.

## Changing the app

This repo is the platform as well as the content. Code contributions are
welcome, but open an issue first — the app is deliberately small, and the
content format is a contract that other things now depend on.
