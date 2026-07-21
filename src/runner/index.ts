import type { Runtime } from "../content/types";
import { ModalRunner } from "./modalRunner";
import { PyodideRunner } from "./pyodideRunner";
import type { Runner } from "./types";

const singletons = new Map<Runtime, Runner>();

/** The single place that maps a runtime to a transport. */
export function pickRunner(runtime: Runtime): Runner {
  if (!singletons.has(runtime)) {
    singletons.set(runtime, runtime === "modal" ? new ModalRunner() : new PyodideRunner());
  }
  return singletons.get(runtime)!;
}

export function warmPyodide() {
  const r = pickRunner("pyodide");
  if (r instanceof PyodideRunner) r.warm();
}

export * from "./types";
