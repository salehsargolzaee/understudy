## What this adds

<!-- One or two sentences. Which lecture, which minute, what the learner does. -->

- exercise: `content/<id>/`
- lecture: `<video_id>` at `<m:ss>`
- course: `content/courses/<course-id>.yml`

## Contributor checklist

The check on this pull request already runs your tests against your starter and
your solution, reads your metadata, and verifies the lecture's name against
YouTube. Don't repeat that work here. These are the things it cannot see:

- [ ] The timestamp in `start` is the minute where the lecture actually teaches this, not the start of the video.
- [ ] The brief says what to implement, what the inputs look like, and what counts as correct — without giving away the answer.
- [ ] The tests check more than the example in the brief: an edge case, an empty input, a different shape.
- [ ] `solution.py` is how you would want a learner to write it, not a golfed version.
- [ ] `author` is my own GitHub handle.
- [ ] I ran `python tools/validate_exercises.py content/<my-exercise>` locally and it passed.

## Anything the reviewer should know

<!-- Choices you made, things you were unsure about, a difficulty you argue for. -->

---

<!-- Reviewer section: leave it in place. The full rubric is docs/REVIEWING.md. -->

## Reviewer pass

Pedagogy is a human call: the check surfaces hints but never rejects on them.
A simple exercise in a beginner course is correct, not deficient.

- [ ] **Fit** — I watched ~60 seconds from `start`. The exercise practises what is being taught there.
- [ ] **Difficulty** — honest for the course's level. Simple is fine in a beginner course; unexplained leaps are not.
- [ ] **Tests teach** — the suite would catch a plausible wrong solution, not just reproduce the worked example.
- [ ] **Statement** — I could do this exercise from the brief alone, without reading the tests or the solution.
- [ ] **Solution** — readable, and it is the answer the brief implies.
- [ ] **Catalog** — `concept` reads well in a list; `concepts` reuse existing slugs where they exist.
- [ ] Smells reported by the check were looked at and either accepted or raised.
