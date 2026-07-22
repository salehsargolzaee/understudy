import { useEffect, useMemo, useState } from "react";
import { exercises, getExercise } from "../content";
import { loadPassed } from "../lib/storage";
import { warmPyodide } from "../runner";
import ExercisePicker from "./ExercisePicker";
import ExerciseWorkspace from "./ExerciseWorkspace";
import ProfilePage from "./ProfilePage";
const EX_HASH = "#/e/";
const USER_HASH = "#/u/";
/** Two routes: an exercise (#/e/<id>) and a contributor profile (#/u/<handle>). */
const readRoute = (): { id: string | null; user: string | null } => {
  const h = location.hash;
  if (h.startsWith(USER_HASH)) return { id: null, user: decodeURIComponent(h.slice(USER_HASH.length)) };
  if (h.startsWith(EX_HASH)) return { id: decodeURIComponent(h.slice(EX_HASH.length)), user: null };
  return { id: null, user: null };
};
export default function App() {
  // `id` is the current (or last-visited) exercise; it survives a detour to a
  // profile so "back to exercises" returns where the reader left off.
  const [id, setId] = useState<string | null>(() => readRoute().id ?? exercises[0]?.meta.id ?? null);
  const [user, setUser] = useState<string | null>(() => readRoute().user);
  const [passed, setPassed] = useState(() => loadPassed());
  useEffect(() => {
    const on = () => {
      const r = readRoute();
      setUser(r.user);
      if (!r.user) setId(r.id ?? exercises[0]?.meta.id ?? null);
    };
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    if (!user && id) location.hash = `${EX_HASH}${encodeURIComponent(id)}`;
  }, [id, user]);
  useEffect(() => {
    warmPyodide();
  }, []);
  const exercise = useMemo(() => (id ? getExercise(id) : undefined), [id]);
  if (!exercises.length) {
    return (
      <div className="grid h-full place-items-center bg-ink-950 p-8 text-center text-sm text-ink-500">
        No exercises found in content/.
      </div>
    );
  }
  if (user) {
    const backId = id ?? exercises[0]?.meta.id ?? "";
    return <ProfilePage handle={user} backHref={`${EX_HASH}${encodeURIComponent(backId)}`} />;
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ExercisePicker exercises={exercises} currentId={exercise?.meta.id ?? null} passed={passed} onSelect={setId} />
      {exercise ? (
        <ExerciseWorkspace key={exercise.meta.id} exercise={exercise} onPass={() => setPassed(loadPassed())} />
      ) : (
        <div className="grid flex-1 place-items-center text-sm text-ink-500">Exercise not found.</div>
      )}
    </div>
  );
}
