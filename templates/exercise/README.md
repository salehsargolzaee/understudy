# Exercise template

Copy this folder into `content/` and rename it to your exercise's id:

```sh
cp -r templates/exercise content/moving-average
```

Then edit the files in place. Every file explains its own conventions in
comments. The field reference is `content/SCHEMA.md`; the whole path from here to
a merged pull request is `CONTRIBUTING.md`.

Two notes about this folder:

- It is not catalog content. The app only loads `content/*/`, so nothing here
  appears as an exercise, and the pull-request check never validates it as one.
- The example is a real, working exercise — central-difference derivatives,
  pointed at a lecture that is in the catalog. Run
  `python tools/validate_exercises.py --template` and it passes. That is
  deliberate: the scaffold you copy is known to be in working order, so if your
  copy fails the check, the problem is in your edits.

There is no `data/` folder here. Add one only if your brief hands the learner
files; CSVs are rendered as a table beside the brief and mounted at
`data/<name>` when the tests run.
