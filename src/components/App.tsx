import { useEffect, useState } from "react";
import { exercises, getExercise } from "../content";
import { loadPassed } from "../lib/storage";
import { exerciseHash, exploreHome, parseExplore, safeDecode } from "../lib/routes";
import type { ExploreView } from "../lib/routes";
import { warmPyodide } from "../runner";
import ExercisePicker from "./ExercisePicker";
import ExerciseWorkspace from "./ExerciseWorkspace";
import ExplorePage from "./ExplorePage";
import ProfilePage from "./ProfilePage";
/**
 * Three route families: explore (#/x…, also the default for an empty hash),
 * an exercise workspace (#/e/<id>), and a contributor profile (#/u/<handle>).
 */
type Route =
  | { kind: "explore"; view: ExploreView }
  | { kind: "exercise"; id: string }
  | { kind: "profile"; handle: string };
const parseHash = (): Route => {
  const h = location.hash;
  if (h.startsWith("#/u/")) return { kind: "profile", handle: safeDecode(h.slice(4)) };
  if (h.startsWith("#/e/")) return { kind: "exercise", id: safeDecode(h.slice(4)) };
  if (h.startsWith("#/x")) return { kind: "explore", view: parseExplore(h.slice(3)) };
  return { kind: "explore", view: { type: "home" } };
};
export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  // the last-visited exercise survives detours to explore/profiles, so
  // "Workspace →" and "← Back" return exactly where the reader left off
  const [lastExerciseId, setLastExerciseId] = useState<string | null>(() => {
    const r = parseHash();
    return r.kind === "exercise" ? r.id : null;
  });
  const [passed, setPassed] = useState(() => loadPassed());
  useEffect(() => {
    const on = () => {
      const r = parseHash();
      setRoute(r);
      if (r.kind === "exercise") setLastExerciseId(r.id);
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    warmPyodide();
  }, []);
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
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ExercisePicker
        exercises={exercises}
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
