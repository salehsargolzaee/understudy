# In-app authoring: operator notes

The flow at `#/new` writes the same five files the repo contract demands and
opens a real PR from the contributor's own fork. Nothing is stored server-side.

## One-time setup

1. Create a GitHub **OAuth App**. Callback URL: `https://<your-domain>/`
   (and a second app with `http://localhost:3000/` for `vercel dev`).
2. Vercel env:
   - `VITE_GITHUB_CLIENT_ID` — build-time, lands in the bundle (public by design).
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — runtime, read only by
     `api/github-oauth.ts`. Never referenced from `src/`.
3. Local dev: `npm run dev` works without auth (the flow says sign-in is not
   configured and the files remain copyable). `vercel dev` runs the function.

## What the browser verifies before a PR can open

Everything `tools/validate_exercises.py` checks that does not need a Python
toolchain: structure, metadata shape, id/slug rules, sandbox import rules,
tests-import-`submission`, starter ≠ solution, package specs, course
resolution — plus the two invariants, run live in the learners' Pyodide
runner: tests fail on the starter, pass on the solution. CI re-verifies all
of it independently; the browser gate exists so CI never bounces a PR for a
reason the browser could have caught. The one thing the browser may not be
able to verify is the lecture's exact title (oEmbed can be blocked); the flow
then asks for it explicitly and says why.
