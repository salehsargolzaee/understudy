import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { exercises, getExercise } from "../content";
import { loadPassed } from "../lib/storage";
import { exerciseHash, exploreHome, parseContributeRoute, parseExplore, parseVideoRoute, safeDecode } from "../lib/routes";
import type { ExploreView } from "../lib/routes";
import { warmPyodide } from "../runner";
import ExercisePicker from "./ExercisePicker";
import ExerciseWorkspace from "./ExerciseWorkspace";
import ExplorePage from "./ExplorePage";
import ProfilePage from "./ProfilePage";
import VideoPage from "./VideoPage";
import LandingPage from "./LandingPage";
import ContributePage from "./ContributePage";
import { completeOAuth } from "../lib/auth";

/**
 * Four route families: explore (#/x…, also the default for an empty hash), a
 * lecture (#/v/<videoId>[/t/<sec>] — the front door for pasted links), an
 * exercise workspace (#/e/<id>), and a contributor profile (#/u/<handle>).
 */
type Route =
  | { kind: "landing" }
  | { kind: "explore"; view: ExploreView }
  | { kind: "video"; id: string; start: number | null }
  | { kind: "exercise"; id: string }
  | { kind: "profile"; handle: string }
  | { kind: "contribute"; videoId: string | null; start: number | null };

const parseHash = (): Route => {
  const h = location.hash;
  if (!h || h === "#" || h === "#/") return { kind: "landing" };
  if (h.startsWith("#/u/")) return { kind: "profile", handle: safeDecode(h.slice(4)) };
  if (h.startsWith("#/e/")) return { kind: "exercise", id: safeDecode(h.slice(4)) };
  if (h.startsWith("#/new")) {
    const c = parseContributeRoute(h.slice(5));
    return { kind: "contribute", videoId: c.videoId, start: c.start };
  }
  if (h.startsWith("#/v/")) {
    const v = parseVideoRoute(h.slice(4));
    if (v) return { kind: "video", id: v.id, start: v.start };
  }
  if (h.startsWith("#/x")) return { kind: "explore", view: parseExplore(h.slice(3)) };
  return { kind: "landing" };
};

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  // the last-visited exercise survives detours to explore/lectures/profiles, so
  // "Workspace →" and "← Back" return exactly where the reader left off
  const [lastExerciseId, setLastExerciseId] = useState<string | null>(() => {
    const r = parseHash();
    return r.kind === "exercise" ? r.id : null;
  });
  const [passed, setPassed] = useState(() => loadPassed());

  useEffect(() => {
    const apply = () => {
      const r = parseHash();
      setRoute(r);
      if (r.kind === "exercise") setLastExerciseId(r.id);
    };
    // route changes ride a view transition where the browser has one; the
    // flushSync makes React commit inside the capture window
    const on = () => {
      const dvt = document as Document & { startViewTransition?: (cb: () => void) => void };
      if (dvt.startViewTransition) dvt.startViewTransition(() => flushSync(apply));
      else apply();
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    // A first-time visitor must not pay for a ~10 MB Python runtime they did
    // not ask for: the landing page warms the runner only on intent.
    if (route.kind !== "landing") warmPyodide();
  }, [route.kind]);

  useEffect(() => {
    void completeOAuth(); // finishes a GitHub sign-in redirect, if one is pending
  }, []);

  if (route.kind === "landing") return <LandingPage />;

  // A pasted link has to work even before any content exists, so the lecture
  // route is checked before the empty-catalog guard.
  if (route.kind === "video") {
    return (
      <VideoPage
        key={`${route.id}:${route.start ?? 0}`}
        videoId={route.id}
        start={route.start}
        workspaceHref={lastExerciseId ? exerciseHash(lastExerciseId) : null}
      />
    );
  }

  if (route.kind === "contribute") {
    return <ContributePage key={route.videoId ?? "pick"} videoId={route.videoId} start={route.start} />;
  }

  if (!exercises.length) {
    return (
      <div className="grid h-full place-items-center bg-ink-950 p-8 text-center text-sm text-ink-500">
        No exercises found in content/.
      </div>
    );
  }

  if (route.kind === "profile") {
    return (
      <ProfilePage
        handle={route.handle}
        backHref={lastExerciseId ? exerciseHash(lastExerciseId) : exploreHome}
      />
    );
  }

  if (route.kind === "explore") {
    const target = lastExerciseId ?? exercises[0]?.meta.id;
    return <ExplorePage view={route.view} workspaceHref={target ? exerciseHash(target) : null} />;
  }

  const exercise = getExercise(route.id);
  // the top-rail picker is scoped to the lecture being worked, in video order;
  // the whole catalog lives in Explore
  const lectureExercises = exercise
    ? exercises
        .filter((e) => e.meta.video_id === exercise.meta.video_id)
        .sort((a, b) => a.meta.start - b.meta.start)
    : exercises;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ExercisePicker
        exercises={lectureExercises}
        currentId={exercise?.meta.id ?? null}
        passed={passed}
        onSelect={(id) => (location.hash = exerciseHash(id))}
      />
      {exercise ? (
        <ExerciseWorkspace key={exercise.meta.id} exercise={exercise} onPass={() => setPassed(loadPassed())} />
      ) : (
        <div className="grid flex-1 place-items-center text-sm text-ink-500">
          <div className="text-center">
            <p>Exercise not found.</p>
            <a href={exploreHome} className="mt-2 inline-block text-verd underline underline-offset-2">
              Browse the catalog
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
