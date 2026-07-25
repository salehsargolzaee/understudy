# Reviewing an exercise

The check on the pull request decides whether an exercise is *sound*. You decide
whether it is *worth doing*. Those are different jobs and this page is only about
the second one.

Budget: ten minutes. If a review is taking longer than that, the exercise is
probably not ready and a short comment is more useful than a long review.

## What the check already proved

Do not re-verify any of this by hand:

- all five pieces exist, and the metadata is complete and well typed
- the folder name and the `id` agree, and the course resolves to a real file
- the tests **fail** against `starter.py` and **pass** against `solution.py`
- the declared packages install
- the lecture the exercise points at has its real name on file, verified against
  YouTube (a mismatch is reported as a warning, for you)
- the code does no networking and starts no processes

If the check is green, you can merge on a skim of the four questions below.

## The four questions

### 1. Does it fit where it claims to sit?

Open the lecture at `start` and watch a minute.

Accept when the exercise practises the idea being explained there, with the
vocabulary the lecture has already introduced.

Push back when it needs a concept from later in the course, when it is a generic
Python drill with no connection to the lecture, or when `start` points at the
introduction rather than the moment the idea lands. `start` being off by a minute
is a one-line comment, not a rejection.

### 2. Is the difficulty honest for this course's level?

Check the course's `level`, then ask what a learner who has watched up to this
timestamp can do.

**A simple exercise is not a defect.** A beginner course should contain exercises
that take two minutes. What you are looking for is a mismatch in either
direction: an exercise that can be passed without understanding anything from
the lecture, or one that silently requires an algorithm the course has not
reached.

If the check reported a `smell` — few tests, a thin brief, tests that only echo
the worked example — that is where to look first. It is a hint, never a verdict.

### 3. Do the tests teach?

Read the test file as if you were the learner who just failed it.

Accept when the suite would catch a plausible wrong answer: an off-by-one, a
wrong order, a mutation of the input, an empty input, a single element, a
negative number, a duplicate key — whatever is the real trap in this task. The
failure messages should point somewhere.

Push back when the suite is the brief's example restated, when it accepts
anything that returns the right type, when it depends on dictionary ordering,
wall-clock time, randomness without a seed, or floating point equality, or when
it tests a private helper rather than the behaviour the brief describes.

### 4. Can a learner act on the statement?

Read only `exercise.md`. You should know the function name, the shape of the
inputs, what to return, and what the edge cases are.

Push back when the brief needs the test file to be comprehensible, when it
describes the solution step by step (that is the lecture's job), when provided
data is not described, or when the prose is long enough to hide the task.

## Also worth a glance

- `concept` is what appears in menus and cards. It should read as a phrase, not
  a file name.
- `concepts` are the catalog's facets. Reusing an existing slug is almost always
  better than coining a near-duplicate.
- Duplicates: if an exercise at the same timestamp already practises the same
  idea, say so and ask which one should stand.
- `author` should be the contributor's own handle — it is how credit shows up on
  their profile page.

## Deciding

**Merge** when all four questions are yes and the check is green. Small wording
fixes are faster to push yourself than to ask for, if the contributor has left
edits enabled.

**Request changes** with one concrete ask per point. "Add a test for an empty
list" beats "tests are weak".

**Decline** rarely, and say which of the four questions failed and why. An
exercise that cannot be placed in any lecture is the usual case.

Suggested phrasings:

> The idea here is good, but `start: 240` is the recap — the lecture reaches this
> at about 11:20. Move the timestamp and I will merge.

> The tests pass on anything that returns a list of the right length. Add a case
> where the answer is not sorted and one with duplicates.

> This is a fine exercise for lecture 4, not lecture 1 — it needs the chain rule,
> which has not been introduced yet.

Never decline for being too easy. Decline for being in the wrong place, for
testing nothing, or for being unreadable.
