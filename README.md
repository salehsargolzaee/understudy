# Understudy

**The lectures are free on YouTube. The practice belongs beside them.**

[understudy.community](https://understudy.community) is a catalog of great
lectures with real, runnable exercises beside them — pinned to the second of
the video where the idea is taught, running entirely in your browser, written
by whoever just learned the thing. Contributing an exercise is a pull request
under your own GitHub name: a public, un-fakeable record of learning. Your
profile paints every exercise you have written as a star in your own night
sky — a learning resume at one link.

## How it works

- **Content is plain files.** An exercise is one folder: a markdown brief, a
  starter file, a reference solution, pytest tests, and a small `meta.yml`
  naming the lecture, the second, and the author. A course is one YAML file.
  See [`content/SCHEMA.md`](content/SCHEMA.md).
- **The site is static.** Everything is built from `content/` at build time.
  There is no database and no server-side state; the only server code in the
  repository is one short function that completes a GitHub sign-in for the
  in-app composer.
- **Python runs in the browser.** Tests execute in a Pyodide web worker —
  nothing to install, nothing uploaded, no compute to meter.
- **A gate guards the catalog.** CI runs every exercise's tests twice: they
  must fail against the starter and pass against the solution. It also checks
  metadata, verifies the lecture's real title against YouTube, and refuses
  code that touches the network. Pedagogy stays a human call, made against a
  public rubric: [`docs/REVIEWING.md`](docs/REVIEWING.md).
- **The composer.** You can author an exercise entirely in the app — brief
  with live math preview, editors with a real run loop, the same fail/pass
  proof the CI enforces — and leave with a pull request opened from your own
  fork, without touching git.

## Contributing

Watch a lecture, pause where the idea lands, and write the exercise you wish
had been there. The whole path — in-app or by hand — is in
[`CONTRIBUTING.md`](CONTRIBUTING.md).

## Running locally

```sh
npm install
npm run dev          # the app, reading content/ from disk
python tools/validate_exercises.py   # the same checks CI runs
```

## Made by

[Saleh Sargolzaei](https://understudy.community/#/u/salehsargolzaee) —
[GitHub](https://github.com/salehsargolzaee) ·
[LinkedIn](https://www.linkedin.com/in/saleh-sargolzaee/). A course you want
practice for, an idea, a problem: open an issue or reach out.

## License

[AGPL-3.0](LICENSE). The code is free to use, study, and build on; anything built on it must stay open the same way. © 2026 Saleh Sargolzaei.
