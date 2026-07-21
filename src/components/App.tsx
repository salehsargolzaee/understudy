import { useEffect, useMemo, useState } from "react";
import { exercises, getExercise } from "../content";
import { loadPassed } from "../lib/storage";
import { warmPyodide } from "../runner";
import ExercisePicker from "./ExercisePicker";
import ExerciseWorkspace from "./ExerciseWorkspace";

const HASH = "#/e/";
const readHash = () =>
  location.hash.startsWith(HASH) ? decodeURIComponent(location.hash.slice(HASH.length)) : null;

export default function App() {
  const [id, setId] = useState<string | null>(() => readHash() ?? exercises[0]?.meta.id ?? null);
  const [passed, setPassed] = useState(() => loadPassed());

  useEffect(() => {
    const on = () => setId(readHash() ?? exercises[0]?.meta.id ?? null);
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);

  useEffect(() => {
    if (id) location.hash = `${HASH}${encodeURIComponent(id)}`;
  }, [id]);

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-ink-950">
      <ExercisePicker exercises={exercises} currentId={exercise?.meta.id ?? null} passed={passed} onSelect={setId} />
      {exercise ? (
        <ExerciseWorkspace key={exercise.meta.id} exercise={exercise} onPass={() => setPassed(loadPassed())} />
      ) : (
        <div className="grid flex-1 place-items-center text-sm text-ink-500">Exercise not found.</div>
      )}
    </div>
  );
}
