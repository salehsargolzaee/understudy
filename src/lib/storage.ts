const KEY = "practice.v1";

interface Store {
  code: Record<string, string>;
  passed: Record<string, { at: number }>;
}

const empty: Store = { code: {}, passed: {} };

function read(): Store {
  try {
    return { ...empty, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store) };
  } catch {
    return empty;
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* quota or private mode: ignore */
  }
}

export const loadCode = (id: string): string | null => read().code[id] ?? null;

export function saveCode(id: string, code: string) {
  const s = read();
  s.code[id] = code;
  write(s);
}

export function clearCode(id: string) {
  const s = read();
  delete s.code[id];
  write(s);
}

export function markPassed(id: string) {
  const s = read();
  s.passed[id] = { at: Date.now() };
  write(s);
}

export const loadPassed = (): Record<string, { at: number }> => read().passed;
